import { globby } from 'globby';
import path from 'path';
import fs from 'fs-extra';
import xxhash from 'xxhash-wasm';
import { FileClassifier } from './classifier.js';

export interface ScanOptions {
  include?: string[];
  exclude?: string[];
  ignore?: string[];
  rootDir: string;
  maxFileSize?: string | number; // Default: 1MB (1_000_000 bytes)
}

export interface SkippedFile {
  path: string;
  reason: 'ignored' | 'large' | 'binary' | 'generated' | 'vendor' | 'error';
  size?: number;
  limit?: number;
}

export interface ScanResult {
  files: string[];
  skipped: SkippedFile[];
  totalDiscovered: number;
}

export function parseBytes(val?: string | number, defaultBytes = 1_000_000): number {
  if (val === undefined || val === null) return defaultBytes;
  if (typeof val === 'number') return val;
  const str = String(val).trim().toUpperCase();
  const match = str.match(/^([\d.]+)\s*(B|KB|MB|GB)?$/);
  if (!match) return defaultBytes;
  const num = parseFloat(match[1]);
  const unit = match[2] || 'B';
  switch (unit) {
    case 'GB': return Math.round(num * 1024 * 1024 * 1024);
    case 'MB': return Math.round(num * 1024 * 1024);
    case 'KB': return Math.round(num * 1024);
    case 'B':
    default: return Math.round(num);
  }
}

/**
 * Standard industry-standard multi-language exclusion patterns.
 * Directories and files that should almost never be indexed.
 */
export const GLOBAL_BLACK_LIST = [
  // ── Version Control ────────────────────────────────────────────────────────
  '**/.git/**',
  '**/.svn/**',
  '**/.hg/**',

  // ── Package Managers & Dependencies ─────────────────────────────────────────
  '**/node_modules/**',
  '**/bower_components/**',
  '**/vendor/**',
  '**/third_party/**',
  '**/Pods/**',
  '**/Carthage/Build/**',
  '**/deps/**',

  // ── JavaScript / TypeScript / Web Frameworks ────────────────────────────────
  '**/.next/**',
  '**/_next/**',
  '**/.nuxt/**',
  '**/.svelte-kit/**',
  '**/.docusaurus/**',
  '**/storybook-static/**',
  '**/dist/**',
  '**/build/**',
  '**/out/**',
  '**/.turbo/**',
  '**/.cache/**',
  '**/.vite/**',

  // ── Rust ────────────────────────────────────────────────────────────────────
  '**/target/**',

  // ── Java / Kotlin / Scala / JVM (Maven, Gradle, SBT) ────────────────────────
  '**/.gradle/**',
  '**/gradle/wrapper/**',
  '**/.m2/**',
  '**/.bsp/**',
  '**/.metals/**',
  '**/.bloop/**',
  '**/.sbt/**',
  '**/.kotlin/**',

  // ── C / C++ (CMake, Meson, Ninja, Bazel, Visual Studio) ─────────────────────
  '**/CMakeFiles/**',
  '**/cmake-build-*/**',
  '**/.ninja/**',
  '**/bazel-*/**',
  '**/Debug/**',
  '**/Release/**',
  '**/x64/**',
  '**/x86/**',

  // ── C# / .NET ───────────────────────────────────────────────────────────────
  '**/bin/**',
  '**/obj/**',
  '**/TestResults/**',
  '**/.nuget/**',

  // ── Python ──────────────────────────────────────────────────────────────────
  '**/__pycache__/**',
  '**/.pytest_cache/**',
  '**/.mypy_cache/**',
  '**/.ruff_cache/**',
  '**/.tox/**',
  '**/.nox/**',
  '**/.hypothesis/**',
  '**/.venv/**',
  '**/venv/**',
  '**/env/**',
  '**/site-packages/**',
  '**/*.egg-info/**',
  '**/*.dist-info/**',
  '**/htmlcov/**',

  // ── PHP ─────────────────────────────────────────────────────────────────────
  '**/var/cache/**',
  '**/var/log/**',
  '**/storage/framework/**',
  '**/.phpunit.cache/**',

  // ── Ruby ────────────────────────────────────────────────────────────────────
  '**/.bundle/**',
  '**/vendor/bundle/**',

  // ── Dart / Flutter ──────────────────────────────────────────────────────────
  '**/.dart_tool/**',
  '**/.pub-cache/**',
  '**/.pub/**',
  '**/.flutter-plugins/**',
  '**/.flutter-plugins-dependencies/**',

  // ── Elixir / Erlang ─────────────────────────────────────────────────────────
  '**/_build/**',
  '**/.elixir_ls/**',

  // ── Swift / iOS / Xcode ─────────────────────────────────────────────────────
  '**/.swiftpm/**',
  '**/DerivedData/**',

  // ── Zig ─────────────────────────────────────────────────────────────────────
  '**/.zig-cache/**',
  '**/zig-out/**',

  // ── Haskell ─────────────────────────────────────────────────────────────────
  '**/.stack-work/**',
  '**/dist-newstyle/**',

  // ── IDE & Tooling ───────────────────────────────────────────────────────────
  '**/.idea/**',
  '**/.vscode/**',
  '**/.vs/**',

  // ── Testing & Coverage ──────────────────────────────────────────────────────
  '**/coverage/**',

  // ── Environment & Temp ──────────────────────────────────────────────────────
  '**/.env*',
  '**/temp/**',
  '**/tmp/**',
  '**/scratch/**',
  '**/temp_test_*/**',

  // ── Engine Specific ─────────────────────────────────────────────────────────
  '**/.kiteretsu/**',
];

/**
 * Patterns that identify "garbage" files (minified, machine-generated, locks, binaries)
 */
export const GARBAGE_PATTERNS = [
  // Lock files across all package managers
  '**/pnpm-lock.yaml',
  '**/package-lock.json',
  '**/yarn.lock',
  '**/composer.lock',
  '**/Cargo.lock',
  '**/Gemfile.lock',
  '**/poetry.lock',
  '**/Pipfile.lock',
  '**/uv.lock',
  '**/pdm.lock',
  '**/pubspec.lock',
  '**/mix.lock',
  '**/rebar.lock',
  '**/Package.resolved',
  '**/Podfile.lock',
  '**/Cartfile.resolved',
  '**/gradle.lockfile',
  '**/packages.lock.json',
  '**/cabal.project.freeze',

  // Minified, bundles, and source maps
  '**/*.min.js',
  '**/*.min.css',
  '**/*.bundle.js',
  '**/*.bundle.min.js',
  '**/*.chunk.js',
  '**/*.map',
  '**/*.d.ts.map',
  '**/*.tsbuildinfo',

  // Compiled binaries & bytecode
  '**/*.wasm',
  '**/*.class',
  '**/*.pyc',
  '**/*.pyo',
  '**/*.pyd',
  '**/*.rlib',
  '**/*.rmeta',
  '**/*.beam',
  '**/*.o',
  '**/*.obj',
  '**/*.so',
  '**/*.dylib',
  '**/*.dll',
  '**/*.a',
  '**/*.lib',
  '**/*.exe'
];

export class Scanner {
  private _hasher: any;
  private maxFileSizeBytes: number;

  constructor(private options: ScanOptions) {
    this.maxFileSizeBytes = parseBytes(options.maxFileSize, 1_000_000);
  }

  private async getHasher() {
    if (!this._hasher) {
      this._hasher = await xxhash();
    }
    return this._hasher;
  }

  getMaxFileSize(): number {
    return this.maxFileSizeBytes;
  }

  async scanDetailed(pattern?: string | string[]): Promise<ScanResult> {
    const include = pattern || this.options.include || ['**/*'];

    // Level 1: Combine Static Blacklist, Garbage Patterns, and User Options
    const exclude = [
      ...new Set([
        ...GLOBAL_BLACK_LIST,
        ...GARBAGE_PATTERNS,
        ...(this.options.exclude || []),
        ...(this.options.ignore || [])
      ])
    ];

    const rawDiscovered = await globby(include, {
      cwd: this.options.rootDir,
      ignore: exclude,
      absolute: true,
      onlyFiles: true,
      followSymbolicLinks: false,
      gitignore: true,
    });

    const rootDir = this.options.rootDir;
    const filteredFiles: string[] = [];
    const skipped: SkippedFile[] = [];

    // Level 2: Intelligence-driven Filtering (Size, Binary, and Classification)
    for (const fullPath of rawDiscovered) {
      const relPath = path.relative(rootDir, fullPath).replace(/\\/g, '/');

      try {
        const stats = await fs.stat(fullPath);

        // Layer 2: Pre-read File Size Guard
        if (stats.size > this.maxFileSizeBytes) {
          skipped.push({
            path: relPath,
            reason: 'large',
            size: stats.size,
            limit: this.maxFileSizeBytes
          });
          continue;
        }

        // Layer 3: Binary check by extension
        if (FileClassifier.isBinaryExtension(fullPath)) {
          skipped.push({
            path: relPath,
            reason: 'binary',
            size: stats.size
          });
          continue;
        }

        // Layer 4: Deep Binary Buffer check (inspect first 512 bytes)
        if (stats.size > 0) {
          const fd = await fs.open(fullPath, 'r');
          const buffer = Buffer.alloc(Math.min(512, stats.size));
          try {
            await fs.read(fd, buffer, 0, buffer.length, 0);
            if (FileClassifier.isBinaryBuffer(buffer)) {
              skipped.push({
                path: relPath,
                reason: 'binary',
                size: stats.size
              });
              continue;
            }
          } finally {
            await fs.close(fd);
          }
        }

        // Layer 5: Path-based Generated/Vendor Classification
        const classification = FileClassifier.classify(relPath);
        if (classification.classification === 'generated') {
          skipped.push({
            path: relPath,
            reason: 'generated',
            size: stats.size
          });
          continue;
        }
        if (classification.classification === 'vendor') {
          skipped.push({
            path: relPath,
            reason: 'vendor',
            size: stats.size
          });
          continue;
        }

        filteredFiles.push(relPath);
      } catch (e) {
        skipped.push({
          path: relPath,
          reason: 'error'
        });
      }
    }

    return {
      files: filteredFiles,
      skipped,
      totalDiscovered: rawDiscovered.length
    };
  }

  async scan(pattern?: string | string[]): Promise<string[]> {
    const result = await this.scanDetailed(pattern);
    return result.files;
  }

  async getFileHash(filePath: string): Promise<string> {
    const stats = await fs.stat(filePath);
    if (stats.size > this.maxFileSizeBytes) {
      return 'large-file-' + stats.mtimeMs;
    }

    const hasher = await this.getHasher();
    const content = await fs.readFile(filePath);
    return hasher.h64Raw(content).toString(16);
  }

  /**
   * Returns the combined list of all ignore patterns.
   */
  async getExcludes(): Promise<string[]> {
    return [
      ...new Set([
        ...GLOBAL_BLACK_LIST,
        ...GARBAGE_PATTERNS,
        ...(this.options.exclude || []),
        ...(this.options.ignore || [])
      ])
    ];
  }
}
