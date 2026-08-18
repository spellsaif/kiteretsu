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
    const directMatchedSymbolIds: number[] = [];

    for (const kw of rawKeywords) {
      const idf = keywordSignificance.get(kw) || 1.0;

      // Symbol exact/partial matches
      const symbolMatches = await this.knex('symbols')
        .join('files', 'symbols.file_id', 'files.id')
        .where('symbols.name', 'like', `%${kw}%`)
        .select('symbols.id as symbol_id', 'files.id as file_id', 'symbols.name as symbol_name');

      for (const m of symbolMatches) {
        directMatchedSymbolIds.push(m.symbol_id);
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

    // ─── 3. Symbol-Aware & File-Level Graph Proximity Expansion Pass ───
    const currentTopFileIds = Array.from(signals.keys()).slice(0, 5);

    // Collect candidate symbols for spatial graph traversal (both direct matched and top files' symbols)
    let candidateSymbolIds = [...new Set(directMatchedSymbolIds)];
    if (candidateSymbolIds.length === 0 && currentTopFileIds.length > 0) {
      const topSymbols = await this.knex('symbols')
        .whereIn('file_id', currentTopFileIds)
        .select('id');
      candidateSymbolIds = topSymbols.map(s => s.id);
    }

    if (candidateSymbolIds.length > 0) {
      // Outgoing symbol edges: Symbol -> calls/references/extends/implements -> Symbol
      const outgoingSymbolEdges = await this.knex('graph_edges')
        .join('symbols as target_sym', 'graph_edges.target_id', 'target_sym.id')
        .where('graph_edges.source_type', 'symbol')
        .where('graph_edges.target_type', 'symbol')
        .whereIn('graph_edges.source_id', candidateSymbolIds)
        .whereIn('graph_edges.relation', ['calls', 'references', 'extends', 'implements', 'tested_by'])
        .select(
          'graph_edges.source_id',
          'graph_edges.relation',
          'target_sym.id as target_sym_id',
          'target_sym.name as target_sym_name',
          'target_sym.file_id as target_file_id'
        );

      for (const edge of outgoingSymbolEdges) {
        const targetSig = await getOrCreateSignal(edge.target_file_id);
        if (targetSig) {
          const boost = edge.relation === 'extends' || edge.relation === 'implements' ? 0.85 : 0.70;
          targetSig.graphBoost = Math.max(targetSig.graphBoost, boost);
          targetSig.graphTraces.push(`graph:${edge.relation}:${edge.target_sym_name}`);
          if (!targetSig.matchedSymbols.includes(edge.target_sym_name)) {
            targetSig.matchedSymbols.push(edge.target_sym_name);
          }
        }
      }

      // Incoming symbol edges: Symbol -> calls/references/extends/implements -> Candidate Symbol
      const incomingSymbolEdges = await this.knex('graph_edges')
        .join('symbols as src_sym', 'graph_edges.source_id', 'src_sym.id')
        .where('graph_edges.source_type', 'symbol')
        .where('graph_edges.target_type', 'symbol')
        .whereIn('graph_edges.target_id', candidateSymbolIds)
        .whereIn('graph_edges.relation', ['calls', 'references', 'extends', 'implements', 'tested_by'])
        .select(
          'graph_edges.target_id',
          'graph_edges.relation',
          'src_sym.id as src_sym_id',
          'src_sym.name as src_sym_name',
          'src_sym.file_id as src_file_id'
        );

      for (const edge of incomingSymbolEdges) {
        const srcSig = await getOrCreateSignal(edge.src_file_id);
        if (srcSig) {
          const boost = edge.relation === 'tested_by' ? 0.85 : 0.65;
          srcSig.graphBoost = Math.max(srcSig.graphBoost, boost);
          srcSig.graphTraces.push(`graph:called_by:${edge.src_sym_name}`);
          if (!srcSig.matchedSymbols.includes(edge.src_sym_name)) {
            srcSig.matchedSymbols.push(edge.src_sym_name);
          }
        }
      }
    }

    // File-level graph edges (imports / tested_by)
    if (currentTopFileIds.length > 0) {
      // Find files imported by top files
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

    // ─── 5. Four-Signal Multi-Sensor Fusion & Ranking ───
    const fusedCandidates = await this.fusion.fuse(signals, maxResults);
    return { candidates: fusedCandidates, keywords: rawKeywords, semanticDegraded };
  }
}
