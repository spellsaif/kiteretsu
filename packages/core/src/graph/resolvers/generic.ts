import path from 'path';
import { LanguageResolver, ResolveContext, resolveImportWithFallback } from './resolver.js';

export class GenericResolver implements LanguageResolver {
  readonly name = 'generic';

  supports(_ext: string): boolean {
    return true;
  }

  async resolve(ctx: ResolveContext): Promise<string[]> {
    const { sourceFile, importInfo, rootDir, fileSystemCache } = ctx;
    const sourceRaw = importInfo.source;
    const dir = path.dirname(sourceFile);
    const targets: string[] = [];

    const resolved = await resolveImportWithFallback(dir, sourceRaw, rootDir, fileSystemCache) ||
      await resolveImportWithFallback(rootDir, sourceRaw, rootDir, fileSystemCache);

    if (resolved) {
      targets.push(resolved);
    }

    return targets;
  }
}
