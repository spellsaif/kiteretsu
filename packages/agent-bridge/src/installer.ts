import { AgentIntegration, IntegrationContext, IntegrationStatus } from './agent.js';
import { AgentDetector } from './detector.js';

export interface InstallSummary {
  installed: AgentIntegration[];
  statuses: IntegrationStatus[];
}

export class AgentInstaller {
  constructor(private detector: AgentDetector = new AgentDetector()) { }

  async install(ctx: IntegrationContext, integrationIds?: string[]): Promise<InstallSummary> {
    let targets: AgentIntegration[];

    if (integrationIds && integrationIds.length > 0) {
      targets = this.detector.getAllIntegrations().filter(i => integrationIds.includes(i.id));
    } else {
      targets = await this.detector.detect(ctx.rootDir);
    }

    const statuses: IntegrationStatus[] = [];
    const installed: AgentIntegration[] = [];

    for (const integration of targets) {
      await integration.install(ctx);
      installed.push(integration);
      const status = await integration.validate(ctx);
      statuses.push(status);
    }

    return {
      installed,
      statuses
    };
  }
}
