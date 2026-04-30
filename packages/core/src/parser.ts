import Parser from 'tree-sitter';
import fs from 'fs-extra';
import path from 'path';

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
        const { default: TypeScript } = await import('tree-sitter-typescript');
        const tsParser = new Parser();
        // @ts-ignore
        tsParser.setLanguage(TypeScript.typescript || TypeScript);
        this.parsers.set('.ts', tsParser);
        this.parsers.set('.tsx', tsParser);
        this.parsers.set('.js', tsParser);
        this.parsers.set('.jsx', tsParser);
        this.languages.set('typescript', TypeScript);
      } catch (e) { }
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
        const { default: mod } = await import(lang.module);
        const p = new Parser();
        // @ts-ignore
        p.setLanguage(mod.php || mod);
        this.parsers.set(ext, p);
        this.languages.set(lang.name, mod);
      } catch (e) { }
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
      const TypeScript = this.languages.get('typescript');
      // @ts-ignore
      language = TypeScript.typescript;
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
        (impl_item type: (type_identifier) @impl.name)
      `;
    } else if (ext === '.go') {
      language = this.languages.get('go');
      queryString = `
        (function_declaration name: (identifier) @func.name)
        (type_declaration (type_spec name: (type_identifier) @type.name))
        (method_declaration name: (field_identifier) @method.name)
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

    if (!queryString) return [];

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
    } catch (error) {
      // Query syntax might be unsupported for this language version, safely ignore symbol extraction
    }

    return symbols;
  }

  async parseImports(filePath: string): Promise<string[]> {
    await this.initParsers(path.extname(filePath));
    const ext = path.extname(filePath);
    const parser = this.parsers.get(ext);
    if (!parser || !['.ts', '.tsx', '.js', '.jsx'].includes(ext)) return [];

    const content = await fs.readFile(filePath, 'utf8');
    const tree = parser.parse(content);
    const imports: string[] = [];

    // Capture sources from import and export statements
    const { default: TypeScript } = await import('tree-sitter-typescript');
    const queryString = `
      (import_statement) @import
      (export_statement) @export
    `;
    
    try {
      const query = new Parser.Query(TypeScript.typescript || TypeScript, queryString);
      const captures = query.captures(tree.rootNode);

      for (const capture of captures) {
        // Find the string child node which contains the source path
        for (let i = 0; i < capture.node.childCount; i++) {
          const child = capture.node.child(i);
          if (!child) continue;
          if (child.type === 'string') {
            const source = child.text.replace(/['"]/g, '');
            if (source && !imports.includes(source)) {
              imports.push(source);
            }
          }
        }
      }
    } catch (e) { }

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
