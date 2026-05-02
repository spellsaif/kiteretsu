import { pipeline } from '@xenova/transformers';
import path from 'path';
import fs from 'fs-extra';
import pLimit from 'p-limit';

export class EmbeddingEngine {
  private extractor: any = null;
  private initPromise: Promise<any> | null = null;
  private modelName = 'Xenova/all-MiniLM-L6-v2';
  private limit = pLimit(2);

  constructor() {}

  private async getExtractor() {
    if (!this.initPromise) {
      this.initPromise = pipeline('feature-extraction', this.modelName);
    }
    this.extractor = await this.initPromise;
    return this.extractor;
  }

  async generateEmbedding(text: string): Promise<number[]> {
    const extractor = await this.getExtractor();
    const output = await this.limit(() => extractor(text, { pooling: 'mean', normalize: true }));
    return Array.from(output.data);
  }

  /**
   * Generates a semantic summary of a file for embedding.
   * We don't want to embed the whole file if it's huge, 
   * just the important parts like symbols and first few lines.
   */
  async prepareFileContent(filePath: string, content: string): Promise<string> {
    const fileName = path.basename(filePath);
    // Take first 1000 chars and some structure info
    const snippet = content.slice(0, 1000);
    return `File: ${fileName}\nPath: ${filePath}\nContent:\n${snippet}`;
  }
}
