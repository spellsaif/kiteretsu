import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import path from 'path';
import fs from 'fs-extra';
import {
  injectManagedSection,
  extractManagedSection,
  KITERETSU_SECTION_START,
  KITERETSU_SECTION_END,
  AgentDetector,
  AgentInstaller,
  AgentUpdater,
  AgentDoctor
} from '../src/index.js';

const TEST_ROOT = path.resolve(process.cwd(), 'temp_test_bridge');

describe('Agent Bridge & Managed Instruction Sections', () => {
  beforeEach(async () => {
    await fs.ensureDir(TEST_ROOT);
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

  it('injects managed section and preserves existing user instructions', () => {
    const userContent = '# My Custom Project Instructions\n\nAlways use pnpm, never npm.';
    const kiteretsuBody = 'Query Kiteretsu context before modifying files.';

    const injected = injectManagedSection(userContent, kiteretsuBody);
    expect(injected).toContain('Always use pnpm, never npm.');
    expect(injected).toContain(KITERETSU_SECTION_START);
    expect(injected).toContain(kiteretsuBody);
    expect(injected).toContain(KITERETSU_SECTION_END);

    const extracted = extractManagedSection(injected);
    expect(extracted).toBe(kiteretsuBody);
  });

  it('safely updates existing managed section without duplicating or touching user content', () => {
    const initial = [
      '# My Project',
      '',
      KITERETSU_SECTION_START,
      'Old instructions v1',
      KITERETSU_SECTION_END,
      '',
      '## Developer Notes',
      'Keep port 8080 open.'
    ].join('\n');

    const updated = injectManagedSection(initial, 'New instructions v2');
    expect(updated).toContain('# My Project');
    expect(updated).toContain('## Developer Notes');
    expect(updated).toContain('Keep port 8080 open.');
    expect(updated).toContain('New instructions v2');
    expect(updated).not.toContain('Old instructions v1');

    // Ensure only one start and end marker
    expect(updated.split(KITERETSU_SECTION_START).length).toBe(2);
    expect(updated.split(KITERETSU_SECTION_END).length).toBe(2);
  });

  it('detects, installs, and validates agent integrations and MCP configs', async () => {
    // Create pre-existing agent markers
    await fs.writeFile(path.join(TEST_ROOT, 'CLAUDE.md'), '# Claude Config\n');
    await fs.ensureDir(path.join(TEST_ROOT, '.cursor'));

    const detector = new AgentDetector();
    const detected = await detector.detect(TEST_ROOT);
    expect(detected.some(i => i.id === 'claude')).toBe(true);
    expect(detected.some(i => i.id === 'cursor')).toBe(true);

    const installer = new AgentInstaller(detector);
    const installSummary = await installer.install({ rootDir: TEST_ROOT });
    expect(installSummary.installed.length).toBeGreaterThan(0);

    // Verify CLAUDE.md has managed section
    const claudeContent = await fs.readFile(path.join(TEST_ROOT, 'CLAUDE.md'), 'utf8');
    expect(claudeContent).toContain(KITERETSU_SECTION_START);
    expect(claudeContent).toContain('# Claude Config');

    // Verify .claude.json has MCP server config
    const claudeJson = await fs.readJson(path.join(TEST_ROOT, '.claude.json'));
    expect(claudeJson.mcpServers.kiteretsu).toBeDefined();
    expect(claudeJson.mcpServers.kiteretsu.command).toBe('npx');

    // Verify .cursor/mcp.json has MCP server config
    const cursorJson = await fs.readJson(path.join(TEST_ROOT, '.cursor', 'mcp.json'));
    expect(cursorJson.mcpServers.kiteretsu).toBeDefined();

    // Verify doctor diagnosis
    const doctor = new AgentDoctor(detector);
    const report = await doctor.diagnose({ rootDir: TEST_ROOT });
    expect(report.overallHealthy).toBe(true);
    expect(report.statuses.some(s => s.id === 'claude' && s.healthy)).toBe(true);
  });
});
