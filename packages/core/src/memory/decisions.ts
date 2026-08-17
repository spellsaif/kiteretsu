import { Knex } from 'knex';
import { Database } from '../database.js';
import { EmbeddingEngine } from '../embeddings.js';

export interface DecisionRecord {
  id?: number;
  title: string;
  rationale: string;
  alternatives_considered?: string;
  affected_paths?: string[];
  status?: 'proposed' | 'accepted' | 'superseded' | 'deprecated' | 'rejected' | 'active';
  created_at?: string;
  updated_at?: string;
}

export class DecisionStore {
  constructor(private db: Database, private getEmbeddings: () => EmbeddingEngine) { }

  get knex(): Knex {
    return this.db.getKnex();
  }

  async getAllDecisions(): Promise<DecisionRecord[]> {
    const rows = await this.knex('decisions').select('*').orderBy('created_at', 'desc');
    return rows.map(r => ({
      id: r.id,
      title: r.title,
      rationale: r.rationale,
      alternatives_considered: r.alternatives_considered,
      affected_paths: r.affected_paths ? JSON.parse(r.affected_paths) : [],
      status: r.status,
      created_at: r.created_at,
      updated_at: r.updated_at
    }));
  }

  async recordDecision(
    title: string,
    rationale: string,
    alternativesConsidered: string = '',
    affectedPaths: string[] = [],
    status: 'active' | 'deprecated' | 'superseded' = 'active'
  ): Promise<number> {
    let embeddingBuffer: Buffer | null = null;
    try {
      const textToEmbed = `${title} ${rationale} ${alternativesConsidered}`;
      const vector = await this.getEmbeddings().generateEmbedding(textToEmbed);
      if (vector && vector.length > 0) {
        embeddingBuffer = Buffer.from(new Float32Array(vector).buffer);
      }
    } catch { }

    const [id] = await this.knex('decisions').insert({
      title,
      rationale,
      alternatives_considered: alternativesConsidered,
      affected_paths: JSON.stringify(affectedPaths),
      status,
      embedding: embeddingBuffer
    });

    return id;
  }

  async getRelevantDecisions(query: string, candidatePaths: string[] = [], limit: number = 3): Promise<DecisionRecord[]> {
    const allDecisions = await this.getAllDecisions();
    if (allDecisions.length === 0) return [];

    const scored = new Map<number, { decision: DecisionRecord; score: number }>();

    for (const d of allDecisions) {
      let score = 0;

      // 1. Path overlap score
      if (d.affected_paths && d.affected_paths.length > 0 && candidatePaths.length > 0) {
        for (const affPath of d.affected_paths) {
          const normAff = affPath.replace(/\\/g, '/').toLowerCase();
          for (const cand of candidatePaths) {
            const normCand = cand.replace(/\\/g, '/').toLowerCase();
            if (normCand.includes(normAff) || normAff.includes(normCand)) {
              score += 10.0;
            }
          }
        }
      }

      // 2. Keyword lexical matching
      const queryTerms = query.toLowerCase().split(/\s+/).filter(t => t.length > 2);
      const text = `${d.title} ${d.rationale} ${d.alternatives_considered || ''}`.toLowerCase();
      for (const term of queryTerms) {
        if (text.includes(term)) {
          score += 3.0;
        }
      }

      if (d.status === 'active') {
        score += 1.0;
      }

      if (score > 0) {
        scored.set(d.id!, { decision: d, score });
      }
    }

    // 3. Vector similarity matching
    try {
      const vector = await this.getEmbeddings().generateEmbedding(query);
      const vectorBuffer = Buffer.from(new Float32Array(vector).buffer);

      const vectorMatches = await this.knex.raw(`
        SELECT id, vec_distance_cosine(embedding, ?) as distance
        FROM decisions
        WHERE embedding IS NOT NULL
        ORDER BY distance ASC
        LIMIT ?
      `, [vectorBuffer, limit]);

      for (const match of vectorMatches) {
        const sim = Math.max(0, 1 - match.distance);
        const existing = scored.get(match.id);
        if (existing) {
          existing.score += sim * 8.0;
        } else {
          const d = allDecisions.find(item => item.id === match.id);
          if (d) {
            scored.set(d.id!, { decision: d, score: sim * 8.0 });
          }
        }
      }
    } catch { }

    return Array.from(scored.values())
      .sort((a, b) => b.score - a.score)
      .slice(0, limit)
      .map(s => s.decision);
  }
}
