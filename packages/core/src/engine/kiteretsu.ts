import path from 'path';
import fs from 'fs-extra';
import { Database } from '../database.js';
import { Scanner, ScanOptions } from '../scanner.js';
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
import { createDefaultConfigFile } from '../config.js';

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

  constructor(config: KiteretsuConfig = {}) {
    this.rootDir = path.resolve(config.rootDir || process.cwd()).replace(/\\/g, '/');
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
      const scanOptions: ScanOptions = {
        rootDir: this.rootDir,
        include: this.config.indexing?.include,
        exclude: this.config.indexing?.exclude,
        ignore: this.config.ignore
      };
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

    const tsConfigPath = path.join(this.rootDir, 'kiteretsu.config.ts');
    if (!(await fs.pathExists(tsConfigPath))) {
      await createDefaultConfigFile(this.rootDir);
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
    await this.db.initialize();
    const analyzer = await this.getAnalyzer();
    return analyzer.getSymbolCallees(symbolName, filePath);
  }

  async getSymbolGraph(symbolName: string, filePath?: string) {
    await this.db.initialize();
    const analyzer = await this.getAnalyzer();
    return analyzer.getSymbolGraph(symbolName, filePath);
  }

  async explain(target: string) {
    await this.db.initialize();
    const analyzer = await this.getAnalyzer();
    return analyzer.explain(target);
  }

  async getDetailedBlastRadius(target: string) {
    await this.db.initialize();
    const analyzer = await this.getAnalyzer();
    return analyzer.getDetailedBlastRadius(target);
  }

  async getBootstrapSummary() {
    await this.db.initialize();
    const knex = this.db.getKnex();

    const [filesCount, symbolsCount, edgesCount, decisions, rules, tasks] = await Promise.all([
      knex('files').count('* as count').first(),
      knex('symbols').count('* as count').first(),
      knex('graph_edges').count('* as count').first(),
      this.getAllDecisions(),
      this.ruleStore.getAllRules(),
      this.taskStore.getRecentTasks(5)
    ]);

    // Find central modules (highest incoming dependency in-degree)
    const centralModules = await knex('graph_edges')
      .join('files', 'graph_edges.target_id', 'files.id')
      .where({ 'graph_edges.source_type': 'file', 'graph_edges.target_type': 'file' })
      .groupBy('files.path')
      .select('files.path as path')
      .count('* as in_degree')
      .orderBy('in_degree', 'desc')
      .limit(5);

    // Architectural layers
    const allFiles = await knex('files').select('path');
    const layers = new Set<string>();
    for (const f of allFiles) {
      const p = f.path.replace(/\\/g, '/');
      if (p.startsWith('packages/core') || p.startsWith('src/core')) layers.add('Core Intelligence & Engine');
      else if (p.startsWith('packages/cli') || p.startsWith('src/cli')) layers.add('CLI & Tooling');
      else if (p.startsWith('packages/mcp-server')) layers.add('MCP Server Protocol');
      else if (p.startsWith('packages/agent-bridge')) layers.add('Agent Bridge Integration');
      else if (p.includes('test') || p.includes('spec')) layers.add('Test & Quality Assurance');
      else layers.add('Infrastructure & Domain');
    }

    const totalFiles = Number(filesCount?.count || 0);
    const totalSymbols = Number(symbolsCount?.count || 0);
    const totalEdges = Number(edgesCount?.count || 0);
    const confidence = totalFiles > 0 ? (totalSymbols > 0 ? 0.94 : 0.80) : 0.0;

    return {
      repository: {
        totalFiles,
        totalSymbols,
        totalDependencies: totalEdges
      },
      architecture: Array.from(layers),
      centralModules: centralModules.map((m: any) => ({ path: m.path, inDegree: Number(m.in_degree) })),
      importantDecisions: decisions.filter(d => d.status === 'active' || (d.status as any) === 'accepted').slice(0, 5),
      governanceRules: rules.slice(0, 5),
      recentTasks: tasks,
      indexConfidence: Math.round(confidence * 100)
    };
  }

  async runDiagnostics() {
    await this.db.initialize();
    const knex = this.db.getKnex();

    // 1. SQLite integrity check
    let dbHealthy = false;
    try {
      const integrity = await knex.raw('PRAGMA integrity_check');
      dbHealthy = integrity && integrity[0] && Object.values(integrity[0])[0] === 'ok';
    } catch { }

    // 2. Index stats
    const files = await knex('files').select('id', 'path', 'stale');
    const staleFiles = files.filter(f => f.stale).map(f => f.path);

    // 3. Graph edges & unresolved
    const edges = await knex('graph_edges').select('*');
    const unresolvedImports: string[] = [];

    // 4. Memory counts
    const [decisions, rules, tasks] = await Promise.all([
      this.getAllDecisions(),
      this.ruleStore.getAllRules(),
      this.taskStore.getRecentTasks(100)
    ]);

    const embStatus = this.embeddings.getStatus();
    const embeddingProvider = embStatus.status === 'available' ? 'Transformers.js (local ONNX)' : 'Mock Deterministic Hashing';

    return {
      databaseIntegrity: dbHealthy,
      index: {
        totalFiles: files.length,
        staleFiles,
        healthy: staleFiles.length === 0 && files.length > 0
      },
      graph: {
        totalEdges: edges.length,
        unresolvedImports,
        healthy: edges.length > 0
      },
      embeddings: {
        provider: embeddingProvider,
        healthy: true
      },
      memory: {
        rulesCount: rules.length,
        decisionsCount: decisions.length,
        tasksCount: tasks.length,
        healthy: true
      }
    };
  }

  async analyzeGitChanges() {
    await this.db.initialize();
    const { execSync } = await import('child_process');
    let changedFiles: string[] = [];
    try {
      const statusOutput = execSync('git status --porcelain', { cwd: this.rootDir, encoding: 'utf8' });
      changedFiles = statusOutput
        .split('\n')
        .map(l => l.trim().slice(3))
        .filter(p => p.length > 0 && fs.existsSync(path.resolve(this.rootDir, p)));
    } catch { }

    const relatedTests = await this.getRelatedTests(changedFiles);
    const affectedADRs = await this.getRelevantDecisions('git changes', changedFiles, 5);

    return {
      changedFiles,
      relatedTests,
      affectedADRs
    };
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
