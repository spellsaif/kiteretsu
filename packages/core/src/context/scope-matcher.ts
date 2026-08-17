import path from 'path';
import { RuleRecord } from '../memory/rules.js';

/**
 * Matches a rule against a list of candidate file paths based on scope (global, path, language).
 */
export function matchesRuleScope(rule: RuleRecord, candidatePaths: string[]): boolean {
  const scopeType = rule.scope_type || 'global';
  const scopeValue = (rule.scope_value || '').trim();

  if (scopeType === 'global' || !scopeValue) {
    return true;
  }

  if (scopeType === 'path') {
    return candidatePaths.some(candPath => {
      const normalizedPath = candPath.replace(/\\/g, '/');
      const normalizedPattern = scopeValue.replace(/\\/g, '/');

      if (normalizedPattern === '*' || normalizedPattern === '**' || normalizedPattern === '**/*') {
        return true;
      }
      if (normalizedPath === normalizedPattern || normalizedPath.startsWith(normalizedPattern.endsWith('/') ? normalizedPattern : `${normalizedPattern}/`)) {
        return true;
      }
      const escaped = normalizedPattern
        .replace(/[.+^${}()|[\]\\]/g, '\\$&')
        .replace(/\*\*/g, '.*')
        .replace(/\*(?!\*)/g, '[^/]*')
        .replace(/\?/g, '.');
      try {
        const re = new RegExp(`^${escaped}$`);
        return re.test(normalizedPath);
      } catch {
        return normalizedPath.includes(normalizedPattern);
      }
    });
  }

  if (scopeType === 'language') {
    const target = scopeValue.toLowerCase().replace(/^\./, '');
    const langAliases: Record<string, string[]> = {
      typescript: ['ts', 'tsx'],
      javascript: ['js', 'jsx', 'mjs', 'cjs'],
      python: ['py'],
      rust: ['rs'],
      go: ['go'],
      ruby: ['rb'],
      java: ['java'],
      kotlin: ['kt', 'kts'],
      scala: ['scala', 'sc'],
      php: ['php'],
      csharp: ['cs'],
      'c#': ['cs'],
      c: ['c', 'h'],
      cpp: ['cpp', 'cc', 'cxx', 'hpp', 'h'],
      'c++': ['cpp', 'cc', 'cxx', 'hpp', 'h'],
      swift: ['swift'],
      lua: ['lua'],
      dart: ['dart'],
      elixir: ['ex', 'exs'],
      zig: ['zig'],
      shell: ['sh', 'bash'],
      bash: ['sh', 'bash'],
    };
    const validExts = langAliases[target] || [target];
    return candidatePaths.some(candPath => {
      const ext = path.extname(candPath).toLowerCase().replace(/^\./, '');
      return validExts.includes(ext);
    });
  }

  return true;
}
