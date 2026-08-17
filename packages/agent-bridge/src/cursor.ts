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
    const cursorRules = path.join(root, '.cursorrules');
    const cursorDir = path.join(root, '.cursor');
    return (
      (await fs.pathExists(cursorRules)) ||
      (await fs.pathExists(cursorDir))
    );
  }

  async install(ctx: IntegrationContext): Promise<void> {
    const instructionPath = path.join(ctx.rootDir, '.cursorrules');
    let existingContent = '';
    if (await fs.pathExists(instructionPath)) {
      existingContent = await fs.readFile(instructionPath, 'utf8');
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
    const instructionPath = path.join(ctx.rootDir, '.cursorrules');
    if (await fs.pathExists(instructionPath)) {
      const content = await fs.readFile(instructionPath, 'utf8');
      const cleared = injectManagedSection(content, '').replace(/<!-- KITERETSU:START -->\s*<!-- KITERETSU:END -->/g, '').trim();
      if (cleared.length === 0) {
        await fs.remove(instructionPath);
      } else {
        await fs.writeFile(instructionPath, cleared + '\n', 'utf8');
      }
    }

    const mcpConfigPath = path.join(ctx.rootDir, '.cursor', 'mcp.json');
    if (await fs.pathExists(mcpConfigPath)) {
      try {
        const config = await fs.readJson(mcpConfigPath);
        if (config.mcpServers?.kiteretsu) {
          delete config.mcpServers.kiteretsu;
          await fs.writeJson(mcpConfigPath, config, { spaces: 2 });
        }
      } catch { }
    }
  }

  async validate(ctx: IntegrationContext): Promise<IntegrationStatus> {
    const issues: string[] = [];
    const instructionPath = path.join(ctx.rootDir, '.cursorrules');
    const mcpConfigPath = path.join(ctx.rootDir, '.cursor', 'mcp.json');

    const detected = await this.detect(ctx.rootDir);
    let installed = false;
    let healthy = false;

    if (await fs.pathExists(instructionPath)) {
      const content = await fs.readFile(instructionPath, 'utf8');
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
      instructionFile: '.cursorrules',
      mcpConfigFile: '.cursor/mcp.json',
      issues
    };
  }
}
