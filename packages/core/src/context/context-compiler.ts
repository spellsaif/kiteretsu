import path from 'path';
import { HybridRetriever } from '../retrieval/hybrid.js';
import { RuleStore } from '../memory/rules.js';
import { TaskStore } from '../memory/tasks.js';
import { DecisionStore } from '../memory/decisions.js';
import { CodeAnalyzer } from '../analyzer.js';
import { matchesRuleScope } from './scope-matcher.js';
import { ContextBudgetOptimizer, ContextFileItem } from './budget.js';

export interface ContextPackOptions {
  budgetTokens?: number;
}

export interface ContextPackResult {
  task: string;
  strategy: string;
  confidence: number;
  read_first: ContextFileItem[];
  optional_read: ContextFileItem[];
  blast_radius: string[];
  tests_to_run: string[];
  rules: string[];
  decisions?: Array<{ title: string; rationale: string; affected_paths?: string[] }>;
  past_tasks?: Array<{ description: string; outcome?: string; notes?: string }>;
  warnings: string[];
}

export class ContextCompiler {
  private budgetOptimizer: ContextBudgetOptimizer;

  constructor(
    private rootDir: string,
    private retriever: HybridRetriever,
    private ruleStore: RuleStore,
    private getAnalyzer: () => Promise<CodeAnalyzer>,
    private taskStore?: TaskStore,
    private decisionStore?: DecisionStore
  ) {
    this.budgetOptimizer = new ContextBudgetOptimizer(rootDir);
  }

  async compile(task: string, options?: ContextPackOptions): Promise<ContextPackResult> {
    const budgetTokens = options?.budgetTokens ?? 8000;
    const warnings: string[] = [];

    // 1. Pre-fetch decisions for memory matching
    const allDecisions = this.decisionStore ? await this.decisionStore.getAllDecisions() : [];
    const affectedPaths = allDecisions.flatMap(d => d.affected_paths || []);

    // 2. Multi-sensor retrieval
    const { candidates, keywords, semanticDegraded } = await this.retriever.retrieveCandidates(
      task,
      10,
      { affectedPaths }
    );

    if (keywords.length === 0) {
      return {
        task,
        strategy: 'No actionable keywords found.',
        confidence: 0.0,
        read_first: [],
        blast_radius: [],
        tests_to_run: [],
        optional_read: [],
        rules: [],
        decisions: [],
        past_tasks: [],
        warnings: ['Task description too short.']
      };
    }

    if (candidates.length === 0) {
      return {
        task,
        strategy: 'No relevant files found.',
        confidence: 0.0,
        read_first: [],
        blast_radius: [],
        tests_to_run: [],
        optional_read: [],
        rules: [],
        decisions: [],
        past_tasks: [],
        warnings: []
      };
    }

    // 3. Intelligence Accretion (Blast Radius + Tests)
    const analyzer = await this.getAnalyzer();
    const blastRadiusFiles = new Set<string>();
    const testsToRun = new Set<string>();
    const codeExts = ['.ts', '.tsx', '.js', '.jsx', '.py', '.rs', '.go', '.java', '.kt', '.cpp', '.h', '.cs'];

    for (const f of candidates) {
      const fullPath = path.resolve(this.rootDir, f.path);
      const fileExt = path.extname(f.path).toLowerCase();

      if (!codeExts.includes(fileExt)) continue;

      const radius = await analyzer.getBlastRadius(fullPath);
      radius.forEach(r => {
        const rel = r.startsWith('UNRESOLVABLE: ')
          ? `UNRESOLVABLE: ${path.relative(this.rootDir, r.slice('UNRESOLVABLE: '.length)).replace(/\\/g, '/')}`
          : path.relative(this.rootDir, r).replace(/\\/g, '/');
        blastRadiusFiles.add(rel);
      });

      const tests = await analyzer.getRelatedTests(fullPath);
      tests.forEach(t => testsToRun.add(path.relative(this.rootDir, t).replace(/\\/g, '/')));
    }

    // 4. Rule Scope Evaluation
    const allRules = await this.ruleStore.getAllRules();
    const candidatePaths = candidates.map(c => c.path);
    const matchedRules = allRules.filter(r => matchesRuleScope(r, candidatePaths));

    // 5. Retrieve Relevant Decisions & Similar Historical Tasks
    const [relevantDecisions, similarTasks] = await Promise.all([
      this.decisionStore ? this.decisionStore.getRelevantDecisions(task, candidatePaths, 3) : Promise.resolve([]),
      this.taskStore ? this.taskStore.getSimilarTasks(task, 3) : Promise.resolve([])
    ]);

    if (candidates.some(f => f.stale)) {
      warnings.push("Codebase index is stale. Run 'kiteretsu index' to refresh.");
    }
    if (semanticDegraded) {
      warnings.push('Semantic embedding search is degraded. Fallback to lexical and graph ranking active.');
    }

    // 6. Token Budget Allocation
    const rulesOutput = matchedRules.map(r => `${r.name}: ${r.description}`);
    const decisionsOutput = relevantDecisions.map(d => ({
      title: d.title,
      rationale: d.rationale,
      affected_paths: d.affected_paths
    }));
    const pastTasksOutput = similarTasks.map(t => ({
      description: t.description,
      outcome: t.outcome,
      notes: t.notes
    }));

    const rulesTokens = Math.ceil(rulesOutput.join('\n').length / 4);
    const testsTokens = Math.ceil(Array.from(testsToRun).join('\n').length / 4);
    const blastTokens = Math.ceil(Array.from(blastRadiusFiles).join('\n').length / 4);
    const memoryTokens = Math.ceil(JSON.stringify(decisionsOutput).length / 4) + Math.ceil(JSON.stringify(pastTasksOutput).length / 4);
    const metadataTokens = Math.ceil((task.length + 120) / 4) + rulesTokens + testsTokens + blastTokens + memoryTokens;

    const allocation = await this.budgetOptimizer.allocateCandidates(candidates, budgetTokens, metadataTokens);
    const overallConfidence = candidates.length > 0 ? candidates[0].confidence : 0.5;

    return {
      task,
      strategy: `Context centered on ${candidates[0].path.split('/').pop()}`,
      confidence: overallConfidence,
      read_first: allocation.readFirst,
      blast_radius: Array.from(blastRadiusFiles).slice(0, 10),
      tests_to_run: Array.from(testsToRun).slice(0, 5),
      optional_read: allocation.optionalRead,
      rules: rulesOutput,
      decisions: decisionsOutput,
      past_tasks: pastTasksOutput,
      warnings
    };
  }
}
