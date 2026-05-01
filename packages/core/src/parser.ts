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
      (interface_declaration name: (type_identifier) @interface.name)
      (method_definition name: (property_identifier) @method.name)
      (variable_declarator name: (identifier) @var.name)
    `,
    importQuery: `
      (import_statement source: (string) @source)
      (export_statement source: (string) @source)
    `,
  },
  '.tsx': {
    wasmFile: 'tree-sitter-tsx.wasm',
    symbolQuery: `
      (function_declaration name: (identifier) @func.name)
      (class_declaration name: (type_identifier) @class.name)
      (interface_declaration name: (type_identifier) @interface.name)
      (method_definition name: (property_identifier) @method.name)
      (variable_declarator name: (identifier) @var.name)
    `,
    importQuery: `
      (import_statement source: (string) @source)
      (export_statement source: (string) @source)
    `,
  },
  '.js': {
    wasmFile: 'tree-sitter-javascript.wasm',
    symbolQuery: `
      (function_declaration name: (identifier) @func.name)
      (class_declaration name: (identifier) @class.name)
      (method_definition name: (property_identifier) @method.name)
      (variable_declarator name: (identifier) @var.name)
    `,
    importQuery: `
      (import_statement source: (string) @source)
      (export_statement source: (string) @source)
    `,
  },
  '.jsx': {
    wasmFile: 'tree-sitter-javascript.wasm',
    symbolQuery: `
      (function_declaration name: (identifier) @func.name)
      (class_declaration name: (identifier) @class.name)
      (method_definition name: (property_identifier) @method.name)
      (variable_declarator name: (identifier) @var.name)
    `,
    importQuery: `
      (import_statement source: (string) @source)
      (export_statement source: (string) @source)
    `,
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
  private parser: Parser | null = null;

  constructor() {}

  /**
   * Initialize the WASM runtime. Called once, cached globally.
   */
  private async ensureInit(): Promise<void> {
    if (this.parser) return;

    if (!CodeParser.initPromise) {
      CodeParser.initPromise = Parser.init();
    }
    await CodeParser.initPromise;
    this.parser = new Parser();
  }

  /**
   * Load a language grammar from its WASM file.
   * Uses tree-sitter-wasms package for pre-built WASM binaries.
   */
  private async loadLanguage(ext: string): Promise<Language | null> {
    if (this.languages.has(ext)) return this.languages.get(ext)!;

    const config = LANGUAGE_CONFIG[ext];
    if (!config) return null;

    try {
      // Resolve the WASM file path from the tree-sitter-wasms package
      const wasmsDir = path.dirname(require.resolve('tree-sitter-wasms/package.json'));
      const wasmPath = path.join(wasmsDir, 'out', config.wasmFile);

      if (!fs.existsSync(wasmPath)) {
        debugLog(`[Parser] WASM file not found: ${wasmPath}`);
        return null;
      }

      const language = await Language.load(wasmPath);
      this.languages.set(ext, language);
      debugLog(`[Parser] ${config.wasmFile} loaded successfully via WASM.`);
      return language;
    } catch (e: any) {
      debugLog(`[Parser] Failed to load WASM for ${ext}: ${e.message}`);
      return null;
    }
  }

  async parseSymbols(filePath: string): Promise<SymbolInfo[]> {
    const ext = path.extname(filePath);
    const config = LANGUAGE_CONFIG[ext];
    if (!config || !config.symbolQuery) return [];

    await this.ensureInit();
    const language = await this.loadLanguage(ext);
    if (!language || !this.parser) return [];

    const content = await fs.readFile(filePath, 'utf8');
    this.parser.setLanguage(language);
    const tree = this.parser.parse(content);
    if (!tree) return [];
    
    const symbols: SymbolInfo[] = [];

    try {
      const query = new Query(language, config.symbolQuery);
      const captures = query.captures(tree.rootNode);

      for (const capture of captures) {
        // Skip predicate-internal captures (e.g. @_kw, @_fn, @_cmd, @_method)
        if (capture.name.startsWith('_')) continue;

        symbols.push({
          name: capture.node.text,
          type: this.mapNodeType(capture.name),
          startLine: capture.node.startPosition.row + 1,
          endLine: capture.node.endPosition.row + 1,
        });
      }
      query.delete();
    } catch (e: any) {
      debugLog(`[Parser] Symbol query failed for ${filePath}: ${e.message}`);
    }

    if (tree) tree.delete();
    return symbols;
  }

  async parseImports(filePath: string): Promise<string[]> {
    const ext = path.extname(filePath);
    const config = LANGUAGE_CONFIG[ext];
    if (!config || !config.importQuery) return [];

    await this.ensureInit();
    const language = await this.loadLanguage(ext);
    if (!language || !this.parser) return [];

    const content = await fs.readFile(filePath, 'utf8');
    this.parser.setLanguage(language);
    const tree = this.parser.parse(content);
    if (!tree) return [];

    const imports: string[] = [];

    try {
      const query = new Query(language, config.importQuery);
      const captures = query.captures(tree.rootNode);

      for (const capture of captures) {
        // Skip predicate-internal captures (e.g. @_fn, @_kw, @_cmd, @_method)
        if (capture.name.startsWith('_')) continue;

        let source = capture.node.text;

        // ── Post-processing per language ──────────────────────────────────
        source = this.normalizeImport(ext, source);

        if (source && !imports.includes(source)) {
          imports.push(source);
        }
      }
      query.delete();
    } catch (e: any) {
      debugLog(`[Parser] Import query failed for ${filePath}: ${e.message}`);
    }

    if (tree) tree.delete();
    return imports;
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
        // Rust: keep the :: notation as-is, indexer handles resolution
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
