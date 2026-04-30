import { Database } from './database.js';
import { Scanner } from './scanner.js';
import type { CodeParser } from './parser.js';
import type { CodeAnalyzer } from './analyzer.js';
import path from 'path';
import fs from 'fs-extra';

export interface KiteretsuConfig {
  rootDir: string;
  dbPath?: string;
}

export class Kiteretsu {
  private _db?: Database;
  private _scanner?: Scanner;
  private _parser?: CodeParser;
  private _analyzer?: CodeAnalyzer;
  private rootDir: string;
  private config: KiteretsuConfig;
  private packageMap: Map<string, string> = new Map();

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

    // 2. Parse symbols & imports
    const parser = await this.getParser();
    
    // Symbols
    const symbols = await parser.parseSymbols(fullPath);
    await knex('symbols').where({ file_id: fileId }).delete();
    for (const sym of symbols) {
      await knex('symbols').insert({
        name: sym.name,
        type: sym.type,
        file_id: fileId,
        start_line: sym.startLine,
        end_line: sym.endLine
      });
    }

    // Imports
    const importSources = await parser.parseImports(fullPath);
    await knex('graph_edges')
      .where({ source_type: 'file', source_id: fileId, relation: 'imports' })
      .delete();

    const fileExt = path.extname(fullPath);

    for (const sourceRaw of importSources) {
      let targetPath: string | null = null;

      if (['.ts', '.tsx', '.js', '.jsx'].includes(fileExt)) {
        // ── JS/TS Resolution ──
        const source = sourceRaw.replace(/\.(js|jsx|ts|tsx)$/, '');
        if (source.startsWith('.')) {
          targetPath = this.resolveFilePath(path.resolve(path.dirname(fullPath), source));
        } else {
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
            const srcDir = path.join(packageDir, 'src');
            if (subPath) {
              targetPath = this.resolveFilePath(path.join(srcDir, subPath)) || 
                           this.resolveFilePath(path.join(packageDir, subPath));
            } else {
              targetPath = this.resolveFilePath(srcDir) || this.resolveFilePath(packageDir);
            }
          }
          if (!targetPath) {
            targetPath = this.resolveFilePath(path.resolve(this.rootDir, source));
          }
        }
      } else if (fileExt === '.py') {
        // ── Python Resolution ──
        // sourceRaw is like 'models/user' (dots already converted to slashes)
        targetPath = this.resolveFilePath(path.resolve(this.rootDir, sourceRaw));
        if (!targetPath) {
          targetPath = this.resolveFilePath(path.resolve(path.dirname(fullPath), sourceRaw));
        }
      } else if (fileExt === '.rs') {
        // ── Rust Resolution ──
        // sourceRaw is like 'crate::models::user', 'self::helpers', 'super::config'
        const rustPath = sourceRaw.replace(/::/g, '/');
        if (sourceRaw.startsWith('crate')) {
          targetPath = this.resolveFilePath(path.resolve(this.rootDir, rustPath.replace(/^crate/, 'src')));
        } else if (sourceRaw.startsWith('super')) {
          targetPath = this.resolveFilePath(path.resolve(path.dirname(fullPath), rustPath.replace(/^super/, '..')));
        } else if (sourceRaw.startsWith('self')) {
          targetPath = this.resolveFilePath(path.resolve(path.dirname(fullPath), rustPath.replace(/^self/, '.')));
        }
      } else if (fileExt === '.go') {
        // ── Go Resolution ──
        // sourceRaw is like 'github.com/user/project/internal/api' or 'fmt'
        if (sourceRaw.includes('/')) {
          const goMod = this.getGoModuleName();
          if (goMod && sourceRaw.startsWith(goMod)) {
            const localPath = sourceRaw.slice(goMod.length + 1);
            targetPath = this.resolveFilePath(path.resolve(this.rootDir, localPath));
          }
        }
      } else {
        // ── Generic: try root-relative and file-relative ──
        targetPath = this.resolveFilePath(path.resolve(this.rootDir, sourceRaw));
        if (!targetPath) {
          targetPath = this.resolveFilePath(path.resolve(path.dirname(fullPath), sourceRaw));
        }
      }

      if (targetPath) {
        targetPath = path.resolve(targetPath).replace(/\\/g, '/');
        if (process.platform === 'win32' && /^[a-z]:/i.test(targetPath)) {
          targetPath = targetPath[0].toLowerCase() + targetPath.slice(1);
        }

        let targetRelative = path.relative(this.rootDir, targetPath).replace(/\\/g, '/');
        if (targetRelative.startsWith('./')) targetRelative = targetRelative.slice(2);
        
        const target = await knex('files')
          .whereRaw('LOWER(path) = ?', [targetRelative.toLowerCase()])
          .first();
        
        if (target) {
          await knex('graph_edges').insert({
            source_type: 'file',
            source_id: fileId,
            relation: 'imports',
            target_type: 'file',
            target_id: target.id,
            confidence: 0.8,
            provenance: 'static_analysis'
          });
        }
      }
    }
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
    }
  }

  async init() {
    await this.db.initialize();
    await this.populatePackageMap();

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

  async index(): Promise<{ files: number; symbols: number; edges: number }> {
    await this.populatePackageMap();
    const files = await this.scanner.scan();
    const knex = this.db.getKnex();

    // ─── Pass 1: Register all files in the DB ───
    const fileMap = new Map<string, number>();
    for (const relativePath of files) {
      const fullPath = path.resolve(this.rootDir, relativePath);
      const hash = await this.scanner.getFileHash(fullPath);

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
        if (existingFile.hash !== hash) {
          await knex('files').where({ id: fileId }).update({
            hash: hash,
            stale: true,
            last_indexed: knex.fn.now()
          });
        }
      }
      fileMap.set(relativePath, fileId);
    }

    // ─── Pass 2: Parse symbols & build dependency graph ───
    let totalSymbols = 0;
    let totalEdges = 0;

    for (const relativePath of files) {
      const fullPath = path.resolve(this.rootDir, relativePath);
      
      try {
        await this.indexFile(fullPath);
      } catch (error: any) {
        const debugLog = path.resolve(this.rootDir, '.kiteretsu', 'debug.log');
        try { fs.appendFileSync(debugLog, `[Indexer] Error indexing ${relativePath}: ${error.message}\n`); } catch {} 
      }
    }

    // Refresh counts
    const symbolCount = await knex('symbols').count('id as count').first();
    const edgeCount = await knex('graph_edges').count('id as count').first();
    totalSymbols = Number(symbolCount?.count || 0);
    totalEdges = Number(edgeCount?.count || 0);

    // Mark all indexed files as not stale
    const allIds = Array.from(fileMap.values());
    if (allIds.length > 0) {
      await knex('files').whereIn('id', allIds).update({ stale: false });
    }

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

  /** Resolve a base path (without extension) to an actual file on disk. */
  private resolveFilePath(targetBase: string): string | null {
    const exts = [
      '', '.ts', '.tsx', '.js', '.jsx', 
      '.py', '.go', '.rs', '.java', '.rb', 
      '.c', '.cpp', '.cs', '.php', '.swift'
    ];
    for (const ext of exts) {
      const candidate = targetBase + ext;
      if (fs.existsSync(candidate) && fs.statSync(candidate).isFile()) {
        return candidate;
      }
      // Language-specific directory entry points
      const dirCandidates = [
        path.join(targetBase, 'index' + ext),      // JS/TS
        path.join(targetBase, '__init__' + ext),    // Python
        path.join(targetBase, 'mod' + ext),         // Rust
      ];
      for (const dc of dirCandidates) {
        if (fs.existsSync(dc) && fs.statSync(dc).isFile()) {
          return dc;
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
      '**/scratch/**',
      '**/temp/**',
    ];

    // JS/TS
    if (fs.existsSync(path.join(this.rootDir, 'package.json'))) {
      base.push('**/node_modules/**', '**/dist/**', '**/build/**',
                '**/pnpm-lock.yaml', '**/package-lock.json', '**/yarn.lock');
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

    const topCandidates = Array.from(scores.entries())
      .sort((a, b) => b[1].score - a[1].score)
      .slice(0, 7) // Increased candidate pool
      .map(([id, data]) => ({ id, ...data }));

    if (topCandidates.length === 0) {
      return { task, strategy: "No relevant files found.", read_first: [], blast_radius: [], tests_to_run: [], optional_read: [], rules: [], warnings: [] };
    }

    // 2. Build Intelligence Accretion (Blast Radius + Rules + Tests)
    const analyzer = await this.getAnalyzer();
    const blastRadiusFiles = new Set<string>();
    const testsToRun = new Set<string>();

    for (const f of topCandidates) {
      const fullPath = path.resolve(this.rootDir, f.path);
      const radius = await analyzer.getBlastRadius(fullPath);
      radius.forEach(r => {
        const rel = path.relative(this.rootDir, r).replace(/\\/g, '/');
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
    if (this._db) {
      await this._db.destroy();
    }
  }
}

export * from './database.js';
export * from './scanner.js';
