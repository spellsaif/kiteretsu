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

export class ClaudeIntegration implements AgentIntegration {
  readonly id = 'claude';
  readonly name = 'Claude Code';

  async detect(root: string): Promise<boolean> {
    const claudeMd = path.join(root, 'CLAUDE.md');
    const claudeJson = path.join(root, '.claude.json');
    const claudeDir = path.join(root, '.claude');
    return (
      (await fs.pathExists(claudeMd)) ||
      (await fs.pathExists(claudeJson)) ||
      (await fs.pathExists(claudeDir)) ||
      !!process.env.CLAUDE_CODE
    );
  }

  async install(ctx: IntegrationContext): Promise<void> {
    const instructionPath = path.join(ctx.rootDir, 'CLAUDE.md');
    let existingContent = '';
    if (await fs.pathExists(instructionPath)) {
      existingContent = await fs.readFile(instructionPath, 'utf8');
    }

    const instructions = getStandardAgentInstructions(this.name);
    const updatedContent = injectManagedSection(existingContent, instructions);
    await fs.writeFile(instructionPath, updatedContent, 'utf8');

    // Configure MCP server in .claude.json
    const mcpConfigPath = path.join(ctx.rootDir, '.claude.json');
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
      args: ctx.mcpArgs || ['-y', '@spellsaif/kiteretsu-mcp-server'],
      env: ctx.mcpEnv || {}
    };

    await fs.writeJson(mcpConfigPath, mcpConfig, { spaces: 2 });
  }

  async update(ctx: IntegrationContext): Promise<void> {
    return this.install(ctx);
  }

  async remove(ctx: IntegrationContext): Promise<void> {
    const instructionPath = path.join(ctx.rootDir, 'CLAUDE.md');
    if (await fs.pathExists(instructionPath)) {
      const content = await fs.readFile(instructionPath, 'utf8');
      const cleared = injectManagedSection(content, '').replace(/<!-- KITERETSU:START -->\s*<!-- KITERETSU:END -->/g, '').trim();
      if (cleared.length === 0) {
        await fs.remove(instructionPath);
      } else {
        await fs.writeFile(instructionPath, cleared + '\n', 'utf8');
      }
    }

    const mcpConfigPath = path.join(ctx.rootDir, '.claude.json');
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
    const instructionPath = path.join(ctx.rootDir, 'CLAUDE.md');
    const mcpConfigPath = path.join(ctx.rootDir, '.claude.json');

    const detected = await this.detect(ctx.rootDir);
    let installed = false;
    let healthy = false;

    if (await fs.pathExists(instructionPath)) {
      const content = await fs.readFile(instructionPath, 'utf8');
      if (extractManagedSection(content)) {
        installed = true;
      } else {
        issues.push('CLAUDE.md exists but is missing the managed Kiteretsu section.');
      }
    }

    if (await fs.pathExists(mcpConfigPath)) {
      try {
        const config = await fs.readJson(mcpConfigPath);
        if (config.mcpServers?.kiteretsu) {
          healthy = installed && issues.length === 0;
        } else {
          issues.push('.claude.json is missing the kiteretsu MCP server configuration.');
        }
      } catch {
        issues.push('.claude.json is invalid JSON.');
      }
    } else if (installed) {
      issues.push('.claude.json not found for MCP integration.');
    }

    return {
      id: this.id,
      name: this.name,
      detected,
      installed,
      healthy,
      instructionFile: 'CLAUDE.md',
      mcpConfigFile: '.claude.json',
      issues
    };
  }
}
