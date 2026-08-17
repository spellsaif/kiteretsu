import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { DependencyResolverRegistry } from '../src/graph/resolvers/index.js';
import path from 'path';
import fs from 'fs-extra';

const TEST_ROOT = path.resolve(process.cwd(), 'temp_test_resolvers');

describe('Dependency Resolvers Subsystem', () => {
  let registry: DependencyResolverRegistry;

  beforeEach(async () => {
    await fs.ensureDir(TEST_ROOT);
    registry = new DependencyResolverRegistry();
  });

  afterEach(async () => {
    for (let i = 0; i < 5; i++) {
      try {
        await fs.remove(TEST_ROOT);
        break;
      } catch {
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    }
  });

  it('resolves TypeScript relative and package imports', async () => {
    const pkgDir = path.join(TEST_ROOT, 'packages', 'shared');
    await fs.ensureDir(path.join(pkgDir, 'src'));
    const sharedUtil = path.join(pkgDir, 'src', 'util.ts');
    await fs.writeFile(sharedUtil, 'export const util = 1;');

    const appFile = path.join(TEST_ROOT, 'app.ts');
    await fs.writeFile(appFile, 'import { util } from "@shared/util";');

    const packageMap = new Map<string, string>([['@shared', pkgDir]]);
    const fileSystemCache = new Set<string>();

    const targets = await registry.resolveDependencies('.ts', {
      sourceFile: appFile,
      importInfo: { source: '@shared/util', type: 'value' },
      rootDir: TEST_ROOT,
      packageMap,
      crateMap: new Map(),
      fileSystemCache
    });

    expect(targets.length).toBeGreaterThan(0);
    expect(targets[0].replace(/\\/g, '/')).toContain('packages/shared/src/util.ts');
  });

  it('resolves Python module and package imports', async () => {
    const pkgDir = path.join(TEST_ROOT, 'services');
    await fs.ensureDir(pkgDir);
    const authPy = path.join(pkgDir, 'auth.py');
    await fs.writeFile(authPy, 'def login(): pass');

    const mainPy = path.join(TEST_ROOT, 'main.py');
    await fs.writeFile(mainPy, 'import services.auth');

    const fileSystemCache = new Set<string>();

    const targets = await registry.resolveDependencies('.py', {
      sourceFile: mainPy,
      importInfo: { source: 'services.auth', type: 'value' },
      rootDir: TEST_ROOT,
      packageMap: new Map(),
      crateMap: new Map(),
      fileSystemCache
    });

    expect(targets.length).toBeGreaterThan(0);
    expect(targets[0].replace(/\\/g, '/')).toContain('services/auth.py');
  });

  it('resolves Rust crate:: and super:: paths', async () => {
    const srcDir = path.join(TEST_ROOT, 'src');
    await fs.ensureDir(srcDir);
    await fs.writeFile(path.join(TEST_ROOT, 'Cargo.toml'), '[package]\nname = "test_crate"');
    const libRs = path.join(srcDir, 'lib.rs');
    await fs.writeFile(libRs, 'pub fn add() {}');

    const mainRs = path.join(srcDir, 'main.rs');
    await fs.writeFile(mainRs, 'use crate::lib::add;');

    const fileSystemCache = new Set<string>();

    const targets = await registry.resolveDependencies('.rs', {
      sourceFile: mainRs,
      importInfo: { source: 'crate::lib::add', type: 'value' },
      rootDir: TEST_ROOT,
      packageMap: new Map(),
      crateMap: new Map(),
      fileSystemCache
    });

    expect(targets.length).toBeGreaterThan(0);
    expect(targets[0].replace(/\\/g, '/')).toContain('src/lib.rs');
  });
});
