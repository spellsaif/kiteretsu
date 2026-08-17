import { Knex } from 'knex';

export const STOP_WORDS = new Set([
  'implement', 'create', 'update', 'delete', 'change', 'fix', 'add', 'remove',
  'the', 'and', 'for', 'with', 'from', 'this', 'that', 'should', 'would',
  'could', 'want', 'need', 'task', 'description', 'issue', 'bug', 'feature'
]);

export function extractKeywords(text: string): string[] {
  return text.toLowerCase()
    .replace(/[^\w\s]/g, ' ')
    .split(/\s+/)
    .filter(k => k.length > 2 && !STOP_WORDS.has(k));
}

export class LexicalRetriever {
  constructor(private knex: Knex) { }

  async computeKeywordSignificance(keywords: string[]): Promise<Map<string, number>> {
    const totalFiles = (await this.knex('files').count('id as count').first())?.count || 1;
    const keywordSignificance = new Map<string, number>();

    for (const kw of keywords) {
      const count = (await this.knex('files').where('path', 'like', `%${kw}%`).count('id as count').first())?.count || 1;
      const idf = Math.log(Number(totalFiles) / (Number(count) + 1)) + 1;
      keywordSignificance.set(kw, idf);
    }

    return keywordSignificance;
  }

  async searchKeywords(keywords: string[], keywordSignificance: Map<string, number>, scores: Map<number, { score: number; path: string; summary: string; stale: boolean }>): Promise<void> {
    for (const kw of keywords) {
      const idf = keywordSignificance.get(kw) || 1;

      // Path matches (Weight: 10.0)
      const pathMatches = await this.knex('files').where('path', 'like', `%${kw}%`).select('id', 'path', 'summary', 'stale');
      for (const f of pathMatches) {
        const current = scores.get(f.id) || { score: 0, path: f.path, summary: f.summary || '', stale: !!f.stale };
        current.score += 10.0 * idf;
        scores.set(f.id, current);
      }

      // Symbol matches (Weight: 5.0)
      const symbolMatches = await this.knex('symbols')
        .join('files', 'symbols.file_id', 'files.id')
        .where('symbols.name', 'like', `%${kw}%`)
        .select('files.id', 'files.path', 'files.summary', 'files.stale');
      for (const f of symbolMatches) {
        const current = scores.get(f.id) || { score: 0, path: f.path, summary: f.summary || '', stale: !!f.stale };
        current.score += 5.0 * idf;
        scores.set(f.id, current);
      }

      // Summary matches (Weight: 2.0)
      const summaryMatches = await this.knex('files').where('summary', 'like', `%${kw}%`).select('id', 'path', 'summary', 'stale');
      for (const f of summaryMatches) {
        const current = scores.get(f.id) || { score: 0, path: f.path, summary: f.summary || '', stale: !!f.stale };
        current.score += 2.0 * idf;
        scores.set(f.id, current);
      }
    }
  }
}
