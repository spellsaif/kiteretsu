import { AgentIntegration } from './agent.js';
import { ClaudeIntegration } from './claude.js';
import { GeminiIntegration } from './gemini.js';
import { OpenCodeIntegration } from './opencode.js';
import { CursorIntegration } from './cursor.js';
import { CodexIntegration } from './codex.js';
import { CopilotIntegration } from './copilot.js';
import { GenericIntegration } from './generic.js';

export class AgentDetector {
  private integrations: AgentIntegration[];

  constructor(integrations?: AgentIntegration[]) {
    this.integrations = integrations || [
      new ClaudeIntegration(),
      new GeminiIntegration(),
      new OpenCodeIntegration(),
      new CursorIntegration(),
      new CodexIntegration(),
      new CopilotIntegration(),
      new GenericIntegration()
    ];
  }

  getAllIntegrations(): AgentIntegration[] {
    return this.integrations;
  }

  getIntegration(id: string): AgentIntegration | undefined {
    return this.integrations.find(i => i.id === id);
  }

  async detect(rootDir: string): Promise<AgentIntegration[]> {
    const detected: AgentIntegration[] = [];
    for (const integration of this.integrations) {
      if (await integration.detect(rootDir)) {
        detected.push(integration);
      }
    }
    return detected;
  }
}
