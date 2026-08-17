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

export class GeminiIntegration implements AgentIntegration {
  readonly id = 'gemini';
  readonly name = 'Gemini CLI / Antigravity';

  async detect(root: string): Promise<boolean> {
    const geminiMd = path.join(root, 'GEMINI.md');
    const geminiDir = path.join(root, '.gemini');
    return (
      (await fs.pathExists(geminiMd)) ||
      (await fs.pathExists(geminiDir)) ||
      !!process.env.GEMINI_CLI ||
      !!process.env.ANTIGRAVITY_APP_DATA_DIR
    );
  }

  async install(ctx: IntegrationContext): Promise<void> {
    const instructionPath = path.join(ctx.rootDir, 'GEMINI.md');
    let existingContent = '';
    if (await fs.pathExists(instructionPath)) {
      existingContent = await fs.readFile(instructionPath, 'utf8');
    }

    const instructions = getStandardAgentInstructions(this.name);
    const updatedContent = injectManagedSection(existingContent, instructions);
    await fs.writeFile(instructionPath, updatedContent, 'utf8');

    // Configure MCP server in .gemini/settings.json if .gemini dir exists
    const geminiDir = path.join(ctx.rootDir, '.gemini');
    await fs.ensureDir(geminiDir);
    const mcpConfigPath = path.join(geminiDir, 'settings.json');
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
    const instructionPath = path.join(ctx.rootDir, 'GEMINI.md');
    if (await fs.pathExists(instructionPath)) {
      const content = await fs.readFile(instructionPath, 'utf8');
      const cleared = injectManagedSection(content, '').replace(/<!-- KITERETSU:START -->\s*<!-- KITERETSU:END -->/g, '').trim();
      if (cleared.length === 0) {
        await fs.remove(instructionPath);
      } else {
        await fs.writeFile(instructionPath, cleared + '\n', 'utf8');
      }
    }

    const mcpConfigPath = path.join(ctx.rootDir, '.gemini', 'settings.json');
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
    const instructionPath = path.join(ctx.rootDir, 'GEMINI.md');
    const mcpConfigPath = path.join(ctx.rootDir, '.gemini', 'settings.json');

    const detected = await this.detect(ctx.rootDir);
    let installed = false;
    let healthy = false;

    if (await fs.pathExists(instructionPath)) {
      const content = await fs.readFile(instructionPath, 'utf8');
      if (extractManagedSection(content)) {
        installed = true;
      } else {
        issues.push('GEMINI.md exists but is missing the managed Kiteretsu section.');
      }
    }

    if (await fs.pathExists(mcpConfigPath)) {
      try {
        const config = await fs.readJson(mcpConfigPath);
        if (config.mcpServers?.kiteretsu) {
          healthy = installed && issues.length === 0;
        } else {
          issues.push('.gemini/settings.json is missing kiteretsu MCP configuration.');
        }
      } catch {
        issues.push('.gemini/settings.json is invalid JSON.');
      }
    }

    return {
      id: this.id,
      name: this.name,
      detected,
      installed,
      healthy: installed && (issues.length === 0 || !detected),
      instructionFile: 'GEMINI.md',
      mcpConfigFile: '.gemini/settings.json',
      issues
    };
  }
}
