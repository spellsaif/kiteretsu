import path from 'path';
import fs from 'fs-extra';
import { Knex } from 'knex';
import { Database } from '../database.js';
import { Scanner } from '../scanner.js';
import { CodeParser, SymbolInfo, ImportInfo } from '../parser.js';
import { EmbeddingEngine } from '../embeddings.js';
import { GraphStore, GraphEdgeRecord, SymbolRecord } from '../graph/graph-store.js';
import { DependencyResolverRegistry } from '../graph/resolvers/index.js';
import { generateTechnicalGist } from './gist.js';

export interface PrecomputedData {
  symbols: SymbolInfo[];
  imports: ImportInfo[];
  gist: string;
  embedding: Buffer | null;
}

export interface IndexProgressCallback {
  (current: number, total: number, message: string): void;
}

export interface IndexSummary {
  files: number;
  symbols: number;
  edges: number;
  deleted?: number;
}

export class Indexer {
  private packageMap: Map<string, string> = new Map();
  private crateMap: Map<string, string> = new Map();
  private fileSystemCache: Set<string> = new Set();
  private resolvers: DependencyResolverRegistry;
  private _goModuleName?: string;

  constructor(
    private rootDir: string,
    private db: Database,
    private scanner: Scanner,
    private graphStore: GraphStore,
    private getParser: () => Promise<CodeParser>,
    private getEmbeddings: () => EmbeddingEngine
  ) {
    this.resolvers = new DependencyResolverRegistry();
  }

  async populatePackageMap(): Promise<void> {
    this.packageMap.clear();
    const packagesDir = path.join(this.rootDir, 'packages');
    if (!(await fs.pathExists(packagesDir))) return;

    const dirs = await fs.readdir(packagesDir);
    for (const dir of dirs) {
      const pkgPath = path.join(packagesDir, dir, 'package.json');
      if (await fs.pathExists(pkgPath)) {
        try {
          const pkg = await fs.readJson(pkgPath);
          if (pkg.name) {
            this.packageMap.set(pkg.name, path.join(packagesDir, dir));
          }
        } catch { }
      }
    }
  }

  async discoverRustCrates(): Promise<void> {
    this.crateMap.clear();
    const manifestFiles = await this.scanner.scan('**/Cargo.toml');
    for (const manifestRel of manifestFiles) {
      const manifestFull = path.resolve(this.rootDir, manifestRel);
      const crateDir = path.dirname(manifestFull);
      try {
        const content = await fs.readFile(manifestFull, 'utf8');
        const nameMatch = content.match(/\[package\][^\[]*name\s*=\s*"([^"]+)"/);
        if (nameMatch) {
          const crateName = nameMatch[1];
          this.crateMap.set(crateName, crateDir);
          this.crateMap.set(crateName.replace(/-/g, '_'), crateDir);
        }
      } catch { }
    }
  }

  async getGoModuleName(): Promise<string | undefined> {
    if (this._goModuleName !== undefined) return this._goModuleName;
    const goModPath = path.join(this.rootDir, 'go.mod');
    if (await fs.pathExists(goModPath)) {
      try {
        const content = await fs.readFile(goModPath, 'utf8');
        const match = content.match(/^module\s+([^\s\n\r]+)/m);
        if (match) {
          this._goModuleName = match[1].trim();
          return this._goModuleName;
        }
      } catch { }
    }
    return undefined;
  }

  private async buildSymbolEdges(
    fileId: number,
    symbols: SymbolInfo[],
    insertedSymbols: SymbolRecord[],
    trx: Knex.Transaction | Knex
  ): Promise<GraphEdgeRecord[]> {
    const localSymbolMap = new Map<string, number>();
    for (const sym of insertedSymbols) {
      if (sym.id) localSymbolMap.set(sym.name, sym.id);
    }

    const symbolEdges: GraphEdgeRecord[] = [];
    const seenSymbolEdges = new Set<string>();

    // File -> exports -> Symbol
    for (const sym of insertedSymbols) {
      if (!sym.id) continue;
      const edgeKey = `file:${fileId}:exports:symbol:${sym.id}`;
      if (!seenSymbolEdges.has(edgeKey)) {
        symbolEdges.push({
          source_type: 'file',
          source_id: fileId,
          relation: 'exports',
          target_type: 'symbol',
          target_id: sym.id,
          confidence: 1.0,
          provenance: 'ast'
        });
        seenSymbolEdges.add(edgeKey);
      }
    }

    // Symbol -> calls / extends / implements / references -> Symbol
    for (let i = 0; i < symbols.length; i++) {
      const parsedSym = symbols[i];
      const insertedSym = insertedSymbols[i];
      if (!insertedSym?.id || !parsedSym.relations) continue;

      for (const rel of parsedSym.relations) {
        let targetSymbolId = localSymbolMap.get(rel.targetName);

        if (!targetSymbolId) {
          const externalSym = await trx('symbols')
            .where('symbols.name', rel.targetName)
            .select('symbols.id as id')
            .first();
          if (externalSym) {
            targetSymbolId = externalSym.id;
          }
        }

        if (targetSymbolId && targetSymbolId !== insertedSym.id) {
          const edgeKey = `symbol:${insertedSym.id}:${rel.kind}:symbol:${targetSymbolId}`;
          if (!seenSymbolEdges.has(edgeKey)) {
            symbolEdges.push({
              source_type: 'symbol',
              source_id: insertedSym.id,
              relation: rel.kind as any,
              target_type: 'symbol',
              target_id: targetSymbolId,
              confidence: 0.95,
              provenance: 'ast'
            });
            seenSymbolEdges.add(edgeKey);
          }
        }
      }
    }

    return symbolEdges;
  }

  async indexFile(filePath: string, precomputed?: PrecomputedData): Promise<void> {
    const knex = this.db.getKnex();
    let fullPath = path.resolve(filePath).replace(/\\/g, '/');
    if (process.platform === 'win32' && /^[a-z]:/i.test(fullPath)) {
      fullPath = fullPath[0].toLowerCase() + fullPath.slice(1);
    }

    const relativePath = path.relative(this.rootDir, fullPath).replace(/\\/g, '/');
    this.fileSystemCache.add(fullPath);

    const hash = await this.scanner.getFileHash(fullPath);
    const { id: fileId } = await this.graphStore.upsertFile(relativePath, hash);

    // 1. Parse symbols & imports
    let symbols = precomputed?.symbols;
    let importInfos = precomputed?.imports;
    if (!symbols || !importInfos) {
      const parser = await this.getParser();
      const parsed = await parser.parseCode(fullPath);
      symbols = parsed.symbols;
      importInfos = parsed.imports;
    }

    // 2. Technical Gist
    const gist = precomputed?.gist || generateTechnicalGist(path.basename(fullPath), symbols, importInfos);

    // 3. Generate Embedding
    let vectorBuffer: Buffer | null = precomputed ? precomputed.embedding : null;
    if (!precomputed) {
      try {
        const vector = await this.getEmbeddings().generateEmbedding(gist);
        if (vector && vector.length > 0) {
          vectorBuffer = Buffer.from(new Float32Array(vector).buffer);
        }
      } catch (e: any) {
        const debugLog = path.resolve(this.rootDir, '.kiteretsu', 'debug.log');
        try { fs.appendFileSync(debugLog, `[Embeddings] Failed for ${path.basename(fullPath)}: ${e.message}\n`); } catch { }
      }
    }

    // 4. Multi-language dependency resolution
    const fileExt = path.extname(fullPath).toLowerCase();
    const edgeRecords: GraphEdgeRecord[] = [];
    const seenEdges = new Set<string>();
    const goModule = await this.getGoModuleName();

    for (const info of importInfos) {
      const relation = info.resolution === 'dynamic'
        ? 'imports:dynamic'
        : info.type === 'type'
          ? 'imports:type'
          : 'imports';

      const potentialTargets = await this.resolvers.resolveDependencies(fileExt, {
        sourceFile: fullPath,
        importInfo: info,
        rootDir: this.rootDir,
        packageMap: this.packageMap,
        crateMap: this.crateMap,
        goModuleName: goModule,
        fileSystemCache: this.fileSystemCache
      });

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
              relation,
              target_type: 'file',
              target_id: target.id,
              confidence: 1.0,
              provenance: 'ast'
            });
            seenEdges.add(edgeKey);
          }
        }
      }
    }

    // 5. Atomic write to SQLite
    await knex.transaction(async (trx) => {
      await this.graphStore.updateFileMetadata(fileId, gist, vectorBuffer, trx);

      const symbolRecords = symbols.map(sym => ({
        name: sym.name,
        type: sym.type,
        file_id: fileId,
        start_line: sym.startLine,
        end_line: sym.endLine
      }));
      const insertedSymbols = await this.graphStore.replaceFileSymbols(fileId, symbolRecords, trx);
      await this.graphStore.replaceFileEdges(fileId, edgeRecords, trx);

      const symbolEdges = await this.buildSymbolEdges(fileId, symbols, insertedSymbols, trx);
      if (symbolEdges.length > 0) {
        await this.graphStore.insertSymbolEdges(symbolEdges, trx);
      }
    });
  }

  async index(onProgress?: IndexProgressCallback): Promise<IndexSummary> {
    await this.db.initialize();
    await this.populatePackageMap();
    await this.discoverRustCrates();

    if (onProgress) onProgress(0, 100, 'Scanning files...');
    const files = await this.scanner.scan();
    const knex = this.db.getKnex();

    this.fileSystemCache.clear();
    for (const f of files) {
      this.fileSystemCache.add(path.resolve(this.rootDir, f).replace(/\\/g, '/'));
    }

    // ─── Pass 1: Register all files, reconcile deletions & check for changes ───
    const existingFiles = await this.graphStore.getAllFiles();
    const existingFilesMap = new Map(existingFiles.map(f => [f.path, f]));
    const scannedSet = new Set(files);

    const deletedFiles = existingFiles.filter(f => !scannedSet.has(f.path));
    if (deletedFiles.length > 0) {
      for (const f of deletedFiles) {
        await this.graphStore.deleteFile(f.id);
      }
    }

    const filesToProcess: string[] = [];
    const fileMap = new Map<string, number>();

    for (const relativePath of files) {
      const fullPath = path.resolve(this.rootDir, relativePath);
      const hash = await this.scanner.getFileHash(fullPath);
      const existingFile = existingFilesMap.get(relativePath);
      let fileId: number;

      if (!existingFile) {
        const res = await this.graphStore.upsertFile(relativePath, hash);
        fileId = res.id;
        filesToProcess.push(relativePath);
      } else {
        fileId = existingFile.id;
        if (existingFile.hash !== hash || existingFile.stale || !existingFile.embedding || !existingFile.summary) {
          await this.graphStore.markFileStale(fileId, hash);
          filesToProcess.push(relativePath);
        }
      }
      fileMap.set(relativePath, fileId);
    }

    // ─── Pass 2: Batch parsing and embedding ───
    const gistsToEmbed: Array<{
      fullPath: string;
      relativePath: string;
      symbols: SymbolInfo[];
      imports: ImportInfo[];
      gist: string;
      hash: string;
    }> = [];

    let processedCount = 0;
    const toProcess = filesToProcess.length;
    const parser = await this.getParser();

    for (const relativePath of filesToProcess) {
      try {
        const fullPath = path.resolve(this.rootDir, relativePath);
        this.fileSystemCache.add(fullPath.replace(/\\/g, '/'));

        const { symbols, imports: importInfos } = await parser.parseCode(fullPath);
        const gist = generateTechnicalGist(path.basename(fullPath), symbols, importInfos);
        const hash = await this.scanner.getFileHash(fullPath);

        gistsToEmbed.push({
          fullPath,
          relativePath,
          symbols,
          imports: importInfos,
          gist,
          hash
        });

        processedCount++;
        if (onProgress) {
          onProgress(10 + Math.floor((processedCount / toProcess) * 20), 100, `Parsing: ${relativePath}`);
        }
      } catch (error: any) {
        const debugLog = path.resolve(this.rootDir, '.kiteretsu', 'debug.log');
        try { fs.appendFileSync(debugLog, `[Indexer] Error parsing ${relativePath}: ${error.message}\n`); } catch { }
      }
    }

    const gists = gistsToEmbed.map(x => x.gist);
    const embeddings: Array<Buffer | null> = [];
    const BATCH_SIZE = 32;

    for (let i = 0; i < gists.length; i += BATCH_SIZE) {
      const batch = gists.slice(i, i + BATCH_SIZE);
      if (onProgress) {
        onProgress(30 + Math.floor((i / gists.length) * 40), 100, `Generating embeddings: ${i}/${gists.length}`);
      }

      try {
        const batchVectors = await this.getEmbeddings().generateEmbeddings(batch);
        for (const vector of batchVectors) {
          embeddings.push(Buffer.from(new Float32Array(vector).buffer));
        }
      } catch (e: any) {
        const debugLog = path.resolve(this.rootDir, '.kiteretsu', 'debug.log');
        try { fs.appendFileSync(debugLog, `[Embeddings] Batch failed: ${e.message}\n`); } catch { }
        for (let j = 0; j < batch.length; j++) {
          embeddings.push(null);
        }
      }
    }

    // ─── Pass 3: Database write (Files, Symbols, File Edges) ───
    const insertedSymbolsByFile = new Map<number, SymbolRecord[]>();

    for (let i = 0; i < gistsToEmbed.length; i++) {
      const item = gistsToEmbed[i];
      const embedding = embeddings[i];
      const fileId = fileMap.get(item.relativePath)!;

      try {
        await knex.transaction(async (trx) => {
          await this.graphStore.updateFileMetadata(fileId, item.gist, embedding, trx);

          const symbolRecords = item.symbols.map(sym => ({
            name: sym.name,
            type: sym.type,
            file_id: fileId,
            start_line: sym.startLine,
            end_line: sym.endLine
          }));
          const insertedSymbols = await this.graphStore.replaceFileSymbols(fileId, symbolRecords, trx);
          insertedSymbolsByFile.set(fileId, insertedSymbols);

          // File import edges
          const fileExt = path.extname(item.fullPath).toLowerCase();
          const edgeRecords: GraphEdgeRecord[] = [];
          const seenEdges = new Set<string>();
          const goModule = await this.getGoModuleName();

          for (const info of item.imports) {
            const relation = info.resolution === 'dynamic'
              ? 'imports:dynamic'
              : info.type === 'type'
                ? 'imports:type'
                : 'imports';

            const potentialTargets = await this.resolvers.resolveDependencies(fileExt, {
              sourceFile: item.fullPath,
              importInfo: info,
              rootDir: this.rootDir,
              packageMap: this.packageMap,
              crateMap: this.crateMap,
              goModuleName: goModule,
              fileSystemCache: this.fileSystemCache
            });

            for (let targetPath of potentialTargets) {
              targetPath = path.resolve(targetPath).replace(/\\/g, '/');
              if (process.platform === 'win32' && /^[a-z]:/i.test(targetPath)) {
                targetPath = targetPath[0].toLowerCase() + targetPath.slice(1);
              }

              let targetRelative = path.relative(this.rootDir, targetPath).replace(/\\/g, '/');
              if (targetRelative.startsWith('./')) targetRelative = targetRelative.slice(2);

              const target = await trx('files')
                .whereRaw('LOWER(path) = ?', [targetRelative.toLowerCase()])
                .first();

              if (target && target.id !== fileId) {
                const edgeKey = `${fileId}:${target.id}:${relation}`;
                if (!seenEdges.has(edgeKey)) {
                  edgeRecords.push({
                    source_type: 'file',
                    source_id: fileId,
                    relation,
                    target_type: 'file',
                    target_id: target.id,
                    confidence: 1.0,
                    provenance: 'ast'
                  });
                  seenEdges.add(edgeKey);
                }
              }
            }
          }

          await this.graphStore.replaceFileEdges(fileId, edgeRecords, trx);
        });

        if (onProgress) {
          onProgress(70 + Math.floor((i / gistsToEmbed.length) * 15), 100, `Writing: ${item.relativePath}`);
        }
      } catch (error: any) {
        const debugLog = path.resolve(this.rootDir, '.kiteretsu', 'debug.log');
        try { fs.appendFileSync(debugLog, `[Indexer] Error writing ${item.relativePath}: ${error.message}\n`); } catch { }
      }
    }

    // ─── Pass 4: Cross-file symbol graph linking ───
    for (let i = 0; i < gistsToEmbed.length; i++) {
      const item = gistsToEmbed[i];
      const fileId = fileMap.get(item.relativePath)!;
      const insertedSymbols = insertedSymbolsByFile.get(fileId) || [];

      try {
        const symbolEdges = await this.buildSymbolEdges(fileId, item.symbols, insertedSymbols, knex);
        if (symbolEdges.length > 0) {
          await this.graphStore.insertSymbolEdges(symbolEdges);
        }

        if (onProgress) {
          onProgress(85 + Math.floor((i / gistsToEmbed.length) * 15), 100, `Linking symbols: ${item.relativePath}`);
        }
      } catch (error: any) {
        const debugLog = path.resolve(this.rootDir, '.kiteretsu', 'debug.log');
        try { fs.appendFileSync(debugLog, `[Indexer] Error linking symbols for ${item.relativePath}: ${error.message}\n`); } catch { }
      }
    }

    if (onProgress) onProgress(100, 100, 'Indexing complete');

    const counts = await this.graphStore.getCounts();
    return { files: fileMap.size, symbols: counts.symbols, edges: counts.edges, deleted: deletedFiles.length };
  }

  async removeFile(filePath: string): Promise<void> {
    let fullPath = path.resolve(filePath).replace(/\\/g, '/');
    if (process.platform === 'win32' && /^[a-z]:/i.test(fullPath)) {
      fullPath = fullPath[0].toLowerCase() + fullPath.slice(1);
    }

    const relativePath = path.relative(this.rootDir, fullPath).replace(/\\/g, '/');
    const file = await this.graphStore.getFileByPath(relativePath);

    if (file) {
      await this.graphStore.deleteFile(file.id);
    }
  }
}
