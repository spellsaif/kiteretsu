import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import path from 'path';
import fs from 'fs-extra';
import { fileURLToPath } from 'url';
import { Kiteretsu } from '../src/index.js';

interface ExpectedJson {
  trigger_file: string;
  expected_blast_radius: string[];
  expected_NOT_in_blast_radius?: string[];
  expected_UNRESOLVABLE?: string[];
  notes?: string;
}

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const TEST_ROOT = path.join(__dirname, 'temp_test_conformance');
const SRC_FIXTURES_DIR = path.resolve(__dirname, '../../../test-fixtures');
const FIXTURES_DIR = path.join(TEST_ROOT, 'test-fixtures');

describe('Fixture Conformance & Multi-Language Graph Resolution', () => {
  let kiteretsu: Kiteretsu;

  // Find all expected.json files from source fixtures
  const expectedFiles: string[] = [];
  function findExpected(dir: string) {
    if (!fs.existsSync(dir)) return;
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        findExpected(full);
      } else if (entry.name === 'expected.json') {
        expectedFiles.push(full);
      }
    }
  }
  findExpected(SRC_FIXTURES_DIR);

  beforeAll(async () => {
    await fs.remove(TEST_ROOT);
    await fs.ensureDir(TEST_ROOT);
    await fs.copy(SRC_FIXTURES_DIR, FIXTURES_DIR);

    kiteretsu = new Kiteretsu({ rootDir: TEST_ROOT });
    await kiteretsu.init();
    await kiteretsu.index();
  }, 45000);

  afterAll(async () => {
    if (kiteretsu) {
      await kiteretsu.destroy();
    }
    await fs.remove(TEST_ROOT);
  });

  const normalize = (p: string) => {
    let clean = p;
    if (clean.startsWith('UNRESOLVABLE: ')) {
      clean = clean.slice('UNRESOLVABLE: '.length);
    }
    const abs = path.isAbsolute(clean) ? clean : path.resolve(TEST_ROOT, clean);
    let rel = path.relative(TEST_ROOT, abs).replace(/\\/g, '/');
    if (rel.startsWith('./')) rel = rel.slice(2);
    return rel.toLowerCase();
  };

  for (const srcExpectedFile of expectedFiles) {
    const srcFixtureDir = path.dirname(srcExpectedFile);
    const relDir = path.relative(SRC_FIXTURES_DIR, srcFixtureDir).replace(/\\/g, '/');

    it(`evaluates conformance for [${relDir}]`, async () => {
      const expectedFile = path.join(FIXTURES_DIR, relDir, 'expected.json');
      const expected: ExpectedJson = await fs.readJson(expectedFile);
      const triggerFull = path.resolve(TEST_ROOT, expected.trigger_file);

      const analyzer = await kiteretsu.getAnalyzer();
      const rawBlast = await analyzer.getBlastRadius(triggerFull);
      const actualNormalized = rawBlast.map(normalize);

      // 1. Assert expected_blast_radius
      for (const exp of expected.expected_blast_radius) {
        const expNorm = normalize(exp);
        expect(
          actualNormalized,
          `Expected ${exp} to be in blast radius of ${expected.trigger_file} (${expected.notes || relDir})`
        ).toContain(expNorm);
      }

      // 2. Assert expected_NOT_in_blast_radius (negative testing against false positives)
      if (expected.expected_NOT_in_blast_radius) {
        for (const notExp of expected.expected_NOT_in_blast_radius) {
          const notExpNorm = normalize(notExp);
          expect(
            actualNormalized,
            `Expected ${notExp} NOT to be in blast radius of ${expected.trigger_file} (${expected.notes || relDir})`
          ).not.toContain(notExpNorm);
        }
      }
    });
  }
});
