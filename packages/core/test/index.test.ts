import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { Kiteretsu } from '../src/index';
import path from 'path';
import fs from 'fs-extra';

const TEST_ROOT = path.resolve(process.cwd(), 'temp_test_root_intelligence');

describe('Kiteretsu Intelligence Layer', () => {
  let kiteretsu: Kiteretsu;

  beforeEach(async () => {
    await fs.ensureDir(TEST_ROOT);
    kiteretsu = new Kiteretsu({ rootDir: TEST_ROOT });
    await kiteretsu.init();
  });

  afterEach(async () => {
    await kiteretsu.destroy();
    for (let i = 0; i < 5; i++) {
      try {
        await fs.remove(TEST_ROOT);
        break;
      } catch {
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    }
  });

  it('should initialize a database in the root directory', async () => {
    const dbPath = path.join(TEST_ROOT, '.kiteretsu', 'memory', 'kiteretsu.sqlite');
    expect(fs.existsSync(dbPath)).toBe(true);
  });

  it('should identify symbols in a file', async () => {
    const filePath = path.join(TEST_ROOT, 'utils.ts');
    await fs.writeFile(filePath, 'export function hello() { return "world"; }');
    
    const relPath = 'utils.ts';
    await kiteretsu.indexFile(filePath);
    
    const symbols = await kiteretsu.db.getSymbolsForFile(relPath);
    expect(symbols).toHaveLength(1);
    expect(symbols[0].name).toBe('hello');
    expect(symbols[0].type).toBe('function');
  });

  it('should correctly calculate blast radius', async () => {
    const fileA = normalize(path.join(TEST_ROOT, 'a.ts'));
    const fileB = normalize(path.join(TEST_ROOT, 'b.ts'));
    
    await fs.writeFile(fileA, 'export const a = 1;');
    await fs.writeFile(fileB, 'import { a } from "./a"; export const b = a + 1;');
    
    await kiteretsu.indexFile(fileA);
    await kiteretsu.indexFile(fileB);
    
    const analyzer = await kiteretsu.getAnalyzer();
    const blastRadius = (await analyzer.getBlastRadius(fileA)).map(normalize);
    expect(blastRadius).toContain(fileB);
  });

  it('should flag template-literal dynamic imports as unresolved', async () => {
    const pluginFile = normalize(path.join(TEST_ROOT, 'plugin.ts'));
    const loaderFile = normalize(path.join(TEST_ROOT, 'loader.ts'));

    await fs.writeFile(pluginFile, 'export const run = () => "ok";');
    await fs.writeFile(loaderFile, 'const pluginName = "plugin";\nexport const load = async () => import(`./${pluginName}`);');

    await kiteretsu.indexFile(pluginFile);
    await kiteretsu.indexFile(loaderFile);

    const analyzer = await kiteretsu.getAnalyzer();
    const blastRadius = (await analyzer.getBlastRadius(pluginFile)).map(normalizeBlastEntry);
    expect(blastRadius).toContain(`UNRESOLVABLE: ${loaderFile}`);
  });
});

function normalize(p: string) {
  let resolved = path.resolve(p).replace(/\\/g, '/');
  if (process.platform === 'win32' && /^[a-z]:/i.test(resolved)) {
    resolved = resolved[0].toLowerCase() + resolved.slice(1);
  }
  return resolved;
}

function normalizeBlastEntry(entry: string) {
  if (entry.startsWith('UNRESOLVABLE: ')) {
    return `UNRESOLVABLE: ${normalize(entry.slice('UNRESOLVABLE: '.length))}`;
  }
  return normalize(entry);
}
