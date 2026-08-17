import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { Kiteretsu } from '../src/index.js';
import path from 'path';
import fs from 'fs-extra';

const TEST_ROOT = path.resolve(process.cwd(), 'temp_test_memory');

describe('Phase 4 Structured Memory & Engineering Decisions', () => {
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

  it('records and retrieves architectural decisions (ADRs) with path scoping', async () => {
    const authFile = path.join(TEST_ROOT, 'src', 'auth.ts');
    await fs.ensureDir(path.dirname(authFile));
    await fs.writeFile(authFile, 'export function login() { return true; }');

    await kiteretsu.recordDecision(
      'Use Better-SQLite3 for Embedded Storage',
      'Better-sqlite3 runs synchronously in-process and avoids native async locking overhead on Linux and Windows.',
      'sqlite3 npm package, Prisma, TypeORM',
      ['src/database.ts', 'src/storage/**'],
      'active'
    );

    await kiteretsu.recordDecision(
      'Enforce JWT Authentication Tokens',
      'All API endpoints under src/auth.ts must validate JWT signatures with RSA-256.',
      'Session cookies, Basic Auth',
      ['src/auth.ts'],
      'active'
    );

    const allDecisions = await kiteretsu.getAllDecisions();
    expect(allDecisions.length).toBe(2);

    // Retrieve decisions for auth task
    const relevantAuthDecisions = await kiteretsu.getRelevantDecisions('Add login route for users', ['src/auth.ts'], 5);
    expect(relevantAuthDecisions.length).toBeGreaterThan(0);
    expect(relevantAuthDecisions.some(d => d.title.includes('JWT Authentication'))).toBe(true);
  });

  it('records episodic task outcomes and retrieves similar past tasks', async () => {
    await kiteretsu.recordTaskOutcome(
      'Refactor database connection pool and fix PRAGMA foreign keys',
      'refactor',
      'success',
      'Enabled foreign_keys=ON pragma in afterCreate pool callback.'
    );

    await kiteretsu.recordTaskOutcome(
      'Implement OAuth2 Google authentication flow',
      'feature',
      'success',
      'Created auth/oauth.ts and updated token expiry checks.'
    );

    const similarAuthTasks = await kiteretsu.getSimilarTasks('Google OAuth login support', 3);
    expect(similarAuthTasks.length).toBeGreaterThan(0);
    expect(similarAuthTasks.some(t => t.description.includes('OAuth2'))).toBe(true);
  });

  it('includes decisions and past task learnings in context pack output', async () => {
    const serviceFile = path.join(TEST_ROOT, 'service.ts');
    await fs.writeFile(serviceFile, 'export function processPayment() { return 1; }');
    await kiteretsu.index();

    await kiteretsu.recordDecision(
      'Stripe Payment Gateway Standard',
      'All payment processing in service.ts must use idempotency keys with Stripe v3 API.',
      'PayPal, Braintree',
      ['service.ts']
    );

    await kiteretsu.recordTaskOutcome(
      'Implement Stripe payment idempotency keys in service.ts',
      'feature',
      'success',
      'Required UUID v4 generation on client before calling service.ts.'
    );

    const pack = await kiteretsu.getContextPack('Implement payment processing');
    expect(pack.decisions).toBeDefined();
    expect(pack.decisions!.some(d => d.title.includes('Stripe'))).toBe(true);
    expect(pack.past_tasks).toBeDefined();
    expect(pack.past_tasks!.some(t => t.description.includes('payment idempotency'))).toBe(true);
  });
});
