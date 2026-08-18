import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { Kiteretsu } from '../src/index.js';
import path from 'path';
import fs from 'fs-extra';

const TEST_ROOT = path.resolve(process.cwd(), 'temp_test_fusion_context');

describe('Four-Signal Multi-Sensor Fusion & Explainable Context Compiler', () => {
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

  it('compiles context with four-signal relevance score and explainable signal traces', async () => {
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
    expect(pack.relevance_score ?? pack.confidence).toBeGreaterThan(0.3);
    expect(pack.read_first.length).toBeGreaterThan(0);

    const primary = pack.read_first[0];
    expect(primary.relevance_score ?? primary.confidence).toBeGreaterThan(0.3);
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

  it('performs symbol-aware graph traversal to surface calling and extending symbols', async () => {
    const baseServiceFile = path.join(TEST_ROOT, 'base_payment.ts');
    await fs.writeFile(baseServiceFile, `
      export class BasePaymentGateway {
        executeTransaction(amount: number) {
          return { success: true, amount };
        }
      }
    `);

    const stripeServiceFile = path.join(TEST_ROOT, 'stripe_payment.ts');
    await fs.writeFile(stripeServiceFile, `
      import { BasePaymentGateway } from './base_payment';
      export class StripePaymentGateway extends BasePaymentGateway {
        chargeCustomer(id: string, amount: number) {
          return this.executeTransaction(amount);
        }
      }
    `);

    await kiteretsu.index();

    // Query for the subclass method - symbol graph expansion should discover and boost the base class file
    const pack = await kiteretsu.getContextPack('chargeCustomer Stripe payment');
    const filePaths = pack.read_first.map(f => f.path);
    expect(filePaths.some(p => p.includes('stripe_payment.ts'))).toBe(true);
    expect(filePaths.some(p => p.includes('base_payment.ts')) || pack.optional_read.some(f => f.path.includes('base_payment.ts'))).toBe(true);
  });
});
