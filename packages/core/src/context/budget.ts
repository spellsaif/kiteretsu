import fs from 'fs-extra';
import path from 'path';
import { FusedCandidate } from '../retrieval/fusion-ranker.js';

export interface ContextFileItem {
  path: string;
  summary: string;
  relevance_score?: number;
  confidence: number;
  signals: string[];
  key_symbols?: string[];
}

export interface BudgetAllocation {
  readFirst: ContextFileItem[];
  optionalRead: ContextFileItem[];
  tokensUsed: number;
}

export class ContextBudgetOptimizer {
  constructor(private rootDir: string) { }

  async allocateCandidates(
    candidates: FusedCandidate[],
    budgetTokens: number,
    metadataTokens: number
  ): Promise<BudgetAllocation> {
    const fileBudget = Math.max(400, budgetTokens - metadataTokens);
    let currentTokens = 0;
    const readFirst: ContextFileItem[] = [];
    const optionalRead: ContextFileItem[] = [];

    for (const f of candidates) {
      const fullPath = path.resolve(this.rootDir, f.path);
      let charLength = 0;
      try {
        if (await fs.pathExists(fullPath)) {
          const content = await fs.readFile(fullPath, 'utf8');
          charLength = content.length;
        } else {
          charLength = (f.summary || '').length * 4;
        }
      } catch {
        charLength = (f.summary || '').length * 4;
      }

      const fileTokens = Math.ceil(charLength / 4);
      const item: ContextFileItem = {
        path: f.path,
        summary: f.summary || 'No summary',
        relevance_score: f.relevance_score ?? f.confidence,
        confidence: f.confidence,
        signals: f.signals,
        key_symbols: f.key_symbols
      };

      if (readFirst.length === 0 || currentTokens + fileTokens <= fileBudget) {
        currentTokens += fileTokens;
        readFirst.push(item);
      } else {
        optionalRead.push(item);
      }
    }

    return {
      readFirst,
      optionalRead,
      tokensUsed: currentTokens + metadataTokens
    };
  }
}
