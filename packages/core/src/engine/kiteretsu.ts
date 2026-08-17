import path from 'path';
import fs from 'fs-extra';
import { Database } from '../database.js';
import { Scanner } from '../scanner.js';
import type { CodeParser } from '../parser.js';
import type { CodeAnalyzer } from '../analyzer.js';
import { EmbeddingEngine } from '../embeddings.js';
import { GraphStore } from '../graph/graph-store.js';
import { RuleStore } from '../memory/rules.js';
import { TaskStore, TaskRecord } from '../memory/tasks.js';
import { DecisionStore, DecisionRecord } from '../memory/decisions.js';
import { HybridRetriever } from '../retrieval/hybrid.js';
import { SemanticRetriever, SemanticSearchResult } from '../retrieval/semantic.js';
import { Indexer, PrecomputedData, IndexProgressCallback, IndexSummary } from '../indexer/indexer.js';
import { ContextCompiler, ContextPackOptions, ContextPackResult } from '../context/context-compiler.js';
import { KiteretsuConfig } from './types.js';

export class Kiteretsu {
  private _db?: Database;
  private _scanner?: Scanner;
  private _parser?: CodeParser;
  private _analyzer?: CodeAnalyzer;
  private _embeddings?: EmbeddingEngine;
  private _graphStore?: GraphStore;
  private _ruleStore?: RuleStore;
  private _taskStore?: TaskStore;
  private _decisionStore?: DecisionStore;
  private _retriever?: HybridRetriever;
  private _semanticRetriever?: SemanticRetriever;
  private _indexer?: Indexer;
  private _compiler?: ContextCompiler;

  private rootDir: string;
  private config: KiteretsuConfig;

  constructor(config: KiteretsuConfig) {
    this.rootDir = path.resolve(config.rootDir).replace(/\\/g, '/');
    if (process.platform === 'win32' && /^[a-z]:/i.test(this.rootDir)) {
      this.rootDir = this.rootDir[0].toLowerCase() + this.rootDir.slice(1);
    }
    this.config = config;
  }

  getRootDir(): string {
    return this.rootDir;
  }

  get db(): Database {
    if (!this._db) {
      const dbPath = this.config.dbPath || path.join(this.rootDir, '.kiteretsu', 'memory', 'kiteretsu.sqlite');
      this._db = new Database(dbPath);
    }
    return this._db;
  }

  public getDatabase(): Database {
    return this.db;
  }

  get graphStore(): GraphStore {
    if (!this._graphStore) {
      this._graphStore = new GraphStore(this.db);
    }
    return this._graphStore;
  }

  get ruleStore(): RuleStore {
    if (!this._ruleStore) {
      this._ruleStore = new RuleStore(this.db);
    }
    return this._ruleStore;
  }

  get taskStore(): TaskStore {
    if (!this._taskStore) {
      this._taskStore = new TaskStore(this.db, () => this.embeddings);
    }
    return this._taskStore;
  }

  get decisionStore(): DecisionStore {
    if (!this._decisionStore) {
      this._decisionStore = new DecisionStore(this.db, () => this.embeddings);
    }
    return this._decisionStore;
  }

  get scanner(): Scanner {
    if (!this._scanner) {
      const rootConfigPath = path.join(this.rootDir, 'kiteretsu.config.json');
      const internalConfigPath = path.join(this.rootDir, '.kiteretsu', 'config.json');

      let scanOptions: { rootDir: string; include?: string[]; exclude?: string[] } = { rootDir: this.rootDir };
      const configPath = fs.existsSync(rootConfigPath) ? rootConfigPath : (fs.existsSync(internalConfigPath) ? internalConfigPath : null);

      if (configPath) {
        try {
          const fileConfig = fs.readJsonSync(configPath);
          if (fileConfig.indexing) {
            scanOptions.include = fileConfig.indexing.include;
            scanOptions.exclude = fileConfig.indexing.exclude;
          }
        } catch { }
      }

      this._scanner = new Scanner(scanOptions);
    }
    return this._scanner;
  }

  get embeddings(): EmbeddingEngine {
    if (!this._embeddings) {
      this._embeddings = new EmbeddingEngine();
    }
    return this._embeddings;
  }

  async getParser(): Promise<CodeParser> {
    if (!this._parser) {
      const { CodeParser } = await import('../parser.js');
      this._parser = new CodeParser();
    }
    return this._parser;
  }

  async getAnalyzer(): Promise<CodeAnalyzer> {
    if (!this._analyzer) {
      const { CodeAnalyzer } = await import('../analyzer.js');
      this._analyzer = new CodeAnalyzer(this.rootDir, this.db);
    }
    return this._analyzer;
  }

  get analyzer(): CodeAnalyzer {
    if (!this._analyzer) throw new Error('Analyzer not initialized. Call init() or getAnalyzer() first.');
    return this._analyzer;
  }

  get indexer(): Indexer {
    if (!this._indexer) {
      this._indexer = new Indexer(
        this.rootDir,
        this.db,
        this.scanner,
        this.graphStore,
        () => this.getParser(),
        () => this.embeddings
      );
    }
    return this._indexer;
  }

  get hybridRetriever(): HybridRetriever {
    if (!this._retriever) {
      this._retriever = new HybridRetriever(this.db.getKnex(), this.embeddings);
    }
    return this._retriever;
  }

  get contextCompiler(): ContextCompiler {
    if (!this._compiler) {
      this._compiler = new ContextCompiler(
        this.rootDir,
        this.hybridRetriever,
        this.ruleStore,
        () => this.getAnalyzer(),
        this.taskStore,
        this.decisionStore
      );
    }
    return this._compiler;
  }

  async init(): Promise<void> {
    await this.db.initialize();

    const kiteretsuDir = path.join(this.rootDir, '.kiteretsu');
    await fs.ensureDir(kiteretsuDir);
    await fs.ensureDir(path.join(kiteretsuDir, 'memory'));

    const configPath = path.join(this.rootDir, 'kiteretsu.config.json');
    if (!(await fs.pathExists(configPath))) {
      const detectedExcludes = [
        '**/.kiteretsu/**', '**/.git/**', '**/.turbo/**', '**/.cache/**',
        '**/.next/**', '**/.nuxt/**', '**/.svelte-kit/**', '**/.gradle/**',
        '**/.venv/**', '**/venv/**', '**/__pycache__/**', '**/node_modules/**',
        '**/dist/**', '**/build/**', '**/target/**', '**/vendor/**', '**/coverage/**', '**/out/**'
      ];
      const initialConfig = {
        name: path.basename(this.rootDir),
        version: '0.1.0',
        indexing: {
          include: ['**/*'],
          exclude: detectedExcludes
        }
      };
      await fs.writeJson(configPath, initialConfig, { spaces: 2 });
    }

    const ignorePath = path.join(this.rootDir, '.kiteretsuignore');
    if (!(await fs.pathExists(ignorePath))) {
      const content = [
        '# Kiteretsu Ignore Patterns',
        '# Add files and directories here that should not be indexed.',
        '*.min.js',
        '*.min.css',
        '*.map',
        '*.lock',
        '*.wasm',
        'dist/',
        'build/',
        'target/',
        '.turbo/',
        '.cache/',
        '',
        '# Custom ignores below',
      ].join('\n');
      await fs.writeFile(ignorePath, content);
    }
  }

  async indexFile(filePath: string, precomputed?: PrecomputedData): Promise<void> {
    return this.indexer.indexFile(filePath, precomputed);
  }

  async index(onProgress?: IndexProgressCallback): Promise<IndexSummary> {
    return this.indexer.index(onProgress);
  }

  async removeFile(filePath: string): Promise<void> {
    return this.indexer.removeFile(filePath);
  }

  async semanticSearch(query: string, limit: number = 10): Promise<SemanticSearchResult[]> {
    await this.db.initialize();
    if (!this._semanticRetriever) {
      this._semanticRetriever = new SemanticRetriever(this.db.getKnex(), this.embeddings);
    }
    return this._semanticRetriever.search(query, limit);
  }

  async getContextPack(task: string, options?: ContextPackOptions): Promise<ContextPackResult> {
    await this.db.initialize();
    return this.contextCompiler.compile(task, options);
  }

  async addRule(name: string, description: string, scopeType: string = 'global', scopeValue: string = ''): Promise<void> {
    await this.db.initialize();
    return this.ruleStore.addOrUpdateRule(name, description, scopeType, scopeValue);
  }

  async recordTaskOutcome(task: string, type: string, outcome: string, notes: string): Promise<void> {
    await this.db.initialize();
    return this.taskStore.recordTask(task, type, outcome, notes);
  }

  async getSimilarTasks(query: string, limit: number = 3): Promise<TaskRecord[]> {
    await this.db.initialize();
    return this.taskStore.getSimilarTasks(query, limit);
  }

  async recordDecision(
    title: string,
    rationale: string,
    alternativesConsidered: string = '',
    affectedPaths: string[] = [],
    status: 'active' | 'deprecated' | 'superseded' = 'active'
  ): Promise<number> {
    await this.db.initialize();
    return this.decisionStore.recordDecision(title, rationale, alternativesConsidered, affectedPaths, status);
  }

  async getAllDecisions(): Promise<DecisionRecord[]> {
    await this.db.initialize();
    return this.decisionStore.getAllDecisions();
  }

  async getRelevantDecisions(query: string, candidatePaths: string[] = [], limit: number = 3): Promise<DecisionRecord[]> {
    await this.db.initialize();
    return this.decisionStore.getRelevantDecisions(query, candidatePaths, limit);
  }

  async getBlastRadius(filePath: string): Promise<string[]> {
    await this.db.initialize();
    const analyzer = await this.getAnalyzer();
    return analyzer.getBlastRadius(filePath);
  }

  async getSymbolCallers(symbolName: string, filePath?: string) {
    const analyzer = await this.getAnalyzer();
    return analyzer.getSymbolCallers(symbolName, filePath);
  }

  async getSymbolCallees(symbolName: string, filePath?: string) {
    const analyzer = await this.getAnalyzer();
    return analyzer.getSymbolCallees(symbolName, filePath);
  }

  async getSymbolGraph(symbolName: string, filePath?: string) {
    const analyzer = await this.getAnalyzer();
    return analyzer.getSymbolGraph(symbolName, filePath);
  }

  async getRelatedTests(filePathOrFiles: string | string[]): Promise<string[]> {
    const analyzer = await this.getAnalyzer();
    const files = Array.isArray(filePathOrFiles) ? filePathOrFiles : [filePathOrFiles];
    const allTests = new Set<string>();

    for (const f of files) {
      const fullPath = path.resolve(this.rootDir, f);
      const tests = await analyzer.getRelatedTests(fullPath);
      for (const test of tests) {
        allTests.add(path.relative(this.rootDir, test).replace(/\\/g, '/'));
      }
    }

    return Array.from(allTests);
  }

  async destroy(): Promise<void> {
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
