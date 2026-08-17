import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { Kiteretsu } from '../src/index.js';
import path from 'path';
import fs from 'fs-extra';

const TEST_ROOT = path.resolve(process.cwd(), 'temp_test_symbol_graph');

describe('Phase 3 Symbol-Level Graph Intelligence', () => {
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

  it('extracts symbol calls, inheritance, and implementations across files', async () => {
    const authServiceFile = path.join(TEST_ROOT, 'auth.ts');
    await fs.writeFile(authServiceFile, `
      export interface IAuthenticator {
        login(u: string, p: string): boolean;
      }

      export class BaseAuth {
        validateToken(token: string): boolean {
          return token.length > 0;
        }
      }

      export class TokenAuthenticator extends BaseAuth implements IAuthenticator {
        login(u: string, p: string): boolean {
          return this.validateToken(u + p);
        }
      }
    `);

    const routerFile = path.join(TEST_ROOT, 'router.ts');
    await fs.writeFile(routerFile, `
      import { TokenAuthenticator } from './auth';

      export function handleLoginRequest(username: string, pass: string) {
        const auth = new TokenAuthenticator();
        return auth.login(username, pass);
      }
    `);

    await kiteretsu.index();

    // 1. Query callers of validateToken
    const callersOfValidate = await kiteretsu.getSymbolCallers('validateToken');
    expect(callersOfValidate.length).toBeGreaterThan(0);
    expect(callersOfValidate.some(c => c.callerSymbolName === 'login')).toBe(true);

    // 2. Query callers of login
    const callersOfLogin = await kiteretsu.getSymbolCallers('login');
    expect(callersOfLogin.length).toBeGreaterThan(0);
    expect(callersOfLogin.some(c => c.callerSymbolName === 'handleLoginRequest')).toBe(true);

    // 3. Query callees of handleLoginRequest
    const calleesOfRouter = await kiteretsu.getSymbolCallees('handleLoginRequest');
    expect(calleesOfRouter.length).toBeGreaterThan(0);
    expect(calleesOfRouter.some(c => c.calleeSymbolName === 'login')).toBe(true);

    // 4. Query full symbol graph for TokenAuthenticator
    const tokenAuthGraph = await kiteretsu.getSymbolGraph('TokenAuthenticator');
    expect(tokenAuthGraph.symbol).toBe('TokenAuthenticator');
  });

  it('cleans up symbol-to-symbol edges on file deletion', async () => {
    const helperFile = path.join(TEST_ROOT, 'helper.ts');
    await fs.writeFile(helperFile, `
      export function computeHash(data: string) {
        return data;
      }
    `);

    const clientFile = path.join(TEST_ROOT, 'client.ts');
    await fs.writeFile(clientFile, `
      import { computeHash } from './helper';
      export function sendPayload(payload: string) {
        return computeHash(payload);
      }
    `);

    await kiteretsu.index();

    let callers = await kiteretsu.getSymbolCallers('computeHash');
    expect(callers.length).toBeGreaterThan(0);

    // Delete client.ts and re-index
    await fs.remove(clientFile);
    await kiteretsu.index();

    callers = await kiteretsu.getSymbolCallers('computeHash');
    expect(callers.length).toBe(0);
  });
});
