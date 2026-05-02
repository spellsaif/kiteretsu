import { globby } from 'globby';
import path from 'path';
import fs from 'fs-extra';
import xxhash from 'xxhash-wasm';

export interface ScanOptions {
  include?: string[];
  exclude?: string[];
  rootDir: string;
}

export class Scanner {
  private _hasher: any;

  constructor(private options: ScanOptions) {}

  private async getHasher() {
    if (!this._hasher) {
      this._hasher = await xxhash();
    }
    return this._hasher;
  }

  async scan(pattern?: string | string[]) {
    const include = pattern || this.options.include || ['**/*'];
    const defaultExclude = [
      '**/.git/**',
      '**/.kiteretsu/**',
      '**/.turbo/**',
      '**/.cache/**',
      '**/.next/**',
      '**/.nuxt/**',
      '**/.svelte-kit/**',
      '**/.gradle/**',
      '**/.venv/**',
      '**/venv/**',
      '**/__pycache__/**',
      '**/node_modules/**',
      '**/dist/**',
      '**/build/**',
      '**/target/**',
      '**/vendor/**',
      '**/coverage/**',
      '**/out/**',
      '**/scratch/**',
      '**/temp/**',
      '**/*.pyc',
      '**/*.tsbuildinfo',
      '**/pnpm-lock.yaml',
      '**/package-lock.json',
      '**/yarn.lock',
    ];
    const exclude = [...new Set([...(this.options.exclude || []), ...defaultExclude])];

    const files = await globby(include, {
      cwd: this.options.rootDir,
      ignore: exclude,
      absolute: true,
      onlyFiles: true,
      followSymbolicLinks: false,
      gitignore: true,
    });

    return files.map(f => path.relative(this.options.rootDir, f).replace(/\\/g, '/'));
  }

  async getFileHash(filePath: string): Promise<string> {
    const hasher = await this.getHasher();
    const content = await fs.readFile(filePath);
    return hasher.h64Raw(content).toString(16);
  }
}
