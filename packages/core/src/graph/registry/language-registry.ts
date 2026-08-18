export type LanguageTier = 'tier-a-project-aware' | 'tier-b-ast-aware' | 'tier-c-syntax-indexing';

export interface LanguageDefinition {
  id: string;
  name: string;
  tier: LanguageTier;
  extensions: string[];
  wasmGrammar?: string;
  entrypoints: string[];
  ecosystem: 'typescript' | 'python' | 'rust' | 'go' | 'jvm' | 'c-family' | 'ruby' | 'generic';
}

export class LanguageRegistry {
  private static languages: Map<string, LanguageDefinition> = new Map();
  private static extensionMap: Map<string, LanguageDefinition> = new Map();

  static {
    const definitions: LanguageDefinition[] = [
      // Tier A: Project-Aware Resolution (dedicated project context adapters for tsconfig, package.json, Cargo.toml, go.mod, pyproject.toml)
      {
        id: 'typescript',
        name: 'TypeScript',
        tier: 'tier-a-project-aware',
        extensions: ['.ts', '.tsx', '.mts', '.cts'],
        wasmGrammar: 'tree-sitter-typescript.wasm',
        entrypoints: ['index.ts', 'index.tsx', 'index.js', 'package.json'],
        ecosystem: 'typescript'
      },
      {
        id: 'javascript',
        name: 'JavaScript',
        tier: 'tier-a-project-aware',
        extensions: ['.js', '.jsx', '.mjs', '.cjs'],
        wasmGrammar: 'tree-sitter-javascript.wasm',
        entrypoints: ['index.js', 'index.jsx', 'package.json'],
        ecosystem: 'typescript'
      },
      {
        id: 'python',
        name: 'Python',
        tier: 'tier-a-project-aware',
        extensions: ['.py', '.pyi'],
        wasmGrammar: 'tree-sitter-python.wasm',
        entrypoints: ['__init__.py', 'main.py'],
        ecosystem: 'python'
      },
      {
        id: 'rust',
        name: 'Rust',
        tier: 'tier-a-project-aware',
        extensions: ['.rs'],
        wasmGrammar: 'tree-sitter-rust.wasm',
        entrypoints: ['mod.rs', 'lib.rs', 'main.rs'],
        ecosystem: 'rust'
      },
      {
        id: 'go',
        name: 'Go',
        tier: 'tier-a-project-aware',
        extensions: ['.go'],
        wasmGrammar: 'tree-sitter-go.wasm',
        entrypoints: ['main.go'],
        ecosystem: 'go'
      },

      // Tier B: AST-Aware & Syntactic Resolution (Tree-sitter AST, symbol extraction, candidate resolution, semantic search)
      {
        id: 'java',
        name: 'Java',
        tier: 'tier-b-ast-aware',
        extensions: ['.java'],
        wasmGrammar: 'tree-sitter-java.wasm',
        entrypoints: ['Main.java'],
        ecosystem: 'jvm'
      },
      {
        id: 'kotlin',
        name: 'Kotlin',
        tier: 'tier-b-ast-aware',
        extensions: ['.kt', '.kts'],
        wasmGrammar: 'tree-sitter-kotlin.wasm',
        entrypoints: ['Main.kt'],
        ecosystem: 'jvm'
      },
      {
        id: 'scala',
        name: 'Scala',
        tier: 'tier-b-ast-aware',
        extensions: ['.scala', '.sc'],
        wasmGrammar: 'tree-sitter-scala.wasm',
        entrypoints: ['Main.scala'],
        ecosystem: 'jvm'
      },
      {
        id: 'c',
        name: 'C',
        tier: 'tier-b-ast-aware',
        extensions: ['.c', '.h'],
        wasmGrammar: 'tree-sitter-c.wasm',
        entrypoints: ['main.c'],
        ecosystem: 'c-family'
      },
      {
        id: 'cpp',
        name: 'C++',
        tier: 'tier-b-ast-aware',
        extensions: ['.cpp', '.cc', '.cxx', '.hpp', '.hxx', '.hh', '.h'],
        wasmGrammar: 'tree-sitter-cpp.wasm',
        entrypoints: ['main.cpp'],
        ecosystem: 'c-family'
      },
      {
        id: 'csharp',
        name: 'C#',
        tier: 'tier-b-ast-aware',
        extensions: ['.cs'],
        wasmGrammar: 'tree-sitter-c_sharp.wasm',
        entrypoints: ['Program.cs'],
        ecosystem: 'generic'
      },
      {
        id: 'ruby',
        name: 'Ruby',
        tier: 'tier-b-ast-aware',
        extensions: ['.rb'],
        wasmGrammar: 'tree-sitter-ruby.wasm',
        entrypoints: ['main.rb', 'init.rb'],
        ecosystem: 'ruby'
      },
      {
        id: 'php',
        name: 'PHP',
        tier: 'tier-b-ast-aware',
        extensions: ['.php'],
        wasmGrammar: 'tree-sitter-php.wasm',
        entrypoints: ['index.php'],
        ecosystem: 'generic'
      },
      {
        id: 'swift',
        name: 'Swift',
        tier: 'tier-b-ast-aware',
        extensions: ['.swift'],
        wasmGrammar: 'tree-sitter-swift.wasm',
        entrypoints: ['main.swift'],
        ecosystem: 'generic'
      },
      {
        id: 'dart',
        name: 'Dart',
        tier: 'tier-b-ast-aware',
        extensions: ['.dart'],
        wasmGrammar: 'tree-sitter-dart.wasm',
        entrypoints: ['main.dart'],
        ecosystem: 'generic'
      },
      {
        id: 'elixir',
        name: 'Elixir',
        tier: 'tier-b-ast-aware',
        extensions: ['.ex', '.exs'],
        wasmGrammar: 'tree-sitter-elixir.wasm',
        entrypoints: ['mix.exs'],
        ecosystem: 'generic'
      },
      {
        id: 'lua',
        name: 'Lua',
        tier: 'tier-b-ast-aware',
        extensions: ['.lua'],
        wasmGrammar: 'tree-sitter-lua.wasm',
        entrypoints: ['init.lua', 'main.lua'],
        ecosystem: 'generic'
      },
      {
        id: 'zig',
        name: 'Zig',
        tier: 'tier-b-ast-aware',
        extensions: ['.zig'],
        wasmGrammar: 'tree-sitter-zig.wasm',
        entrypoints: ['main.zig'],
        ecosystem: 'generic'
      },
      {
        id: 'julia',
        name: 'Julia',
        tier: 'tier-b-ast-aware',
        extensions: ['.jl'],
        wasmGrammar: 'tree-sitter-julia.wasm',
        entrypoints: ['main.jl'],
        ecosystem: 'generic'
      },
      {
        id: 'objective-c',
        name: 'Objective-C',
        tier: 'tier-b-ast-aware',
        extensions: ['.m', '.mm'],
        wasmGrammar: 'tree-sitter-objc.wasm',
        entrypoints: ['main.m'],
        ecosystem: 'c-family'
      },
      {
        id: 'vue',
        name: 'Vue',
        tier: 'tier-b-ast-aware',
        extensions: ['.vue'],
        wasmGrammar: 'tree-sitter-vue.wasm',
        entrypoints: ['App.vue'],
        ecosystem: 'typescript'
      },
      {
        id: 'svelte',
        name: 'Svelte',
        tier: 'tier-b-ast-aware',
        extensions: ['.svelte'],
        wasmGrammar: 'tree-sitter-svelte.wasm',
        entrypoints: ['App.svelte'],
        ecosystem: 'typescript'
      },

      // Tier C: Syntax & Symbol Indexing
      {
        id: 'powershell',
        name: 'PowerShell',
        tier: 'tier-c-syntax-indexing',
        extensions: ['.ps1', '.psm1'],
        entrypoints: ['profile.ps1'],
        ecosystem: 'generic'
      },
      {
        id: 'verilog',
        name: 'Verilog',
        tier: 'tier-c-syntax-indexing',
        extensions: ['.v', '.vh'],
        entrypoints: ['top.v'],
        ecosystem: 'generic'
      },
      {
        id: 'systemverilog',
        name: 'SystemVerilog',
        tier: 'tier-c-syntax-indexing',
        extensions: ['.sv', '.svh'],
        entrypoints: ['top.sv'],
        ecosystem: 'generic'
      }
    ];

    for (const def of definitions) {
      this.languages.set(def.id, def);
      for (const ext of def.extensions) {
        this.extensionMap.set(ext.toLowerCase(), def);
      }
    }
  }

  static getLanguage(id: string): LanguageDefinition | undefined {
    return this.languages.get(id.toLowerCase());
  }

  static getLanguageByExtension(ext: string): LanguageDefinition | undefined {
    const cleanExt = ext.startsWith('.') ? ext.toLowerCase() : `.${ext.toLowerCase()}`;
    return this.extensionMap.get(cleanExt);
  }

  static getLanguageForFile(filePath: string): LanguageDefinition | undefined {
    for (const [ext, def] of this.extensionMap.entries()) {
      if (filePath.toLowerCase().endsWith(ext)) {
        return def;
      }
    }
    return undefined;
  }

  static getAllLanguages(): LanguageDefinition[] {
    return Array.from(this.languages.values());
  }

  static getTierLanguages(tier: LanguageTier): LanguageDefinition[] {
    return this.getAllLanguages().filter(l => l.tier === tier);
  }

  static getAllExtensions(): string[] {
    return Array.from(this.extensionMap.keys());
  }

  static getEcosystem(languageId: string): string {
    const def = this.getLanguage(languageId);
    return def ? def.ecosystem : 'generic';
  }
}
