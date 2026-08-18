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

export class CopilotIntegration implements AgentIntegration {
  readonly id = 'copilot';
  readonly name = 'GitHub Copilot';

  async detect(root: string): Promise<boolean> {
    const copilotMd = path.join(root, '.github', 'copilot-instructions.md');
    const githubDir = path.join(root, '.github');
    return (
      (await fs.pathExists(copilotMd)) ||
      (await fs.pathExists(githubDir)) ||
      !!process.env.GITHUB_COPILOT
    );
  }

  async install(ctx: IntegrationContext): Promise<void> {
    const githubDir = path.join(ctx.rootDir, '.github');
    await fs.ensureDir(githubDir);
    const instructionPath = path.join(githubDir, 'copilot-instructions.md');

    let existingContent = '';
    if (await fs.pathExists(instructionPath)) {
      existingContent = await fs.readFile(instructionPath, 'utf8');
    }

    const instructions = getStandardAgentInstructions(this.name);
    const updatedContent = injectManagedSection(existingContent, instructions);
    await fs.writeFile(instructionPath, updatedContent, 'utf8');
  }

  async update(ctx: IntegrationContext): Promise<void> {
    return this.install(ctx);
  }

  async remove(ctx: IntegrationContext): Promise<void> {
    const instructionPath = path.join(ctx.rootDir, '.github', 'copilot-instructions.md');
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
    const instructionPath = path.join(ctx.rootDir, '.github', 'copilot-instructions.md');

    const detected = await this.detect(ctx.rootDir);
    let installed = false;

    if (await fs.pathExists(instructionPath)) {
      const content = await fs.readFile(instructionPath, 'utf8');
      if (extractManagedSection(content)) {
        installed = true;
      } else {
        issues.push('.github/copilot-instructions.md exists but is missing the managed Kiteretsu section.');
      }
    }

    return {
      id: this.id,
      name: this.name,
      detected,
      installed,
      healthy: installed && issues.length === 0,
      instructionFile: '.github/copilot-instructions.md',
      issues
    };
  }
}
