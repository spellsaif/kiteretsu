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

  constructor(config: KiteretsuConfig) {
    this.rootDir = config.rootDir;
    this.config = config;
  }

  get db(): Database {
    if (!this._db) {
      const dbPath = this.config.dbPath || path.join(this.rootDir, '.kiteretsu', 'memory', 'kiteretsu.sqlite');
      this._db = new Database(dbPath);
    }
    return this._db;
  }

  get scanner(): Scanner {
    if (!this._scanner) {
      // Read exclusions from config.json if available
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

  private async getAnalyzer(): Promise<CodeAnalyzer> {
    if (!this._analyzer) {
      const { CodeAnalyzer } = await import('./analyzer.js');
      this._analyzer = new CodeAnalyzer(this.rootDir, this.db);
    }
    return this._analyzer;
  }

  async init() {
    await this.db.initialize();

    // Create default config if it doesn't exist
    const configPath = path.join(this.rootDir, '.kiteretsu', 'config.json');
    if (!fs.existsSync(configPath)) {
      await fs.ensureDir(path.dirname(configPath));
      await fs.writeJson(configPath, {
        name: path.basename(this.rootDir),
        version: "1.0.0",
        indexing: {
          include: ["**/*"],
          exclude: [
            "**/node_modules/**",
            "**/dist/**",
            "**/build/**",
            "**/.kiteretsu/**",
            "**/.git/**",
            "**/scratch/**",
            "**/temp/**",
            "**/pnpm-lock.yaml",
            "**/package-lock.json",
            "**/yarn.lock"
          ]
        }
      }, { spaces: 2 });
    }
  }

  async index(): Promise<{ files: number; symbols: number; edges: number }> {
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
      const ext = path.extname(fullPath);

      if (!['.ts', '.tsx', '.js', '.jsx'].includes(ext)) continue;

      const fileId = fileMap.get(relativePath);
      if (!fileId) continue;

      try {
        const parser = await this.getParser();

        // ── Symbols ──
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
          totalSymbols++;
        }

        // ── Import Edges ──
        const importSources = await parser.parseImports(fullPath);
        await knex('graph_edges')
          .where({ source_type: 'file', source_id: fileId, relation: 'imports' })
          .delete();

        for (const source of importSources) {
          if (!source.startsWith('.')) continue;

          const sourceDir = path.dirname(fullPath);
          let targetBase = path.resolve(sourceDir, source);

          // Handle ESM style imports: .js/.jsx → .ts/.tsx
          if (targetBase.endsWith('.js')) targetBase = targetBase.slice(0, -3);
          if (targetBase.endsWith('.jsx')) targetBase = targetBase.slice(0, -4);

          const resolvedPath = this.resolveFilePath(targetBase);
          if (!resolvedPath) continue;

          const targetRelativePath = path.relative(this.rootDir, resolvedPath).replace(/\\/g, '/');
          const targetId = fileMap.get(targetRelativePath);

          if (targetId) {
            await knex('graph_edges').insert({
              source_type: 'file',
              source_id: fileId,
              relation: 'imports',
              target_type: 'file',
              target_id: targetId,
              confidence: 1.0,
              provenance: 'static_analysis'
            });
            totalEdges++;
          }
        }
      } catch (error) {
        // Silently skip unparseable files
      }
    }

    // Mark all indexed files as not stale
    const allIds = Array.from(fileMap.values());
    if (allIds.length > 0) {
      await knex('files').whereIn('id', allIds).update({ stale: false });
    }

    return { files: fileMap.size, symbols: totalSymbols, edges: totalEdges };
  }

  /** Resolve a base path (without extension) to an actual file on disk. */
  private resolveFilePath(targetBase: string): string | null {
    const exts = ['', '.ts', '.tsx', '.js', '.jsx'];
    for (const ext of exts) {
      const candidate = targetBase + ext;
      if (fs.existsSync(candidate) && fs.statSync(candidate).isFile()) {
        return candidate;
      }
      const indexCandidate = path.join(targetBase, 'index' + ext);
      if (fs.existsSync(indexCandidate) && fs.statSync(indexCandidate).isFile()) {
        return indexCandidate;
      }
    }
    return null;
  }

  async getContextPack(task: string) {
    const knex = this.db.getKnex();
    const keywords = task.toLowerCase().split(/\s+/).filter(k => k.length > 2);

    // Guard: if no useful keywords, return early
    if (keywords.length === 0) {
      return {
        task,
        strategy: "No actionable keywords found in the task description.",
        read_first: [],
        blast_radius: [],
        tests_to_run: [],
        optional_read: [],
        rules: [],
        warnings: ["Task description is too short or vague. Try a more specific description."]
      };
    }

    // Smarter search: prioritize filename matches, then symbol matches
    const keywordResults = await knex('files')
      .leftJoin('symbols', 'files.id', 'symbols.file_id')
      .where((builder) => {
        for (const kw of keywords) {
          builder.orWhere('files.path', 'like', `%${kw}%`);
          builder.orWhere('symbols.name', 'like', `%${kw}%`);
        }
      })
      .select('files.path', 'files.id', 'files.summary')
      .select(knex.raw(`
        CASE
          WHEN files.path LIKE ? THEN 100
          WHEN files.path LIKE ? THEN 50
          ELSE 1
        END as rank
      `, [`%${keywords[0]}%`, `%${keywords[keywords.length - 1]}%`]))
      .distinct()
      .orderBy('rank', 'desc')
      .limit(10);

    const candidateFiles = keywordResults.map(f => ({
      path: f.path,
      summary: f.summary || "No summary available."
    }));

    const rules = await knex('rules')
      .where((builder) => {
        for (const kw of keywords) {
          builder.orWhere('name', 'like', `%${kw}%`);
          builder.orWhere('description', 'like', `%${kw}%`);
        }
      });

    // Calculate Blast Radius & Test Mapping for top files
    const blastRadius: string[] = [];
    const testsToRun: string[] = [];
    const analyzer = await this.getAnalyzer();

    for (const file of candidateFiles.slice(0, 5)) {
      try {
        const fullPath = path.join(this.rootDir, file.path);

        const radius = await analyzer.getBlastRadius(fullPath);
        for (const related of radius) {
          const relPath = path.relative(this.rootDir, related).replace(/\\/g, '/');
          if (!blastRadius.includes(relPath) && !candidateFiles.some(c => c.path === relPath)) {
            blastRadius.push(relPath);
          }
        }

        const tests = await analyzer.getRelatedTests(fullPath);
        for (const test of tests) {
          const relPath = path.relative(this.rootDir, test).replace(/\\/g, '/');
          if (!testsToRun.includes(relPath)) testsToRun.push(relPath);
        }
      } catch (e) {
        // file might not exist or be parseable by TS
      }
    }

    return {
      task,
      strategy: "Determine your own strategy based on the files and blast radius provided.",
      read_first: candidateFiles.map(f => ({
        path: f.path,
        summary: f.summary
      })),
      blast_radius: blastRadius,
      tests_to_run: testsToRun,
      optional_read: [],
      rules: rules.map(r => r.name + ': ' + r.description),
      warnings: candidateFiles.length === 0 ? ["No relevant files found. Try a more specific task description."] : []
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

  async destroy() {
    if (this._db) {
      await this._db.destroy();
    }
  }
}

export * from './database.js';
export * from './scanner.js';
