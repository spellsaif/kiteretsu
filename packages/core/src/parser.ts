import { Parser, Language, Query } from 'web-tree-sitter';
import fs from 'fs-extra';
import path from 'path';
import { createRequire } from 'module';
import { fileURLToPath } from 'url';

const require = createRequire(import.meta.url);
const LOG_PATH = path.resolve(process.cwd(), '.kiteretsu', 'debug.log');

function debugLog(msg: string) {
  try { fs.appendFileSync(LOG_PATH, msg + '\n'); } catch {}
}

export interface SymbolInfo {
  name: string;
  type: 'function' | 'class' | 'interface' | 'method' | 'variable' | 'struct' | 'module';
  startLine: number;
  endLine: number;
}

export interface ImportInfo {
  source: string;
  type: 'value' | 'type';
  resolution?: 'static' | 'dynamic';
}

// ─── Language Configuration ───────────────────────────────────────────────────
// Maps file extensions to their WASM grammar file name and query definitions.
// This is the single source of truth for all language support.

interface LanguageConfig {
  wasmFile: string;      // Filename inside tree-sitter-wasms/out/
  symbolQuery: string;   // Tree-sitter S-expression for symbol extraction
  importQuery: string;   // Tree-sitter S-expression for import extraction
}

const LANGUAGE_CONFIG: Record<string, LanguageConfig> = {
  // ── TypeScript / JavaScript ─────────────────────────────────────────────────
  '.ts': {
    wasmFile: 'tree-sitter-typescript.wasm',
    symbolQuery: `
      (function_declaration name: (identifier) @func.name)
      (class_declaration name: (type_identifier) @class.name)
      (class_declaration name: (identifier) @class.name)
      (method_definition name: (property_identifier) @method.name)
      (lexical_declaration (variable_declarator name: (identifier) @var.name))
    `,
    importQuery: `(_ [(string) (string_literal)] @source)`,
  },
  '.tsx': {
    wasmFile: 'tree-sitter-tsx.wasm',
    symbolQuery: `
      (function_declaration name: (identifier) @func.name)
      (class_declaration name: (type_identifier) @class.name)
      (class_declaration name: (identifier) @class.name)
      (method_definition name: (property_identifier) @method.name)
      (lexical_declaration (variable_declarator name: (identifier) @var.name))
    `,
    importQuery: `(_ [(string) (string_literal)] @source)`,
  },
  '.js': {
    wasmFile: 'tree-sitter-javascript.wasm',
    symbolQuery: `
      (function_declaration name: (identifier) @func.name)
      (class_declaration name: (identifier) @class.name)
      (method_definition name: (property_identifier) @method.name)
      (lexical_declaration (variable_declarator name: (identifier) @var.name))
    `,
    importQuery: `(_ [(string) (string_literal)] @source)`,
  },
  '.jsx': {
    wasmFile: 'tree-sitter-javascript.wasm',
    symbolQuery: `
      (function_declaration name: (identifier) @func.name)
      (class_declaration name: (identifier) @class.name)
      (method_definition name: (property_identifier) @method.name)
      (lexical_declaration (variable_declarator name: (identifier) @var.name))
    `,
    importQuery: `(_ [(string) (string_literal)] @source)`,
  },
  '.vue': {
    wasmFile: 'tree-sitter-vue.wasm',
    symbolQuery: `(attribute_value) @attr.value`,
    importQuery: `(string) @source`,
  },
  '.svelte': {
    wasmFile: 'tree-sitter-javascript.wasm',
    symbolQuery: `(variable_declarator name: (identifier) @var.name)`,
    importQuery: `(string) @source`,
  },

  // ── Python ──────────────────────────────────────────────────────────────────
  '.py': {
    wasmFile: 'tree-sitter-python.wasm',
    symbolQuery: `
      (function_definition name: (identifier) @func.name)
      (class_definition name: (identifier) @class.name)
    `,
    importQuery: `
      (import_statement name: (dotted_name) @source)
      (import_from_statement module_name: (dotted_name) @source)
      (import_from_statement module_name: (relative_import) @source)
    `,
  },

  // ── Rust ────────────────────────────────────────────────────────────────────
  // For Rust, use_declaration has an 'argument' field that can be:
  //   - scoped_identifier (e.g. crate::models::User)
  //   - scoped_use_list (e.g. crate::models::{User, Post})
  //   - use_wildcard (e.g. crate::models::*)
  //   - use_as_clause (e.g. crate::models::User as MyUser)
  //   - identifier, self, super, crate
  // We capture the entire use_declaration and extract the text programmatically.
  '.rs': {
    wasmFile: 'tree-sitter-rust.wasm',
    symbolQuery: `
      (function_item name: (identifier) @func.name)
      (struct_item name: (type_identifier) @struct.name)
      (impl_item type: (type_identifier) @class.name)
      (trait_item name: (type_identifier) @interface.name)
      (enum_item name: (type_identifier) @class.name)
    `,
    importQuery: `
      (use_declaration argument: (_) @source)
    `,
  },

  // ── Go ──────────────────────────────────────────────────────────────────────
  // Go import_spec has a 'path' field that is an interpreted_string_literal
  '.go': {
    wasmFile: 'tree-sitter-go.wasm',
    symbolQuery: `
      (function_declaration name: (identifier) @func.name)
      (method_declaration name: (field_identifier) @method.name)
      (type_declaration (type_spec name: (type_identifier) @type.name))
    `,
    importQuery: `
      (import_spec path: (interpreted_string_literal) @source)
    `,
  },

  // ── Java ────────────────────────────────────────────────────────────────────
  '.java': {
    wasmFile: 'tree-sitter-java.wasm',
    symbolQuery: `
      (method_declaration name: (identifier) @method.name)
      (class_declaration name: (identifier) @class.name)
      (interface_declaration name: (identifier) @interface.name)
    `,
    importQuery: `
      (import_declaration (scoped_identifier) @source)
    `,
  },

  // ── Ruby ────────────────────────────────────────────────────────────────────
  '.rb': {
    wasmFile: 'tree-sitter-ruby.wasm',
    symbolQuery: `
      (method name: (identifier) @method.name)
      (class name: (constant) @class.name)
      (module name: (constant) @module.name)
    `,
    importQuery: `
      (call method: (identifier) @_method arguments: (argument_list (string (string_content) @source)) (#eq? @_method "require"))
      (call method: (identifier) @_method arguments: (argument_list (string (string_content) @source)) (#eq? @_method "require_relative"))
    `,
  },

  // ── PHP ─────────────────────────────────────────────────────────────────────
  '.php': {
    wasmFile: 'tree-sitter-php.wasm',
    symbolQuery: `
      (function_definition name: (name) @func.name)
      (class_declaration name: (name) @class.name)
      (method_declaration name: (name) @method.name)
    `,
    importQuery: `
      (namespace_use_declaration (namespace_use_clause (qualified_name) @source))
    `,
  },

  // ── C ───────────────────────────────────────────────────────────────────────
  '.c': {
    wasmFile: 'tree-sitter-c.wasm',
    symbolQuery: `
      (function_definition declarator: (function_declarator declarator: (identifier) @func.name))
      (struct_specifier name: (type_identifier) @struct.name)
    `,
    importQuery: `
      (preproc_include path: (string_literal) @source)
      (preproc_include path: (system_lib_string) @source)
    `,
  },

  // ── C++ ─────────────────────────────────────────────────────────────────────
  '.cpp': {
    wasmFile: 'tree-sitter-cpp.wasm',
    symbolQuery: `
      (function_definition declarator: (function_declarator declarator: (identifier) @func.name))
      (class_specifier name: (type_identifier) @class.name)
      (struct_specifier name: (type_identifier) @struct.name)
    `,
    importQuery: `
      (preproc_include path: (string_literal) @source)
      (preproc_include path: (system_lib_string) @source)
    `,
  },

  // ── C# ──────────────────────────────────────────────────────────────────────
  '.cs': {
    wasmFile: 'tree-sitter-c_sharp.wasm',
    symbolQuery: `
      (method_declaration name: (identifier) @method.name)
      (class_declaration name: (identifier) @class.name)
      (interface_declaration name: (identifier) @interface.name)
    `,
    importQuery: `
      (using_directive (qualified_name) @source)
    `,
  },

  // ── Swift ───────────────────────────────────────────────────────────────────
  '.swift': {
    wasmFile: 'tree-sitter-swift.wasm',
    symbolQuery: `
      (function_declaration name: (simple_identifier) @func.name)
      (class_declaration name: (type_identifier) @class.name)
      (protocol_declaration name: (type_identifier) @interface.name)
    `,
    importQuery: `
      (import_declaration (identifier) @source)
    `,
  },

  // ── Kotlin ──────────────────────────────────────────────────────────────────
  '.kt': {
    wasmFile: 'tree-sitter-kotlin.wasm',
    symbolQuery: `
      (function_declaration (simple_identifier) @func.name)
      (class_declaration (type_identifier) @class.name)
    `,
    importQuery: `
      (import_header (identifier) @source)
    `,
  },

  // ── Scala ───────────────────────────────────────────────────────────────────
  '.scala': {
    wasmFile: 'tree-sitter-scala.wasm',
    symbolQuery: `
      (function_definition name: (identifier) @func.name)
      (class_definition name: (identifier) @class.name)
      (object_definition name: (identifier) @module.name)
      (trait_definition name: (identifier) @interface.name)
    `,
    importQuery: `
      (import_declaration path: (stable_identifier) @source)
    `,
  },

  // ── Lua ─────────────────────────────────────────────────────────────────────
  '.lua': {
    wasmFile: 'tree-sitter-lua.wasm',
    symbolQuery: `
      (function_declaration name: (identifier) @func.name)
    `,
    importQuery: `
      (function_call name: (identifier) @_fn arguments: (arguments (string) @source) (#eq? @_fn "require"))
    `,
  },

  // ── Dart ────────────────────────────────────────────────────────────────────
  '.dart': {
    wasmFile: 'tree-sitter-dart.wasm',
    symbolQuery: `
      (function_signature name: (identifier) @func.name)
      (class_definition name: (identifier) @class.name)
    `,
    importQuery: `
      (import_or_export (configurable_uri (uri (string_literal) @source)))
    `,
  },

  // ── Elixir ──────────────────────────────────────────────────────────────────
  '.ex': {
    wasmFile: 'tree-sitter-elixir.wasm',
    symbolQuery: `
      (call target: (identifier) @_kw (arguments (alias) @module.name) (#match? @_kw "^(defmodule)$"))
      (call target: (identifier) @_kw (arguments (identifier) @func.name) (#match? @_kw "^(def|defp)$"))
    `,
    importQuery: `
      (call target: (identifier) @_kw (arguments (alias) @source) (#match? @_kw "^(import|alias|use)$"))
    `,
  },

  // ── Zig ─────────────────────────────────────────────────────────────────────
  '.zig': {
    wasmFile: 'tree-sitter-zig.wasm',
    symbolQuery: `
      (TopLevelDecl (FnProto (IDENTIFIER) @func.name))
    `,
    importQuery: `
      (BuildinExpr (BUILTINIDENTIFIER) @_fn (Expr (STRINGLITERALSINGLE) @source) (#eq? @_fn "@import"))
    `,
  },

  // ── Bash ────────────────────────────────────────────────────────────────────
  '.sh': {
    wasmFile: 'tree-sitter-bash.wasm',
    symbolQuery: `
      (function_definition name: (word) @func.name)
    `,
    importQuery: `
      (command name: (command_name) @_cmd argument: (word) @source (#match? @_cmd "^(source|\\\\.)$"))
    `,
  },

  // ── PowerShell ─────────────────────────────────────────────────────────────
  '.ps1': {
    wasmFile: 'tree-sitter-powershell.wasm',
    symbolQuery: `(function_definition name: (word) @func.name)`,
    importQuery: `(command name: (command_name) @_cmd argument: (word) @source (#match? @_cmd "^(\\\\.|Import-Module)$"))`,
  },

  // ── Objective-C ─────────────────────────────────────────────────────────────
  '.m': {
    wasmFile: 'tree-sitter-objc.wasm',
    symbolQuery: `(method_definition) @method.name`,
    importQuery: `(preproc_import path: (string_literal) @source)`,
  },

  // ── Julia ───────────────────────────────────────────────────────────────────
  '.jl': {
    wasmFile: 'tree-sitter-julia.wasm',
    symbolQuery: `(function_definition name: (identifier) @func.name)`,
    importQuery: `(import_statement (import_path (identifier) @source)) (using_statement (import_path (identifier) @source))`,
  },

  // ── Verilog / SystemVerilog ─────────────────────────────────────────────────
  '.v': {
    wasmFile: 'tree-sitter-verilog.wasm',
    symbolQuery: `(module_declaration name: (identifier) @class.name)`,
    importQuery: `(include_directive path: (string_literal) @source)`,
  },
  '.sv': {
    wasmFile: 'tree-sitter-verilog.wasm',
    symbolQuery: `(module_declaration name: (identifier) @class.name)`,
    importQuery: `(include_directive path: (string_literal) @source)`,
  },

  // ── HTML ────────────────────────────────────────────────────────────────────
  '.html': {
    wasmFile: 'tree-sitter-html.wasm',
    symbolQuery: ``,
    importQuery: ``,
  },
};

// ─── Parser Implementation ───────────────────────────────────────────────────

export class CodeParser {
  private static initPromise: Promise<void> | null = null;
  private languages: Map<string, Language> = new Map();
  private queryCache: Map<string, { symbol?: Query, import?: Query }> = new Map();
  private parserInstance: Parser | null = null;

  constructor() {}

  private async ensureInit(): Promise<void> {
    if (!CodeParser.initPromise) {
      CodeParser.initPromise = Parser.init();
    }
    await CodeParser.initPromise;
  }

  /**
   * Load a language grammar from its WASM file.
   * Uses tree-sitter-wasms package for pre-built WASM binaries.
   */
  private async loadLanguage(ext: string): Promise<Language | null> {
    if (this.languages.has(ext)) return this.languages.get(ext)!;

    await this.ensureInit();
    const config = LANGUAGE_CONFIG[ext];
    if (!config) return null;

    try {
      let wasmPath = '';
      
      // 1. Try require.resolve safely
      try {
        const wasmsDir = path.dirname(require.resolve('tree-sitter-wasms/package.json'));
        const p = path.join(wasmsDir, 'out', config.wasmFile);
        if (fs.existsSync(p)) wasmPath = p;
      } catch (e) {}

      // 2. Try process.cwd() fallback
      if (!wasmPath) {
        const p = path.join(process.cwd(), 'node_modules', 'tree-sitter-wasms', 'out', config.wasmFile);
        if (fs.existsSync(p)) wasmPath = p;
      }

      // 3. Try deep pnpm fallback (for this environment)
      if (!wasmPath) {
        const p = path.join(process.cwd(), 'node_modules', '.pnpm', 'tree-sitter-wasms@0.1.13', 'node_modules', 'tree-sitter-wasms', 'out', config.wasmFile);
        if (fs.existsSync(p)) wasmPath = p;
      }

      if (!wasmPath) {
        debugLog(`[Parser] WASM file not found for ${ext}: ${config.wasmFile}`);
        return null;
      }

      const language = await Language.load(wasmPath);
      this.languages.set(ext, language);
      return language;
    } catch (e: any) {
      debugLog(`[Parser] Failed to load WASM for ${ext}: ${e.message}`);
      return null;
    }
  }

  destroy(): void {
    for (const queries of this.queryCache.values()) {
      queries.symbol?.delete();
      queries.import?.delete();
    }
    this.queryCache.clear();
    for (const language of this.languages.values()) {
      try {
        const disposableLanguage = language as Language & { delete?: () => void };
        disposableLanguage.delete?.();
      } catch {}
    }
    this.languages.clear();
    if (this.parserInstance) {
      this.parserInstance.delete();
      this.parserInstance = null;
    }
  }

  async parseCode(filePath: string): Promise<{ symbols: SymbolInfo[], imports: ImportInfo[] }> {
    const ext = path.extname(filePath);
    const config = LANGUAGE_CONFIG[ext];
    if (!config) return { symbols: [], imports: [] };

    const content = await fs.readFile(filePath, 'utf8');
    
    // 1. Regex Pass (Quick)
    const symbols = this.parseSymbolsWithRegex(ext, content);
    const imports = this.parseImportsWithRegex(ext, content) || [];

    // 2. Tree-sitter Pass (Deep)
    const treeSitterFallbackExts = new Set(['.py', '.go', '.rs', '.rb', '.c', '.cpp', '.h', '.hpp', '.java', '.cs', '.php', '.swift', '.kt', '.scala', '.lua', '.dart', '.ex', '.zig']);
    if (symbols.length > 0 && imports.length > 0 && !treeSitterFallbackExts.has(ext)) {
      return { symbols, imports };
    }

    const language = await this.loadLanguage(ext);
    if (!language) return { symbols, imports };

    if (!this.parserInstance) {
      this.parserInstance = new Parser();
    }
    this.parserInstance.setLanguage(language);
    
    let tree: any = null;

    try {
      tree = this.parserInstance.parse(content);
      if (!tree) return { symbols, imports };

      // Get or create cached queries
      let queries = this.queryCache.get(ext);
      if (!queries) {
        queries = {};
        if (config.symbolQuery) queries.symbol = new Query(language, config.symbolQuery);
        if (config.importQuery) queries.import = new Query(language, config.importQuery);
        this.queryCache.set(ext, queries);
      }

      // Extract Symbols
      if (queries.symbol) {
        try {
          const captures = queries.symbol.captures(tree.rootNode);
          for (const capture of captures) {
            if (capture.name.startsWith('_')) continue;
            const name = capture.node.text;
            if (!symbols.some(s => s.name === name)) {
              symbols.push({
                name,
                type: this.mapNodeType(capture.name),
                startLine: capture.node.startPosition.row + 1,
                endLine: capture.node.endPosition.row + 1,
              });
            }
          }
        } catch (e: any) { debugLog(`[Parser] Symbol query failed: ${e.message}`); }
      }

      // Extract Imports
      if (queries.import) {
        try {
          const captures = queries.import.captures(tree.rootNode);
          for (const capture of captures) {
            let source = capture.node.text;
            let isTypeOnly = false;

            // Resilient filtering
            let parent = capture.node.parent;
            let isImport = false;
            let depth = 0;
            while (parent && depth < 10) {
              const type = parent.type.toLowerCase();
              if (type.includes('import') || type.includes('export') || type.includes('use') || type.includes('require')) {
                isImport = true;
                if (parent.text.includes('type ')) isTypeOnly = true;
                break;
              }
              parent = parent.parent;
              depth++;
            }

            if (!isImport) continue;
            source = this.normalizeImport(ext, source);
            if (source && !imports.some(i => i.source === source)) {
              imports.push({ source, type: isTypeOnly ? 'type' : 'value' });
            }
          }
        } catch (e: any) { debugLog(`[Parser] Import query failed: ${e.message}`); }
      }
    } catch (e: any) {
      debugLog(`[Parser] Deep parse failed for ${filePath}: ${e.message}`);
    } finally {
      if (tree) tree.delete();
    }

    return { symbols, imports };
  }

  async parseSymbols(filePath: string): Promise<SymbolInfo[]> {
    const { symbols } = await this.parseCode(filePath);
    return symbols;
  }

  private parseSymbolsWithRegex(ext: string, content: string): SymbolInfo[] {
    const symbols: SymbolInfo[] = [];
    const addSymbol = (name: string | undefined, type: SymbolInfo['type'], index: number | undefined) => {
      if (!name || index === undefined) return;
      const line = content.slice(0, index).split('\n').length;
      if (symbols.some(symbol => symbol.name === name && symbol.type === type && symbol.startLine === line)) return;

      symbols.push({
        name,
        type,
        startLine: line,
        endLine: line,
      });
    };

    switch (ext) {
      case '.ts':
      case '.tsx':
      case '.js':
      case '.jsx': {
        for (const match of content.matchAll(/\bfunction\s+([A-Za-z_$][\w$]*)\s*\(/g)) {
          addSymbol(match[1], 'function', match.index);
        }
        for (const match of content.matchAll(/\bclass\s+([A-Za-z_$][\w$]*)\b/g)) {
          addSymbol(match[1], 'class', match.index);
        }
        for (const match of content.matchAll(/\b(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*=\s*(?:async\s*)?(?:\([^)]*\)|[A-Za-z_$][\w$]*)\s*=>/g)) {
          addSymbol(match[1], 'variable', match.index);
        }
        return symbols;
      }

      default:
        return symbols;
    }
  }

  async parseImports(filePath: string): Promise<ImportInfo[]> {
    const { imports } = await this.parseCode(filePath);
    return imports;
  }

  private parseImportsWithRegex(ext: string, content: string): ImportInfo[] | null {
    const imports: ImportInfo[] = [];
    const addImport = (
      raw: string | undefined,
      type: 'value' | 'type' = 'value',
      resolution: 'static' | 'dynamic' = 'static'
    ) => {
      if (!raw) return;

      const source = this.normalizeImport(ext, raw.trim());
      if (!source) return;

      const existing = imports.find(i => i.source === source);
      if (existing) {
        if (type === 'value') existing.type = 'value';
        if (resolution === 'dynamic' || existing.resolution === 'dynamic') {
          existing.resolution = 'dynamic';
        }
        return;
      }

      imports.push({ source, type, resolution });
    };

    switch (ext) {
      case '.ts':
      case '.tsx':
      case '.js':
      case '.jsx':
      case '.vue':
      case '.svelte': {
        const constStrings = new Map<string, string>();
        for (const match of content.matchAll(/\bconst\s+([A-Za-z_$][\w$]*)\s*=\s*(['"])([^'"\\]*(?:\\.[^'"\\]*)*)\2\s*;?/g)) {
          constStrings.set(match[1], match[3]);
        }

        for (const match of content.matchAll(/\bimport\s+type\b[\s\S]*?\bfrom\s*["'`]([^"'`]+)["'`]/g)) {
          addImport(match[1], 'type');
        }
        for (const match of content.matchAll(/\bimport\s+(?!type\b)[\s\S]*?\bfrom\s*["'`]([^"'`]+)["'`]/g)) {
          addImport(match[1]);
        }
        for (const match of content.matchAll(/\bimport\s*["'`]([^"'`]+)["'`]/g)) {
          addImport(match[1]);
        }
        for (const match of content.matchAll(/\bexport\s+(type\s+)?(?:\*|\{[\s\S]*?\})\s+from\s*["'`]([^"'`]+)["'`]/g)) {
          addImport(match[2], match[1] ? 'type' : 'value');
        }
        for (const match of content.matchAll(/(?:^|[^\w])import\(\s*["'`]([^"'`$]+)["'`]\s*\)/gm)) {
          addImport(match[1]);
        }
        for (const match of content.matchAll(/(?:^|[^\w])import\(\s*`([^`$]*(?:\$\{[^}]+\}[^`$]*)+)`\s*\)/gm)) {
          const resolved = match[1].replace(/\$\{\s*([A-Za-z_$][\w$]*)\s*\}/g, (_, name: string) => {
            return constStrings.get(name) ?? `__UNRESOLVED__${name}__`;
          });

          if (!resolved.includes('__UNRESOLVED__')) {
            addImport(resolved, 'value', 'dynamic');
          }
        }
        for (const match of content.matchAll(/(?:^|[^\w])require\(\s*["'`]([^"'`$]+)["'`]\s*\)/gm)) {
          addImport(match[1]);
        }
        return imports;
      }

      case '.py': {
        for (const match of content.matchAll(/^\s*import\s+([^\n#]+)/gm)) {
          const modules = match[1].split(',').map(part => part.trim()).filter(Boolean);
          for (const mod of modules) {
            addImport(mod.split(/\s+as\s+/i)[0]);
          }
        }
        for (const match of content.matchAll(/^\s*from\s+([^\s]+)\s+import\s+([^\n#]+)/gm)) {
          const moduleName = match[1].trim();
          const names = match[2].split(',').map(part => part.trim()).filter(Boolean);
          for (const name of names) {
            const bareName = name.split(/\s+as\s+/i)[0].trim();
            if (!bareName || bareName === '*') {
              addImport(moduleName);
            } else {
              addImport(`${moduleName}.${bareName}`);
            }
          }
        }
        return imports;
      }

      case '.go': {
        for (const match of content.matchAll(/^\s*import\s+(?:[\w.]+\s+)?["'`]([^"'`]+)["'`]/gm)) {
          addImport(match[1]);
        }
        for (const block of content.matchAll(/^\s*import\s*\(([\s\S]*?)\)/gm)) {
          for (const match of block[1].matchAll(/["'`]([^"'`]+)["'`]/g)) {
            addImport(match[1]);
          }
        }
        return imports;
      }

      case '.rs': {
        for (const match of content.matchAll(/^\s*use\s+([^;]+);/gm)) {
          addImport(match[1]);
        }
        return imports;
      }

      case '.java':
      case '.kt':
      case '.scala': {
        for (const match of content.matchAll(/^\s*import\s+([^;\n]+);?/gm)) {
          addImport(match[1]);
        }
        return imports;
      }

      case '.rb': {
        for (const match of content.matchAll(/\brequire_relative\s+["'`]([^"'`]+)["'`]/g)) {
          addImport(match[1]);
        }
        for (const match of content.matchAll(/\brequire\s+(?:\(\s*)?["'`]([^"'`]+)["'`](?:\s*\))?/g)) {
          addImport(match[1]);
        }
        return imports;
      }

      case '.php': {
        for (const match of content.matchAll(/^\s*use\s+([^;]+);/gm)) {
          addImport(match[1].split(/\s+as\s+/i)[0]);
        }
        return imports;
      }

      case '.c':
      case '.cpp':
      case '.m': {
        for (const match of content.matchAll(/^\s*#(?:include|import)\s*[<"]([^>"]+)[>"]/gm)) {
          addImport(match[1]);
        }
        return imports;
      }

      case '.cs': {
        for (const match of content.matchAll(/^\s*using\s+([^;]+);/gm)) {
          addImport(match[1]);
        }
        return imports;
      }

      case '.swift': {
        for (const match of content.matchAll(/^\s*import\s+([A-Za-z_][\w.]*)/gm)) {
          addImport(match[1]);
        }
        return imports;
      }

      case '.lua': {
        for (const match of content.matchAll(/\brequire\s*\(\s*["'`]([^"'`]+)["'`]\s*\)/g)) {
          addImport(match[1]);
        }
        for (const match of content.matchAll(/\brequire\s+["'`]([^"'`]+)["'`]/g)) {
          addImport(match[1]);
        }
        return imports;
      }

      case '.dart': {
        for (const match of content.matchAll(/\bimport\s+["'`]([^"'`]+)["'`]/g)) {
          addImport(match[1]);
        }
        return imports;
      }

      case '.ex': {
        for (const match of content.matchAll(/^\s*(?:alias|import|use)\s+([A-Za-z_][\w.]*)/gm)) {
          addImport(match[1]);
        }
        return imports;
      }

      case '.zig': {
        for (const match of content.matchAll(/@import\(\s*["'`]([^"'`]+)["'`]\s*\)/g)) {
          addImport(match[1]);
        }
        return imports;
      }

      case '.sh': {
        for (const match of content.matchAll(/^\s*(?:source|\.)\s+([^\s#;]+)/gm)) {
          addImport(match[1]);
        }
        return imports;
      }

      case '.ps1': {
        for (const match of content.matchAll(/^\s*\.\s+([^\s#;]+)/gm)) {
          addImport(match[1]);
        }
        for (const match of content.matchAll(/^\s*Import-Module\s+([^\s#;]+)/gim)) {
          addImport(match[1]);
        }
        return imports;
      }

      case '.jl': {
        for (const match of content.matchAll(/\binclude\(\s*["'`]([^"'`]+)["'`]\s*\)/g)) {
          addImport(match[1]);
        }
        for (const match of content.matchAll(/^\s*(?:using|import)\s+([^\n]+)/gm)) {
          addImport(match[1]);
        }
        return imports;
      }

      case '.v':
      case '.sv': {
        for (const match of content.matchAll(/^\s*`include\s+["'`]([^"'`]+)["'`]/gm)) {
          addImport(match[1]);
        }
        return imports;
      }

      default:
        return null;
    }
  }

  /**
   * Normalize a raw import string based on the language's conventions.
   */
  private normalizeImport(ext: string, raw: string): string {
    // Strip surrounding quotes for all languages
    let source = raw.replace(/^['"`]|['"`]$/g, '');

    switch (ext) {
      case '.py': {
        // Python: convert dots to slashes for path resolution
        // Handle relative imports: '.' -> '.', '.foo' -> './foo', '..foo' -> '../foo'
        if (source.startsWith('.')) {
          // Count leading dots
          const dotMatch = source.match(/^(\.+)(.*)/);
          if (dotMatch) {
            const dots = dotMatch[1];
            const rest = dotMatch[2].replace(/\./g, '/');
            if (dots.length === 1) {
              source = rest ? './' + rest : '.';
            } else {
              source = '../'.repeat(dots.length - 1) + rest;
            }
          }
        } else {
          source = source.replace(/\./g, '/');
        }
        break;
      }
      case '.go':
        // Go: strip surrounding quotes (already done above)
        break;
      case '.rs':
        // Rust: strip ' as alias' and '{ ... }' lists
        source = source.split(/\s+as\s+/)[0].trim();
        source = source.replace(/\{[\s\S]*\}/g, '').trim();
        source = source.replace(/::$/, '');
        break;
      case '.java':
      case '.kt':
      case '.scala':
        // JVM: keep dotted notation, indexer handles resolution
        break;
      case '.cs':
        // C#: keep dotted namespace
        break;
      case '.c':
      case '.cpp':
        // C/C++: strip < > for system includes
        source = source.replace(/^<|>$/g, '');
        break;
      case '.php':
        // PHP: backslashes to forward slashes for path-like resolution
        source = source.replace(/\\/g, '/');
        break;
      case '.swift':
        source = source.replace(/_/g, '/');
        break;
      case '.lua':
        source = source.replace(/\./g, '/');
        break;
      case '.ex':
        source = source.replace(/\./g, '/').toLowerCase();
        break;
      default:
        break;
    }

    return source;
  }

  private mapNodeType(captureName: string): SymbolInfo['type'] {
    if (captureName.includes('func')) return 'function';
    if (captureName.includes('class')) return 'class';
    if (captureName.includes('interface')) return 'interface';
    if (captureName.includes('method')) return 'method';
    if (captureName.includes('struct')) return 'struct';
    if (captureName.includes('module')) return 'module';
    if (captureName.includes('type')) return 'class';
    return 'variable';
  }
}
