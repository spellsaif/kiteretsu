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

const ROOT_DIR = path.resolve(fileURLToPath(new URL('../../..', import.meta.url)));
const FIXTURES_DIR = path.join(ROOT_DIR, 'test-fixtures');

describe('Fixture Conformance & Multi-Language Graph Resolution', () => {
  let kiteretsu: Kiteretsu;

  // Find all expected.json files
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
  findExpected(FIXTURES_DIR);

  beforeAll(async () => {
    kiteretsu = new Kiteretsu({ rootDir: ROOT_DIR });
    await kiteretsu.init();

    // Index all fixture files once upfront
    const allFixtureFiles: string[] = [];
    function collectAll(dir: string) {
      if (!fs.existsSync(dir)) return;
      const entries = fs.readdirSync(dir, { withFileTypes: true });
      for (const entry of entries) {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) {
          collectAll(full);
        } else if (entry.name !== 'expected.json') {
          allFixtureFiles.push(full);
        }
      }
    }
    collectAll(FIXTURES_DIR);

    for (const file of allFixtureFiles) {
      await kiteretsu.indexFile(file);
    }
  }, 30000);

  afterAll(async () => {
    if (kiteretsu) {
      await kiteretsu.destroy();
    }
  });

  const normalize = (p: string) => {
    let clean = p;
    if (clean.startsWith('UNRESOLVABLE: ')) {
      clean = clean.slice('UNRESOLVABLE: '.length);
    }
    const abs = path.isAbsolute(clean) ? clean : path.resolve(ROOT_DIR, clean);
    let rel = path.relative(ROOT_DIR, abs).replace(/\\/g, '/');
    if (rel.startsWith('./')) rel = rel.slice(2);
    return rel.toLowerCase();
  };

  for (const expectedFile of expectedFiles) {
    const fixtureDir = path.dirname(expectedFile);
    const relDir = path.relative(FIXTURES_DIR, fixtureDir).replace(/\\/g, '/');

    it(`evaluates conformance for [${relDir}]`, async () => {
      const expected: ExpectedJson = await fs.readJson(expectedFile);
      const triggerFull = path.resolve(ROOT_DIR, expected.trigger_file);

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
