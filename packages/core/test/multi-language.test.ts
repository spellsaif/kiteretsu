import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { Kiteretsu } from '../src/index';
import path from 'path';
import fs from 'fs-extra';

const TEST_ROOT = path.resolve(process.cwd(), 'temp_test_languages');

describe('Multi-Language Indexing', () => {
  let kiteretsu: Kiteretsu;

  beforeEach(async () => {
    await fs.ensureDir(TEST_ROOT);
    kiteretsu = new Kiteretsu({ rootDir: TEST_ROOT });
    await kiteretsu.init();
  });

  afterEach(async () => {
    await kiteretsu.destroy();
    // Retry cleanup on Windows due to potential lock issues
    for (let i = 0; i < 5; i++) {
      try {
        await fs.remove(TEST_ROOT);
        break;
      } catch (e) {
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    }
  });

  it('should extract symbols and dependencies from Python files', async () => {
    const fileA = path.join(TEST_ROOT, 'module_a.py');
    const fileB = path.join(TEST_ROOT, 'module_b.py');

    await fs.writeFile(fileA, 'def func_a():\n    return "A"');
    // Testing both import styles
    await fs.writeFile(fileB, 'import module_a\nfrom module_a import func_a\n\ndef func_b():\n    return module_a.func_a()');

    await kiteretsu.indexFile(fileA);
    await kiteretsu.indexFile(fileB);

    const knex = kiteretsu.db.getKnex();
    
    // Check symbols in A
    const fileARec = await knex('files').where({ path: 'module_a.py' }).first();
    const symbolsA = await knex('symbols').where({ file_id: fileARec.id });
    expect(symbolsA.map(s => s.name)).toContain('func_a');

    // Check edges from B to A
    const fileBRec = await knex('files').where({ path: 'module_b.py' }).first();
    const edges = await knex('graph_edges').where({ source_id: fileBRec.id, relation: 'imports' });
    
    // We expect B to import A. 
    // Note: The indexer's resolveFilePath handles finding the actual file.
    expect(edges).toHaveLength(1); // One unique target file (module_a.py)
    const target = await knex('files').where({ id: edges[0].target_id }).first();
    expect(target.path).toBe('module_a.py');
  });

  it('should extract symbols and dependencies from Rust files', async () => {
    const fileA = path.join(TEST_ROOT, 'src', 'lib.rs');
    const fileB = path.join(TEST_ROOT, 'src', 'main.rs');
    await fs.ensureDir(path.join(TEST_ROOT, 'src'));

    await fs.writeFile(fileA, 'pub fn hello() {}');
    await fs.writeFile(fileB, 'use crate::lib::hello;\nfn main() { hello(); }');

    // In Rust, 'crate' usually refers to the root of the source tree. 
    // The current indexer logic for Rust:
    // sourceRaw.startsWith('crate') -> targetPath = resolveFilePath(path.resolve(this.rootDir, rustPath.replace(/^crate/, 'src')))
    
    await kiteretsu.indexFile(fileA);
    await kiteretsu.indexFile(fileB);

    const knex = kiteretsu.db.getKnex();
    const fileBRec = await knex('files').where({ path: 'src/main.rs' }).first();
    const edges = await knex('graph_edges').where({ source_id: fileBRec.id, relation: 'imports' });
    
    expect(edges.length).toBeGreaterThan(0);
    const target = await knex('files').where({ id: edges[0].target_id }).first();
    expect(target.path).toBe('src/lib.rs');
  });

  it('should extract symbols and dependencies from Go files', async () => {
    const fileA = path.join(TEST_ROOT, 'pkg', 'math.go');
    const fileB = path.join(TEST_ROOT, 'main.go');
    const goMod = path.join(TEST_ROOT, 'go.mod');
    
    await fs.ensureDir(path.join(TEST_ROOT, 'pkg'));
    await fs.writeFile(goMod, 'module example.com/test');
    await fs.writeFile(fileA, 'package pkg\nfunc Add(a, b int) int { return a + b }');
    await fs.writeFile(fileB, 'package main\nimport "example.com/test/pkg"\nfunc main() {}');

    await kiteretsu.indexFile(fileA);
    await kiteretsu.indexFile(fileB);

    const knex = kiteretsu.db.getKnex();
    
    const fileBRec = await knex('files').where({ path: 'main.go' }).first();
    const edges = await knex('graph_edges').where({ source_id: fileBRec.id, relation: 'imports' });
    
    expect(edges.length).toBeGreaterThan(0);
    const target = await knex('files').where({ id: edges[0].target_id }).first();
    expect(target.path).toBe('pkg/math.go');
  });

  it('should extract symbols and dependencies from Ruby files', async () => {
    const fileA = path.join(TEST_ROOT, 'lib', 'utils.rb');
    const fileB = path.join(TEST_ROOT, 'app.rb');
    
    await fs.ensureDir(path.join(TEST_ROOT, 'lib'));
    await fs.writeFile(fileA, 'def hello\n  puts "hello"\nend');
    await fs.writeFile(fileB, 'require "./lib/utils"\nhello()');

    await kiteretsu.indexFile(fileA);
    await kiteretsu.indexFile(fileB);

    const knex = kiteretsu.db.getKnex();
    
    const fileBRec = await knex('files').where({ path: 'app.rb' }).first();
    const edges = await knex('graph_edges').where({ source_id: fileBRec.id, relation: 'imports' });
    
    expect(edges.length).toBeGreaterThan(0);
    const target = await knex('files').where({ id: edges[0].target_id }).first();
    expect(target.path).toBe('lib/utils.rb');
  });
});
