import path from 'path';
import fs from 'fs-extra';
import {
  AgentIntegration,
  IntegrationContext,
  IntegrationStatus,
  injectManagedSection,
  extractManagedSection,
  getStandardAgentInstructions
} from './agent.js';

export class CursorIntegration implements AgentIntegration {
  readonly id = 'cursor';
  readonly name = 'Cursor';

  async detect(root: string): Promise<boolean> {
    const cursorDir = path.join(root, '.cursor');
    const cursorRulesDir = path.join(root, '.cursor', 'rules');
    const cursorRulesFile = path.join(root, '.cursorrules');
    return (
      (await fs.pathExists(cursorDir)) ||
      (await fs.pathExists(cursorRulesDir)) ||
      (await fs.pathExists(cursorRulesFile)) ||
      !!process.env.CURSOR
    );
  }

  async install(ctx: IntegrationContext): Promise<void> {
    const cursorRulesDir = path.join(ctx.rootDir, '.cursor', 'rules');
    await fs.ensureDir(cursorRulesDir);
    const instructionPath = path.join(cursorRulesDir, 'kiteretsu.mdc');

    let existingContent = '';
    if (await fs.pathExists(instructionPath)) {
      existingContent = await fs.readFile(instructionPath, 'utf8');
    } else {
      existingContent = [
        '---',
        'description: Kiteretsu Codebase Intelligence and Architectural Rules',
        'globs: *',
        'alwaysApply: true',
        '---',
        ''
      ].join('\n');
    }

    const instructions = getStandardAgentInstructions(this.name);
    const updatedContent = injectManagedSection(existingContent, instructions);
    await fs.writeFile(instructionPath, updatedContent, 'utf8');

    // Configure MCP in .cursor/mcp.json
    const cursorDir = path.join(ctx.rootDir, '.cursor');
    await fs.ensureDir(cursorDir);
    const mcpConfigPath = path.join(cursorDir, 'mcp.json');
    let mcpConfig: any = {};
    if (await fs.pathExists(mcpConfigPath)) {
      try {
        mcpConfig = await fs.readJson(mcpConfigPath);
      } catch { }
    }

    if (!mcpConfig.mcpServers) {
      mcpConfig.mcpServers = {};
    }

    mcpConfig.mcpServers.kiteretsu = {
      command: ctx.mcpCommand || 'npx',
      args: ctx.mcpArgs || ['-y', '@kiteretsu/mcp-server'],
      env: ctx.mcpEnv || {}
    };

    await fs.writeJson(mcpConfigPath, mcpConfig, { spaces: 2 });
  }

  async update(ctx: IntegrationContext): Promise<void> {
    return this.install(ctx);
  }

  async remove(ctx: IntegrationContext): Promise<void> {
    const instructionPath = path.join(ctx.rootDir, '.cursor', 'rules', 'kiteretsu.mdc');
    if (await fs.pathExists(instructionPath)) {
      const content = await fs.readFile(instructionPath, 'utf8');
      const cleared = injectManagedSection(content, '').replace(/<!-- KITERETSU:START -->\s*<!-- KITERETSU:END -->/g, '').trim();
      if (cleared.length === 0 || cleared === '---\ndescription: Kiteretsu Codebase Intelligence and Architectural Rules\nglobs: *\nalwaysApply: true\n---') {
        await fs.remove(instructionPath);
      } else {
        await fs.writeFile(instructionPath, cleared + '\n', 'utf8');
      }
    }

    // Also clean legacy .cursorrules if it exists with managed section
    const legacyPath = path.join(ctx.rootDir, '.cursorrules');
    if (await fs.pathExists(legacyPath)) {
      const content = await fs.readFile(legacyPath, 'utf8');
      if (extractManagedSection(content)) {
        const cleared = injectManagedSection(content, '').replace(/<!-- KITERETSU:START -->\s*<!-- KITERETSU:END -->/g, '').trim();
        if (cleared.length === 0) {
          await fs.remove(legacyPath);
        } else {
          await fs.writeFile(legacyPath, cleared + '\n', 'utf8');
        }
      }
    }

    const mcpConfigPath = path.join(ctx.rootDir, '.cursor', 'mcp.json');
    if (await fs.pathExists(mcpConfigPath)) {
      try {
        const config = await fs.readJson(mcpConfigPath);
        if (config.mcpServers?.kiteretsu) {
          delete config.mcpServers.kiteretsu;
          if (Object.keys(config.mcpServers).length === 0) {
            delete config.mcpServers;
          }
          await fs.writeJson(mcpConfigPath, config, { spaces: 2 });
        }
      } catch { }
    }
  }

  async validate(ctx: IntegrationContext): Promise<IntegrationStatus> {
    const issues: string[] = [];
    const instructionPath = path.join(ctx.rootDir, '.cursor', 'rules', 'kiteretsu.mdc');
    const legacyPath = path.join(ctx.rootDir, '.cursorrules');
    const mcpConfigPath = path.join(ctx.rootDir, '.cursor', 'mcp.json');

    const detected = await this.detect(ctx.rootDir);
    let installed = false;
    let healthy = false;
    let actualInstructionFile = '.cursor/rules/kiteretsu.mdc';

    if (await fs.pathExists(instructionPath)) {
      const content = await fs.readFile(instructionPath, 'utf8');
      if (extractManagedSection(content)) {
        installed = true;
      } else {
        issues.push('.cursor/rules/kiteretsu.mdc exists but is missing the managed Kiteretsu section.');
      }
    } else if (await fs.pathExists(legacyPath)) {
      actualInstructionFile = '.cursorrules';
      const content = await fs.readFile(legacyPath, 'utf8');
      if (extractManagedSection(content)) {
        installed = true;
      } else {
        issues.push('.cursorrules exists but is missing the managed Kiteretsu section.');
      }
    }

    if (await fs.pathExists(mcpConfigPath)) {
      try {
        const config = await fs.readJson(mcpConfigPath);
        if (config.mcpServers?.kiteretsu) {
          healthy = installed && issues.length === 0;
        } else {
          issues.push('.cursor/mcp.json is missing kiteretsu MCP server entry.');
        }
      } catch {
        issues.push('.cursor/mcp.json is invalid JSON.');
      }
    }

    return {
      id: this.id,
      name: this.name,
      detected,
      installed,
      healthy: installed && (issues.length === 0 || !detected),
      instructionFile: actualInstructionFile,
      mcpConfigFile: '.cursor/mcp.json',
      issues
    };
  }
}
