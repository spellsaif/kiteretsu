import { Knex } from 'knex';
import { Database } from '../database.js';
import { EmbeddingEngine } from '../embeddings.js';

export interface TaskRecord {
  id?: number;
  description: string;
  type: string;
  outcome?: string;
  notes?: string;
  created_at?: string;
}

export class TaskStore {
  constructor(private db: Database, private getEmbeddings: () => EmbeddingEngine) { }

  get knex(): Knex {
    return this.db.getKnex();
  }

  async recordTask(description: string, type: string, outcome: string, notes: string = ''): Promise<void> {
    let embeddingBuffer: Buffer | null = null;
    try {
      const textToEmbed = `${description} ${notes}`;
      const vector = await this.getEmbeddings().generateEmbedding(textToEmbed);
      if (vector && vector.length > 0) {
        embeddingBuffer = Buffer.from(new Float32Array(vector).buffer);
      }
    } catch { }

    await this.knex('tasks').insert({
      description,
      type,
      outcome,
      notes,
      embedding: embeddingBuffer
    });
  }

  async getRecentTasks(limit: number = 20): Promise<TaskRecord[]> {
    return this.knex('tasks').select('id', 'description', 'type', 'outcome', 'notes', 'created_at').orderBy('created_at', 'desc').limit(limit);
  }

  async getSimilarTasks(query: string, limit: number = 3): Promise<TaskRecord[]> {
    const tasks = await this.getRecentTasks(50);
    if (tasks.length === 0) return [];

    const scored = new Map<number, { task: TaskRecord; score: number }>();

    // 1. Lexical match
    const terms = query.toLowerCase().split(/\s+/).filter(t => t.length > 2);
    for (const t of tasks) {
      let score = 0;
      const text = `${t.description} ${t.notes || ''}`.toLowerCase();
      for (const term of terms) {
        if (text.includes(term)) {
          score += 2.0;
        }
      }
      if (score > 0) {
        scored.set(t.id!, { task: t, score });
      }
    }

    // 2. Vector search
    try {
      const vector = await this.getEmbeddings().generateEmbedding(query);
      const vectorBuffer = Buffer.from(new Float32Array(vector).buffer);

      const vectorMatches = await this.knex.raw(`
        SELECT id, vec_distance_cosine(embedding, ?) as distance
        FROM tasks
        WHERE embedding IS NOT NULL
        ORDER BY distance ASC
        LIMIT ?
      `, [vectorBuffer, limit]);

      for (const match of vectorMatches) {
        const sim = Math.max(0, 1 - match.distance);
        const existing = scored.get(match.id);
        if (existing) {
          existing.score += sim * 6.0;
        } else {
          const t = tasks.find(item => item.id === match.id);
          if (t) {
            scored.set(t.id!, { task: t, score: sim * 6.0 });
          }
        }
      }
    } catch { }

    return Array.from(scored.values())
      .sort((a, b) => b.score - a.score)
      .slice(0, limit)
      .map(s => s.task);
  }
}
