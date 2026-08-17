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

export class OpenCodeIntegration implements AgentIntegration {
  readonly id = 'opencode';
  readonly name = 'OpenCode';

  async detect(root: string): Promise<boolean> {
    const opencodeMd = path.join(root, 'OPENCODE.md');
    const opencodeDir = path.join(root, '.opencode');
    return (
      (await fs.pathExists(opencodeMd)) ||
      (await fs.pathExists(opencodeDir))
    );
  }

  async install(ctx: IntegrationContext): Promise<void> {
    const instructionPath = path.join(ctx.rootDir, 'OPENCODE.md');
    let existingContent = '';
    if (await fs.pathExists(instructionPath)) {
      existingContent = await fs.readFile(instructionPath, 'utf8');
    }

    const instructions = getStandardAgentInstructions(this.name);
    const updatedContent = injectManagedSection(existingContent, instructions);
    await fs.writeFile(instructionPath, updatedContent, 'utf8');

    // Configure MCP in .opencode/mcp.json
    const opencodeDir = path.join(ctx.rootDir, '.opencode');
    await fs.ensureDir(opencodeDir);
    const mcpConfigPath = path.join(opencodeDir, 'mcp.json');
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
    const instructionPath = path.join(ctx.rootDir, 'OPENCODE.md');
    if (await fs.pathExists(instructionPath)) {
      const content = await fs.readFile(instructionPath, 'utf8');
      const cleared = injectManagedSection(content, '').replace(/<!-- KITERETSU:START -->\s*<!-- KITERETSU:END -->/g, '').trim();
      if (cleared.length === 0) {
        await fs.remove(instructionPath);
      } else {
        await fs.writeFile(instructionPath, cleared + '\n', 'utf8');
      }
    }

    const mcpConfigPath = path.join(ctx.rootDir, '.opencode', 'mcp.json');
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
    const instructionPath = path.join(ctx.rootDir, 'OPENCODE.md');
    const mcpConfigPath = path.join(ctx.rootDir, '.opencode', 'mcp.json');

    const detected = await this.detect(ctx.rootDir);
    let installed = false;
    let healthy = false;

    if (await fs.pathExists(instructionPath)) {
      const content = await fs.readFile(instructionPath, 'utf8');
      if (extractManagedSection(content)) {
        installed = true;
      } else {
        issues.push('OPENCODE.md exists but is missing the managed Kiteretsu section.');
      }
    }

    if (await fs.pathExists(mcpConfigPath)) {
      try {
        const config = await fs.readJson(mcpConfigPath);
        if (config.mcpServers?.kiteretsu) {
          healthy = installed && issues.length === 0;
        } else {
          issues.push('.opencode/mcp.json is missing kiteretsu MCP server configuration.');
        }
      } catch {
        issues.push('.opencode/mcp.json is invalid JSON.');
      }
    }

    return {
      id: this.id,
      name: this.name,
      detected,
      installed,
      healthy: installed && (issues.length === 0 || !detected),
      instructionFile: 'OPENCODE.md',
      mcpConfigFile: '.opencode/mcp.json',
      issues
    };
  }
}
