import { AgentIntegration, IntegrationContext, IntegrationStatus } from './agent.js';
import { AgentDetector } from './detector.js';

export interface UpdateSummary {
  updated: AgentIntegration[];
  statuses: IntegrationStatus[];
}

export class AgentUpdater {
  constructor(private detector: AgentDetector = new AgentDetector()) { }

  async update(ctx: IntegrationContext): Promise<UpdateSummary> {
    const all = this.detector.getAllIntegrations();
    const updated: AgentIntegration[] = [];
    const statuses: IntegrationStatus[] = [];

    for (const integration of all) {
      const isDetected = await integration.detect(ctx.rootDir);
      if (isDetected) {
        await integration.update(ctx);
        updated.push(integration);
        const status = await integration.validate(ctx);
        statuses.push(status);
      }
    }

    return {
      updated,
      statuses
    };
  }
}
