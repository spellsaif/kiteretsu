export type ImportKind =
  | 'relative'
  | 'absolute'
  | 'package'
  | 'namespace'
  | 'crate'
  | 'module'
  | 'include'
  | 'generic';

export interface SourceLocation {
  startLine: number;
  endLine: number;
}

export interface ImportReference {
  source: string;
  raw: string;
  kind: ImportKind;
  isTypeOnly: boolean;
  isDynamic: boolean;
  language: string;
  location?: SourceLocation;
  metadata?: Record<string, unknown>;
}

export function classifyImportKind(raw: string, language: string): ImportKind {
  const trimmed = raw.trim().replace(/^['"`<]|['"`>]$/g, '');

  if (trimmed.startsWith('./') || trimmed.startsWith('../') || trimmed.startsWith('.\\') || trimmed.startsWith('..\\')) {
    return 'relative';
  }
  if (language === 'python' && trimmed.startsWith('.')) {
    return 'relative';
  }
  if (trimmed.startsWith('/') || /^[a-zA-Z]:[\\/]/.test(trimmed)) {
    return 'absolute';
  }
  if (trimmed.startsWith('crate::') || trimmed.startsWith('super::') || trimmed.startsWith('self::')) {
    return 'crate';
  }
  if (language === 'c' || language === 'cpp' || language === 'objective-c') {
    return 'include';
  }
  if (trimmed.startsWith('@') || trimmed.includes('/')) {
    return 'package';
  }
  if (trimmed.includes('::') || trimmed.includes('\\')) {
    return 'namespace';
  }
  return 'module';
}

export function createImportReference(
  rawSource: string,
  language: string,
  options?: {
    isTypeOnly?: boolean;
    isDynamic?: boolean;
    location?: SourceLocation;
    metadata?: Record<string, unknown>;
  }
): ImportReference {
  const cleanSource = rawSource.trim().replace(/^['"`<]|['"`>]$/g, '');
  const kind = classifyImportKind(cleanSource, language);

  return {
    source: cleanSource,
    raw: rawSource,
    kind,
    isTypeOnly: options?.isTypeOnly ?? false,
    isDynamic: options?.isDynamic ?? false,
    language,
    location: options?.location,
    metadata: options?.metadata
  };
}
