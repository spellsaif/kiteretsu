import { LanguageResolver, ResolveContext } from './resolver.js';
import { TypeScriptResolver } from './typescript.js';
import { PythonResolver } from './python.js';
import { RustResolver } from './rust.js';
import { GoResolver } from './go.js';
import { RubyResolver } from './ruby.js';
import { GenericResolver } from './generic.js';

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
    const resolver = this.getResolver(ext);
    return resolver.resolve(context);
  }
}
