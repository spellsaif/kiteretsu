import { LanguageResolver, ResolveContext } from './resolver.js';
import { TypeScriptResolver } from './typescript.js';
import { PythonResolver } from './python.js';
import { RustResolver } from './rust.js';
import { GoResolver } from './go.js';
import { RubyResolver } from './ruby.js';
import { GenericResolver } from './generic.js';
import { ProjectContext } from '../project/project-context.js';
import { ResolutionEngine } from '../engine/resolution-engine.js';
import { createImportReference } from '../ir/import-ir.js';
import { LanguageRegistry } from '../registry/language-registry.js';

export * from '../registry/language-registry.js';
export * from '../ir/import-ir.js';
export * from '../project/project-context.js';
export * from '../engine/resolution-engine.js';

export * from './resolver.js';
export * from './typescript.js';
export * from './python.js';
export * from './rust.js';
export * from './go.js';
export * from './ruby.js';
export * from './generic.js';

export class DependencyResolverRegistry {
  private resolvers: LanguageResolver[];
  private fallback: LanguageResolver;
  private engines: Map<string, ResolutionEngine> = new Map();

  constructor(customResolvers?: LanguageResolver[]) {
    this.resolvers = customResolvers || [
      new TypeScriptResolver(),
      new PythonResolver(),
      new RustResolver(),
      new GoResolver(),
      new RubyResolver(),
    ];
    this.fallback = new GenericResolver();
  }

  getResolver(ext: string): LanguageResolver {
    const found = this.resolvers.find(r => r.supports(ext));
    return found || this.fallback;
  }

  async resolveDependencies(ext: string, context: ResolveContext): Promise<string[]> {
    // 1. First try unified ResolutionEngine
    try {
      let engine = this.engines.get(context.rootDir);
      if (!engine) {
        const projectCtx = new ProjectContext(context.rootDir);
        projectCtx.fileSystemCache = context.fileSystemCache;
        projectCtx.packageMap = context.packageMap;
        projectCtx.crateMap = context.crateMap;
        projectCtx.goModuleName = context.goModuleName;
        await projectCtx.initialize();
        engine = new ResolutionEngine(projectCtx);
        this.engines.set(context.rootDir, engine);
      }

      const langDef = LanguageRegistry.getLanguageByExtension(ext);
      const importRef = createImportReference(
        context.importInfo.source,
        langDef?.id || 'generic',
        {
          isTypeOnly: context.importInfo.type === 'type',
          isDynamic: context.importInfo.resolution === 'dynamic'
        }
      );

      const result = await engine.resolve(importRef, context.sourceFile);
      if (result.status === 'resolved' && result.target) {
        return [result.target];
      }
      if (result.status === 'ambiguous' && result.candidates && result.candidates.length > 0) {
        return result.candidates;
      }
    } catch { }

    // 2. Fallback to existing resolver strategies
    const resolver = this.getResolver(ext);
    return resolver.resolve(context);
  }
}
