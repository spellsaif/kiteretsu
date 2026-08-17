import { SymbolInfo, ImportInfo } from '../parser.js';

export function generateTechnicalGist(_filename: string, symbols: SymbolInfo[], imports: ImportInfo[]): string {
  const lines: string[] = [];

  // 1. Identify primary purpose
  const mainClasses = symbols.filter(s => s.type === 'class' || s.type === 'interface' || s.type === 'struct');
  const mainFunctions = symbols.filter(s => s.type === 'function' || s.type === 'method').slice(0, 5);

  if (mainClasses.length > 0) {
    lines.push(`Core structures: ${mainClasses.map(c => c.name).join(', ')}.`);
  }

  if (mainFunctions.length > 0) {
    const fnNames = mainFunctions.map(f => {
      const doc = f.docstring ? ` (${f.docstring.split('\n')[0].slice(0, 50)})` : '';
      return `${f.name}${doc}`;
    });
    lines.push(`Key logic: ${fnNames.join(', ')}.`);
  }

  // 2. Identify external dependencies
  const externalDeps = imports
    .filter(i => !i.source.startsWith('.'))
    .map(i => i.source.split('/').pop())
    .slice(0, 5);

  if (externalDeps.length > 0) {
    lines.push(`Integrates with: ${externalDeps.join(', ')}.`);
  }

  const summary = lines.join(' ');
  return summary.length > 500 ? summary.slice(0, 497) + '...' : summary;
}
