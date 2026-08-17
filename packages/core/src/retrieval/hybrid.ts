import { Knex } from 'knex';
import { LexicalRetriever, extractKeywords } from './lexical.js';
import { SemanticRetriever } from './semantic.js';
import { MultiSensorFusionRanker, CandidateSignal, FusedCandidate } from './fusion-ranker.js';
import { EmbeddingEngine } from '../embeddings.js';

export interface HybridRetrievalOptions {
  candidatePaths?: string[];
  maxResults?: number;
}

export interface HybridRetrievalResult {
  candidates: FusedCandidate[];
  keywords: string[];
  semanticDegraded: boolean;
}

export class HybridRetriever {
  private lexical: LexicalRetriever;
  private semantic: SemanticRetriever;
  private fusion: MultiSensorFusionRanker;

  constructor(private knex: Knex, private embeddings: EmbeddingEngine) {
    this.lexical = new LexicalRetriever(knex);
    this.semantic = new SemanticRetriever(knex, embeddings);
    this.fusion = new MultiSensorFusionRanker(knex);
  }

  async retrieveCandidates(
    task: string,
    maxResults: number = 10,
    options?: { affectedPaths?: string[] }
  ): Promise<HybridRetrievalResult> {
    const rawKeywords = extractKeywords(task);
    if (rawKeywords.length === 0) {
      return { candidates: [], keywords: [], semanticDegraded: false };
    }

    const signals = new Map<number, CandidateSignal>();
    let semanticDegraded = false;

    const getOrCreateSignal = async (fileId: number): Promise<CandidateSignal | null> => {
      let sig = signals.get(fileId);
      if (!sig) {
        const file = await this.knex('files').where({ id: fileId }).first();
        if (!file) return null;
        sig = {
          fileId: file.id,
          path: file.path,
          summary: file.summary || '',
          stale: !!file.stale,
          lexicalScore: 0,
          semanticSimilarity: 0,
          graphBoost: 0,
          memoryBoost: 0,
          matchedSymbols: [],
          matchedTerms: [],
          graphTraces: []
        };
        signals.set(fileId, sig);
      }
      return sig;
    };

    // ─── 1. Semantic Vector Pass ───
    try {
      const semanticResults = await this.semantic.search(task, maxResults * 2);
      for (const res of semanticResults) {
        const similarity = Math.max(0, 1 - res.distance);
        if (similarity < 0.20) continue;

        const file = await this.knex('files').where({ path: res.path }).first();
        if (file) {
          const sig = await getOrCreateSignal(file.id);
          if (sig) {
            sig.semanticSimilarity = similarity;
          }
        }
      }
    } catch {
      semanticDegraded = true;
    }

    // ─── 2. Lexical & Symbol Pass ───
    const keywordSignificance = await this.lexical.computeKeywordSignificance(rawKeywords);
    for (const kw of rawKeywords) {
      const idf = keywordSignificance.get(kw) || 1.0;

      // Symbol exact/partial matches
      const symbolMatches = await this.knex('symbols')
        .join('files', 'symbols.file_id', 'files.id')
        .where('symbols.name', 'like', `%${kw}%`)
        .select('files.id as file_id', 'symbols.name as symbol_name');

      for (const m of symbolMatches) {
        const sig = await getOrCreateSignal(m.file_id);
        if (sig) {
          sig.lexicalScore += 8.0 * idf;
          if (!sig.matchedSymbols.includes(m.symbol_name)) {
            sig.matchedSymbols.push(m.symbol_name);
          }
          if (!sig.matchedTerms.includes(kw)) {
            sig.matchedTerms.push(kw);
          }
        }
      }

      // Path matches
      const pathMatches = await this.knex('files').where('path', 'like', `%${kw}%`).select('id', 'path');
      for (const p of pathMatches) {
        const sig = await getOrCreateSignal(p.id);
        if (sig) {
          sig.lexicalScore += 10.0 * idf;
          if (!sig.matchedTerms.includes(kw)) {
            sig.matchedTerms.push(kw);
          }
        }
      }

      // Summary matches
      const summaryMatches = await this.knex('files').where('summary', 'like', `%${kw}%`).select('id', 'path');
      for (const s of summaryMatches) {
        const sig = await getOrCreateSignal(s.id);
        if (sig) {
          sig.lexicalScore += 2.0 * idf;
          if (!sig.matchedTerms.includes(kw)) {
            sig.matchedTerms.push(kw);
          }
        }
      }
    }

    // ─── 3. Graph Proximity Expansion Pass ───
    const currentTopFileIds = Array.from(signals.keys()).slice(0, 5);
    if (currentTopFileIds.length > 0) {
      // Find files imported by or calling top files
      const connectedEdges = await this.knex('graph_edges')
        .whereIn('source_id', currentTopFileIds)
        .where('source_type', 'file')
        .where('target_type', 'file')
        .select('*');

      for (const edge of connectedEdges) {
        const targetSig = await getOrCreateSignal(edge.target_id);
        if (targetSig) {
          targetSig.graphBoost = Math.max(targetSig.graphBoost, 0.7);
          targetSig.graphTraces.push(`imported_by_${edge.source_id}`);
        }
      }

      // Find files that import top files
      const incomingEdges = await this.knex('graph_edges')
        .whereIn('target_id', currentTopFileIds)
        .where('source_type', 'file')
        .where('target_type', 'file')
        .select('*');

      for (const edge of incomingEdges) {
        const srcSig = await getOrCreateSignal(edge.source_id);
        if (srcSig) {
          srcSig.graphBoost = Math.max(srcSig.graphBoost, 0.5);
          srcSig.graphTraces.push(`imports_target`);
        }
      }
    }

    // ─── 4. Memory Scope Boost Pass ───
    if (options?.affectedPaths && options.affectedPaths.length > 0) {
      for (const sig of signals.values()) {
        const normSig = sig.path.replace(/\\/g, '/').toLowerCase();
        for (const aff of options.affectedPaths) {
          const normAff = aff.replace(/\\/g, '/').toLowerCase();
          if (normSig.includes(normAff) || normAff.includes(normSig)) {
            sig.memoryBoost = 1.0;
          }
        }
      }
    }

    // ─── 5. Multi-Sensor Fusion & Ranking ───
    const fusedCandidates = await this.fusion.fuse(signals, maxResults);
    return { candidates: fusedCandidates, keywords: rawKeywords, semanticDegraded };
  }
}
