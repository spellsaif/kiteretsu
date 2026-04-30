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
    if (process.platform === 'win32' && /^[a-z]:/i.test(fullPath)) {
      fullPath = fullPath[0].toLowerCase() + fullPath.slice(1);
    }
    
    let relativePath = path.relative(this.rootDir, fullPath).replace(/\\/g, '/');
    if (relativePath.startsWith('./')) relativePath = relativePath.slice(2);
    
    const knex = this.db.getKnex();

    try {
      // 1. Try Fast Path: Database Query
      const file = await knex('files')
        .whereRaw('LOWER(path) = ?', [relativePath.toLowerCase()])
        .first();
      if (file) {
        const edges = await knex('graph_edges')
          .where({ target_id: file.id, relation: 'imports' })
          .select('source_id');
        
        if (edges.length > 0) {
          const sourceIds = edges.map(e => e.source_id);
          const sourceFiles = await knex('files').whereIn('id', sourceIds);
          return sourceFiles.map(f => path.resolve(this.rootDir, f.path));
        }
      }
    } catch (error) {
      // Fallback to slow path on DB error
    }

    // 2. Slow Path: Static Analysis with ts-morph
    if (!this.project) return [];
    const sourceFile = this.project.getSourceFile(filePath);
    if (!sourceFile) return [];

    const referringFiles = new Set<string>();
    
    // Check references to exported declarations
    const exportedDeclarations = sourceFile.getExportedDeclarations();
    for (const [name, declarations] of exportedDeclarations) {
      for (const declaration of declarations) {
        // @ts-ignore - simple implementation
        if (declaration.findReferences) {
          // @ts-ignore
          const referencedSymbols = declaration.findReferences();
          for (const symbol of referencedSymbols) {
            for (const reference of symbol.getReferences()) {
              const refFilePath = reference.getSourceFile().getFilePath();
              if (refFilePath !== filePath) {
                referringFiles.add(refFilePath);
              }
            }
          }
        }
      }
    }

    return Array.from(referringFiles);
  }

  // If this file is a source file, which test files cover it?
  async getRelatedTests(filePath: string): Promise<string[]> {
    const blastRadius = await this.getBlastRadius(filePath);
    return blastRadius.filter(f => f.includes('.test.') || f.includes('.spec.'));
  }
}
