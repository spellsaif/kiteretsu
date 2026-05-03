import { globby } from 'globby';
import path from 'path';
import fs from 'fs-extra';
import xxhash from 'xxhash-wasm';

export interface ScanOptions {
  include?: string[];
  exclude?: string[];
  rootDir: string;
}

/**
 * Standard industry-standard exclusion patterns.
 * These are directories and files that should almost never be indexed.
 */
const GLOBAL_BLACK_LIST = [
  // Version Control
  '**/.git/**',
  '**/.svn/**',
  '**/.hg/**',
  
  // Package Managers
  '**/node_modules/**',
  '**/bower_components/**',
  '**/vendor/**',
  
  // Build & Cache
  '**/dist/**',
  '**/build/**',
  '**/out/**',
  '**/target/**',
  '**/.turbo/**',
  '**/.cache/**',
  '**/.next/**',
  '**/.nuxt/**',
  '**/.svelte-kit/**',
  '**/coverage/**',
  '**/.gradle/**',
  '**/bin/**',
  '**/obj/**',
  
  // Python
  '**/__pycache__/**',
  '**/.venv/**',
  '**/venv/**',
  '**/env/**',
  '**/site-packages/**',
  '**/*.pyc',
  
  // Environment & Temp
  '**/.env*',
  '**/temp/**',
  '**/tmp/**',
  '**/scratch/**',
  
  // Engine Specific
  '**/.kiteretsu/**',
];

/**
 * Patterns that identify "garbage" files (minified, machine-generated, etc.)
 */
const GARBAGE_PATTERNS = [
  '**/pnpm-lock.yaml',
  '**/package-lock.json',
  '**/yarn.lock',
  '**/composer.lock',
  '**/Cargo.lock',
  '**/*.min.js',
  '**/*.min.css',
  '**/*.map',
  '**/*.tsbuildinfo',
  '**/*.wasm',
];

export class Scanner {
  private _hasher: any;

  constructor(private options: ScanOptions) {}

  private async getHasher() {
    if (!this._hasher) {
      this._hasher = await xxhash();
    }
    return this._hasher;
  }

  /**
   * Loads custom ignore patterns from .kiteretsuignore if it exists.
   */
  private async loadIgnoreFile(): Promise<string[]> {
    const ignorePath = path.join(this.options.rootDir, '.kiteretsuignore');
    if (fs.existsSync(ignorePath)) {
      try {
        const content = await fs.readFile(ignorePath, 'utf8');
        return content
          .split('\n')
          .map(line => line.trim())
          .filter(line => line && !line.startsWith('#'));
      } catch (e) {
        return [];
      }
    }
    return [];
  }

  async scan(pattern?: string | string[]) {
    const include = pattern || this.options.include || ['**/*'];
    
    // Level 1: Combine Static Blacklist, Project Ignore, and User Options
    const customIgnores = await this.loadIgnoreFile();
    const exclude = [
      ...new Set([
        ...GLOBAL_BLACK_LIST,
        ...GARBAGE_PATTERNS,
        ...(this.options.exclude || []),
        ...customIgnores
      ])
    ];

    const files = await globby(include, {
      cwd: this.options.rootDir,
      ignore: exclude,
      absolute: true,
      onlyFiles: true,
      followSymbolicLinks: false,
      gitignore: true,
    });

    const rootDir = this.options.rootDir;
    const filteredFiles: string[] = [];

    // Level 2: Intelligence-driven Filtering (Size & Content)
    for (const fullPath of files) {
      try {
        const stats = await fs.stat(fullPath);
        
        // Safety: Only skip files that are truly massive (>10MB) or binary.
        // Files between 2MB and 10MB are registered but indexed "lite" by the parser.
        if (stats.size > 10 * 1024 * 1024) continue;

        const ext = path.extname(fullPath).toLowerCase();
        const binaryExts = ['.exe', '.dll', '.so', '.dylib', '.zip', '.tar', '.gz', '.jpg', '.png', '.gif', '.pdf', '.wasm', '.bin'];
        if (binaryExts.includes(ext)) continue;

        filteredFiles.push(path.relative(rootDir, fullPath).replace(/\\/g, '/'));
      } catch (e) {
        // Skip inaccessible files
      }
    }

    return filteredFiles;
  }

  async getFileHash(filePath: string): Promise<string> {
    const stats = await fs.stat(filePath);
    // Extra safety: never read more than 10MB for hashing
    if (stats.size > 10 * 1024 * 1024) return 'large-file-' + stats.mtimeMs;

    const hasher = await this.getHasher();
    const content = await fs.readFile(filePath);
    return hasher.h64Raw(content).toString(16);
  }

  /**
   * Returns the combined list of all ignore patterns.
   */
  async getExcludes(): Promise<string[]> {
    const customIgnores = await this.loadIgnoreFile();
    return [
      ...new Set([
        ...GLOBAL_BLACK_LIST,
        ...GARBAGE_PATTERNS,
        ...(this.options.exclude || []),
        ...customIgnores
      ])
    ];
  }
}
