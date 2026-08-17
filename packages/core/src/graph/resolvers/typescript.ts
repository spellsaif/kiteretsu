import path from 'path';
import { LanguageResolver, ResolveContext, resolveImportWithFallback } from './resolver.js';

export class TypeScriptResolver implements LanguageResolver {
  readonly name = 'typescript';

  supports(ext: string): boolean {
    return ['.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs', '.vue', '.svelte'].includes(ext);
  }

  async resolve(ctx: ResolveContext): Promise<string[]> {
    const { sourceFile, importInfo, rootDir, packageMap, fileSystemCache } = ctx;
    const sourceRaw = importInfo.source;
    const dir = path.dirname(sourceFile);
    const source = sourceRaw.replace(/\.(js|jsx|ts|tsx|mjs|cjs)$/, '');
    const targets: string[] = [];

    // 1. Relative import resolution
    const resolved = await resolveImportWithFallback(dir, source, rootDir, fileSystemCache) ||
      await resolveImportWithFallback(dir, sourceRaw, rootDir, fileSystemCache);

    if (resolved) {
      targets.push(resolved);
      return targets;
    }

    // 2. Monorepo package resolution via packageMap
    let packageDir: string | undefined = packageMap.get(source);
    let subPath = '';

    if (!packageDir && source.includes('/')) {
      const parts = source.split('/');
      const twoParts = parts.slice(0, 2).join('/');
      if (packageMap.has(twoParts)) {
        packageDir = packageMap.get(twoParts);
        subPath = parts.slice(2).join('/');
      } else if (packageMap.has(parts[0])) {
        packageDir = packageMap.get(parts[0]);
        subPath = parts.slice(1).join('/');
      }
    }

    if (packageDir) {
      const resolvedDirect = await resolveImportWithFallback(packageDir, subPath || 'src', rootDir, fileSystemCache);
      if (resolvedDirect) {
        targets.push(resolvedDirect);
        return targets;
      }
      const resolvedSrc = await resolveImportWithFallback(path.join(packageDir, 'src'), subPath || 'index', rootDir, fileSystemCache);
      if (resolvedSrc) {
        targets.push(resolvedSrc);
        return targets;
      }
    }

    // 3. Fallback to workspace root-relative import
    const resolvedRoot = await resolveImportWithFallback(rootDir, source, rootDir, fileSystemCache);
    if (resolvedRoot) {
      targets.push(resolvedRoot);
    }

    return targets;
  }
}
