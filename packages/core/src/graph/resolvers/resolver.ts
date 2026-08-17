import path from 'path';
import fs from 'fs-extra';
import { ImportInfo } from '../../parser.js';

export interface ResolveContext {
  sourceFile: string;
  importInfo: ImportInfo;
  rootDir: string;
  packageMap: Map<string, string>;
  crateMap: Map<string, string>;
  goModuleName?: string;
  fileSystemCache: Set<string>;
}

export interface LanguageResolver {
  readonly name: string;
  supports(ext: string): boolean;
  resolve(context: ResolveContext): Promise<string[]>;
}

/**
 * Shared helper to resolve a candidate path or base to an existing file or directory.
 */
export async function resolveCandidateFilePath(targetBase: string, fileSystemCache: Set<string>): Promise<string | null> {
  if (fileSystemCache.has(targetBase)) {
    return targetBase;
  }
  if (await fs.pathExists(targetBase)) {
    const stat = await fs.stat(targetBase);
    if (!stat.isDirectory()) {
      fileSystemCache.add(targetBase);
      return targetBase;
    }
  }

  const exts = [
    '', '.ts', '.tsx', '.js', '.jsx',
    '.py', '.go', '.rs', '.java', '.rb', '.lua',
    '.c', '.cpp', '.cs', '.php', '.swift', '.kt', '.scala',
    '.ps1', '.jl', '.m', '.v', '.sv', '.vue', '.svelte', '.dart', '.ex', '.zig', '.sh', '.h', '.hpp'
  ];

  const candidateBases = [targetBase];
  const parsedTarget = path.parse(targetBase);
  if (parsedTarget.ext) {
    candidateBases.push(path.join(parsedTarget.dir, parsedTarget.name));
  }

  for (const base of candidateBases) {
    for (const ext of exts) {
      const candidate = base + ext;
      if (fileSystemCache.has(candidate)) {
        return candidate;
      }
      if (await fs.pathExists(candidate)) {
        const stat = await fs.stat(candidate);
        if (!stat.isDirectory()) {
          fileSystemCache.add(candidate);
          return candidate;
        }
      }

      // Language-specific directory entry points
      const dirCandidates = [
        path.join(base, 'index' + ext).replace(/\\/g, '/'),
        path.join(base, '__init__' + ext).replace(/\\/g, '/'),
        path.join(base, 'mod' + ext).replace(/\\/g, '/'),
        path.join(base, 'lib' + ext).replace(/\\/g, '/'),
        path.join(base, 'main' + ext).replace(/\\/g, '/'),
      ];

      for (const dc of dirCandidates) {
        if (fileSystemCache.has(dc)) {
          return dc;
        }
        if (await fs.pathExists(dc)) {
          const stat = await fs.stat(dc);
          if (!stat.isDirectory()) {
            fileSystemCache.add(dc);
            return dc;
          }
        }
      }
    }
  }

  return null;
}

/**
 * Shared helper to resolve relative imports with right-trimming for submodules.
 */
export async function resolveImportWithFallback(baseDir: string, relativePath: string, rootDir: string, fileSystemCache: Set<string>): Promise<string | null> {
  if (!relativePath) return null;

  let processedPath = relativePath;
  if (!relativePath.includes('/') && !relativePath.includes('\\') && relativePath.includes('.')) {
    processedPath = relativePath.replace(/\./g, '/');
  }

  const currentPath = path.resolve(baseDir, processedPath).replace(/\\/g, '/');
  const exact = await resolveCandidateFilePath(currentPath, fileSystemCache);
  if (exact) return exact;

  if (await fs.pathExists(currentPath) && (await fs.stat(currentPath)).isDirectory()) {
    return currentPath;
  }

  let parts = processedPath.split(/[/\\]/);
  while (parts.length > 1) {
    parts.pop();
    const candidateBase = path.resolve(baseDir, parts.join('/')).replace(/\\/g, '/');
    const found = await resolveCandidateFilePath(candidateBase, fileSystemCache);
    if (found) return found;

    if (await fs.pathExists(candidateBase) && (await fs.stat(candidateBase)).isDirectory()) {
      return candidateBase;
    }
  }

  if (!relativePath.startsWith('.')) {
    const globalResolved = await resolveCandidateFilePath(path.resolve(rootDir, processedPath).replace(/\\/g, '/'), fileSystemCache);
    if (globalResolved) return globalResolved;
  }

  return null;
}
