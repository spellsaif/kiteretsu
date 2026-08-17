import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { Kiteretsu } from '../src/index.js';
import path from 'path';
import fs from 'fs-extra';

const TEST_ROOT = path.resolve(process.cwd(), 'temp_test_fusion_context');

describe('Phase 5 Multi-Sensor Fusion & Explainable Context Compiler', () => {
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

  it('compiles context with multi-sensor confidence and explainable signal traces', async () => {
    const authCoreFile = path.join(TEST_ROOT, 'auth_core.ts');
    await fs.writeFile(authCoreFile, `
      export class SessionAuthenticator {
        verifySession(token: string) {
          return token.length > 5;
        }
      }
    `);

    const authApiFile = path.join(TEST_ROOT, 'auth_api.ts');
    await fs.writeFile(authApiFile, `
      import { SessionAuthenticator } from './auth_core';
      export function loginEndpoint(token: string) {
        const auth = new SessionAuthenticator();
        return auth.verifySession(token);
      }
    `);

    await kiteretsu.index();

    const pack = await kiteretsu.getContextPack('SessionAuthenticator token verification');
    expect(pack.confidence).toBeGreaterThan(0.3);
    expect(pack.read_first.length).toBeGreaterThan(0);

    const primary = pack.read_first[0];
    expect(primary.confidence).toBeGreaterThan(0.3);
    expect(primary.signals).toBeDefined();
    expect(primary.signals.length).toBeGreaterThan(0);
    expect(primary.signals.some(s => s.startsWith('symbol:') || s.startsWith('terms:') || s.startsWith('vector_sim:'))).toBe(true);
  });

  it('elevates graph-connected files during multi-sensor retrieval', async () => {
    const dbFile = path.join(TEST_ROOT, 'db.ts');
    await fs.writeFile(dbFile, 'export function queryUser() { return { id: 1 }; }');

    const userServiceFile = path.join(TEST_ROOT, 'user_service.ts');
    await fs.writeFile(userServiceFile, `
      import { queryUser } from './db';
      export function getUserProfile() {
        return queryUser();
      }
    `);

    await kiteretsu.index();

    const pack = await kiteretsu.getContextPack('getUserProfile');
    const filePaths = pack.read_first.map(f => f.path);
    expect(filePaths.some(p => p.includes('user_service.ts'))).toBe(true);
  });
});
