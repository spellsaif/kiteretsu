import { AgentIntegration } from './agent.js';

export interface AgentSelectionOptions {
  agent?: string[];
  all?: boolean;
  noAgent?: boolean;
  nonInteractive?: boolean;
}

export interface AgentProposal {
  id: string;
  name: string;
  detected: boolean;
  selectedByDefault: boolean;
}

export class AgentSelector {
  /**
   * Generates a proposal of integrations with detected ones marked as selected by default.
   */
  static propose(allIntegrations: AgentIntegration[], detected: AgentIntegration[]): AgentProposal[] {
    const detectedIds = new Set(detected.map(d => d.id));
    return allIntegrations.map(integration => ({
      id: integration.id,
      name: integration.name,
      detected: detectedIds.has(integration.id),
      selectedByDefault: detectedIds.has(integration.id) || (detected.length === 0 && integration.id === 'generic')
    }));
  }

  /**
   * Resolves explicit CLI flags without requiring interactive selection.
   * Returns null if interactive selection should proceed.
   */
  static resolveExplicit(
    options: AgentSelectionOptions,
    allIntegrations: AgentIntegration[],
    detected: AgentIntegration[]
  ): string[] | null {
    if (options.noAgent) {
      return [];
    }
    if (options.all) {
      return allIntegrations.map(i => i.id);
    }
    if (options.agent && options.agent.length > 0) {
      return options.agent;
    }
    if (options.nonInteractive) {
      return detected.length > 0 ? detected.map(d => d.id) : ['generic'];
    }
    return null;
  }
}
