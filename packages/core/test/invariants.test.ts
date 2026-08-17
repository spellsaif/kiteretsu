import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { Kiteretsu } from '../src/index.js';
import { CodeWatcher } from '../src/watcher.js';
import { createDeterministicEmbedding } from '../src/embeddings.js';
import path from 'path';
import fs from 'fs-extra';

const TEST_ROOT = path.resolve(process.cwd(), 'temp_test_invariants');

describe('Codebase Invariants & Engine Correctness', () => {
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

  it('reconciles deleted files and purges database records on re-index', async () => {
    const fileA = path.join(TEST_ROOT, 'a.ts');
    const fileB = path.join(TEST_ROOT, 'b.ts');

    await fs.writeFile(fileA, 'export function funcA() { return "A"; }');
    await fs.writeFile(fileB, 'import { funcA } from "./a"; export function funcB() { return funcA(); }');

    // Index both files
    await kiteretsu.index();

    const knex = kiteretsu.db.getKnex();
    const filesBefore = await knex('files').select('path');
    const filePathsBefore = filesBefore.map(f => f.path);
    expect(filePathsBefore).toContain('a.ts');
    expect(filePathsBefore).toContain('b.ts');

    const symbolsBefore = await knex('symbols').select('name');
    expect(symbolsBefore.map(s => s.name)).toContain('funcA');

    // Delete fileA from disk
    await fs.remove(fileA);

    // Re-index repository
    await kiteretsu.index();

    const filesAfter = await knex('files').select('path');
    const filePathsAfter = filesAfter.map(f => f.path);
    expect(filePathsAfter).not.toContain('a.ts');
    expect(filePathsAfter).toContain('b.ts');

    // funcA symbols should be purged
    const symbolsAfter = await knex('symbols').select('name');
    expect(symbolsAfter.map(s => s.name)).not.toContain('funcA');
  });

  it('evaluates rule scopes (global, path, language) accurately during context retrieval', async () => {
    await fs.ensureDir(path.join(TEST_ROOT, 'packages', 'frontend'));
    await fs.ensureDir(path.join(TEST_ROOT, 'packages', 'backend'));

    const frontendFile = path.join(TEST_ROOT, 'packages', 'frontend', 'Button.tsx');
    const backendFile = path.join(TEST_ROOT, 'packages', 'backend', 'server.ts');
    const pyFile = path.join(TEST_ROOT, 'packages', 'backend', 'service.py');

    await fs.writeFile(frontendFile, 'export function Button() { return <button>Click</button>; }');
    await fs.writeFile(backendFile, 'export function startServer() { return true; }');
    await fs.writeFile(pyFile, 'def execute(): pass');

    await kiteretsu.index();

    // Register scoped rules
    await kiteretsu.addRule('global-error-handling', 'All exceptions must be caught and logged', 'global', '');
    await kiteretsu.addRule('no-zustand-ui', 'Do not use Zustand in UI components', 'path', 'packages/frontend/**');
    await kiteretsu.addRule('python-typing', 'All Python functions require type hints', 'language', 'python');

    // Query context targeting frontend
    const fePack = await kiteretsu.getContextPack('Button component click UI');
    expect(fePack.rules.some(r => r.includes('global-error-handling'))).toBe(true);
    expect(fePack.rules.some(r => r.includes('no-zustand-ui'))).toBe(true);
    expect(fePack.rules.some(r => r.includes('python-typing'))).toBe(false);

    // Query context targeting python
    const pyPack = await kiteretsu.getContextPack('service execute backend');
    expect(pyPack.rules.some(r => r.includes('global-error-handling'))).toBe(true);
    expect(pyPack.rules.some(r => r.includes('python-typing'))).toBe(true);
    expect(pyPack.rules.some(r => r.includes('no-zustand-ui'))).toBe(false);
  });

  it('respects custom budget_tokens option in getContextPack', async () => {
    // Create multiple source files
    for (let i = 0; i < 5; i++) {
      const filePath = path.join(TEST_ROOT, `file_${i}.ts`);
      const longContent = `// File ${i}\n` + 'export const data = "x";\n'.repeat(50);
      await fs.writeFile(filePath, longContent);
    }

    await kiteretsu.index();

    // Context pack with a tight budget
    const tightPack = await kiteretsu.getContextPack('file data', { budgetTokens: 100 });
    expect(tightPack.read_first.length).toBeGreaterThan(0);
    // Overflown candidates must be partitioned into optional_read
    expect(tightPack.optional_read.length).toBeGreaterThan(0);
    expect(tightPack.read_first.length + tightPack.optional_read.length).toBeGreaterThanOrEqual(2);
  });

  it('allows multiple CodeWatcher instances with isolated lifecycles', async () => {
    const watcherA = new CodeWatcher(kiteretsu);
    const watcherB = new CodeWatcher(kiteretsu);

    await watcherA.start(TEST_ROOT);
    await watcherB.start(TEST_ROOT);

    watcherA.stop();
    watcherB.stop();

    // Verify restarts work without static flag lockups
    await watcherA.start(TEST_ROOT);
    watcherA.stop();
  });

  it('generates deterministic embeddings with semantic token clustering', () => {
    const vecAuth1 = createDeterministicEmbedding('export function authenticateUser()');
    const vecAuth2 = createDeterministicEmbedding('export function authenticateSession()');
    const vecDb = createDeterministicEmbedding('export class DatabaseConnectionPool');

    expect(vecAuth1).toHaveLength(384);
    expect(vecAuth2).toHaveLength(384);
    expect(vecDb).toHaveLength(384);

    // Cosine similarity
    const cosineSim = (a: number[], b: number[]) => a.reduce((sum, val, i) => sum + val * b[i], 0);

    const simAuth = cosineSim(vecAuth1, vecAuth2);
    const simDb = cosineSim(vecAuth1, vecDb);

    expect(simAuth).toBeGreaterThan(simDb);
  });
});
