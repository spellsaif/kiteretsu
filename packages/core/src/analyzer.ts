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
}
