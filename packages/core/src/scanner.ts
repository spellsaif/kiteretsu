import { globby } from 'globby';
import path from 'path';
import fs from 'fs-extra';
import crypto from 'crypto';

export interface ScanOptions {
  include?: string[];
  exclude?: string[];
  rootDir: string;
}

export class Scanner {
  constructor(private options: ScanOptions) {}

  async scan() {
    const include = this.options.include || ['**/*'];
    const exclude = this.options.exclude || ['**/node_modules/**', '**/dist/**', '**/build/**', '**/.git/**', '**/.kiteretsu/**', '**/package-lock.json', '**/scratch/**', '**/temp/**'];

    const files = await globby(include, {
      cwd: this.options.rootDir,
      ignore: exclude,
      absolute: true,
    });

    return files.map(f => path.relative(this.options.rootDir, f).replace(/\\/g, '/'));
  }

  async getFileHash(filePath: string): Promise<string> {
    const content = await fs.readFile(filePath);
    return crypto.createHash('sha256').update(content).digest('hex');
  }
}
