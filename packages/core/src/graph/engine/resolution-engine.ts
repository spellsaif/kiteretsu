import path from 'path';
import fs from 'fs-extra';
import { ImportReference } from '../ir/import-ir.js';
import { ProjectContext } from '../project/project-context.js';
import { LanguageRegistry, LanguageDefinition } from '../registry/language-registry.js';

export type ResolutionStatus = 'resolved' | 'ambiguous' | 'unresolved';

export interface ResolutionResult {
  status: ResolutionStatus;
  target?: string;
  candidates?: string[];
  confidence: number;
  evidence: string[];
  reason?: string;
}

export class ResolutionEngine {
  constructor(private projectContext: ProjectContext) { }

  async resolve(
    importRef: ImportReference,
    sourceFile: string
  ): Promise<ResolutionResult> {
    if (importRef.isDynamic && importRef.source.includes('${')) {
      return {
        status: 'unresolved',
        confidence: 0,
        evidence: [],
        reason: 'dynamic-import-expression'
      };
    }

    const sourceDir = path.dirname(path.resolve(sourceFile)).replace(/\\/g, '/');
    const sourceExt = path.extname(sourceFile).toLowerCase();
    const langDef = LanguageRegistry.getLanguageByExtension(sourceExt) || LanguageRegistry.getLanguage(importRef.language);

    const ecosystem = langDef?.ecosystem || 'generic';
    let candidates: { path: string; evidence: string }[] = [];

    switch (ecosystem) {
      case 'typescript':
        candidates = await this.resolveTypeScript(importRef, sourceDir);
        break;
      case 'python':
        candidates = await this.resolvePython(importRef, sourceDir);
        break;
      case 'rust':
        candidates = await this.resolveRust(importRef, sourceDir, sourceFile);
        break;
      case 'go':
        candidates = await this.resolveGo(importRef, sourceDir);
        break;
      case 'jvm':
        candidates = await this.resolveJvm(importRef, sourceDir);
        break;
      case 'c-family':
        candidates = await this.resolveCFamily(importRef, sourceDir);
        break;
      case 'ruby':
        candidates = await this.resolveRuby(importRef, sourceDir);
        break;
      default:
        candidates = await this.resolveGeneric(importRef, sourceDir, langDef);
        break;
    }

    // Verify candidates against filesystem
    const verified: { path: string; evidence: string }[] = [];
    for (const cand of candidates) {
      const verifiedPath = await this.verifyPath(cand.path, langDef);
      if (verifiedPath && !verified.some(v => v.path === verifiedPath)) {
        verified.push({ path: verifiedPath, evidence: cand.evidence });
      }
    }

    if (verified.length === 1) {
      return {
        status: 'resolved',
        target: verified[0].path,
        confidence: 0.98,
        evidence: [verified[0].evidence, 'filesystem-verified']
      };
    } else if (verified.length > 1) {
      return {
        status: 'ambiguous',
        candidates: verified.map(v => v.path),
        confidence: 0.70,
        evidence: verified.map(v => v.evidence)
      };
    }

    return {
      status: 'unresolved',
      confidence: 0,
      evidence: [],
      reason: `Could not statically resolve '${importRef.source}' from '${path.relative(this.projectContext.rootDir, sourceFile)}'`
    };
  }

  // ── TypeScript / JavaScript Ecosystem ─────────────────────────────────────────
  private async resolveTypeScript(
    importRef: ImportReference,
    sourceDir: string
  ): Promise<{ path: string; evidence: string }[]> {
    const candidates: { path: string; evidence: string }[] = [];
    const source = importRef.source;

    // 1. tsconfig paths
    const tsPaths = this.projectContext.resolveTsPath(source);
    for (const p of tsPaths) {
      candidates.push({ path: p, evidence: 'tsconfig-path' });
    }

    // 2. Monorepo package.json mapping
    if (this.projectContext.packageMap.has(source)) {
      const pkgDir = this.projectContext.packageMap.get(source)!;
      candidates.push({ path: pkgDir, evidence: 'monorepo-package' });
    }

    // 3. Relative or local imports
    const relativeTarget = path.resolve(sourceDir, source).replace(/\\/g, '/');
    candidates.push({ path: relativeTarget, evidence: 'relative-import' });

    return candidates;
  }

  // ── Python Ecosystem ─────────────────────────────────────────────────────────
  private async resolvePython(
    importRef: ImportReference,
    sourceDir: string
  ): Promise<{ path: string; evidence: string }[]> {
    const candidates: { path: string; evidence: string }[] = [];
    let source = importRef.source;

    // Convert relative dots
    if (source.startsWith('.')) {
      let dots = 0;
      while (source.startsWith('.')) {
        dots++;
        source = source.slice(1);
      }
      let base = sourceDir;
      for (let i = 1; i < dots; i++) {
        base = path.dirname(base);
      }
      const subPath = source.replace(/\./g, '/');
      const target = subPath ? path.resolve(base, subPath).replace(/\\/g, '/') : base;
      candidates.push({ path: target, evidence: 'python-relative-dot' });
      return candidates;
    }

    const modPath = source.replace(/\./g, '/');
    // Local / relative
    candidates.push({ path: path.resolve(sourceDir, modPath).replace(/\\/g, '/'), evidence: 'python-local-module' });

    // Project roots / src layout
    for (const srcDir of this.projectContext.pythonSrcDirs) {
      candidates.push({ path: path.resolve(srcDir, modPath).replace(/\\/g, '/'), evidence: 'python-src-layout' });
    }

    return candidates;
  }

  // ── Rust Ecosystem ───────────────────────────────────────────────────────────
  private async resolveRust(
    importRef: ImportReference,
    sourceDir: string,
    sourceFile: string
  ): Promise<{ path: string; evidence: string }[]> {
    const candidates: { path: string; evidence: string }[] = [];
    let source = importRef.source;

    if (source.startsWith('crate::')) {
      const subPath = source.slice('crate::'.length).replace(/::/g, '/');
      // Look for crate root (e.g. src/ or root)
      let crateRoot = sourceDir;
      let curr = sourceDir;
      while (curr.length >= this.projectContext.rootDir.length) {
        if (await fs.pathExists(path.join(curr, 'Cargo.toml'))) {
          crateRoot = path.join(curr, 'src');
          break;
        }
        curr = path.dirname(curr);
      }
      candidates.push({ path: path.resolve(crateRoot, subPath).replace(/\\/g, '/'), evidence: 'rust-crate-path' });
      candidates.push({ path: path.resolve(sourceDir, subPath).replace(/\\/g, '/'), evidence: 'rust-local-path' });
    } else if (source.startsWith('super::')) {
      const subPath = source.slice('super::'.length).replace(/::/g, '/');
      candidates.push({ path: path.resolve(path.dirname(sourceDir), subPath).replace(/\\/g, '/'), evidence: 'rust-super' });
    } else if (source.startsWith('self::')) {
      const subPath = source.slice('self::'.length).replace(/::/g, '/');
      candidates.push({ path: path.resolve(sourceDir, subPath).replace(/\\/g, '/'), evidence: 'rust-self' });
    } else {
      const modPath = source.replace(/::/g, '/');
      candidates.push({ path: path.resolve(sourceDir, modPath).replace(/\\/g, '/'), evidence: 'rust-mod' });
      candidates.push({ path: path.resolve(sourceDir, 'src', modPath).replace(/\\/g, '/'), evidence: 'rust-src-mod' });
    }

    return candidates;
  }

  // ── Go Ecosystem ─────────────────────────────────────────────────────────────
  private async resolveGo(
    importRef: ImportReference,
    sourceDir: string
  ): Promise<{ path: string; evidence: string }[]> {
    const candidates: { path: string; evidence: string }[] = [];
    const source = importRef.source;

    // Module prefix resolution
    if (this.projectContext.goModuleName && source.startsWith(this.projectContext.goModuleName)) {
      const subPath = source.slice(this.projectContext.goModuleName.length).replace(/^\//, '');
      candidates.push({ path: path.resolve(this.projectContext.rootDir, subPath).replace(/\\/g, '/'), evidence: 'go-module-root' });
    }

    // Relative or package directory
    const target = path.resolve(sourceDir, source).replace(/\\/g, '/');
    candidates.push({ path: target, evidence: 'go-relative' });
    candidates.push({ path: path.resolve(this.projectContext.rootDir, source).replace(/\\/g, '/'), evidence: 'go-root-package' });

    return candidates;
  }

  // ── JVM Ecosystem ────────────────────────────────────────────────────────────
  private async resolveJvm(
    importRef: ImportReference,
    sourceDir: string
  ): Promise<{ path: string; evidence: string }[]> {
    const candidates: { path: string; evidence: string }[] = [];
    const modPath = importRef.source.replace(/\./g, '/');

    candidates.push({ path: path.resolve(sourceDir, modPath).replace(/\\/g, '/'), evidence: 'jvm-local' });
    candidates.push({ path: path.resolve(this.projectContext.rootDir, modPath).replace(/\\/g, '/'), evidence: 'jvm-root' });

    // Standard Maven / Gradle source roots
    for (const root of ['src/main/java', 'src/main/kotlin', 'src/main/scala', 'src']) {
      candidates.push({ path: path.resolve(this.projectContext.rootDir, root, modPath).replace(/\\/g, '/'), evidence: 'jvm-src-root' });
    }

    return candidates;
  }

  // ── C / C++ Family Ecosystem ──────────────────────────────────────────────────
  private async resolveCFamily(
    importRef: ImportReference,
    sourceDir: string
  ): Promise<{ path: string; evidence: string }[]> {
    const candidates: { path: string; evidence: string }[] = [];
    const headerPath = importRef.source;

    candidates.push({ path: path.resolve(sourceDir, headerPath).replace(/\\/g, '/'), evidence: 'c-include-local' });
    for (const inc of ['include', 'inc', 'src', '']) {
      candidates.push({ path: path.resolve(this.projectContext.rootDir, inc, headerPath).replace(/\\/g, '/'), evidence: 'c-include-dir' });
    }

    return candidates;
  }

  // ── Ruby Ecosystem ───────────────────────────────────────────────────────────
  private async resolveRuby(
    importRef: ImportReference,
    sourceDir: string
  ): Promise<{ path: string; evidence: string }[]> {
    const candidates: { path: string; evidence: string }[] = [];
    const source = importRef.source;

    candidates.push({ path: path.resolve(sourceDir, source).replace(/\\/g, '/'), evidence: 'ruby-relative' });
    candidates.push({ path: path.resolve(this.projectContext.rootDir, 'lib', source).replace(/\\/g, '/'), evidence: 'ruby-lib' });
    candidates.push({ path: path.resolve(this.projectContext.rootDir, source).replace(/\\/g, '/'), evidence: 'ruby-root' });

    return candidates;
  }

  // ── Generic / Fallback Ecosystem ─────────────────────────────────────────────
  private async resolveGeneric(
    importRef: ImportReference,
    sourceDir: string,
    langDef?: LanguageDefinition
  ): Promise<{ path: string; evidence: string }[]> {
    const candidates: { path: string; evidence: string }[] = [];
    const processedSource = importRef.source.includes('.') && !importRef.source.includes('/') && !importRef.source.includes('\\')
      ? importRef.source.replace(/\./g, '/')
      : importRef.source;

    candidates.push({ path: path.resolve(sourceDir, processedSource).replace(/\\/g, '/'), evidence: 'generic-local' });
    candidates.push({ path: path.resolve(this.projectContext.rootDir, processedSource).replace(/\\/g, '/'), evidence: 'generic-root' });

    return candidates;
  }

  // ── Candidate Verification ────────────────────────────────────────────────────
  private async verifyPath(
    candidatePath: string,
    langDef?: LanguageDefinition
  ): Promise<string | null> {
    const normalized = candidatePath.replace(/\\/g, '/');

    // 1. Direct file check
    if (this.projectContext.fileSystemCache.has(normalized)) {
      return normalized;
    }
    if (await fs.pathExists(normalized)) {
      const stat = await fs.stat(normalized);
      if (!stat.isDirectory()) {
        this.projectContext.fileSystemCache.add(normalized);
        return normalized;
      }
    }

    // 2. Extension probing
    const exts = langDef?.extensions || [
      '', '.ts', '.tsx', '.js', '.jsx', '.py', '.rs', '.go',
      '.java', '.kt', '.scala', '.c', '.cpp', '.h', '.hpp',
      '.rb', '.php', '.cs', '.swift', '.dart', '.ex', '.lua', '.zig', '.jl', '.ps1', '.v', '.sv', '.vue', '.svelte'
    ];

    for (const ext of exts) {
      const withExt = normalized + ext;
      if (this.projectContext.fileSystemCache.has(withExt)) {
        return withExt;
      }
      if (await fs.pathExists(withExt)) {
        const stat = await fs.stat(withExt);
        if (!stat.isDirectory()) {
          this.projectContext.fileSystemCache.add(withExt);
          return withExt;
        }
      }
    }

    // 3. Directory entrypoints
    const entrypoints = langDef?.entrypoints || ['index.ts', 'index.js', '__init__.py', 'mod.rs', 'lib.rs', 'main.go', 'Main.java'];
    for (const entry of entrypoints) {
      const entryPath = path.join(normalized, entry).replace(/\\/g, '/');
      if (this.projectContext.fileSystemCache.has(entryPath)) {
        return entryPath;
      }
      if (await fs.pathExists(entryPath)) {
        const stat = await fs.stat(entryPath);
        if (!stat.isDirectory()) {
          this.projectContext.fileSystemCache.add(entryPath);
          return entryPath;
        }
      }
    }

    // 4. Directory containing language source files (e.g. Go package folder, Java package folder)
    if (await fs.pathExists(normalized)) {
      const stat = await fs.stat(normalized);
      if (stat.isDirectory()) {
        const files = await fs.readdir(normalized);
        const match = files.find(f => exts.some(e => e && f.endsWith(e)));
        if (match) {
          const matchedPath = path.join(normalized, match).replace(/\\/g, '/');
          this.projectContext.fileSystemCache.add(matchedPath);
          return matchedPath;
        }
      }
    }

    return null;
  }
}
