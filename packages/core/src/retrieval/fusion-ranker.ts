import { Knex } from 'knex';

export interface CandidateSignal {
  fileId: number;
  path: string;
  summary: string;
  stale: boolean;
  lexicalScore: number;
  semanticSimilarity: number;
  graphBoost: number;
  memoryBoost: number;
  matchedSymbols: string[];
  matchedTerms: string[];
  graphTraces: string[];
}

export interface FusedCandidate {
  id: number;
  path: string;
  summary: string;
  stale: boolean;
  confidence: number;
  signals: string[];
  key_symbols: string[];
}

export class MultiSensorFusionRanker {
  constructor(private knex: Knex) { }

  async fuse(
    signalsMap: Map<number, CandidateSignal>,
    maxResults: number = 10
  ): Promise<FusedCandidate[]> {
    if (signalsMap.size === 0) return [];

    // Find max values for normalization
    let maxLexical = 1.0;
    for (const sig of signalsMap.values()) {
      if (sig.lexicalScore > maxLexical) maxLexical = sig.lexicalScore;
    }

    const fused: Array<FusedCandidate & { rawScore: number }> = [];

    for (const [fileId, sig] of signalsMap.entries()) {
      const normLexical = Math.min(1.0, sig.lexicalScore / maxLexical);
      const normSemantic = Math.max(0.0, Math.min(1.0, sig.semanticSimilarity));
      const normGraph = Math.min(1.0, sig.graphBoost);
      const normMemory = Math.min(1.0, sig.memoryBoost);

      // Weighted multi-sensor fusion
      const rawScore = (
        normLexical * 0.35 +
        normSemantic * 0.35 +
        normGraph * 0.20 +
        normMemory * 0.10
      );

      // Compute explainable confidence (0.0 to 1.0)
      const confidence = Math.min(0.99, Math.max(0.20, Number(rawScore.toFixed(2))));

      // Explainable signal breakdown
      const signals: string[] = [];
      if (sig.matchedSymbols.length > 0) {
        signals.push(`symbol:${sig.matchedSymbols.slice(0, 3).join(',')}`);
      }
      if (sig.semanticSimilarity > 0.3) {
        signals.push(`vector_sim:${(sig.semanticSimilarity * 100).toFixed(0)}%`);
      }
      if (sig.matchedTerms.length > 0) {
        signals.push(`terms:${sig.matchedTerms.slice(0, 3).join(',')}`);
      }
      if (sig.graphTraces.length > 0) {
        signals.push(`graph:${sig.graphTraces[0]}`);
      }
      if (sig.memoryBoost > 0) {
        signals.push('memory:adr_rule_match');
      }

      fused.push({
        id: fileId,
        path: sig.path,
        summary: sig.summary,
        stale: sig.stale,
        confidence,
        signals,
        key_symbols: sig.matchedSymbols,
        rawScore
      });
    }

    // Sort by raw composite score descending
    fused.sort((a, b) => b.rawScore - a.rawScore);

    const topCandidates = fused.slice(0, maxResults);
    return topCandidates;
  }
}
