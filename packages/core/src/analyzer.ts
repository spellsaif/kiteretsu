import { Project } from 'ts-morph';
import path from 'path';
import fs from 'fs-extra';
import { Database } from './database.js';

export class CodeAnalyzer {
  private project: Project | null = null;

  constructor(private rootDir: string, private db: Database) {
    const tsConfigPath = path.join(rootDir, 'tsconfig.json');
    if (fs.existsSync(tsConfigPath)) {
      try {
        this.project = new Project({
          tsConfigFilePath: tsConfigPath,
          skipAddingFilesFromTsConfig: false,
        });
      } catch (e) {
        // Fallback or silent
      }
    }
  }

  // Find what other files depend on this file
  async getBlastRadius(filePath: string): Promise<string[]> {
    let fullPath = path.resolve(filePath).replace(/\\/g, '/');
    if (process.platform === 'win32') {
      if (/^[a-z]:/i.test(fullPath)) {
        fullPath = fullPath[0].toLowerCase() + fullPath.slice(1);
      }
    }
    
    let relativePath = path.relative(this.rootDir, fullPath).replace(/\\/g, '/');
    relativePath = relativePath.replace(/^\.?\//, ''); // Strip leading ./ or /
    
    const knex = this.db.getKnex();
    const blastRadius = new Set<string>();
    const queue: string[] = [relativePath];
    const visited = new Set<string>();

    while (queue.length > 0) {
      const currentRelPath = queue.shift()!;
      if (visited.has(currentRelPath)) continue;
      visited.add(currentRelPath);

      try {
        const file = await knex('files')
          .whereRaw('LOWER(path) = ?', [currentRelPath.toLowerCase()])
          .first();
        
        if (file) {
          const dependents = await knex('graph_edges')
            .join('files', 'graph_edges.source_id', 'files.id')
            .where({ 'graph_edges.target_id': file.id })
            .where('graph_edges.relation', 'imports')
            .select('files.path');

          const dynamicDependents = await knex('graph_edges')
            .join('files', 'graph_edges.source_id', 'files.id')
            .where({ 'graph_edges.target_id': file.id })
            .where('graph_edges.relation', 'imports:dynamic')
            .select('files.path');
           
          for (const dep of dependents) {
            const depRelPath = dep.path;
            if (!visited.has(depRelPath)) {
              blastRadius.add(path.resolve(this.rootDir, depRelPath));
              queue.push(depRelPath);
            }
          }

          for (const dep of dynamicDependents) {
            blastRadius.add(`UNRESOLVABLE: ${path.resolve(this.rootDir, dep.path)}`);
          }
        }
      } catch (error) {
        // Fallback or log
      }
    }

    return Array.from(blastRadius);
  }

  // If this file is a source file, which test files cover it?
  async getRelatedTests(filePath: string): Promise<string[]> {
    const blastRadius = await this.getBlastRadius(filePath);
    return blastRadius
      .map(f => f.startsWith('UNRESOLVABLE: ') ? f.slice('UNRESOLVABLE: '.length) : f)
      .filter(f => f.includes('.test.') || f.includes('.spec.'));
  }

  // Find all symbols that call or reference a symbol
  async getSymbolCallers(symbolName: string, filePath?: string) {
    const knex = this.db.getKnex();
    let query = knex('symbols')
      .join('files', 'symbols.file_id', 'files.id')
      .where('symbols.name', symbolName);

    if (filePath) {
      const rel = path.relative(this.rootDir, path.resolve(filePath)).replace(/\\/g, '/');
      query = query.whereRaw('LOWER(files.path) = ?', [rel.toLowerCase()]);
    }

    const targetSymbols = await query.select(
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

    const callers = await knex('symbols')
      .join('files', 'symbols.file_id', 'files.id')
      .whereIn('symbols.id', callerSymbolIds)
      .select(
        'symbols.id as id',
        'symbols.name as name',
        'symbols.type as type',
        'files.path as path'
      );

    const callerMap = new Map(callers.map(c => [c.id, c]));
    const targetMap = new Map(targetSymbols.map(t => [t.symbol_id, t]));

    return edges.map(edge => {
      const caller = callerMap.get(edge.source_id);
      const target = targetMap.get(edge.target_id);
      return {
        callerSymbolName: caller?.name || '',
        callerSymbolType: caller?.type || '',
        callerFilePath: caller ? path.resolve(this.rootDir, caller.path) : '',
        calleeSymbolName: target?.symbol_name || '',
        calleeSymbolType: target?.symbol_type || '',
        calleeFilePath: target ? path.resolve(this.rootDir, target.file_path) : '',
        relation: edge.relation,
        confidence: edge.confidence ?? 1.0
      };
    }).filter(e => e.callerSymbolName);
  }

  // Find all symbols called or referenced by a symbol
  async getSymbolCallees(symbolName: string, filePath?: string) {
    const knex = this.db.getKnex();
    let query = knex('symbols')
      .join('files', 'symbols.file_id', 'files.id')
      .where('symbols.name', symbolName);

    if (filePath) {
      const rel = path.relative(this.rootDir, path.resolve(filePath)).replace(/\\/g, '/');
      query = query.whereRaw('LOWER(files.path) = ?', [rel.toLowerCase()]);
    }

    const sourceSymbols = await query.select(
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

    const callees = await knex('symbols')
      .join('files', 'symbols.file_id', 'files.id')
      .whereIn('symbols.id', calleeSymbolIds)
      .select(
        'symbols.id as id',
        'symbols.name as name',
        'symbols.type as type',
        'files.path as path'
      );

    const calleeMap = new Map(callees.map(c => [c.id, c]));
    const sourceMap = new Map(sourceSymbols.map(s => [s.symbol_id, s]));

    return edges.map(edge => {
      const source = sourceMap.get(edge.source_id);
      const callee = calleeMap.get(edge.target_id);
      return {
        callerSymbolName: source?.symbol_name || '',
        callerSymbolType: source?.symbol_type || '',
        callerFilePath: source ? path.resolve(this.rootDir, source.file_path) : '',
        calleeSymbolName: callee?.name || '',
        calleeSymbolType: callee?.type || '',
        calleeFilePath: callee ? path.resolve(this.rootDir, callee.path) : '',
        relation: edge.relation,
        confidence: edge.confidence ?? 1.0
      };
    }).filter(e => e.calleeSymbolName);
  }

  // Get complete symbol graph
  async getSymbolGraph(symbolName: string, filePath?: string) {
    const [callers, callees] = await Promise.all([
      this.getSymbolCallers(symbolName, filePath),
      this.getSymbolCallees(symbolName, filePath)
    ]);
    return {
      symbol: symbolName,
      callers,
      callees
    };
  }
}
