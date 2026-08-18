import { describe, it, expect } from 'vitest';
import { AgentDetector, AgentSelector } from '../src/index.js';

describe('AgentSelector Architecture & Flags Suite', () => {
  const detector = new AgentDetector();
  const allIntegrations = detector.getAllIntegrations();
  const detectedNone: any[] = [];
  const detectedCodexAndCopilot = allIntegrations.filter(i => i.id === 'codex' || i.id === 'copilot');

  it('proposes all integrations with detected ones pre-selected', () => {
    const proposals = AgentSelector.propose(allIntegrations, detectedCodexAndCopilot);
    expect(proposals.length).toBe(7);

    const codex = proposals.find(p => p.id === 'codex');
    expect(codex?.detected).toBe(true);
    expect(codex?.selectedByDefault).toBe(true);

    const copilot = proposals.find(p => p.id === 'copilot');
    expect(copilot?.detected).toBe(true);
    expect(copilot?.selectedByDefault).toBe(true);

    const claude = proposals.find(p => p.id === 'claude');
    expect(claude?.detected).toBe(false);
    expect(claude?.selectedByDefault).toBe(false);
  });

  it('proposes generic pre-selected when no specific agents are detected', () => {
    const proposals = AgentSelector.propose(allIntegrations, detectedNone);
    const generic = proposals.find(p => p.id === 'generic');
    expect(generic?.selectedByDefault).toBe(true);
  });

  it('--no-agent returns empty array and skips all bridges', () => {
    const selected = AgentSelector.resolveExplicit({ noAgent: true }, allIntegrations, detectedCodexAndCopilot);
    expect(selected).toEqual([]);
  });

  it('--all returns all integrations', () => {
    const selected = AgentSelector.resolveExplicit({ all: true }, allIntegrations, detectedCodexAndCopilot);
    expect(selected).toEqual(allIntegrations.map(i => i.id));
    expect(selected?.length).toBe(7);
  });

  it('--agent <names...> returns explicitly requested agents', () => {
    const selected = AgentSelector.resolveExplicit(
      { agent: ['claude', 'gemini'] },
      allIntegrations,
      detectedCodexAndCopilot
    );
    expect(selected).toEqual(['claude', 'gemini']);
  });

  it('--non-interactive with detected agents returns detected', () => {
    const selected = AgentSelector.resolveExplicit(
      { nonInteractive: true },
      allIntegrations,
      detectedCodexAndCopilot
    );
    expect(selected).toEqual(['codex', 'copilot']);
  });

  it('--non-interactive with no detected agents returns generic', () => {
    const selected = AgentSelector.resolveExplicit(
      { nonInteractive: true },
      allIntegrations,
      detectedNone
    );
    expect(selected).toEqual(['generic']);
  });

  it('standard interactive invocation returns null to prompt user', () => {
    const selected = AgentSelector.resolveExplicit({}, allIntegrations, detectedCodexAndCopilot);
    expect(selected).toBeNull();
  });
});
