import { Knex } from 'knex';
import { Database } from '../database.js';

export interface FileRecord {
  id: number;
  path: string;
  hash: string;
  summary?: string;
  stale?: boolean;
  embedding?: Buffer | null;
  last_indexed?: string;
}

export interface SymbolRecord {
  id?: number;
  name: string;
  type: string;
  file_id: number;
  start_line?: number;
  end_line?: number;
}

export interface GraphEdgeRecord {
  id?: number;
  source_type: 'file' | 'symbol';
  source_id: number;
  relation: 'imports' | 'imports:type' | 'imports:dynamic' | 'calls' | 'references' | 'extends' | 'implements' | 'exports' | 'tested_by';
  target_type: 'file' | 'symbol';
  target_id: number;
  confidence?: number;
  provenance?: string;
}

export interface SymbolCallInfo {
  callerSymbolName: string;
  callerSymbolType: string;
  callerFilePath: string;
  calleeSymbolName: string;
  calleeSymbolType: string;
  calleeFilePath: string;
  relation: string;
  confidence: number;
}

export class GraphStore {
  constructor(private db: Database) { }

  get knex(): Knex {
    return this.db.getKnex();
  }

  async getAllFiles(): Promise<FileRecord[]> {
    return this.knex('files').select('id', 'path', 'hash', 'stale', 'embedding', 'summary');
  }

  async getFileByPath(relativePath: string): Promise<FileRecord | undefined> {
    return this.knex('files')
      .whereRaw('LOWER(path) = ?', [relativePath.toLowerCase()])
      .first();
  }

  async upsertFile(path: string, hash: string): Promise<{ id: number; isNew: boolean }> {
    const existing = await this.getFileByPath(path);
    if (!existing) {
      const [insertedId] = await this.knex('files').insert({
        path,
        hash,
        stale: true,
        last_indexed: this.knex.fn.now()
      });
      return { id: insertedId, isNew: true };
    }
    return { id: existing.id, isNew: false };
  }

  async markFileStale(id: number, hash: string): Promise<void> {
    await this.knex('files').where({ id }).update({
      hash,
      stale: true,
      last_indexed: this.knex.fn.now()
    });
  }

  async updateFileMetadata(id: number, summary: string, embedding: Buffer | null, trx?: Knex.Transaction): Promise<void> {
    const query = trx ? trx('files') : this.knex('files');
    await query.where({ id }).update({
      summary,
      embedding: embedding || null,
      stale: false,
      last_indexed: (trx || this.knex).fn.now()
    });
  }

  async deleteFile(id: number): Promise<void> {
    const existingSymbols = await this.knex('symbols').where({ file_id: id }).select('id');
    const symbolIds = existingSymbols.map(s => s.id);

    // Delete edges referencing symbols from this file
    if (symbolIds.length > 0) {
      await this.knex('graph_edges')
        .where(builder => {
          builder.where('source_type', 'symbol').whereIn('source_id', symbolIds)
            .orWhere('target_type', 'symbol').whereIn('target_id', symbolIds);
        })
        .delete();
    }

    // Delete edges referencing this file
    await this.knex('graph_edges')
      .where(builder => {
        builder.where({ source_type: 'file', source_id: id })
          .orWhere({ target_type: 'file', target_id: id });
      })
      .delete();

    await this.knex('symbols').where({ file_id: id }).delete();
    await this.knex('files').where({ id }).delete();

    try {
      await this.knex.raw('DELETE FROM vec_files WHERE rowid = ?', [id]);
    } catch { }
  }

  async replaceFileSymbols(fileId: number, symbols: SymbolRecord[], trx?: Knex.Transaction): Promise<SymbolRecord[]> {
    const query = trx ? trx('symbols') : this.knex('symbols');
    
    // First, clear old symbol edges for this file's existing symbols
    const existingSymbols = await query.where({ file_id: fileId }).select('id');
    const oldSymbolIds = existingSymbols.map(s => s.id);
    if (oldSymbolIds.length > 0) {
      const edgeQuery = trx ? trx('graph_edges') : this.knex('graph_edges');
      await edgeQuery
        .where(builder => {
          builder.where('source_type', 'symbol').whereIn('source_id', oldSymbolIds)
            .orWhere('target_type', 'symbol').whereIn('target_id', oldSymbolIds);
        })
        .delete();
    }

    await query.where({ file_id: fileId }).delete();

    const inserted: SymbolRecord[] = [];
    for (const sym of symbols) {
      const [id] = await query.insert({
        name: sym.name,
        type: sym.type,
        file_id: fileId,
        start_line: sym.start_line,
        end_line: sym.end_line
      });
      inserted.push({ ...sym, id });
    }

    return inserted;
  }

  async replaceFileEdges(fileId: number, edges: GraphEdgeRecord[], trx?: Knex.Transaction): Promise<void> {
    const query = trx ? trx('graph_edges') : this.knex('graph_edges');
    await query
      .where({ source_type: 'file', source_id: fileId })
      .delete();

    if (edges.length > 0) {
      const chunkSize = 100;
      for (let i = 0; i < edges.length; i += chunkSize) {
        await query.insert(edges.slice(i, i + chunkSize));
      }
    }
  }

  async insertSymbolEdges(edges: GraphEdgeRecord[], trx?: Knex.Transaction): Promise<void> {
    if (edges.length === 0) return;
    const query = trx ? trx('graph_edges') : this.knex('graph_edges');
    const chunkSize = 100;
    for (let i = 0; i < edges.length; i += chunkSize) {
      await query.insert(edges.slice(i, i + chunkSize));
    }
  }

  async getSymbolsForFile(filePath: string): Promise<SymbolRecord[]> {
    return this.db.getSymbolsForFile(filePath);
  }

  async getSymbolCallers(symbolName: string, filePath?: string): Promise<SymbolCallInfo[]> {
    const knex = this.knex;
    let targetQuery = knex('symbols')
      .join('files', 'symbols.file_id', 'files.id')
      .where('symbols.name', symbolName);

    if (filePath) {
      targetQuery = targetQuery.whereRaw('LOWER(files.path) = ?', [filePath.toLowerCase()]);
    }

    const targetSymbols = await targetQuery.select(
      'symbols.id as symbol_id',
      'symbols.name as symbol_name',
      'symbols.type as symbol_type',
      'files.path as file_path'
    );

    if (targetSymbols.length === 0) return [];

    const targetIds = targetSymbols.map(s => s.symbol_id);
    const edges = await knex('graph_edges')
      .where({ target_type: 'symbol' })
      .whereIn('target_id', targetIds)
      .whereIn('relation', ['calls', 'references', 'extends', 'implements', 'tested_by'])
      .select('*');

    if (edges.length === 0) return [];

    const callerSymbolIds = edges.filter(e => e.source_type === 'symbol').map(e => e.source_id);
    const callerSymbols = await knex('symbols')
      .join('files', 'symbols.file_id', 'files.id')
      .whereIn('symbols.id', callerSymbolIds)
      .select(
        'symbols.id as id',
        'symbols.name as name',
        'symbols.type as type',
        'files.path as path'
      );

    const callerMap = new Map(callerSymbols.map(c => [c.id, c]));
    const targetMap = new Map(targetSymbols.map(t => [t.symbol_id, t]));

    const results: SymbolCallInfo[] = [];
    for (const edge of edges) {
      const caller = callerMap.get(edge.source_id);
      const target = targetMap.get(edge.target_id);
      if (caller && target) {
        results.push({
          callerSymbolName: caller.name,
          callerSymbolType: caller.type,
          callerFilePath: caller.path,
          calleeSymbolName: target.symbol_name,
          calleeSymbolType: target.symbol_type,
          calleeFilePath: target.file_path,
          relation: edge.relation,
          confidence: edge.confidence ?? 1.0
        });
      }
    }

    return results;
  }

  async getSymbolCallees(symbolName: string, filePath?: string): Promise<SymbolCallInfo[]> {
    const knex = this.knex;
    let sourceQuery = knex('symbols')
      .join('files', 'symbols.file_id', 'files.id')
      .where('symbols.name', symbolName);

    if (filePath) {
      sourceQuery = sourceQuery.whereRaw('LOWER(files.path) = ?', [filePath.toLowerCase()]);
    }

    const sourceSymbols = await sourceQuery.select(
      'symbols.id as symbol_id',
      'symbols.name as symbol_name',
      'symbols.type as symbol_type',
      'files.path as file_path'
    );

    if (sourceSymbols.length === 0) return [];

    const sourceIds = sourceSymbols.map(s => s.symbol_id);
    const edges = await knex('graph_edges')
      .where({ source_type: 'symbol' })
      .whereIn('source_id', sourceIds)
      .whereIn('relation', ['calls', 'references', 'extends', 'implements'])
      .select('*');

    if (edges.length === 0) return [];

    const calleeSymbolIds = edges.filter(e => e.target_type === 'symbol').map(e => e.target_id);
    const calleeSymbols = await knex('symbols')
      .join('files', 'symbols.file_id', 'files.id')
      .whereIn('symbols.id', calleeSymbolIds)
      .select(
        'symbols.id as id',
        'symbols.name as name',
        'symbols.type as type',
        'files.path as path'
      );

    const calleeMap = new Map(calleeSymbols.map(c => [c.id, c]));
    const sourceMap = new Map(sourceSymbols.map(s => [s.symbol_id, s]));

    const results: SymbolCallInfo[] = [];
    for (const edge of edges) {
      const source = sourceMap.get(edge.source_id);
      const callee = calleeMap.get(edge.target_id);
      if (source && callee) {
        results.push({
          callerSymbolName: source.symbol_name,
          callerSymbolType: source.symbol_type,
          callerFilePath: source.file_path,
          calleeSymbolName: callee.name,
          calleeSymbolType: callee.type,
          calleeFilePath: callee.path,
          relation: edge.relation,
          confidence: edge.confidence ?? 1.0
        });
      }
    }

    return results;
  }

  async getCounts(): Promise<{ files: number; symbols: number; edges: number }> {
    const fileCount = await this.knex('files').count('id as count').first();
    const symbolCount = await this.knex('symbols').count('id as count').first();
    const edgeCount = await this.knex('graph_edges').count('id as count').first();
    return {
      files: Number(fileCount?.count || 0),
      symbols: Number(symbolCount?.count || 0),
      edges: Number(edgeCount?.count || 0)
    };
  }
}
