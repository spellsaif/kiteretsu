import path from 'path';
import fs from 'fs-extra';
import { LanguageResolver, ResolveContext, resolveImportWithFallback } from './resolver.js';

export class GoResolver implements LanguageResolver {
  readonly name = 'go';

  supports(ext: string): boolean {
    return ext === '.go';
  }

  async resolve(ctx: ResolveContext): Promise<string[]> {
    const { sourceFile, importInfo, rootDir, goModuleName, fileSystemCache } = ctx;
    const sourceRaw = importInfo.source;
    let localPath = sourceRaw;

    if (goModuleName && sourceRaw.startsWith(goModuleName)) {
      localPath = sourceRaw.slice(goModuleName.length).replace(/^\//, '');
    }

    const goBaseDir = localPath.startsWith('.') ? path.dirname(sourceFile) : rootDir;
    const resolvedDir = await resolveImportWithFallback(goBaseDir, localPath, rootDir, fileSystemCache);
    const targets: string[] = [];

    if (resolvedDir && (await fs.pathExists(resolvedDir)) && (await fs.stat(resolvedDir)).isDirectory()) {
      const files = await fs.readdir(resolvedDir);
      for (const f of files) {
        if (f.endsWith('.go')) {
          targets.push(path.join(resolvedDir, f));
        }
      }
    } else if (resolvedDir) {
      targets.push(resolvedDir);
    }

    return targets;
  }
}
