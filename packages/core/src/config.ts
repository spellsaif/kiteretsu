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

export interface KiteretsuConfig {
  rootDir?: string;
  dbPath?: string;
  name?: string;
  version?: string;
  indexing?: KiteretsuIndexingConfig;
  search?: KiteretsuSearchConfig;
  ignore?: string[];
  languages?: Record<string, unknown>;
  memory?: Record<string, unknown>;
  agents?: Record<string, unknown>;
}

export function defineConfig(config: KiteretsuConfig): KiteretsuConfig {
  return config;
}

export const DEFAULT_CONFIG_TEMPLATE = `import { defineConfig } from "kiteretsu";

export default defineConfig({
  indexing: {
    maxFileSize: "10MB",
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
    "**/.next/**",
    "**/coverage/**",
    "**/.kiteretsu/**",
  ],
});
`;

/**
 * Loads project configuration from canonical kiteretsu.config.ts,
 * with fallback to .js, .mjs, or .json.
 */
export async function loadProjectConfig(rootDir: string): Promise<KiteretsuConfig> {
  const tsPath = path.join(rootDir, 'kiteretsu.config.ts');
  const mjsPath = path.join(rootDir, 'kiteretsu.config.mjs');
  const jsPath = path.join(rootDir, 'kiteretsu.config.js');
  const jsonPath = path.join(rootDir, 'kiteretsu.config.json');

  // 1. Try TypeScript config
  if (await fs.pathExists(tsPath)) {
    try {
      const fileUrl = `${pathToFileURL(tsPath).href}?t=${Date.now()}`;
      const mod = await import(fileUrl);
      if (mod.default) return mod.default;
      if (mod.config) return mod.config;
    } catch {
      // Fallback: parse basic structure if dynamic TS loader is unavailable
      const parsed = parseConfigText(await fs.readFile(tsPath, 'utf8'));
      if (parsed) return parsed;
    }
  }

  // 2. Try ESM / JS config
  for (const p of [mjsPath, jsPath]) {
    if (await fs.pathExists(p)) {
      try {
        const fileUrl = `${pathToFileURL(p).href}?t=${Date.now()}`;
        const mod = await import(fileUrl);
        if (mod.default) return mod.default;
        if (mod.config) return mod.config;
      } catch {
        const parsed = parseConfigText(await fs.readFile(p, 'utf8'));
        if (parsed) return parsed;
      }
    }
  }

  // 3. Try legacy JSON config
  if (await fs.pathExists(jsonPath)) {
    try {
      return await fs.readJson(jsonPath);
    } catch { }
  }

  return {};
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

    // Extract maxFileSize
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
