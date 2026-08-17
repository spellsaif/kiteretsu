import path from 'path';
import fs from 'fs-extra';
import { LanguageResolver, ResolveContext, resolveImportWithFallback } from './resolver.js';

export class RustResolver implements LanguageResolver {
  readonly name = 'rust';

  supports(ext: string): boolean {
    return ext === '.rs';
  }

  private async findRustCrateRoot(filePath: string, rootDir: string): Promise<string> {
    let current = path.dirname(filePath);
    while (current.length >= rootDir.length) {
      if (await fs.pathExists(path.join(current, 'Cargo.toml')) || await fs.pathExists(path.join(current, 'src'))) {
        return current;
      }
      const parent = path.dirname(current);
      if (parent === current) break;
      current = parent;
    }
    return '';
  }

  async resolve(ctx: ResolveContext): Promise<string[]> {
    const { sourceFile, importInfo, rootDir, fileSystemCache } = ctx;
    const sourceRaw = importInfo.source;
    const rustPath = sourceRaw.replace(/::/g, '/');
    const rustTargets: Array<{ baseDir: string; relativePath: string }> = [];

    if (sourceRaw.startsWith('crate')) {
      const crateRoot = await this.findRustCrateRoot(sourceFile, rootDir);
      if (crateRoot) {
        rustTargets.push({ baseDir: crateRoot, relativePath: rustPath.replace(/^crate/, 'src') });
      }
      rustTargets.push({ baseDir: path.dirname(sourceFile), relativePath: rustPath.replace(/^crate\/?/, '') });
    } else if (sourceRaw.startsWith('super')) {
      rustTargets.push({ baseDir: path.dirname(sourceFile), relativePath: rustPath.replace(/^super/, '..') });
    } else if (sourceRaw.startsWith('self')) {
      rustTargets.push({ baseDir: path.dirname(sourceFile), relativePath: rustPath.replace(/^self/, '.') });
    } else {
      rustTargets.push({ baseDir: rootDir, relativePath: rustPath });
    }

    const targets: string[] = [];
    for (const target of rustTargets) {
      const resolved = await resolveImportWithFallback(target.baseDir, target.relativePath, rootDir, fileSystemCache);
      if (resolved) targets.push(resolved);
    }

    return targets;
  }
}
