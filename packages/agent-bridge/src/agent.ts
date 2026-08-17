export const KITERETSU_SECTION_START = '<!-- KITERETSU:START -->';
export const KITERETSU_SECTION_END = '<!-- KITERETSU:END -->';

export interface IntegrationContext {
  rootDir: string;
  mcpCommand?: string;
  mcpArgs?: string[];
  mcpEnv?: Record<string, string>;
}

export interface IntegrationStatus {
  id: string;
  name: string;
  detected: boolean;
  installed: boolean;
  healthy: boolean;
  instructionFile?: string;
  mcpConfigFile?: string;
  issues: string[];
}

export interface AgentIntegration {
  id: string;
  name: string;
  detect(root: string): Promise<boolean>;
  install(ctx: IntegrationContext): Promise<void>;
  update(ctx: IntegrationContext): Promise<void>;
  remove(ctx: IntegrationContext): Promise<void>;
  validate(ctx: IntegrationContext): Promise<IntegrationStatus>;
}

/**
 * Safely injects or updates a managed Kiteretsu block inside an existing instruction file.
 * Preserves all user customizations outside the managed boundaries.
 */
export function injectManagedSection(existingContent: string, sectionBody: string): string {
  const managedBlock = `${KITERETSU_SECTION_START}\n${sectionBody.trim()}\n${KITERETSU_SECTION_END}`;

  const startIndex = existingContent.indexOf(KITERETSU_SECTION_START);
  const endIndex = existingContent.indexOf(KITERETSU_SECTION_END);

  if (startIndex !== -1 && endIndex !== -1 && endIndex >= startIndex) {
    const before = existingContent.slice(0, startIndex);
    const after = existingContent.slice(endIndex + KITERETSU_SECTION_END.length);
    return `${before}${managedBlock}${after}`;
  }

  if (existingContent.trim().length === 0) {
    return `${managedBlock}\n`;
  }

  return `${existingContent.trim()}\n\n${managedBlock}\n`;
}

/**
 * Extracts the contents of the managed Kiteretsu section if present.
 */
export function extractManagedSection(content: string): string | null {
  const startIndex = content.indexOf(KITERETSU_SECTION_START);
  const endIndex = content.indexOf(KITERETSU_SECTION_END);

  if (startIndex !== -1 && endIndex !== -1 && endIndex >= startIndex) {
    return content.slice(startIndex + KITERETSU_SECTION_START.length, endIndex).trim();
  }
  return null;
}

/**
 * Canonical, compact agent instructions to minimize prompt bloat.
 */
export function getStandardAgentInstructions(agentName: string = 'Agent'): string {
  return [
    `# Kiteretsu Intelligence Bridge (${agentName})`,
    '',
    'This repository uses Kiteretsu to maintain a continuous Code Intelligence Graph and Memory Layer.',
    '',
    '## 🧭 Behavioral Protocol',
    '1. **Context First**: Before planning or making changes, query Kiteretsu for relevant context, symbols, and blast radius:',
    '   - Use MCP tool `kiteretsu_context` (or CLI `kiteretsu context "<task>"`)',
    '   - Read the recommended `read_first` files and obey scoped architectural rules.',
    '2. **Check Blast Radius**: Before high-impact refactors, inspect callers & callees with `kiteretsu_blast_radius`.',
    '3. **Verify**: Run related tests suggested by `kiteretsu_tests` or `kiteretsu context`.',
    '4. **Preserve Decisions**: After significant architectural changes, record the rationale in Kiteretsu via `kiteretsu_record_decision` or `kiteretsu record-decision`.',
    '5. **Record Outcome**: After completing a task, record the result with `kiteretsu_record_task` to enrich repository memory.'
  ].join('\n');
}
