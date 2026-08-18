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
    const opencodeJson = path.join(root, 'opencode.json');
    const opencodeDir = path.join(root, '.opencode');
    const opencodeMd = path.join(root, 'OPENCODE.md');
    return (
      (await fs.pathExists(opencodeJson)) ||
      (await fs.pathExists(opencodeDir)) ||
      (await fs.pathExists(opencodeMd)) ||
      !!process.env.OPENCODE
    );
  }

  async install(ctx: IntegrationContext): Promise<void> {
    // 1. Manage canonical project instructions in AGENTS.md
    const instructionPath = path.join(ctx.rootDir, 'AGENTS.md');
    let existingContent = '';
    if (await fs.pathExists(instructionPath)) {
      existingContent = await fs.readFile(instructionPath, 'utf8');
    }

    const instructions = getStandardAgentInstructions(this.name);
    const updatedContent = injectManagedSection(existingContent, instructions);
    await fs.writeFile(instructionPath, updatedContent, 'utf8');

    // 2. Configure MCP server in opencode.json
    const opencodeJsonPath = path.join(ctx.rootDir, 'opencode.json');
    let opencodeConfig: any = {};
    if (await fs.pathExists(opencodeJsonPath)) {
      try {
        opencodeConfig = await fs.readJson(opencodeJsonPath);
      } catch { }
    }

    if (!opencodeConfig.mcp) {
      opencodeConfig.mcp = {};
    }
    if (!opencodeConfig.mcp.servers) {
      opencodeConfig.mcp.servers = {};
    }

    const commandList = [
      ctx.mcpCommand || 'npx',
      ...(ctx.mcpArgs || ['-y', '@spellsaif/kiteretsu-mcp-server'])
    ];

    opencodeConfig.mcp.servers.kiteretsu = {
      type: 'local',
      command: commandList,
      ...(ctx.mcpEnv && Object.keys(ctx.mcpEnv).length > 0 ? { environment: ctx.mcpEnv } : {})
    };

    await fs.writeJson(opencodeJsonPath, opencodeConfig, { spaces: 2 });

    // 3. If .opencode directory exists, also provide agent definition in .opencode/agents/kiteretsu-context.md
    const opencodeDir = path.join(ctx.rootDir, '.opencode');
    if (await fs.pathExists(opencodeDir)) {
      const agentsDir = path.join(opencodeDir, 'agents');
      await fs.ensureDir(agentsDir);
      const agentFile = path.join(agentsDir, 'kiteretsu-context.md');
      await fs.writeFile(
        agentFile,
        `---\ndescription: Kiteretsu Context and Repository Intelligence Agent\n---\n\n${instructions}\n`,
        'utf8'
      );
    }
  }

  async update(ctx: IntegrationContext): Promise<void> {
    return this.install(ctx);
  }

  async remove(ctx: IntegrationContext): Promise<void> {
    // Remove MCP config from opencode.json
    const opencodeJsonPath = path.join(ctx.rootDir, 'opencode.json');
    if (await fs.pathExists(opencodeJsonPath)) {
      try {
        const config = await fs.readJson(opencodeJsonPath);
        if (config.mcp?.servers?.kiteretsu) {
          delete config.mcp.servers.kiteretsu;
          if (Object.keys(config.mcp.servers).length === 0) {
            delete config.mcp.servers;
          }
          if (Object.keys(config.mcp).length === 0) {
            delete config.mcp;
          }
          if (Object.keys(config).length === 0) {
            await fs.remove(opencodeJsonPath);
          } else {
            await fs.writeJson(opencodeJsonPath, config, { spaces: 2 });
          }
        }
      } catch { }
    }

    // Remove managed section from AGENTS.md
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

    // Remove agent file if created
    const agentFile = path.join(ctx.rootDir, '.opencode', 'agents', 'kiteretsu-context.md');
    if (await fs.pathExists(agentFile)) {
      await fs.remove(agentFile);
    }
  }

  async validate(ctx: IntegrationContext): Promise<IntegrationStatus> {
    const issues: string[] = [];
    const instructionPath = path.join(ctx.rootDir, 'AGENTS.md');
    const opencodeJsonPath = path.join(ctx.rootDir, 'opencode.json');

    const detected = await this.detect(ctx.rootDir);
    let installed = false;
    let healthy = false;

    if (await fs.pathExists(instructionPath)) {
      const content = await fs.readFile(instructionPath, 'utf8');
      if (extractManagedSection(content)) {
        installed = true;
      } else {
        issues.push('AGENTS.md exists but is missing the managed Kiteretsu section.');
      }
    }

    if (await fs.pathExists(opencodeJsonPath)) {
      try {
        const config = await fs.readJson(opencodeJsonPath);
        if (config.mcp?.servers?.kiteretsu || config.mcp?.kiteretsu) {
          healthy = installed && issues.length === 0;
        } else {
          issues.push('opencode.json is missing mcp.servers.kiteretsu configuration.');
        }
      } catch {
        issues.push('opencode.json is invalid JSON.');
      }
    }

    return {
      id: this.id,
      name: this.name,
      detected,
      installed,
      healthy: installed && (issues.length === 0 || !detected),
      instructionFile: 'AGENTS.md',
      mcpConfigFile: 'opencode.json',
      issues
    };
  }
}
