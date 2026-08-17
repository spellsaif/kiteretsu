import path from 'path';
import fs from 'fs-extra';
import pLimit from 'p-limit';

export type EmbeddingStatus =
  | { status: 'available'; model: string }
  | { status: 'mock'; model: 'deterministic-token-hash' }
  | { status: 'degraded'; reason: string };

/**
 * Deterministic token hashing vector generator for testing and offline fallback.
 * Maps lexical tokens and n-grams to a normalized vector so semantically overlapping
 * phrases (e.g. "auth_service" and "authenticate") produce positive cosine similarity,
 * while unrelated phrases produce near-orthogonal vectors.
 */
export function createDeterministicEmbedding(text: string, dimensions: number = 384): number[] {
  const vec = new Float64Array(dimensions);
  const words = text.toLowerCase().replace(/[^\w\s]/g, ' ').split(/\s+/).filter(Boolean);
  
  if (words.length === 0) {
    const emptyVec = new Float32Array(dimensions);
    emptyVec[0] = 1.0;
    return Array.from(emptyVec);
  }

  for (const word of words) {
    let h1 = 0x811c9dc5;
    let h2 = 0x5b79a781;
    for (let i = 0; i < word.length; i++) {
      h1 = Math.imul(h1 ^ word.charCodeAt(i), 0x01000193);
      h2 = Math.imul(h2 ^ word.charCodeAt(i), 0x5bd1e995);
    }
    const idx1 = Math.abs(h1) % dimensions;
    const idx2 = Math.abs(h2) % dimensions;
    const sign1 = (h1 & 1) ? 1 : -1;
    const sign2 = (h2 & 1) ? 1 : -1;
    vec[idx1] += sign1 * 1.0;
    vec[idx2] += sign2 * 0.5;

    // Sub-word character trigrams for partial matching
    if (word.length >= 3) {
      for (let i = 0; i <= word.length - 3; i++) {
        const tri = word.slice(i, i + 3);
        let hTri = 0x811c9dc5;
        for (let j = 0; j < tri.length; j++) {
          hTri = Math.imul(hTri ^ tri.charCodeAt(j), 0x01000193);
        }
        const triIdx = Math.abs(hTri) % dimensions;
        vec[triIdx] += 0.25;
      }
    }
  }

  // L2 normalize
  let norm = 0;
  for (let i = 0; i < dimensions; i++) norm += vec[i] * vec[i];
  norm = Math.sqrt(norm);
  if (norm === 0) norm = 1;
  const result: number[] = new Array(dimensions);
  for (let i = 0; i < dimensions; i++) result[i] = vec[i] / norm;
  return result;
}

export class EmbeddingEngine {
  private extractor: any = null;
  private initPromise: Promise<any> | null = null;
  private modelName = 'Xenova/all-MiniLM-L6-v2';
  private limit = pLimit(2);
  private _lastStatus: EmbeddingStatus = { status: 'available', model: 'Xenova/all-MiniLM-L6-v2' };

  constructor() { }

  getStatus(): EmbeddingStatus {
    if (process.env.NODE_ENV === 'test' || process.env.VITEST || process.env.KITERETSU_DISABLE_EMBEDDINGS === '1') {
      return { status: 'mock', model: 'deterministic-token-hash' };
    }
    return this._lastStatus;
  }

  private async getExtractor() {
    if (!this.initPromise) {
      this.initPromise = (async () => {
        try {
          const { pipeline, env } = await import('@xenova/transformers');
          // Configure ONNX backend options to be extremely safe/single-threaded and avoid Zone allocations
          env.backends.onnx.wasm.numThreads = 1;
          const ext = await pipeline('feature-extraction', this.modelName);
          this._lastStatus = { status: 'available', model: this.modelName };
          return ext;
        } catch (e: any) {
          this._lastStatus = { status: 'degraded', reason: e.message };
          throw new Error(`Failed to load transformers: ${e.message}`);
        }
      })();
    }
    this.extractor = await this.initPromise;
    return this.extractor;
  }

  async generateEmbedding(text: string): Promise<number[]> {
    const results = await this.generateEmbeddings([text]);
    return results[0];
  }

  async generateEmbeddings(texts: string[]): Promise<number[][]> {
    if (texts.length === 0) return [];

    // Deterministic mock fallback for testing environment or if explicitly disabled
    if (process.env.NODE_ENV === 'test' || process.env.VITEST || process.env.KITERETSU_DISABLE_EMBEDDINGS === '1') {
      return texts.map(t => createDeterministicEmbedding(t));
    }

    try {
      const extractor = await this.getExtractor();
      const output = await this.limit(() => extractor(texts, { pooling: 'mean', normalize: true }));

      // Convert the flat data into an array of vectors
      const vectorSize = output.data.length / texts.length;
      const results: number[][] = [];
      for (let i = 0; i < texts.length; i++) {
        results.push(Array.from(output.data.slice(i * vectorSize, (i + 1) * vectorSize)));
      }
      return results;
    } catch (e: any) {
      this._lastStatus = { status: 'degraded', reason: e.message };
      throw e;
    }
  }

  /**
   * Generates a semantic summary of a file for embedding.
   */
  async prepareFileContent(filePath: string, content: string): Promise<string> {
    const fileName = path.basename(filePath);
    const snippet = content.slice(0, 1000);
    return `File: ${fileName}\nPath: ${filePath}\nContent:\n${snippet}`;
  }
}
