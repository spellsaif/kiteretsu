import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { Kiteretsu } from '../src/index';
import path from 'path';
import fs from 'fs-extra';

const TEST_ROOT = path.resolve(process.cwd(), 'temp_test_search');

describe('Semantic Search - TF-IDF Ranking', () => {
  let kiteretsu: Kiteretsu;

  beforeEach(async () => {
    await fs.ensureDir(TEST_ROOT);
    kiteretsu = new Kiteretsu({ rootDir: TEST_ROOT });
    await kiteretsu.init();
  });

  afterEach(async () => {
    await kiteretsu.destroy();
    await fs.remove(TEST_ROOT);
  });

  it('should prioritize rare terms over common noise words', async () => {
    // 1. Create a "Noise" file (common word)
    const noiseFile = path.join(TEST_ROOT, 'generic_handler.ts');
    await fs.writeFile(noiseFile, 'export function handle() {} // implement basic logic');

    // 2. Create a "Significant" file (rare word)
    const significantFile = path.join(TEST_ROOT, 'auth_service.ts');
    await fs.writeFile(significantFile, 'export function authenticate() {}');

    // Index them
    await kiteretsu.indexFile(noiseFile);
    await kiteretsu.indexFile(significantFile);

    // Search for something with noise
    const pack = await kiteretsu.getContextPack('implement auth');
    
    // Auth should be the top candidate because "implement" is a stop-word 
    // and "auth" is rarer than "handle" or generic terms.
    expect(pack.read_first[0].path).toContain('auth_service.ts');
  });

  it('should rank filename matches higher than summary matches', async () => {
    // File A: Keyword in name
    const fileA = path.join(TEST_ROOT, 'database_connector.ts');
    await fs.writeFile(fileA, '// code here');

    // File B: Keyword only in summary
    const fileB = path.join(TEST_ROOT, 'utils.ts');
    await fs.writeFile(fileB, '// helper functions');
    
    await kiteretsu.indexFile(fileA);
    await kiteretsu.indexFile(fileB);

    // Manually add summary to File B via DB (simulating indexed summary)
    const knex = kiteretsu.db.getKnex();
    await knex('files').where({ path: 'utils.ts' }).update({ summary: 'This file connects to the database' });

    const pack = await kiteretsu.getContextPack('database');
    
    // database_connector.ts should be first because name weight (10x) > summary weight (2x)
    expect(pack.read_first[0].path).toBe('database_connector.ts');
  });
});
