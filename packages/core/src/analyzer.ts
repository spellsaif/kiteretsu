import { Project } from 'ts-morph';
import path from 'path';
import fs from 'fs-extra';
import { Database } from './database.js';

export interface DetailedBlastRadiusResult {
  target: string;
  type: 'file' | 'symbol';
  declaringFile?: string;
  directCallersCount: number;
  indirectCallersCount: number;
  directCallers: Array<{ name?: string; file: string; relation: string }>;
  indirectCallers: Array<{ name?: string; file: string }>;
  testsToRun: string[];
  affectedADRs: Array<{ title: string; rationale: string }>;
  affectedRules: string[];
  riskLevel: 'LOW' | 'MEDIUM' | 'HIGH';
  confidence: number;
  evidence: string[];
}

export interface ExplainResult {
  target: string;
  type: 'file' | 'symbol';
  summary: string;
  declaringFile?: string;
  symbols?: Array<{ name: string; type: string; lineRange?: [number, number] }>;
  dependencies?: Array<{ target: string; relation: string }>;
  consumers?: Array<{ source: string; relation: string }>;
  callers?: Array<{ callerName: string; callerFile: string; relation: string }>;
  callees?: Array<{ calleeName: string; calleeFile: string; relation: string }>;
  decisions?: Array<{ title: string; rationale: string }>;
  rules?: string[];
  tests?: string[];
  confidence: number;
  evidence: string[];
}

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
        } else {
          blastRadius.add(`UNRESOLVABLE: ${path.resolve(this.rootDir, currentRelPath)}`);
        }
      } catch (err) {
        console.error('Error fetching dependents from DB:', err);
      }
    }

    return Array.from(blastRadius);
  }

  // Find related test files for a source file
  async getRelatedTests(filePath: string): Promise<string[]> {
    const blastRadius = await this.getBlastRadius(filePath);
    const fromBlast = blastRadius
      .map(f => f.startsWith('UNRESOLVABLE: ') ? f.slice('UNRESOLVABLE: '.length) : f)
      .filter(f => f.includes('.test.') || f.includes('.spec.') || f.includes('_test.') || f.includes('test_'));

    const fileName = path.basename(filePath, path.extname(filePath));
    const testPattern = `**/*{${fileName}.test,${fileName}.spec,test_${fileName},${fileName}_test}*`;

    let fromGlob: string[] = [];
    try {
      const { globby } = await import('globby');
      fromGlob = await globby(testPattern, { cwd: this.rootDir, absolute: true });
    } catch { }

    return Array.from(new Set([...fromBlast, ...fromGlob]));
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
      .whereIn('relation', ['calls', 'references', 'extends', 'implements'])
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
    const targetMap = new Map(targetSymbols.map(s => [s.symbol_id, s]));

    return edges.map(edge => {
      const caller = callerMap.get(edge.source_id);
      const target = targetMap.get(edge.target_id);
      return {
        callerSymbolName: caller?.name || '',
        callerSymbolType: caller?.type || '',
        callerFilePath: caller ? path.resolve(this.rootDir, caller.path) : '',
        targetSymbolName: target?.symbol_name || '',
        targetSymbolType: target?.symbol_type || '',
        targetFilePath: target ? path.resolve(this.rootDir, target.file_path) : '',
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

  // First-Class Detailed Blast Radius Analysis
  async getDetailedBlastRadius(target: string): Promise<DetailedBlastRadiusResult> {
    const knex = this.db.getKnex();
    const evidence: string[] = [];

    // Check if target is an existing file
    const rel = path.relative(this.rootDir, path.resolve(this.rootDir, target)).replace(/\\/g, '/');
    const file = await knex('files').whereRaw('LOWER(path) = ?', [rel.toLowerCase()]).first();

    if (file) {
      evidence.push(`file_match:${file.path}`);
      const directDependents = await knex('graph_edges')
        .join('files', 'graph_edges.source_id', 'files.id')
        .where({ 'graph_edges.target_id': file.id, 'graph_edges.source_type': 'file', 'graph_edges.target_type': 'file' })
        .select('files.path as path', 'graph_edges.relation as relation');

      const allBlastFiles = await this.getBlastRadius(file.path);
      const directPaths = new Set(directDependents.map(d => d.path));
      const indirectFiles = allBlastFiles.filter(p => !directPaths.has(p) && p !== file.path);

      const tests = await this.getRelatedTests(path.resolve(this.rootDir, file.path));
      const allRules = await knex('rules').select('*');
      const allADRs = await knex('decisions').select('*');

      const matchedRules = allRules.filter(r => !r.scope_value || file.path.includes(r.scope_value)).map(r => r.name);
      const matchedADRs = allADRs.filter(d => {
        if (!d.affected_paths) return false;
        try {
          const paths: string[] = JSON.parse(d.affected_paths);
          return paths.some(p => file.path.includes(p) || p.includes(file.path));
        } catch {
          return false;
        }
      }).map(d => ({ title: d.title, rationale: d.rationale }));

      let riskLevel: 'LOW' | 'MEDIUM' | 'HIGH' = 'LOW';
      if (directDependents.length > 8 || allBlastFiles.length > 15 || tests.length > 5) {
        riskLevel = 'HIGH';
      } else if (directDependents.length > 2 || allBlastFiles.length > 4) {
        riskLevel = 'MEDIUM';
      }

      return {
        target: file.path,
        type: 'file',
        declaringFile: file.path,
        directCallersCount: directDependents.length,
        indirectCallersCount: indirectFiles.length,
        directCallers: directDependents.map(d => ({ file: d.path, relation: d.relation })),
        indirectCallers: indirectFiles.map(f => ({ file: f })),
        testsToRun: tests.map(t => path.relative(this.rootDir, t).replace(/\\/g, '/')),
        affectedADRs: matchedADRs,
        affectedRules: matchedRules,
        riskLevel,
        confidence: 0.95,
        evidence: [`direct_deps:${directDependents.length}`, `indirect_deps:${indirectFiles.length}`]
      };
    }

    // Target is a Symbol
    const symbolMatches = await knex('symbols')
      .join('files', 'symbols.file_id', 'files.id')
      .where('symbols.name', target)
      .select('symbols.id as symbol_id', 'symbols.name as symbol_name', 'symbols.type as symbol_type', 'files.path as file_path');

    if (symbolMatches.length > 0) {
      const primarySymbol = symbolMatches[0];
      const callers = await this.getSymbolCallers(target);
      const tests = await this.getRelatedTests(path.resolve(this.rootDir, primarySymbol.file_path));

      const allADRs = await knex('decisions').select('*');
      const matchedADRs = allADRs.filter(d => {
        if (!d.affected_paths) return false;
        try {
          const paths: string[] = JSON.parse(d.affected_paths);
          return paths.some(p => primarySymbol.file_path.includes(p));
        } catch {
          return false;
        }
      }).map(d => ({ title: d.title, rationale: d.rationale }));

      let riskLevel: 'LOW' | 'MEDIUM' | 'HIGH' = 'LOW';
      if (callers.length > 8) {
        riskLevel = 'HIGH';
      } else if (callers.length > 2) {
        riskLevel = 'MEDIUM';
      }

      return {
        target,
        type: 'symbol',
        declaringFile: primarySymbol.file_path,
        directCallersCount: callers.length,
        indirectCallersCount: 0,
        directCallers: callers.map(c => ({ name: c.callerSymbolName, file: path.relative(this.rootDir, c.callerFilePath).replace(/\\/g, '/'), relation: c.relation })),
        indirectCallers: [],
        testsToRun: tests.map(t => path.relative(this.rootDir, t).replace(/\\/g, '/')),
        affectedADRs: matchedADRs,
        affectedRules: [],
        riskLevel,
        confidence: 0.92,
        evidence: [`symbol_callers:${callers.length}`, `declaring_file:${primarySymbol.file_path}`]
      };
    }

    return {
      target,
      type: 'file',
      directCallersCount: 0,
      indirectCallersCount: 0,
      directCallers: [],
      indirectCallers: [],
      testsToRun: [],
      affectedADRs: [],
      affectedRules: [],
      riskLevel: 'LOW',
      confidence: 0.2,
      evidence: ['target_not_indexed']
    };
  }

  // Explain Feature: Synthesizes source + graph + ADRs + rules + historical tasks
  async explain(target: string): Promise<ExplainResult> {
    const knex = this.db.getKnex();
    const rel = path.relative(this.rootDir, path.resolve(this.rootDir, target)).replace(/\\/g, '/');
    const file = await knex('files').whereRaw('LOWER(path) = ?', [rel.toLowerCase()]).first();

    if (file) {
      const symbols = await knex('symbols').where({ file_id: file.id }).select('name', 'type', 'start_line', 'end_line');
      const dependencies = await knex('graph_edges')
        .join('files', 'graph_edges.target_id', 'files.id')
        .where({ 'graph_edges.source_id': file.id, 'graph_edges.source_type': 'file', 'graph_edges.target_type': 'file' })
        .select('files.path as target', 'graph_edges.relation as relation');

      const consumers = await knex('graph_edges')
        .join('files', 'graph_edges.source_id', 'files.id')
        .where({ 'graph_edges.target_id': file.id, 'graph_edges.source_type': 'file', 'graph_edges.target_type': 'file' })
        .select('files.path as source', 'graph_edges.relation as relation');

      const allADRs = await knex('decisions').select('*');
      const matchedADRs = allADRs.filter(d => {
        if (!d.affected_paths) return false;
        try {
          const paths: string[] = JSON.parse(d.affected_paths);
          return paths.some(p => file.path.includes(p) || p.includes(file.path));
        } catch {
          return false;
        }
      }).map(d => ({ title: d.title, rationale: d.rationale }));

      const allRules = await knex('rules').select('*');
      const matchedRules = allRules.filter(r => !r.scope_value || file.path.includes(r.scope_value)).map(r => `${r.name}: ${r.description}`);
      const tests = (await this.getRelatedTests(path.resolve(this.rootDir, file.path))).map(t => path.relative(this.rootDir, t).replace(/\\/g, '/'));

      return {
        target: file.path,
        type: 'file',
        summary: file.summary || 'No technical summary generated.',
        declaringFile: file.path,
        symbols: symbols.map(s => ({ name: s.name, type: s.type, lineRange: [s.start_line, s.end_line] })),
        dependencies,
        consumers,
        decisions: matchedADRs,
        rules: matchedRules,
        tests,
        confidence: 0.95,
        evidence: [`symbols_count:${symbols.length}`, `deps_count:${dependencies.length}`, `consumers_count:${consumers.length}`]
      };
    }

    // Symbol Explanation
    const symbolMatches = await knex('symbols')
      .join('files', 'symbols.file_id', 'files.id')
      .where('symbols.name', target)
      .select('symbols.id as symbol_id', 'symbols.name as symbol_name', 'symbols.type as symbol_type', 'files.path as file_path', 'symbols.start_line', 'symbols.end_line');

    if (symbolMatches.length > 0) {
      const primarySymbol = symbolMatches[0];
      const callers = await this.getSymbolCallers(target);
      const callees = await this.getSymbolCallees(target);
      const tests = (await this.getRelatedTests(path.resolve(this.rootDir, primarySymbol.file_path))).map(t => path.relative(this.rootDir, t).replace(/\\/g, '/'));

      return {
        target,
        type: 'symbol',
        summary: `${primarySymbol.symbol_type} '${primarySymbol.symbol_name}' declared in ${primarySymbol.file_path}:${primarySymbol.start_line}-${primarySymbol.end_line}`,
        declaringFile: primarySymbol.file_path,
        callers: callers.map(c => ({ callerName: c.callerSymbolName, callerFile: path.relative(this.rootDir, c.callerFilePath).replace(/\\/g, '/'), relation: c.relation })),
        callees: callees.map(c => ({ calleeName: c.calleeSymbolName, calleeFile: path.relative(this.rootDir, c.calleeFilePath).replace(/\\/g, '/'), relation: c.relation })),
        tests,
        confidence: 0.92,
        evidence: [`declaring_file:${primarySymbol.file_path}`, `callers:${callers.length}`, `callees:${callees.length}`]
      };
    }

    return {
      target,
      type: 'file',
      summary: `Target '${target}' not found in current index.`,
      confidence: 0.1,
      evidence: ['not_found']
    };
  }
}
