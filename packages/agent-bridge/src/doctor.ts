import { IntegrationContext, IntegrationStatus } from './agent.js';
import { AgentDetector } from './detector.js';

export interface DoctorReport {
  overallHealthy: boolean;
  statuses: IntegrationStatus[];
  summary: {
    totalChecked: number;
    healthyCount: number;
    issueCount: number;
  };
}

export class AgentDoctor {
  constructor(private detector: AgentDetector = new AgentDetector()) { }

  async diagnose(ctx: IntegrationContext): Promise<DoctorReport> {
    const integrations = this.detector.getAllIntegrations();
    const statuses: IntegrationStatus[] = [];
    let issueCount = 0;
    let healthyCount = 0;

    for (const integration of integrations) {
      const isDetected = await integration.detect(ctx.rootDir);
      if (isDetected) {
        const status = await integration.validate(ctx);
        statuses.push(status);
        if (status.healthy) {
          healthyCount++;
        } else {
          issueCount += status.issues.length;
        }
      }
    }

    return {
      overallHealthy: issueCount === 0,
      statuses,
      summary: {
        totalChecked: statuses.length,
        healthyCount,
        issueCount
      }
    };
  }
}
