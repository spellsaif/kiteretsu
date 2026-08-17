import path from 'path';
import { LanguageResolver, ResolveContext, resolveImportWithFallback } from './resolver.js';

export class PythonResolver implements LanguageResolver {
  readonly name = 'python';

  supports(ext: string): boolean {
    return ext === '.py';
  }

  async resolve(ctx: ResolveContext): Promise<string[]> {
    const { sourceFile, importInfo, rootDir, fileSystemCache } = ctx;
    const sourceRaw = importInfo.source;
    const dir = path.dirname(sourceFile);
    const targets: string[] = [];

    let resolved = await resolveImportWithFallback(dir, sourceRaw, rootDir, fileSystemCache);
    if (!resolved) {
      resolved = await resolveImportWithFallback(rootDir, sourceRaw, rootDir, fileSystemCache);
    }

    if (resolved) {
      targets.push(resolved);
    }

    return targets;
  }
}
