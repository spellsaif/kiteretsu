import { Knex } from 'knex';
import { EmbeddingEngine } from '../embeddings.js';

export interface SemanticSearchResult {
  path: string;
  distance: number;
  summary?: string;
}

export class SemanticRetriever {
  constructor(private knex: Knex, private embeddings: EmbeddingEngine) { }

  async search(query: string, limit: number = 10): Promise<SemanticSearchResult[]> {
    const vector = await this.embeddings.generateEmbedding(query);
    const vectorBuffer = Buffer.from(new Float32Array(vector).buffer);

    const results = await this.knex.raw(`
      SELECT 
        path,
        summary,
        vec_distance_cosine(embedding, ?) as distance
      FROM files
      WHERE embedding IS NOT NULL
      ORDER BY distance ASC
      LIMIT ?
    `, [vectorBuffer, limit]);

    return results.map((r: any) => ({
      path: r.path,
      summary: r.summary,
      distance: Number(r.distance)
    }));
  }
}
