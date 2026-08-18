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

export class GenericIntegration implements AgentIntegration {
  readonly id = 'generic';
  readonly name = 'Generic MCP Agent / AGENTS.md';

  async detect(root: string): Promise<boolean> {
    const agentsMd = path.join(root, 'AGENTS.md');
    return fs.pathExists(agentsMd);
  }

  async install(ctx: IntegrationContext): Promise<void> {
    const instructionPath = path.join(ctx.rootDir, 'AGENTS.md');
    let existingContent = '';
    if (await fs.pathExists(instructionPath)) {
      existingContent = await fs.readFile(instructionPath, 'utf8');
    }

    const instructions = getStandardAgentInstructions(this.name);
    const updatedContent = injectManagedSection(existingContent, instructions);
    await fs.writeFile(instructionPath, updatedContent, 'utf8');

    // Also write standard mcp.json in root if none exists
    const mcpConfigPath = path.join(ctx.rootDir, 'mcp.json');
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
    const instructionPath = path.join(ctx.rootDir, 'AGENTS.md');
    if (await fs.pathExists(instructionPath)) {
      const content = await fs.readFile(instructionPath, 'utf8');
      const cleared = injectManagedSection(content, '').replace(/<!-- KITERETSU:START -->\s*<!-- KITERETSU:END -->/g, '').trim();
      if (cleared.length === 0) {
        await fs.remove(instructionPath);
      } else {
        await fs.writeFile(instructionPath, cleared + '\n', 'utf8');
      }
    }
  }

  async validate(ctx: IntegrationContext): Promise<IntegrationStatus> {
    const issues: string[] = [];
    const instructionPath = path.join(ctx.rootDir, 'AGENTS.md');

    const detected = await this.detect(ctx.rootDir);
    let installed = false;

    if (await fs.pathExists(instructionPath)) {
      const content = await fs.readFile(instructionPath, 'utf8');
      if (extractManagedSection(content)) {
        installed = true;
      } else {
        issues.push('AGENTS.md exists but is missing the managed Kiteretsu section.');
      }
    }

    return {
      id: this.id,
      name: this.name,
      detected,
      installed,
      healthy: installed && issues.length === 0,
      instructionFile: 'AGENTS.md',
      mcpConfigFile: 'mcp.json',
      issues
    };
  }
}
