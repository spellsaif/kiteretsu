import Parser from 'tree-sitter';
import fs from 'fs-extra';
import path from 'path';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const LOG_PATH = path.resolve(process.cwd(), '.kiteretsu', 'debug.log');

export interface SymbolInfo {
  name: string;
  type: 'function' | 'class' | 'interface' | 'method' | 'variable' | 'struct' | 'module';
  startLine: number;
  endLine: number;
}

export class CodeParser {
  private parsers: Map<string, Parser> = new Map();
  private languages: Map<string, any> = new Map();

  constructor() {
  }

  private async initParsers(ext: string) {
    if (this.parsers.has(ext)) return;

    if (['.ts', '.tsx', '.js', '.jsx'].includes(ext)) {
      try {
        const mod = require('tree-sitter-typescript');
        const tsParser = new Parser();
        const langObj = mod.typescript || mod;
        // @ts-ignore
        tsParser.setLanguage(langObj);
        this.parsers.set('.ts', tsParser);
        this.parsers.set('.tsx', tsParser);
        this.parsers.set('.js', tsParser);
        this.parsers.set('.jsx', tsParser);
        this.languages.set('typescript', langObj);
      } catch (e: any) {
        fs.appendFileSync(LOG_PATH, `[Parser] TS LOAD ERROR: ${e.message}\n`);
      }
      return;
    }

    const langMap: Record<string, { module: string, name: string }> = {
      '.py': { module: 'tree-sitter-python', name: 'python' },
      '.rs': { module: 'tree-sitter-rust', name: 'rust' },
      '.go': { module: 'tree-sitter-go', name: 'go' },
      '.java': { module: 'tree-sitter-java', name: 'java' },
      '.c': { module: 'tree-sitter-c', name: 'c' },
      '.cpp': { module: 'tree-sitter-cpp', name: 'cpp' },
      '.rb': { module: 'tree-sitter-ruby', name: 'ruby' },
      '.cs': { module: 'tree-sitter-c-sharp', name: 'c-sharp' },
      '.php': { module: 'tree-sitter-php', name: 'php' },
      '.swift': { module: 'tree-sitter-swift', name: 'swift' },
      '.lua': { module: 'tree-sitter-lua', name: 'lua' },
      '.vue': { module: 'tree-sitter-vue', name: 'vue' },
      '.svelte': { module: 'tree-sitter-svelte', name: 'svelte' },
      '.dart': { module: 'tree-sitter-dart', name: 'dart' },
      '.kt': { module: 'tree-sitter-kotlin', name: 'kotlin' },
      '.scala': { module: 'tree-sitter-scala', name: 'scala' },
      '.zig': { module: 'tree-sitter-zig', name: 'zig' },
      '.ex': { module: 'tree-sitter-elixir', name: 'elixir' },
      '.m': { module: 'tree-sitter-objc', name: 'objc' },
      '.jl': { module: 'tree-sitter-julia', name: 'julia' },
      '.v': { module: 'tree-sitter-verilog', name: 'verilog' },
      '.sh': { module: 'tree-sitter-bash', name: 'bash' },
      '.html': { module: 'tree-sitter-html', name: 'html' }
    };

    const lang = langMap[ext];
    if (lang) {
      try {
        const mod = require(lang.module);
        const actualMod = mod.default || mod;
        
        const p = new Parser();
        let success = false;

        const snakeName = lang.name.replace(/-/g, '_');
        const candidates = [
          actualMod[snakeName],
          actualMod[lang.name],
          actualMod.language,
          actualMod,
          mod
        ];

        for (const candidate of candidates) {
          if (!candidate) continue;
          try {
            fs.appendFileSync(LOG_PATH, `[Parser] Trying candidate for ${lang.name}: type=${typeof candidate}, proto=${Object.getPrototypeOf(candidate)?.constructor?.name}\n`);
            // @ts-ignore
            p.setLanguage(candidate);
            this.parsers.set(ext, p);
            this.languages.set(lang.name, candidate);
            success = true;
            fs.appendFileSync(LOG_PATH, `[Parser] ${lang.name} loaded successfully.\n`);
            break;
          } catch (e: any) {
             fs.appendFileSync(LOG_PATH, `[Parser] Candidate FAILED for ${lang.name}: ${e.message}\n`);
          }
        }

        if (!success) {
          fs.appendFileSync(LOG_PATH, `[Parser] FAILED to find valid langObj for ${lang.name}\n`);
        }
      } catch (e: any) { 
        fs.appendFileSync(LOG_PATH, `[Parser] INIT ERROR for ${lang.module}: ${e.message}\n`);
      }
    }
  }

  async parseSymbols(filePath: string): Promise<SymbolInfo[]> {
    const ext = path.extname(filePath);
    await this.initParsers(ext);
    const parser = this.parsers.get(ext);
    if (!parser) return [];

    const content = await fs.readFile(filePath, 'utf8');
    const tree = parser.parse(content);
    const symbols: SymbolInfo[] = [];

    let queryString = '';
    let language: any;

    if (['.ts', '.tsx', '.js', '.jsx'].includes(ext)) {
      language = this.languages.get('typescript');
      queryString = `
        (function_declaration name: (identifier) @func.name)
        (class_declaration name: (type_identifier) @class.name)
        (interface_declaration name: (type_identifier) @interface.name)
        (method_definition name: (property_identifier) @method.name)
        (variable_declarator name: (identifier) @var.name)
      `;
    } else if (ext === '.py') {
      language = this.languages.get('python');
      queryString = `
        (function_definition name: (identifier) @func.name)
        (class_definition name: (identifier) @class.name)
      `;
    } else if (ext === '.rs') {
      language = this.languages.get('rust');
      queryString = `
        (function_item name: (identifier) @func.name)
        (struct_item name: (type_identifier) @struct.name)
      `;
    } else if (ext === '.go') {
      language = this.languages.get('go');
      queryString = `
        (function_declaration name: (identifier) @func.name)
        (type_declaration (type_spec name: (type_identifier) @type.name))
      `;
    } else if (ext === '.java') {
      language = this.languages.get('java');
      queryString = `
        (method_declaration name: (identifier) @method.name)
        (class_declaration name: (identifier) @class.name)
      `;
    } else if (ext === '.rb') {
      language = this.languages.get('ruby');
      queryString = `
        (method name: (identifier) @method.name)
        (class name: (constant) @class.name)
      `;
    } else if (ext === '.php') {
      const phpMod = this.languages.get('php');
      language = phpMod?.php || phpMod;
      queryString = `
        (function_definition name: (name) @func.name)
        (class_declaration name: (name) @class.name)
      `;
    }

    if (!queryString || !language) return [];

    try {
      const query = new Parser.Query(language, queryString);
      const captures = query.captures(tree.rootNode);

      for (const capture of captures) {
        symbols.push({
          name: capture.node.text,
          type: this.mapNodeType(capture.name),
          startLine: capture.node.startPosition.row + 1,
          endLine: capture.node.endPosition.row + 1,
        });
      }
    } catch (error) { }

    return symbols;
  }

  async parseImports(filePath: string): Promise<string[]> {
    const ext = path.extname(filePath);
    await this.initParsers(ext);
    const parser = this.parsers.get(ext);
    if (!parser) return [];

    const content = await fs.readFile(filePath, 'utf8');
    const tree = parser.parse(content);
    const imports: string[] = [];

    let queryString = '';
    let language: any;

    if (['.ts', '.tsx', '.js', '.jsx'].includes(ext)) {
      language = this.languages.get('typescript');
      queryString = `
        (import_statement source: (string) @source)
        (export_statement source: (string) @source)
      `;
    } else if (ext === '.py') {
      language = this.languages.get('python');
      queryString = `
        (import_statement name: (dotted_name) @source)
        (import_from_statement module: (dotted_name) @source)
      `;
    } else if (ext === '.go') {
      language = this.languages.get('go');
      queryString = `
        (import_spec path: (string_literal) @source)
      `;
    } else if (ext === '.rs') {
      // Rust use declarations are complex (scoped_use_list, wildcards, etc.)
      // Handled entirely by regex fallback below for reliability
      language = null;
      queryString = '';
    }

    if (queryString && language) {
      try {
        const query = new Parser.Query(language, queryString);
        const captures = query.captures(tree.rootNode);

        for (const capture of captures) {
          let source = capture.node.text.replace(/['"]/g, '');
          
          if (ext === '.py') {
            source = source.replace(/\./g, '/');
          }
          
          if (source && !imports.includes(source)) {
            imports.push(source);
          }
        }
      } catch (e: any) {
        // Tree-sitter failed
      }
    }

    // --- Regex Fallback for robustness ---
    // For Rust: always use regex (tree-sitter skipped above)
    // For Python/Go: fallback when tree-sitter fails
    if (imports.length === 0 || ext === '.rs') {
      try {
        const fallbackContent = await fs.readFile(filePath, 'utf8');
        if (ext === '.py') {
          const matches = fallbackContent.matchAll(/(?:from|import)\s+([\w\.]+)/g);
          for (const match of matches) {
            const source = match[1].replace(/\./g, '/');
            if (source && source !== 'import' && source !== 'from') {
              if (!imports.includes(source)) imports.push(source);
            }
          }
        } else if (ext === '.go') {
          // Single imports: import "fmt"
          const singleMatches = fallbackContent.matchAll(/import\s+"([^"]+)"/g);
          for (const match of singleMatches) {
            if (!imports.includes(match[1])) imports.push(match[1]);
          }
          // Multi-line import blocks: import ( "fmt" \n "os" )
          const blockMatches = fallbackContent.matchAll(/import\s*\(([\s\S]*?)\)/g);
          for (const match of blockMatches) {
            const lineMatches = match[1].matchAll(/"([^"]+)"/g);
            for (const lineMatch of lineMatches) {
              if (!imports.includes(lineMatch[1])) imports.push(lineMatch[1]);
            }
          }
        } else if (ext === '.rs') {
          // Capture full local use paths: crate::X::Y, self::X, super::X
          const localMatches = fallbackContent.matchAll(/use\s+((?:crate|self|super)(?:::\w+)+)/g);
          for (const match of localMatches) {
            if (!imports.includes(match[1])) imports.push(match[1]);
          }
        }
      } catch (e) {}
    }

    return imports;
  }

  private mapNodeType(captureName: string): SymbolInfo['type'] {
    if (captureName.includes('func')) return 'function';
    if (captureName.includes('class')) return 'class';
    if (captureName.includes('interface')) return 'interface';
    if (captureName.includes('method')) return 'method';
    if (captureName.includes('struct')) return 'struct';
    if (captureName.includes('type')) return 'class';
    return 'variable';
  }
}
