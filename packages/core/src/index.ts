import { Database } from './database.js';
import { Scanner } from './scanner.js';
import type { CodeParser } from './parser.js';
import type { CodeAnalyzer } from './analyzer.js';
import path from 'path';
import fs from 'fs-extra';
import pLimit from 'p-limit';
import { EmbeddingEngine } from './embeddings.js';

export interface KiteretsuConfig {
  rootDir: string;
  dbPath?: string;
}

export class Kiteretsu {
  private _db?: Database;
  private _scanner?: Scanner;
  private _parser?: CodeParser;
  private _analyzer?: CodeAnalyzer;
  private _embeddings?: EmbeddingEngine;
  private rootDir: string;
  private config: KiteretsuConfig;
  private packageMap: Map<string, string> = new Map();
  private crateMap: Map<string, string> = new Map();
  private fileSystemCache: Set<string> = new Set();

  constructor(config: KiteretsuConfig) {
    // Normalize rootDir for consistent path comparisons (especially on Windows)
    this.rootDir = path.resolve(config.rootDir).replace(/\\/g, '/');
    // Ensure case consistency for drive letters on Windows
    if (process.platform === 'win32' && /^[a-z]:/i.test(this.rootDir)) {
      this.rootDir = this.rootDir[0].toLowerCase() + this.rootDir.slice(1);
    }
    this.config = config;
  }

  get db(): Database {
    if (!this._db) {
      const dbPath = this.config.dbPath || path.join(this.rootDir, '.kiteretsu', 'memory', 'kiteretsu.sqlite');
      this._db = new Database(dbPath);
    }
    return this._db;
  }

  async getAnalyzer(): Promise<CodeAnalyzer> {
    if (!this._analyzer) {
      const { CodeAnalyzer } = await import('./analyzer.js');
      this._analyzer = new CodeAnalyzer(this.rootDir, this.db);
    }
    return this._analyzer;
  }

  // Backwards compatibility for the property access if needed, 
  // but recommended to use getAnalyzer()
  get analyzer(): CodeAnalyzer {
    if (!this._analyzer) throw new Error("Analyzer not initialized. Call init() or getAnalyzer() first.");
    return this._analyzer;
  }

  get scanner(): Scanner {
    if (!this._scanner) {
      const configPath = path.join(this.rootDir, '.kiteretsu', 'config.json');
      let scanOptions: { rootDir: string; include?: string[]; exclude?: string[] } = { rootDir: this.rootDir };

      if (fs.existsSync(configPath)) {
        try {
          const fileConfig = fs.readJsonSync(configPath);
          if (fileConfig.indexing) {
            scanOptions.include = fileConfig.indexing.include;
            scanOptions.exclude = fileConfig.indexing.exclude;
          }
        } catch (e) { /* use defaults */ }
      }

      this._scanner = new Scanner(scanOptions);
    }
    return this._scanner;
  }

  private async getParser(): Promise<CodeParser> {
    if (!this._parser) {
      const { CodeParser } = await import('./parser.js');
      this._parser = new CodeParser();
    }
    return this._parser;
  }

  private getEmbeddings(): EmbeddingEngine {
    if (!this._embeddings) {
      this._embeddings = new EmbeddingEngine();
    }
    return this._embeddings;
  }

  async indexFile(filePath: string): Promise<void> {
    const knex = this.db.getKnex();

    // Normalize incoming path
    let fullPath = path.resolve(filePath).replace(/\\/g, '/');
    if (process.platform === 'win32' && /^[a-z]:/i.test(fullPath)) {
      fullPath = fullPath[0].toLowerCase() + fullPath.slice(1);
    }

    const relativePath = path.relative(this.rootDir, fullPath).replace(/\\/g, '/');
    const hash = await this.scanner.getFileHash(fullPath);

    // 1. Register file
    const existingFile = await knex('files').where({ path: relativePath }).first();
    let fileId: number;
    if (!existingFile) {
      [fileId] = await knex('files').insert({
        path: relativePath,
        hash: hash,
        stale: false,
        last_indexed: knex.fn.now()
      });
    } else {
      fileId = existingFile.id;
      await knex('files').where({ id: fileId }).update({
        hash: hash,
        stale: false,
        last_indexed: knex.fn.now()
      });
    }
    // 1.5 Generate and store semantic embedding
    try {
      const content = await fs.readFile(fullPath, 'utf8');
      const engine = this.getEmbeddings();
      const prepContent = await engine.prepareFileContent(fullPath, content);
      const vector = await engine.generateEmbedding(prepContent);
      const vectorBuffer = Buffer.from(new Float32Array(vector).buffer);

      await knex('files').where({ id: fileId }).update({
        embedding: vectorBuffer
      });
    } catch (e: any) {
      const debugLog = path.resolve(this.rootDir, '.kiteretsu', 'debug.log');
      try { fs.appendFileSync(debugLog, `[Embeddings] Failed for ${path.basename(fullPath)}: ${e.message}\n`); } catch { }
    }

    // 2. Parse symbols & imports
    const parser = await this.getParser();
    const { symbols, imports: importInfos } = await parser.parseCode(fullPath);

    // Symbols
    await knex('symbols').where({ file_id: fileId }).delete();
    
    if (symbols.length > 0) {
      const symbolRecords = symbols.map(sym => ({
        name: sym.name,
        type: sym.type,
        file_id: fileId,
        start_line: sym.startLine,
        end_line: sym.endLine
      }));
      // Batch insert in chunks
      const chunkSize = 100;
      for (let i = 0; i < symbolRecords.length; i += chunkSize) {
        await knex('symbols').insert(symbolRecords.slice(i, i + chunkSize));
      }
    }

    // Imports
    await knex('graph_edges')
      .where({ source_type: 'file', source_id: fileId })
      .whereIn('relation', ['imports', 'imports:type', 'imports:dynamic'])
      .delete();

    const fileExt = path.extname(fullPath);
    const edgeRecords: any[] = [];
    const seenEdges = new Set<string>();

    for (const info of importInfos) {
      const sourceRaw = info.source;
      const relation = info.resolution === 'dynamic'
        ? 'imports:dynamic'
        : info.type === 'type'
          ? 'imports:type'
          : 'imports';

      // ─── RESOLUTION STRATEGY ───
      let potentialTargets: string[] = [];

      if (['.ts', '.tsx', '.js', '.jsx'].includes(fileExt)) {
        // ── JS/TS Resolution ──
        const source = sourceRaw.replace(/\.(js|jsx|ts|tsx)$/, '');
        const resolved = this.resolveImportToPath(path.dirname(fullPath), source) ||
                         this.resolveImportToPath(path.dirname(fullPath), sourceRaw);
        
        if (resolved) {
          potentialTargets.push(resolved);
        } else {
          // Check package map
          let packageName = '';
          let subPath = '';
          if (source.startsWith('@')) {
            const parts = source.split('/');
            packageName = parts.slice(0, 2).join('/');
            subPath = parts.slice(2).join('/');
          } else {
            const parts = source.split('/');
            packageName = parts[0];
            subPath = parts.slice(1).join('/');
          }
          const packageDir = this.packageMap.get(packageName);
          if (packageDir) {
            const resolvedPkg = this.resolveImportToPath(packageDir, subPath || 'src');
            if (resolvedPkg) potentialTargets.push(resolvedPkg);
          }
          // Fallback to root-relative
          if (potentialTargets.length === 0) {
            const resolvedRoot = this.resolveImportToPath(this.rootDir, source);
            if (resolvedRoot) potentialTargets.push(resolvedRoot);
          }
        }
      } else if (fileExt === '.py') {
        // ── Python Resolution ──
        let resolved = this.resolveImportToPath(path.dirname(fullPath), sourceRaw);
        if (!resolved) {
          resolved = this.resolveImportToPath(this.rootDir, sourceRaw);
        }
        if (resolved) potentialTargets.push(resolved);
      } else if (fileExt === '.rs') {
        // ── Rust Resolution ──
        const rustPath = sourceRaw.replace(/::/g, '/');
        const rustTargets: Array<{ baseDir: string; relativePath: string }> = [];

        if (sourceRaw.startsWith('crate')) {
          const crateRoot = this.findRustCrateRoot(fullPath);
          if (crateRoot) {
            rustTargets.push({ baseDir: crateRoot, relativePath: rustPath.replace(/^crate/, 'src') });
          }
          rustTargets.push({ baseDir: path.dirname(fullPath), relativePath: rustPath.replace(/^crate\/?/, '') });
        } else if (sourceRaw.startsWith('super')) {
          rustTargets.push({ baseDir: path.dirname(fullPath), relativePath: rustPath.replace(/^super/, '..') });
        } else if (sourceRaw.startsWith('self')) {
          rustTargets.push({ baseDir: path.dirname(fullPath), relativePath: rustPath.replace(/^self/, '.') });
        } else {
          rustTargets.push({ baseDir: this.rootDir, relativePath: rustPath });
        }

        for (const target of rustTargets) {
          const resolved = this.resolveImportToPath(target.baseDir, target.relativePath);
          if (resolved) potentialTargets.push(resolved);
        }
      } else if (fileExt === '.go') {
        // ── Go Resolution ──
        let localPath = sourceRaw;
        const goMod = this.getGoModuleName();
        if (goMod && sourceRaw.startsWith(goMod)) {
          localPath = sourceRaw.slice(goMod.length).replace(/^\//, '');
        }

        const goBaseDir = localPath.startsWith('.') ? path.dirname(fullPath) : this.rootDir;
        const resolvedDir = this.resolveImportToPath(goBaseDir, localPath);
        if (resolvedDir && fs.existsSync(resolvedDir) && fs.statSync(resolvedDir).isDirectory()) {
          const files = fs.readdirSync(resolvedDir);
          for (const f of files) {
            if (f.endsWith('.go')) potentialTargets.push(path.join(resolvedDir, f));
          }
        } else if (resolvedDir) {
          potentialTargets.push(resolvedDir);
        }
      } else {
        const resolved = this.resolveImportToPath(path.dirname(fullPath), sourceRaw) ||
          this.resolveImportToPath(this.rootDir, sourceRaw);
        if (resolved) potentialTargets.push(resolved);
      }

      for (let targetPath of potentialTargets) {
        targetPath = path.resolve(targetPath).replace(/\\/g, '/');
        if (process.platform === 'win32' && /^[a-z]:/i.test(targetPath)) {
          targetPath = targetPath[0].toLowerCase() + targetPath.slice(1);
        }

        let targetRelative = path.relative(this.rootDir, targetPath).replace(/\\/g, '/');
        if (targetRelative.startsWith('./')) targetRelative = targetRelative.slice(2);

        const target = await knex('files')
          .whereRaw('LOWER(path) = ?', [targetRelative.toLowerCase()])
          .first();

        if (target && target.id !== fileId) {
          const edgeKey = `${fileId}:${target.id}:${relation}`;
          if (!seenEdges.has(edgeKey)) {
            edgeRecords.push({
              source_type: 'file',
              source_id: fileId,
              relation: relation,
              target_type: 'file',
              target_id: target.id,
              confidence: info.resolution === 'dynamic' ? 0.3 : info.type === 'type' ? 0.5 : 0.8,
              provenance: info.resolution === 'dynamic' ? 'dynamic_analysis' : 'static_analysis'
            });
            seenEdges.add(edgeKey);
          }
        }
      }
    }

    if (edgeRecords.length > 0) {
      const chunkSize = 100;
      for (let i = 0; i < edgeRecords.length; i += chunkSize) {
        await knex('graph_edges').insert(edgeRecords.slice(i, i + chunkSize));
      }
    }
  }

  async semanticSearch(query: string, limit: number = 10): Promise<Array<{ path: string; distance: number }>> {
    await this.db.initialize();
    const knex = this.db.getKnex();
    const engine = this.getEmbeddings();
    const vector = await engine.generateEmbedding(query);
    const vectorBuffer = Buffer.from(new Float32Array(vector).buffer);

    // Use scalar distance function for linear search (extremely fast for < 10k files)
    const results = await knex.raw(`
      SELECT 
        path,
        vec_distance_cosine(embedding, ?) as distance
      FROM files
      WHERE embedding IS NOT NULL
      ORDER BY distance ASC
      LIMIT ?
    `, [vectorBuffer, limit]);

    return results;
  }

  async removeFile(filePath: string) {
    const knex = this.db.getKnex();
    let fullPath = path.resolve(filePath).replace(/\\/g, '/');
    if (process.platform === 'win32' && /^[a-z]:/i.test(fullPath)) {
      fullPath = fullPath[0].toLowerCase() + fullPath.slice(1);
    }

    const relativePath = path.relative(this.rootDir, fullPath).replace(/\\/g, '/');
    const file = await knex('files').where({ path: relativePath }).first();

    if (file) {
      // Cascade deletion handles graph_edges and symbols
      await knex('files').where({ id: file.id }).delete();
      // Manually cleanup VSS index as it's a virtual table
      try {
        await knex.raw('DELETE FROM vec_files WHERE rowid = ?', [file.id]);
      } catch { }
    }
  }

  async init() {
    await this.db.initialize();
    await this.populatePackageMap();
    await this.discoverRustCrates();

    // Create default config if it doesn't exist
    const configPath = path.join(this.rootDir, '.kiteretsu', 'config.json');
    if (!fs.existsSync(configPath)) {
      await fs.ensureDir(path.dirname(configPath));
      const excludes = this.detectProjectExcludes();
      await fs.writeJson(configPath, {
        name: path.basename(this.rootDir),
        version: "1.0.0",
        indexing: {
          include: ["**/*"],
          exclude: excludes
        }
      }, { spaces: 2 });
    }
  }

  async index(onProgress?: (current: number, total: number, message: string) => void): Promise<{ files: number; symbols: number; edges: number }> {
    await this.populatePackageMap();
    await this.discoverRustCrates();
    
    if (onProgress) onProgress(0, 100, 'Scanning files...');
    const files = await this.scanner.scan();
    const totalFiles = files.length;
    const knex = this.db.getKnex();

    // Populate file system cache for fast resolution
    this.fileSystemCache.clear();
    for (const f of files) {
      this.fileSystemCache.add(path.resolve(this.rootDir, f).replace(/\\/g, '/'));
    }

    // ─── Pass 1: Register all files & check for changes (Parallel) ───
    const existingFiles = await knex('files').select('id', 'path', 'hash', 'stale', 'embedding');
    const existingFilesMap = new Map(existingFiles.map(f => [f.path, f]));
    
    const limit = pLimit(3);
    const filesToProcess: string[] = [];
    const fileMap = new Map<string, number>();
    let registeredCount = 0;

    await Promise.all(files.map(relativePath => limit(async () => {
      const fullPath = path.resolve(this.rootDir, relativePath);
      const hash = await this.scanner.getFileHash(fullPath);

      const existingFile = existingFilesMap.get(relativePath);
      let fileId: number;

      if (!existingFile) {
        [fileId] = await knex('files').insert({
          path: relativePath,
          hash: hash,
          stale: true, // Mark as stale so Pass 2 indexes it
          last_indexed: knex.fn.now()
        });
        filesToProcess.push(relativePath);
      } else {
        fileId = existingFile.id;
        if (existingFile.hash !== hash || existingFile.stale || !existingFile.embedding) {
          await knex('files').where({ id: fileId }).update({
            hash: hash,
            stale: true,
            last_indexed: knex.fn.now()
          });
          filesToProcess.push(relativePath);
        }
      }
      fileMap.set(relativePath, fileId);
      registeredCount++;
      if (onProgress) onProgress(Math.floor((registeredCount / totalFiles) * 30), 100, `Registering files... (${registeredCount}/${totalFiles})`);
    })));

    // ─── Pass 2: Parse symbols & build dependency graph (Parallel) ───
    let indexedCount = 0;
    const toProcessTotal = filesToProcess.length;

    if (toProcessTotal > 0) {
      await Promise.all(filesToProcess.map(relativePath => limit(async () => {
        const fullPath = path.resolve(this.rootDir, relativePath);
        try {
          await this.indexFile(fullPath);
          // Mark as not stale after successful indexing
          await knex('files').where({ path: relativePath }).update({ stale: false });
        } catch (error: any) {
          const debugLog = path.resolve(this.rootDir, '.kiteretsu', 'debug.log');
          try { fs.appendFileSync(debugLog, `[Indexer] Error indexing ${relativePath}: ${error.message}\n`); } catch { }
        }
        indexedCount++;
        if (onProgress) {
          const percent = 30 + Math.floor((indexedCount / toProcessTotal) * 70);
          onProgress(percent, 100, `Indexing content... (${indexedCount}/${toProcessTotal})`);
        }
      })));
    } else {
      if (onProgress) onProgress(100, 100, 'Indexing complete (up to date)');
    }

    // Refresh counts
    const symbolCount = await knex('symbols').count('id as count').first();
    const edgeCount = await knex('graph_edges').count('id as count').first();
    const totalSymbols = Number(symbolCount?.count || 0);
    const totalEdges = Number(edgeCount?.count || 0);

    return { files: fileMap.size, symbols: totalSymbols, edges: totalEdges };
  }

  private async populatePackageMap() {
    this.packageMap.clear();
    const packagesDir = path.join(this.rootDir, 'packages');
    if (!fs.existsSync(packagesDir)) return;

    const dirs = await fs.readdir(packagesDir);
    for (const dir of dirs) {
      const pkgPath = path.join(packagesDir, dir, 'package.json');
      if (fs.existsSync(pkgPath)) {
        try {
          const pkg = await fs.readJson(pkgPath);
          if (pkg.name) {
            this.packageMap.set(pkg.name, path.join(packagesDir, dir));
          }
        } catch (e) { }
      }
    }

    // Also include root package
    const rootPkgPath = path.join(this.rootDir, 'package.json');
    if (fs.existsSync(rootPkgPath)) {
      try {
        const pkg = await fs.readJson(rootPkgPath);
        if (pkg.name) {
          this.packageMap.set(pkg.name, this.rootDir);
        }
      } catch (e) { }
    }
  }

  private async discoverRustCrates() {
    this.crateMap.clear();
    const cargoFiles = await this.scanner.scan('**/Cargo.toml');
    for (const relPath of cargoFiles) {
      const fullPath = path.resolve(this.rootDir, relPath);
      try {
        const content = await fs.readFile(fullPath, 'utf8');
        const nameMatch = content.match(/^name\s*=\s*["'](.+?)["']/m);
        if (nameMatch) {
          const crateName = nameMatch[1];
          const crateDir = path.dirname(fullPath);
          this.crateMap.set(crateName, crateDir);
          // Also handle snake_case versions (common in Rust imports)
          this.crateMap.set(crateName.replace(/-/g, '_'), crateDir);
        }
      } catch (e) { }
    }
  }

  /** Finds the nearest directory containing Cargo.toml or src/ (Rust crate root) */
  private findRustCrateRoot(filePath: string): string {
    let current = path.dirname(filePath);
    while (current.length >= this.rootDir.length) {
      if (fs.existsSync(path.join(current, 'Cargo.toml')) || fs.existsSync(path.join(current, 'src'))) {
        return current;
      }
      const parent = path.dirname(current);
      if (parent === current) break;
      current = parent;
    }
    return '';
  }

  /** 
   * A more robust resolution strategy that tries to find a file by stripping path segments.
   * Useful for Rust (crate::a::b -> src/a.rs) and Go (pkg/a/b -> pkg directory).
   */
  private resolveImportToPath(baseDir: string, relativePath: string): string | null {
    if (!relativePath) return null;

    // Handle dotted paths (Java, C#, Python, Kotlin, Scala)
    // Only convert if it looks like a dotted path and doesn't have slashes
    let processedPath = relativePath;
    if (!relativePath.includes('/') && !relativePath.includes('\\') && relativePath.includes('.')) {
      processedPath = relativePath.replace(/\./g, '/');
    }

    let currentPath = path.resolve(baseDir, processedPath).replace(/\\/g, '/');

    // Try full path first (with extensions)
    const exact = this.resolveFilePath(currentPath);
    if (exact) return exact;

    // If it's a directory, return it
    if (fs.existsSync(currentPath) && fs.statSync(currentPath).isDirectory()) {
      return currentPath;
    }

    // Strip segments from the right (e.g. models/user/get -> models/user.rs)
    let parts = processedPath.split(/[/\\]/);
    while (parts.length > 1) {
      parts.pop();
      const candidateBase = path.resolve(baseDir, parts.join('/')).replace(/\\/g, '/');
      const found = this.resolveFilePath(candidateBase);
      if (found) return found;

      if (fs.existsSync(candidateBase) && fs.statSync(candidateBase).isDirectory()) {
        return candidateBase;
      }
    }

    // Last resort: search globally in rootDir if it's not a relative path
    if (!relativePath.startsWith('.')) {
      const globalResolved = this.resolveFilePath(path.resolve(this.rootDir, processedPath).replace(/\\/g, '/'));
      if (globalResolved) return globalResolved;
    }

    return null;
  }

  /** Resolve a base path (without extension) to an actual file on disk. */
  private resolveFilePath(targetBase: string): string | null {
    if (this.fileSystemCache.has(targetBase)) {
      return targetBase;
    }

    const exts = [
      '', '.ts', '.tsx', '.js', '.jsx',
      '.py', '.go', '.rs', '.java', '.rb', '.lua',
      '.c', '.cpp', '.cs', '.php', '.swift', '.kt', '.scala',
      '.ps1', '.jl', '.m', '.v', '.sv', '.vue', '.svelte', '.dart', '.ex', '.zig', '.sh', '.h', '.hpp'
    ];
    const candidateBases = [targetBase];
    const parsedTarget = path.parse(targetBase);
    if (parsedTarget.ext) {
      candidateBases.push(path.join(parsedTarget.dir, parsedTarget.name));
    }

    for (const base of candidateBases) {
      for (const ext of exts) {
        const candidate = base + ext;
        if (this.fileSystemCache.has(candidate)) {
          return candidate;
        }
        // Language-specific directory entry points
        const dirCandidates = [
          path.join(base, 'index' + ext).replace(/\\/g, '/'),      // JS/TS
          path.join(base, '__init__' + ext).replace(/\\/g, '/'),    // Python
          path.join(base, 'mod' + ext).replace(/\\/g, '/'),         // Rust
          path.join(base, 'lib' + ext).replace(/\\/g, '/'),         // Rust/Elixir
          path.join(base, 'main' + ext).replace(/\\/g, '/'),        // Go/C
        ];
        for (const dc of dirCandidates) {
          if (this.fileSystemCache.has(dc)) {
            return dc;
          }
        }
      }
    }
    return null;
  }

  /** Detect project type from marker files and return appropriate exclude patterns. */
  private detectProjectExcludes(): string[] {
    const base = [
      '**/.kiteretsu/**',
      '**/.git/**',
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

    // JS/TS
    if (fs.existsSync(path.join(this.rootDir, 'package.json'))) {
      base.push('**/web_modules/**');
    }
    // Rust
    if (fs.existsSync(path.join(this.rootDir, 'Cargo.toml'))) {
      base.push('**/target/**');
    }
    // Python
    if (fs.existsSync(path.join(this.rootDir, 'pyproject.toml')) ||
      fs.existsSync(path.join(this.rootDir, 'requirements.txt')) ||
      fs.existsSync(path.join(this.rootDir, 'setup.py'))) {
      base.push('**/__pycache__/**', '**/.venv/**', '**/venv/**',
        '**/*.pyc', '**/*.egg-info/**');
    }
    // Go
    if (fs.existsSync(path.join(this.rootDir, 'go.mod'))) {
      base.push('**/vendor/**');
    }
    // Java/Kotlin
    if (fs.existsSync(path.join(this.rootDir, 'pom.xml')) ||
      fs.existsSync(path.join(this.rootDir, 'build.gradle')) ||
      fs.existsSync(path.join(this.rootDir, 'build.gradle.kts'))) {
      base.push('**/target/**', '**/.gradle/**', '**/build/**');
    }
    // Swift
    if (fs.existsSync(path.join(this.rootDir, 'Package.swift'))) {
      base.push('**/.build/**');
    }
    // Ruby
    if (fs.existsSync(path.join(this.rootDir, 'Gemfile'))) {
      base.push('**/vendor/bundle/**');
    }

    return [...new Set(base)]; // Deduplicate
  }

  /** Read Go module name from go.mod (cached). */
  private _goModuleName: string | null | undefined = undefined;
  private getGoModuleName(): string | null {
    if (this._goModuleName !== undefined) return this._goModuleName;
    const goModPath = path.join(this.rootDir, 'go.mod');
    if (fs.existsSync(goModPath)) {
      try {
        const content = fs.readFileSync(goModPath, 'utf8');
        const match = content.match(/^module\s+(.+)$/m);
        this._goModuleName = match ? match[1].trim() : null;
      } catch { this._goModuleName = null; }
    } else {
      this._goModuleName = null;
    }
    return this._goModuleName;
  }

  async getContextPack(task: string) {
    const knex = this.db.getKnex();

    // 1. Semantic Tokenization
    const STOP_WORDS = new Set(['implement', 'create', 'update', 'delete', 'change', 'fix', 'add', 'remove', 'the', 'and', 'for', 'with', 'from', 'this', 'that', 'should', 'would', 'could', 'want', 'need', 'task', 'description', 'issue', 'bug', 'feature']);
    const rawKeywords = task.toLowerCase()
      .replace(/[^\w\s]/g, ' ')
      .split(/\s+/)
      .filter(k => k.length > 2 && !STOP_WORDS.has(k));

    if (rawKeywords.length === 0) {
      return { task, strategy: "No actionable keywords found.", read_first: [], blast_radius: [], tests_to_run: [], optional_read: [], rules: [], warnings: ["Task description too short."] };
    }

    // 2. IDF Calculation (Significance)
    const totalFiles = (await knex('files').count('id as count').first())?.count || 1;
    const keywordSignificance = new Map<string, number>();

    for (const kw of rawKeywords) {
      const count = (await knex('files').where('path', 'like', `%${kw}%`).count('id as count').first())?.count || 1;
      // Inverse Document Frequency: higher for rarer words
      const idf = Math.log(Number(totalFiles) / (Number(count) + 1)) + 1;
      keywordSignificance.set(kw, idf);
    }

    // 3. Multi-Field Weighted Scoring
    const scores = new Map<number, { score: number; path: string; summary: string; stale: boolean }>();

    // ─── A. Semantic Pass (Conceptual) ───
    try {
      const semanticResults = await this.semanticSearch(task, 10);
      for (const res of semanticResults) {
        // Convert distance to similarity score (0 to 1)
        const similarity = Math.max(0, 1 - res.distance);
        if (similarity < 0.25) continue;

        const file = await knex('files').where({ path: res.path }).first();
        if (file) {
          const current = scores.get(file.id) || { score: 0, path: file.path, summary: file.summary, stale: !!file.stale };
          current.score += similarity * 15.0; // High weight for conceptual match
          scores.set(file.id, current);
        }
      }
    } catch (e) {
      // Fallback if semantic search fails
    }

    // ─── B. Keyword Pass (Structural) ───
    for (const kw of rawKeywords) {
      const idf = keywordSignificance.get(kw) || 1;

      // Path matches (Weight: 10.0)
      const pathMatches = await knex('files').where('path', 'like', `%${kw}%`).select('id', 'path', 'summary', 'stale');
      for (const f of pathMatches) {
        const current = scores.get(f.id) || { score: 0, path: f.path, summary: f.summary, stale: !!f.stale };
        current.score += 10.0 * idf;
        scores.set(f.id, current);
      }

      // Symbol matches (Weight: 5.0)
      const symbolMatches = await knex('symbols').join('files', 'symbols.file_id', 'files.id')
        .where('symbols.name', 'like', `%${kw}%`).select('files.id', 'files.path', 'files.summary', 'files.stale');
      for (const f of symbolMatches) {
        const current = scores.get(f.id) || { score: 0, path: f.path, summary: f.summary, stale: !!f.stale };
        current.score += 5.0 * idf;
        scores.set(f.id, current);
      }

      // Summary matches (Weight: 2.0)
      const summaryMatches = await knex('files').where('summary', 'like', `%${kw}%`).select('id', 'path', 'summary', 'stale');
      for (const f of summaryMatches) {
        const current = scores.get(f.id) || { score: 0, path: f.path, summary: f.summary, stale: !!f.stale };
        current.score += 2.0 * idf;
        scores.set(f.id, current);
      }
    }

    const allCandidates = Array.from(scores.entries())
      .sort((a, b) => b[1].score - a[1].score);

    if (allCandidates.length === 0) {
      return { task, strategy: "No relevant files found.", read_first: [], blast_radius: [], tests_to_run: [], optional_read: [], rules: [], warnings: [] };
    }

    // Relative pruning: Keep results that are at least 40% as strong as the top result
    const maxScore = allCandidates[0][1].score;
    const topCandidates = allCandidates
      .filter(([id, data]) => data.score >= maxScore * 0.4)
      .slice(0, 10) // Increased capacity for complex tasks
      .map(([id, data]) => ({ id, ...data }));

    // 2. Build Intelligence Accretion (Blast Radius + Rules + Tests)
    const analyzer = await this.getAnalyzer();
    const blastRadiusFiles = new Set<string>();
    const testsToRun = new Set<string>();

    for (const f of topCandidates) {
      const fullPath = path.resolve(this.rootDir, f.path);
      const fileExt = path.extname(f.path).toLowerCase();
      
      // Only calculate blast radius and related tests for actual source code files
      const codeExts = ['.ts', '.tsx', '.js', '.jsx', '.py', '.rs', '.go', '.java', '.kt', '.cpp', '.h', '.cs'];
      if (!codeExts.includes(fileExt)) continue;

      const radius = await analyzer.getBlastRadius(fullPath);
      radius.forEach(r => {
        const rel = r.startsWith('UNRESOLVABLE: ')
          ? `UNRESOLVABLE: ${path.relative(this.rootDir, r.slice('UNRESOLVABLE: '.length)).replace(/\\/g, '/')}`
          : path.relative(this.rootDir, r).replace(/\\/g, '/');
        if (!topCandidates.some(tc => tc.path === rel)) blastRadiusFiles.add(rel);
      });

      const tests = await analyzer.getRelatedTests(fullPath);
      tests.forEach(t => testsToRun.add(path.relative(this.rootDir, t).replace(/\\/g, '/')));
    }

    const rules = await knex('rules').where(builder => {
      for (const kw of rawKeywords) {
        builder.orWhere('name', 'like', `%${kw}%`).orWhere('description', 'like', `%${kw}%`);
      }
    });

    return {
      task,
      strategy: `Context centered on ${topCandidates[0].path.split('/').pop()}`,
      read_first: topCandidates.map(f => ({ path: f.path, summary: f.summary || "No summary" })),
      blast_radius: Array.from(blastRadiusFiles).slice(0, 10),
      tests_to_run: Array.from(testsToRun).slice(0, 5),
      optional_read: [],
      rules: rules.map(r => `${r.name}: ${r.description}`),
      warnings: topCandidates.some(f => f.stale) ? ["Codebase index is stale. Run 'kiteretsu index' to refresh."] : []
    };
  }

  async addRule(name: string, description: string, scopeType: string = 'global', scopeValue: string = '') {
    const knex = this.db.getKnex();
    await knex('rules').insert({
      name,
      description,
      scope_type: scopeType,
      scope_value: scopeValue
    });
  }

  async recordTaskOutcome(task: string, type: string, outcome: string, notes: string) {
    const knex = this.db.getKnex();
    await knex('tasks').insert({
      description: task,
      type,
      outcome,
      notes
    });
  }

  async getRelatedTests(filePaths: string[]): Promise<string[]> {
    const analyzer = await this.getAnalyzer();
    const allTests = new Set<string>();

    for (const filePath of filePaths) {
      const fullPath = path.resolve(this.rootDir, filePath);
      const tests = await analyzer.getRelatedTests(fullPath);
      for (const test of tests) {
        allTests.add(path.relative(this.rootDir, test).replace(/\\/g, '/'));
      }
    }

    return Array.from(allTests);
  }

  async destroy() {
    if (this._parser) {
      this._parser.destroy();
      this._parser = undefined;
    }
    if (this._db) {
      await this._db.destroy();
      this._db = undefined;
    }
  }
}

export * from './database.js';
export * from './scanner.js';
