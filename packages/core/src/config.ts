import path from 'path';
import fs from 'fs-extra';
import { pathToFileURL } from 'url';

export interface KiteretsuIndexingConfig {
  maxFileSize?: string | number;
  deepParseLimit?: string | number;
  include?: string[];
  exclude?: string[];
}

export interface KiteretsuSearchConfig {
  precision?: 'low' | 'medium' | 'high';
  provider?: 'transformers' | 'remote';
}

export interface KiteretsuAgentsConfig {
  autoConfigure?: boolean;
  active?: string[];
}

export interface KiteretsuMemoryConfig {
  enabled?: boolean;
  autoRecordTasks?: boolean;
}

export interface KiteretsuConfig {
  rootDir?: string;
  dbPath?: string;
  name?: string;
  version?: string;
  indexing?: KiteretsuIndexingConfig;
  search?: KiteretsuSearchConfig;
  ignore?: string[];
  languages?: Record<string, unknown>;
  memory?: KiteretsuMemoryConfig;
  agents?: KiteretsuAgentsConfig;
}

export function defineConfig(config: KiteretsuConfig): KiteretsuConfig {
  return config;
}

export const DEFAULT_CONFIG_TEMPLATE = `import { defineConfig } from "kiteretsu";

export default defineConfig({
  indexing: {
    maxFileSize: "1MB",
    deepParseLimit: "500KB",
  },
  search: {
    precision: "high",
    provider: "transformers",
  },
  ignore: [
    "**/node_modules/**",
    "**/.git/**",
    "**/dist/**",
    "**/build/**",
    "**/out/**",
    "**/.next/**",
    "**/_next/**",
    "**/.nuxt/**",
    "**/.svelte-kit/**",
    "**/.turbo/**",
    "**/coverage/**",
    "**/.kiteretsu/**",
  ],
});
`;

/**
 * Loads project configuration from canonical kiteretsu.config.ts (or .js/.mjs).
 */
export async function loadProjectConfig(rootDir: string): Promise<KiteretsuConfig> {
  const tsPath = path.join(rootDir, 'kiteretsu.config.ts');
  const mjsPath = path.join(rootDir, 'kiteretsu.config.mjs');
  const jsPath = path.join(rootDir, 'kiteretsu.config.js');

  // 1. Try TypeScript config
  if (await fs.pathExists(tsPath)) {
    try {
      const fileUrl = `${pathToFileURL(tsPath).href}?t=${Date.now()}`;
      const mod = await import(fileUrl);
      const conf = mod.default || mod.config || mod;
      if (conf && typeof conf === 'object') return conf;
    } catch {
      // If direct TS import is not supported natively by the Node runtime,
      // transpile in-memory or write to .kiteretsu/cache/config.mjs
      try {
        const rawTs = await fs.readFile(tsPath, 'utf8');
        const transpiledJs = transpileTsConfig(rawTs);
        const cacheDir = path.join(rootDir, '.kiteretsu', 'cache');
        await fs.ensureDir(cacheDir);
        const tempMjs = path.join(cacheDir, `config.${Date.now()}.mjs`);
        await fs.writeFile(tempMjs, transpiledJs, 'utf8');
        try {
          const mod = await import(`${pathToFileURL(tempMjs).href}`);
          const conf = mod.default || mod.config || mod;
          if (conf && typeof conf === 'object') return conf;
        } finally {
          await fs.remove(tempMjs).catch(() => {});
        }
      } catch {
        const parsed = parseConfigText(await fs.readFile(tsPath, 'utf8'));
        if (parsed) return parsed;
      }
    }
  }

  // 2. Try ESM / JS config
  for (const p of [mjsPath, jsPath]) {
    if (await fs.pathExists(p)) {
      try {
        const fileUrl = `${pathToFileURL(p).href}?t=${Date.now()}`;
        const mod = await import(fileUrl);
        const conf = mod.default || mod.config || mod;
        if (conf && typeof conf === 'object') return conf;
      } catch {
        const parsed = parseConfigText(await fs.readFile(p, 'utf8'));
        if (parsed) return parsed;
      }
    }
  }

  return {};
}

/**
 * Synchronously loads project configuration from canonical kiteretsu.config.ts.
 */
export function loadProjectConfigSync(rootDir: string): KiteretsuConfig {
  const tsPath = path.join(rootDir, 'kiteretsu.config.ts');
  const mjsPath = path.join(rootDir, 'kiteretsu.config.mjs');
  const jsPath = path.join(rootDir, 'kiteretsu.config.js');

  for (const p of [tsPath, mjsPath, jsPath]) {
    if (fs.existsSync(p)) {
      try {
        const content = fs.readFileSync(p, 'utf8');
        const parsed = parseConfigText(content);
        if (parsed) return parsed;
      } catch { }
    }
  }
  return {};
}

/**
 * Lightweight TypeScript to ESM transpiler for configuration files.
 */
function transpileTsConfig(tsCode: string): string {
  // Strip import statements referencing "kiteretsu" or external modules for defineConfig
  let js = tsCode.replace(/import\s*\{[^}]*\}\s*from\s*['"][^'"]+['"]\s*;?/g, '');
  // Provide an inline defineConfig mock so default export evaluates cleanly
  js = `const defineConfig = (c) => c;\n` + js;
  return js;
}

/**
 * Fallback parser for static extraction of config properties from source text.
 */
function parseConfigText(content: string): KiteretsuConfig | null {
  try {
    const config: KiteretsuConfig = {};

    // Extract ignore array: ignore: [ ... ]
    const ignoreMatch = content.match(/ignore\s*:\s*\[([\s\S]*?)\]/);
    if (ignoreMatch) {
      config.ignore = ignoreMatch[1]
        .split(',')
        .map(s => s.trim().replace(/^['"`]|['"`]$/g, ''))
        .filter(Boolean);
    }

    // Extract maxFileSize & deepParseLimit
    const maxFileMatch = content.match(/maxFileSize\s*:\s*['"`](.*?)['"`]/);
    const deepParseMatch = content.match(/deepParseLimit\s*:\s*['"`](.*?)['"`]/);
    if (maxFileMatch || deepParseMatch) {
      config.indexing = {
        maxFileSize: maxFileMatch ? maxFileMatch[1] : undefined,
        deepParseLimit: deepParseMatch ? deepParseMatch[1] : undefined,
      };
    }

    // Extract search precision / provider
    const precisionMatch = content.match(/precision\s*:\s*['"`](.*?)['"`]/);
    const providerMatch = content.match(/provider\s*:\s*['"`](.*?)['"`]/);
    if (precisionMatch || providerMatch) {
      config.search = {
        precision: precisionMatch ? (precisionMatch[1] as any) : undefined,
        provider: providerMatch ? (providerMatch[1] as any) : undefined,
      };
    }

    return config;
  } catch {
    return null;
  }
}

/**
 * Creates canonical kiteretsu.config.ts if no configuration file exists.
 */
export async function createDefaultConfigFile(rootDir: string): Promise<string> {
  const configPath = path.join(rootDir, 'kiteretsu.config.ts');
  if (!(await fs.pathExists(configPath))) {
    await fs.writeFile(configPath, DEFAULT_CONFIG_TEMPLATE, 'utf8');
  }
  return configPath;
}
