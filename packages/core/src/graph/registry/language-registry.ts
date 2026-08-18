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
      {
        id: 'java',
        name: 'Java',
        tier: 'tier-a-project-aware',
        extensions: ['.java'],
        wasmGrammar: 'tree-sitter-java.wasm',
        entrypoints: ['Main.java'],
        ecosystem: 'jvm'
      },
      {
        id: 'kotlin',
        name: 'Kotlin',
        tier: 'tier-a-project-aware',
        extensions: ['.kt', '.kts'],
        wasmGrammar: 'tree-sitter-kotlin.wasm',
        entrypoints: ['Main.kt'],
        ecosystem: 'jvm'
      },
      {
        id: 'scala',
        name: 'Scala',
        tier: 'tier-a-project-aware',
        extensions: ['.scala', '.sc'],
        wasmGrammar: 'tree-sitter-scala.wasm',
        entrypoints: ['Main.scala'],
        ecosystem: 'jvm'
      },
      {
        id: 'c',
        name: 'C',
        tier: 'tier-a-project-aware',
        extensions: ['.c', '.h'],
        wasmGrammar: 'tree-sitter-c.wasm',
        entrypoints: ['main.c'],
        ecosystem: 'c-family'
      },
      {
        id: 'cpp',
        name: 'C++',
        tier: 'tier-a-project-aware',
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
        tier: 'tier-a-project-aware',
        extensions: ['.rb', '.rake'],
        wasmGrammar: 'tree-sitter-ruby.wasm',
        entrypoints: ['main.rb'],
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
        entrypoints: ['main.ex'],
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
        id: 'powershell',
        name: 'PowerShell',
        tier: 'tier-c-syntax-indexing',
        extensions: ['.ps1', '.psm1'],
        entrypoints: [],
        ecosystem: 'generic'
      },
      {
        id: 'objective-c',
        name: 'Objective-C',
        tier: 'tier-b-ast-aware',
        extensions: ['.m', '.mm'],
        entrypoints: [],
        ecosystem: 'c-family'
      },
      {
        id: 'verilog',
        name: 'Verilog',
        tier: 'tier-c-syntax-indexing',
        extensions: ['.v', '.vh'],
        entrypoints: [],
        ecosystem: 'generic'
      },
      {
        id: 'systemverilog',
        name: 'SystemVerilog',
        tier: 'tier-c-syntax-indexing',
        extensions: ['.sv', '.svh'],
        entrypoints: [],
        ecosystem: 'generic'
      },
      {
        id: 'vue',
        name: 'Vue',
        tier: 'tier-b-ast-aware',
        extensions: ['.vue'],
        entrypoints: [],
        ecosystem: 'typescript'
      },
      {
        id: 'svelte',
        name: 'Svelte',
        tier: 'tier-b-ast-aware',
        extensions: ['.svelte'],
        entrypoints: [],
        ecosystem: 'typescript'
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
    return this.languages.get(id);
  }

  static getLanguageByExtension(ext: string): LanguageDefinition | undefined {
    const normalized = ext.startsWith('.') ? ext.toLowerCase() : `.${ext.toLowerCase()}`;
    return this.extensionMap.get(normalized);
  }

  static getAllLanguages(): LanguageDefinition[] {
    return Array.from(this.languages.values());
  }

  static getAllExtensions(): string[] {
    return Array.from(this.extensionMap.keys());
  }

  static isSupported(ext: string): boolean {
    return this.extensionMap.has(ext.startsWith('.') ? ext.toLowerCase() : `.${ext.toLowerCase()}`);
  }

  static getTier(ext: string): LanguageTier {
    const lang = this.getLanguageByExtension(ext);
    return lang ? lang.tier : 'tier-c-syntax-indexing';
  }
}
