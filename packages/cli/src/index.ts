#!/usr/bin/env node
import { Command } from 'commander';
import chalk from 'chalk';
import ora from 'ora';
import cliProgress from 'cli-progress';
import boxen from 'boxen';
import gradient from 'gradient-string';
import { Kiteretsu, loadProjectConfigSync, createDefaultConfigFile } from '@spellsaif/kiteretsu-core';
import { CodeWatcher } from '@spellsaif/kiteretsu-core/watcher.js';
import {
  AgentDetector,
  AgentInstaller,
  AgentUpdater,
  AgentDoctor
} from '@spellsaif/kiteretsu-agent-bridge';
import path from 'path';
import fs from 'fs-extra';
import inquirer from 'inquirer';

const program = new Command();

const kiteretsuLogo = gradient.rainbow.multiline(
  `
  _  _____ _____ _____ ____  _____ _____ ____  _   _ 
 | |/ /_ _|_   _| ____|  _ \\| ____|_   _/ ___|| | | |
 | ' / | |  | | |  _| | |_) |  _|   | | \\___ \\| | | |
 | . \\ | |  | | | |___|  _ <| |___  | |  ___) | |_| |
 |_|\\_\\___| |_| |_____|_| \\_\\_____| |_| |____/ \\___/ 
`
);

function findWorkspaceRoot(startDir: string): string {
  let current = startDir;
  while (current !== path.parse(current).root) {
    if (
      fs.existsSync(path.join(current, 'pnpm-workspace.yaml')) ||
      fs.existsSync(path.join(current, '.git')) ||
      fs.existsSync(path.join(current, 'package.json')) && !current.includes('packages' + path.sep)
    ) {
      return current;
    }
    const parent = path.dirname(current);
    if (parent === current) break;
    current = parent;
  }
  return startDir;
}

export { defineConfig, loadProjectConfig, loadProjectConfigSync, createDefaultConfigFile } from '@spellsaif/kiteretsu-core';

const rootDir = findWorkspaceRoot(process.cwd());
const userConfig = loadProjectConfigSync(rootDir);
const config = { ...userConfig, rootDir };

let kiteretsuInstance: Kiteretsu | null = null;
function getKiteretsu() {
  if (!kiteretsuInstance) {
    kiteretsuInstance = new Kiteretsu(config);
  }
  return kiteretsuInstance;
}

console.log(kiteretsuLogo);
console.log(chalk.cyan('  Codebase Intelligence & Agent Memory Layer'));
console.log(chalk.gray(`  Root: ${rootDir}\n`));

program
  .name('kiteretsu')
  .description('Continuous Code Intelligence Graph and Memory Layer for AI coding agents')
  .version('0.1.0');

// ─── 1. INIT COMMAND (Primary Onboarding) ───
program
  .command('init')
  .description('One-command onboarding: detect repo, configure agents & MCP, initialize and index')
  .option('-a, --agent <agents...>', 'Specific agent integrations to configure (claude, gemini, opencode, cursor, codex, copilot, generic)')
  .option('--all', 'Configure all available agent integrations')
  .action(async (options) => {
    console.log(chalk.bold.cyan('🔍 Detecting environment & AI coding agents...\n'));
    const detector = new AgentDetector();
    let selectedAgentIds: string[] = [];

    if (options.all) {
      selectedAgentIds = detector.getAllIntegrations().map(i => i.id);
      console.log(chalk.bold('Configuring all integrations:'));
      detector.getAllIntegrations().forEach(d => console.log(chalk.green(`  ✓ ${d.name}`)));
    } else if (options.agent && options.agent.length > 0) {
      selectedAgentIds = options.agent;
      console.log(chalk.bold('Configuring specified integrations:'));
      selectedAgentIds.forEach(id => {
        const integ = detector.getIntegration(id);
        console.log(chalk.green(`  ✓ ${integ?.name || id}`));
      });
    } else {
      const detected = await detector.detect(rootDir);
      if (detected.length > 0) {
        console.log(chalk.bold('Detected:'));
        detected.forEach(d => console.log(chalk.green(`  ✓ ${d.name}`)));
        selectedAgentIds = detected.map(d => d.id);
      } else if (process.stdout.isTTY) {
        console.log(chalk.yellow('  ℹ No specific agent configuration detected.\n'));
        const answers = await inquirer.prompt([
          {
            type: 'checkbox',
            name: 'selectedAgents',
            message: 'Select AI coding agents to configure with Kiteretsu:',
            choices: detector.getAllIntegrations().map(i => ({
              name: i.name,
              value: i.id,
              checked: i.id === 'generic'
            }))
          }
        ]);
        selectedAgentIds = answers.selectedAgents.length > 0 ? answers.selectedAgents : ['generic'];
      } else {
        console.log(chalk.yellow('  ℹ No specific agent detected. Configuring universal AGENTS.md & MCP.'));
        selectedAgentIds = ['generic'];
      }
    }

    console.log(chalk.bold.cyan('\n⚙ Installing Kiteretsu Agent Bridge & MCP...'));
    const installer = new AgentInstaller(detector);
    const installResult = await installer.install({ rootDir }, selectedAgentIds);

    installResult.installed.forEach(i => {
      console.log(chalk.green(`  ✓ ${i.name} managed instructions`));
    });
    console.log(chalk.green('  ✓ MCP Server configuration'));

    // Option A: Explicitly ensure canonical kiteretsu.config.ts exists
    const tsConfigPath = path.join(rootDir, 'kiteretsu.config.ts');
    if (!fs.existsSync(tsConfigPath)) {
      await createDefaultConfigFile(rootDir);
      console.log(chalk.green('  ✓ Created canonical kiteretsu.config.ts'));
    }

    const spinner = ora('Initializing repository intelligence database...').start();
    try {
      await getKiteretsu().init();
      spinner.succeed(chalk.green('  ✓ Database and memory initialized'));
    } catch (e: any) {
      spinner.fail(chalk.red('Initialization failed: ' + e.message));
      process.exit(1);
    }

    console.log(chalk.bold.cyan('\n📦 Indexing repository...'));
    const progressBar = new cliProgress.SingleBar({
      format: chalk.cyan('  Indexing ') + '|' + chalk.cyan('{bar}') + '| {percentage}% | {message}',
      barCompleteChar: '\u2588',
      barIncompleteChar: '\u2591',
      hideCursor: true
    }, cliProgress.Presets.shades_classic);

    progressBar.start(100, 0, { message: 'Scanning...' });
    try {
      const stats = await getKiteretsu().index((current, total, message) => {
        progressBar.update(current, { message });
      });
      progressBar.update(100, { message: 'Complete!' });
      progressBar.stop();

      console.log('\n' + boxen(
        [
          chalk.bold.green('✨ Kiteretsu is ready!'),
          '',
          chalk.white(`Files indexed:    ${chalk.bold.cyan(String(stats.files))}`),
          chalk.white(`Symbols found:    ${chalk.bold.cyan(String(stats.symbols))}`),
          chalk.white(`Dependencies:     ${chalk.bold.cyan(String(stats.edges))}`),
          '',
          chalk.gray('Your AI coding agents now automatically query Kiteretsu before making changes.')
        ].join('\n'),
        { padding: 1, margin: 1, borderStyle: 'round', borderColor: 'green' }
      ));

      await getKiteretsu().destroy();
      process.exit(0);
    } catch (error: any) {
      progressBar.stop();
      console.error(chalk.red('\nIndexing failed: ' + error.message));
      await getKiteretsu().destroy();
      process.exit(1);
    }
  });

// ─── 2. BOOTSTRAP COMMAND (Mental Model) ───
program
  .command('bootstrap')
  .description('Generate initial mental model of repository architecture and central modules for agents')
  .action(async () => {
    const spinner = ora('Compiling repository mental model...').start();
    try {
      const summary = await getKiteretsu().getBootstrapSummary();
      spinner.stop();

      console.log(chalk.bold.underline('\n🧠 Repository Mental Model & Orientation\n'));

      console.log(chalk.bold.cyan('📊 Repository Scale:'));
      console.log(chalk.white(`  Files:            ${chalk.bold(summary.repository.totalFiles)}`));
      console.log(chalk.white(`  Symbols:          ${chalk.bold(summary.repository.totalSymbols)}`));
      console.log(chalk.white(`  Dependencies:     ${chalk.bold(summary.repository.totalDependencies)}`));
      console.log(chalk.white(`  Index Confidence: ${chalk.bold.green(summary.indexConfidence + '%')}`));

      if (summary.architecture.length > 0) {
        console.log(chalk.bold.cyan('\n🏛 Architectural Layers:'));
        summary.architecture.forEach(layer => {
          console.log(chalk.white(`  • ${layer}`));
        });
      }

      if (summary.centralModules.length > 0) {
        console.log(chalk.bold.cyan('\n⭐ Central Core Modules (High In-Degree):'));
        summary.centralModules.forEach(m => {
          console.log(chalk.white(`  - ${chalk.bold(m.path)} ${chalk.gray(`(${m.inDegree} dependents)`)}`));
        });
      }

      if (summary.importantDecisions.length > 0) {
        console.log(chalk.bold.cyan('\n💡 Active Architectural Decisions (ADRs):'));
        summary.importantDecisions.forEach(d => {
          console.log(chalk.white(`  • ${chalk.bold(d.title)}`));
          console.log(chalk.gray(`    ${d.rationale}`));
        });
      }

      if (summary.governanceRules.length > 0) {
        console.log(chalk.bold.cyan('\n📏 Governance Rules:'));
        summary.governanceRules.forEach(r => {
          console.log(chalk.white(`  - ${chalk.bold(r.name)}: ${r.description}`));
        });
      }

      console.log('');
      await getKiteretsu().destroy();
      return;
    } catch (e: any) {
      spinner.fail(chalk.red('Failed to compile bootstrap summary: ' + e.message));
      process.exitCode = 1;
    }
  });

// ─── 3. DOCTOR COMMAND (Diagnostics) ───
program
  .command('doctor')
  .description('Run comprehensive health check across index, graph, embeddings, memory, and agent bridges')
  .action(async () => {
    console.log(chalk.bold.cyan('🩺 Running Kiteretsu Diagnostics...\n'));

    try {
      const diag = await getKiteretsu().runDiagnostics();
      const agentDoctor = new AgentDoctor();
      const agentReport = await agentDoctor.diagnose({ rootDir });

      console.log(diag.databaseIntegrity ? chalk.green('✓ SQLite Database Integrity: Healthy') : chalk.red('✗ SQLite Database Integrity: Failed'));
      console.log(diag.index.healthy ? chalk.green(`✓ Index: ${diag.index.totalFiles} files indexed`) : chalk.yellow(`⚠ Index: ${diag.index.staleFiles.length} stale files`));
      console.log(diag.graph.healthy ? chalk.green(`✓ Code Graph: ${diag.graph.totalEdges} dependency & symbol edges`) : chalk.yellow('⚠ Code Graph: No edges found'));
      console.log(chalk.green(`✓ Embeddings: ${diag.embeddings.provider}`));
      console.log(chalk.green(`✓ Memory: ${diag.memory.decisionsCount} ADRs, ${diag.memory.rulesCount} Rules, ${diag.memory.tasksCount} Task logs`));

      console.log(chalk.bold.cyan('\n🤖 Agent Integrations:'));
      if (agentReport.statuses.length === 0) {
        console.log(chalk.gray('  No agent integrations detected. Run `kiteretsu init` to set them up.'));
      } else {
        agentReport.statuses.forEach(s => {
          if (s.healthy) {
            console.log(chalk.green(`  ✓ ${s.name} integration: Healthy`));
          } else {
            console.log(chalk.yellow(`  ⚠ ${s.name} issues: ${s.issues.join(', ')}`));
          }
        });
      }

      console.log('');
      await getKiteretsu().destroy();
    } catch (e: any) {
      console.error(chalk.red('Doctor check failed: ' + e.message));
      process.exitCode = 1;
    }
  });

// ─── 4. SYNC COMMAND (Maintenance) ───
program
  .command('sync')
  .description('Update managed agent instruction sections and refresh MCP configurations')
  .action(async () => {
    const spinner = ora('Syncing agent integrations...').start();
    try {
      const updater = new AgentUpdater();
      const result = await updater.update({ rootDir });
      spinner.succeed(chalk.green('✨ Agent integrations synchronized successfully!'));

      result.updated.forEach(u => {
        console.log(chalk.green(`  ✓ Synced ${u.name}`));
      });

      console.log('');
      await getKiteretsu().destroy();
    } catch (e: any) {
      spinner.fail(chalk.red('Sync failed: ' + e.message));
      process.exitCode = 1;
    }
  });

// ─── 5. EXPLAIN COMMAND (Deep Reasoning) ───
program
  .command('explain <target>')
  .description('Explain why a file or symbol is designed the way it is, combining source, graph, ADRs, and tests')
  .action(async (target) => {
    const spinner = ora(`Analyzing target: "${target}"...`).start();
    try {
      const result = await getKiteretsu().explain(target);
      spinner.stop();

      console.log(chalk.bold.underline(`\n🔍 Architecture & Design Explanation for "${target}"\n`));
      console.log(chalk.bold.cyan('Summary:'));
      console.log(chalk.white(`  ${result.summary}`));

      if (result.symbols && result.symbols.length > 0) {
        console.log(chalk.bold.cyan('\nDeclared Symbols:'));
        result.symbols.forEach(s => console.log(chalk.white(`  • ${s.type} ${chalk.bold(s.name)}`)));
      }

      if (result.callers && result.callers.length > 0) {
        console.log(chalk.bold.cyan('\nInbound Callers:'));
        result.callers.forEach(c => console.log(chalk.white(`  ← ${chalk.bold(c.callerName)} in ${c.callerFile} (${c.relation})`)));
      }

      if (result.callees && result.callees.length > 0) {
        console.log(chalk.bold.cyan('\nOutbound Callees:'));
        result.callees.forEach(c => console.log(chalk.white(`  → ${chalk.bold(c.calleeName)} in ${c.calleeFile} (${c.relation})`)));
      }

      if (result.dependencies && result.dependencies.length > 0) {
        console.log(chalk.bold.cyan('\nDependencies (Imports):'));
        result.dependencies.forEach(d => console.log(chalk.white(`  → ${d.target}`)));
      }

      if (result.consumers && result.consumers.length > 0) {
        console.log(chalk.bold.cyan('\nConsumers (Imported By):'));
        result.consumers.forEach(c => console.log(chalk.white(`  ← ${c.source}`)));
      }

      if (result.decisions && result.decisions.length > 0) {
        console.log(chalk.bold.cyan('\n💡 Applicable Architectural Decisions:'));
        result.decisions.forEach(d => console.log(chalk.white(`  • ${chalk.bold(d.title)}: ${d.rationale}`)));
      }

      if (result.rules && result.rules.length > 0) {
        console.log(chalk.bold.cyan('\n📏 Applicable Rules:'));
        result.rules.forEach(r => console.log(chalk.white(`  - ${r}`)));
      }

      if (result.tests && result.tests.length > 0) {
        console.log(chalk.bold.cyan('\n🧪 Related Tests:'));
        result.tests.forEach(t => console.log(chalk.white(`  ✓ ${t}`)));
      }

      console.log('');
      await getKiteretsu().destroy();
    } catch (e: any) {
      spinner.fail(chalk.red('Explanation failed: ' + e.message));
      process.exitCode = 1;
    }
  });

// ─── 6. BLAST RADIUS COMMAND ───
program
  .command('blast-radius <target>')
  .description('Compute risk rating and downstream impact before modifying a file or symbol')
  .action(async (target) => {
    const spinner = ora(`Computing blast radius for: "${target}"...`).start();
    try {
      const radius = await getKiteretsu().getDetailedBlastRadius(target);
      spinner.stop();

      const riskColor = radius.riskLevel === 'HIGH' ? chalk.bold.red : (radius.riskLevel === 'MEDIUM' ? chalk.bold.yellow : chalk.bold.green);

      console.log(chalk.bold.underline(`\n💥 Blast Radius Analysis: ${target}\n`));
      console.log(chalk.white(`Risk Level:           ${riskColor(radius.riskLevel)}`));
      console.log(chalk.white(`Direct Dependents:    ${chalk.bold(String(radius.directCallersCount))}`));
      console.log(chalk.white(`Indirect Dependents:  ${chalk.bold(String(radius.indirectCallersCount))}`));
      console.log(chalk.white(`Related Tests:        ${chalk.bold(String(radius.testsToRun.length))}`));

      if (radius.directCallers.length > 0) {
        console.log(chalk.bold.cyan('\nDirect Callers / Importers:'));
        radius.directCallers.slice(0, 10).forEach(d => {
          const label = d.name ? `${d.name} (${d.file})` : d.file;
          console.log(chalk.yellow(`  ⚡ ${label}`));
        });
      }

      if (radius.testsToRun.length > 0) {
        console.log(chalk.bold.green('\nTests to Run:'));
        radius.testsToRun.slice(0, 8).forEach(t => console.log(chalk.white(`  ✓ ${t}`)));
      }

      if (radius.affectedADRs.length > 0) {
        console.log(chalk.bold.cyan('\nAffected ADRs:'));
        radius.affectedADRs.forEach(d => console.log(chalk.white(`  • ${d.title}`)));
      }

      console.log('');
      await getKiteretsu().destroy();
    } catch (e: any) {
      spinner.fail(chalk.red('Blast radius computation failed: ' + e.message));
      process.exitCode = 1;
    }
  });

// ─── 7. RECORD COMMAND (Post-Change Workflow) ───
program
  .command('record')
  .description('Analyze git changes, identify affected tests & ADRs, and record task outcome')
  .action(async () => {
    console.log(chalk.bold.cyan('🔍 Analyzing git changes...\n'));
    try {
      const gitAnalysis = await getKiteretsu().analyzeGitChanges();
      if (gitAnalysis.changedFiles.length === 0) {
        console.log(chalk.gray('No uncommitted changes detected in git workspace.'));
        await getKiteretsu().destroy();
        return;
      }

      console.log(chalk.bold('Changed Files:'));
      gitAnalysis.changedFiles.forEach(f => console.log(chalk.white(`  • ${f}`)));

      if (gitAnalysis.relatedTests.length > 0) {
        console.log(chalk.bold.green('\nRecommended Tests to Run:'));
        gitAnalysis.relatedTests.forEach(t => console.log(chalk.white(`  ✓ ${t}`)));
      }

      if (gitAnalysis.affectedADRs.length > 0) {
        console.log(chalk.bold.cyan('\nAffected Architectural Decisions:'));
        gitAnalysis.affectedADRs.forEach(d => console.log(chalk.white(`  💡 ${d.title}`)));
      }

      const answers = await inquirer.prompt([
        {
          type: 'input',
          name: 'description',
          message: 'Task description:',
          default: `Modified ${gitAnalysis.changedFiles.length} files`
        },
        {
          type: 'list',
          name: 'outcome',
          message: 'Task outcome:',
          choices: ['success', 'failure']
        },
        {
          type: 'input',
          name: 'notes',
          message: 'Developer notes / lessons learned:'
        }
      ]);

      await getKiteretsu().recordTaskOutcome(answers.description, 'git-record', answers.outcome, answers.notes);
      console.log(chalk.green('\n✨ Task outcome and learnings recorded in Kiteretsu!'));
      await getKiteretsu().destroy();
    } catch (e: any) {
      console.error(chalk.red('Record failed: ' + e.message));
      process.exitCode = 1;
    }
  });

// ─── 8. INDEX COMMAND ───
program
  .command('index')
  .description('Index the codebase and build memory')
  .action(async () => {
    const progressBar = new cliProgress.SingleBar({
      format: chalk.cyan('  Indexing ') + '|' + chalk.cyan('{bar}') + '| {percentage}% | {message}',
      barCompleteChar: '\u2588',
      barIncompleteChar: '\u2591',
      hideCursor: true
    }, cliProgress.Presets.shades_classic);

    console.log(chalk.cyan('  Starting codebase analysis...'));
    progressBar.start(100, 0, { message: 'Scanning...' });

    try {
      const stats = await getKiteretsu().index((current, total, message) => {
        progressBar.update(current, { message });
      });
      progressBar.update(100, { message: 'Complete!' });
      progressBar.stop();

      console.log('\n' + boxen(
        [
          chalk.white(`Files indexed:    ${chalk.bold.cyan(String(stats.files))}`),
          chalk.white(`Symbols found:    ${chalk.bold.cyan(String(stats.symbols))}`),
          chalk.white(`Dependencies:     ${chalk.bold.cyan(String(stats.edges))}`)
        ].join('\n'),
        { padding: 1, margin: 1, borderStyle: 'round', borderColor: 'green' }
      ));
      await getKiteretsu().destroy();
      process.exit(0);
    } catch (error: any) {
      progressBar.stop();
      console.error(chalk.red('\nIndexing failed: ' + error.message));
      try { await getKiteretsu().destroy(); } catch {}
      process.exit(1);
    }
  });

// ─── 9. CONTEXT COMMAND ───
program
  .command('context <task>')
  .description('Generate a Context Pack for a specific task')
  .option('-f, --format <format>', 'Output format (json or markdown)', 'markdown')
  .action(async (task, options) => {
    const spinner = ora(`Compiling context for: "${task}"...`).start();
    try {
      const pack = await getKiteretsu().getContextPack(task);
      spinner.stop();

      if (options.format === 'json') {
        console.log(JSON.stringify(pack, null, 2));
      } else {
        console.log(chalk.bold.underline('\n📦 Context Pack Compiled\n'));
        console.log(chalk.yellow('Task:'), task);

        console.log(chalk.cyan('\nGovernance Mode:'));
        console.log(chalk.white(boxen("LLM Strategy generation disabled. Use the provided Blast Radius and Rules to determine safe execution.", { padding: 1, borderColor: 'cyan', borderStyle: 'round' })));

        // Read First
        if (pack.read_first.length > 0) {
          console.log(chalk.blue('\n📁 Read First:'));
          pack.read_first.forEach((f: any) => {
            const score = f.relevance_score ?? f.confidence;
            const confStr = score ? ` ${chalk.green(`(${(score * 100).toFixed(0)}% relevance score)`)}` : '';
            const signalsStr = f.signals && f.signals.length > 0 ? ` ${chalk.gray(`[${f.signals.join(', ')}]`)}` : '';
            console.log(chalk.white(`  - ${f.path}${confStr}${signalsStr}`));
            if (f.summary && !f.summary.toLowerCase().includes('no summary')) {
              console.log(chalk.gray(`    ${f.summary}`));
            }
          });
        }

        // Optional Read
        if (pack.optional_read && pack.optional_read.length > 0) {
          console.log(chalk.blue('\n📄 Optional Context:'));
          pack.optional_read.forEach((f: any) => {
            const score = f.relevance_score ?? f.confidence;
            const confStr = score ? ` ${chalk.gray(`(${(score * 100).toFixed(0)}%)`)}` : '';
            console.log(chalk.white(`  - ${f.path}${confStr}`));
          });
        }

        // Blast Radius
        if (pack.blast_radius.length > 0) {
          console.log(chalk.red('\n💥 Blast Radius (files affected by changes):'));
          pack.blast_radius.forEach((f: string) => {
            console.log(chalk.yellow(`  ⚡ ${f}`));
          });
        }

        // Tests to Run
        if (pack.tests_to_run.length > 0) {
          console.log(chalk.green('\n🧪 Tests to Run:'));
          pack.tests_to_run.forEach((t: string) => {
            console.log(chalk.white(`  ✓ ${t}`));
          });
        }

        // Decisions (ADRs)
        if (pack.decisions && pack.decisions.length > 0) {
          console.log(chalk.cyan('\n💡 Architectural Decisions:'));
          pack.decisions.forEach(d => {
            console.log(chalk.white(`  • ${chalk.bold(d.title)}`));
            console.log(chalk.gray(`    ${d.rationale}`));
            if (d.affected_paths && d.affected_paths.length > 0) {
              console.log(chalk.gray(`    Scope: ${d.affected_paths.join(', ')}`));
            }
          });
        }

        // Relevant Past Tasks & Episodic Memory
        if (pack.past_tasks && pack.past_tasks.length > 0) {
          console.log(chalk.blue('\n🧠 Relevant Past Tasks & Learnings:'));
          pack.past_tasks.forEach(t => {
            const outcomeColor = t.outcome === 'success' ? chalk.green('✓') : chalk.red('✗');
            console.log(chalk.white(`  ${outcomeColor} ${t.description}`));
            if (t.notes) {
              console.log(chalk.gray(`    Note: ${t.notes}`));
            }
          });
        }

        // Rules
        if (pack.rules && pack.rules.length > 0) {
          console.log(chalk.magenta('\n📏 Rules to Follow:'));
          pack.rules.forEach(r => console.log(chalk.white(`  - ${r}`)));
        }

        // Warnings
        if (pack.warnings.length > 0) {
          console.log(chalk.yellow('\n⚠️  Warnings:'));
          pack.warnings.forEach(w => console.log(chalk.yellow(`  ⚠ ${w}`)));
        }

        console.log('');
      }
      await getKiteretsu().destroy();
      return;
    } catch (error: any) {
      spinner.fail(chalk.red('Context compilation failed: ' + error.message));
      process.exitCode = 1;
      return;
    }
  });

// ─── 10. DECISIONS & RULES COMMANDS ───
program
  .command('record-decision <title> <rationale>')
  .description('Record an architectural decision (ADR)')
  .option('-a, --alternatives <alternatives>', 'Alternatives considered', '')
  .option('-p, --paths <paths>', 'Comma-separated affected paths or globs', '')
  .option('-s, --status <status>', 'Decision status (proposed, accepted, superseded, deprecated, rejected, active)', 'accepted')
  .action(async (title, rationale, options) => {
    const spinner = ora('Recording decision...').start();
    try {
      const paths = options.paths ? options.paths.split(',').map((p: string) => p.trim()) : [];
      await getKiteretsu().recordDecision(title, rationale, options.alternatives, paths, options.status);
      spinner.succeed(chalk.green('✨ Decision recorded!'));
      await getKiteretsu().destroy();
      return;
    } catch (error: any) {
      spinner.fail(chalk.red('Failed to record decision: ' + error.message));
      process.exitCode = 1;
      return;
    }
  });

program
  .command('decisions')
  .description('List all architectural decision records (ADRs)')
  .action(async () => {
    try {
      const decisions = await getKiteretsu().getAllDecisions();
      if (decisions.length === 0) {
        console.log(chalk.gray('No architectural decisions recorded yet.'));
      } else {
        console.log(chalk.bold.underline('\n💡 Architectural Decisions:\n'));
        for (const d of decisions) {
          const statusBadge = d.status === 'active' || d.status === 'accepted' ? chalk.green(`[${d.status}]`) : chalk.yellow(`[${d.status}]`);
          console.log(`${statusBadge} ${chalk.bold.white(d.title)}`);
          console.log(chalk.gray(`  Rationale: ${d.rationale}`));
          if (d.alternatives_considered) {
            console.log(chalk.gray(`  Alternatives: ${d.alternatives_considered}`));
          }
          if (d.affected_paths && d.affected_paths.length > 0) {
            console.log(chalk.gray(`  Affected paths: ${d.affected_paths.join(', ')}`));
          }
          console.log('');
        }
      }
      await getKiteretsu().destroy();
      return;
    } catch (error: any) {
      console.error(chalk.red('Failed to list decisions: ' + error.message));
      process.exitCode = 1;
      return;
    }
  });

program
  .command('record-rule <name> <description>')
  .description('Record a new architectural rule')
  .option('-s, --scope <type>', 'Scope type (global, path, language)', 'global')
  .option('-v, --value <value>', 'Scope value', '')
  .action(async (name, description, options) => {
    const spinner = ora('Recording rule...').start();
    try {
      await getKiteretsu().addRule(name, description, options.scope, options.value);
      spinner.succeed(chalk.green('✨ Rule recorded!'));
      await getKiteretsu().destroy();
      return;
    } catch (error: any) {
      spinner.fail(chalk.red('Failed to record rule: ' + error.message));
      process.exitCode = 1;
      return;
    }
  });

program
  .command('record-task <task> <outcome>')
  .description('Record the outcome of a task')
  .option('-t, --type <type>', 'Task type', 'unknown')
  .option('-n, --notes <notes>', 'Additional notes', '')
  .action(async (task, outcome, options) => {
    const spinner = ora('Recording task outcome...').start();
    try {
      await getKiteretsu().recordTaskOutcome(task, options.type, outcome, options.notes);
      spinner.succeed(chalk.green('✨ Task outcome recorded!'));
      await getKiteretsu().destroy();
      return;
    } catch (error: any) {
      spinner.fail(chalk.red('Failed to record task outcome: ' + error.message));
      process.exitCode = 1;
      return;
    }
  });

program
  .command('search <query>')
  .description('Semantic search across the codebase')
  .option('-l, --limit <number>', 'Number of results', '5')
  .action(async (query, options) => {
    const spinner = ora(`Searching for "${query}"...`).start();
    try {
      const results = await getKiteretsu().semanticSearch(query, parseInt(options.limit, 10));
      spinner.stop();

      console.log(chalk.bold.underline(`\n🔎 Search Results for: "${query}"\n`));
      if (results.length === 0) {
        console.log(chalk.yellow('No matches found.'));
      } else {
        results.forEach((r, idx) => {
          const simPct = (Math.max(0, 1 - r.distance) * 100).toFixed(0);
          console.log(`${chalk.cyan(String(idx + 1) + '.')} ${chalk.bold.white(r.path)} ${chalk.green(`(${simPct}% similarity)`)}`);
          if (r.summary) {
            console.log(chalk.gray(`   ${r.summary}`));
          }
          console.log('');
        });
      }
      await getKiteretsu().destroy();
    } catch (e: any) {
      spinner.fail(chalk.red('Search failed: ' + e.message));
      process.exitCode = 1;
    }
  });

program
  .command('watch')
  .description('Watch codebase for changes and maintain index in real-time')
  .action(async () => {
    console.log(chalk.cyan('👀 Starting Kiteretsu code watcher...'));
    const watcher = new CodeWatcher(getKiteretsu());
    await watcher.start(rootDir);
    console.log(chalk.green('✓ Watcher active. Press Ctrl+C to stop.'));
  });

program.parse(process.argv);
