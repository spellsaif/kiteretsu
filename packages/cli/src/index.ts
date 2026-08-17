#!/usr/bin/env node
import { Command } from 'commander';
import chalk from 'chalk';
import ora from 'ora';
import cliProgress from 'cli-progress';
import boxen from 'boxen';
import gradient from 'gradient-string';
import { Kiteretsu } from '@kiteretsu/core';
import { CodeWatcher } from '@kiteretsu/core/watcher.js';
import path from 'path';
import fs from 'fs-extra';
import inquirer from 'inquirer';
import os from 'os';

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

const executionDir = process.cwd();
const initCwd = process.env.INIT_CWD;
let rootDir = initCwd || executionDir;

// If we are inside packages/cli and INIT_CWD is not set correctly, try to find the root
if (rootDir.includes('packages' + path.sep + 'cli')) {
  rootDir = findWorkspaceRoot(rootDir);
}

const configPath = path.join(rootDir, '.kiteretsu', 'config.json');
let config = { rootDir };

if (fs.existsSync(configPath)) {
  try {
    const fileConfig = fs.readJsonSync(configPath);
    config = { ...fileConfig, rootDir };
  } catch (e) { }
}

// Initialize Kiteretsu lazily to avoid overhead for simple commands
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
  .description('Agent memory and context compiler for AI coding agents')
  .version('0.1.0');

program
  .command('init')
  .description('Initialize Kiteretsu in the current repository')
  .action(async () => {
    const spinner = ora('Initializing Kiteretsu...').start();
    try {
      await getKiteretsu().init();
      spinner.succeed(chalk.green('✨ Kiteretsu initialized successfully!'));
      console.log(boxen(
        chalk.white('Created .kiteretsu/ folder\nInitialized SQLite database\nGenerated config.json'),
        { padding: 1, margin: 1, borderStyle: 'round', borderColor: 'cyan' }
      ));
      await getKiteretsu().destroy();
      return;
    } catch (error: any) {
      spinner.fail(chalk.red('Initialization failed: ' + error.message));
      process.exitCode = 1;
      return;
    }
  });

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
            const confStr = f.confidence ? ` ${chalk.green(`(${(f.confidence * 100).toFixed(0)}% confidence)`)}` : '';
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
            const confStr = f.confidence ? ` ${chalk.gray(`(${(f.confidence * 100).toFixed(0)}%)`)}` : '';
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

        console.log(''); // trailing newline
      }
      await getKiteretsu().destroy();
      return;
    } catch (error: any) {
      spinner.fail(chalk.red('Context compilation failed: ' + error.message));
      process.exitCode = 1;
      return;
    }
  });

program
  .command('record-decision <title> <rationale>')
  .description('Record an architectural decision (ADR)')
  .option('-a, --alternatives <alternatives>', 'Alternatives considered', '')
  .option('-p, --paths <paths>', 'Comma-separated affected paths or globs', '')
  .option('-s, --status <status>', 'Decision status (active, deprecated, superseded)', 'active')
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
          const statusBadge = d.status === 'active' ? chalk.green('[active]') : chalk.yellow(`[${d.status}]`);
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
      spinner.fail(chalk.red('Failed to record task: ' + error.message));
      process.exitCode = 1;
      return;
    }
  });

program
  .command('search <query>')
  .description('Semantic search across the codebase')
  .action(async (query) => {
    const spinner = ora(`Searching for "${query}"...`).start();
    try {
      const results = await getKiteretsu().semanticSearch(query);
      spinner.stop();
      
      if (!results || results.length === 0) {
        console.log(chalk.yellow('No results found.'));
        return;
      }

      console.log(chalk.cyan(`\nTop semantic matches for: "${query}"`));
      console.log(chalk.gray(`(Higher percentage means stronger conceptual similarity)\n`));

      results.forEach((res, i) => {
        const percentage = Math.max(0, Math.round((1 - res.distance) * 100));
        const color = percentage > 50 ? chalk.green : (percentage > 25 ? chalk.yellow : chalk.white);
        
        console.log(`${chalk.white(i + 1 + '.')} ${chalk.bold(res.path)} ${color(`[${percentage}% Match]`)}`);
      });
      console.log('');
      await getKiteretsu().destroy();
    } catch (e: any) {
      spinner.fail(chalk.red(`Error: ${e.message}`));
    }
  });

program
  .command('tests')
  .description('Find and optionally run tests related to specific files')
  .option('-f, --files <files...>', 'Source files to find tests for')
  .option('-r, --run', 'Try to run the tests automatically', false)
  .action(async (options) => {
    if (!options.files || options.files.length === 0) {
      console.log(chalk.red('❌ Please provide at least one file using --files'));
      process.exitCode = 1;
      return;
    }

    const spinner = ora('Finding related tests...').start();
    try {
      const tests = await getKiteretsu().getRelatedTests(options.files);
      spinner.stop();

      if (tests.length === 0) {
        console.log(chalk.yellow('\n🔍 No related tests found for the specified files.'));
        console.log(chalk.gray('Kiteretsu looks for files containing .test. or .spec. that import your changed files.'));
      } else {
        console.log(chalk.bold.green('\n🧪 Related Tests Found:'));
        tests.forEach(t => console.log(chalk.white(`  ✓ ${t}`)));

        if (options.run) {
          console.log(chalk.cyan('\n🚀 Automatic test execution is coming soon!'));
          console.log(chalk.gray('For now, please run these tests manually using your preferred test runner.'));
        }
      }
      await getKiteretsu().destroy();
      return;
    } catch (error: any) {
      spinner.fail(chalk.red('Failed to find tests: ' + error.message));
      process.exitCode = 1;
      return;
    }
  });

program
  .command('blast-radius <file>')
  .description('Calculate the blast radius of a specific file')
  .action(async (file) => {
    const spinner = ora(`Calculating blast radius for: ${file}...`).start();
    try {
      const fullPath = path.resolve(rootDir, file);
      const analyzer = await getKiteretsu().getAnalyzer();
      const radius = await analyzer.getBlastRadius(fullPath);
      spinner.stop();

      // Normalize paths relative to rootDir for easier testing
      const normalizedRadius = radius.map((f: string) => {
        if (f.startsWith('UNRESOLVABLE: ')) {
          return `UNRESOLVABLE: ${path.relative(rootDir, f.slice('UNRESOLVABLE: '.length)).replace(/\\/g, '/')}`;
        }
        return path.relative(rootDir, f).replace(/\\/g, '/');
      });
      
      console.log(JSON.stringify({
        file: path.relative(rootDir, fullPath).replace(/\\/g, '/'),
        blast_radius: normalizedRadius
      }, null, 2));

      await getKiteretsu().destroy();
      return;
    } catch (error: any) {
      spinner.fail(chalk.red('Blast radius calculation failed: ' + error.message));
      process.exitCode = 1;
      return;
    }
  });



program
  .command('mcp')
  .description('Start the Kiteretsu MCP server')
  .action(async () => {
    try {
      const { runMcpServer } = await import('@kiteretsu/mcp-server');
      await runMcpServer(rootDir);
    } catch (error: any) {
      console.error(chalk.red('MCP Server failed: ' + error.message));
      process.exitCode = 1;
      return;
    }
  });

program
  .command('watch')
  .description('Start the self-healing memory watcher')
  .action(async () => {
    const watcher = new CodeWatcher(getKiteretsu());
    await watcher.start(rootDir);
  });

program
  .command('integrate [target]')
  .alias('install')
  .description('Install Kiteretsu hooks for specific agents (claude, cursor, aider, vscode, copilot, trae, kiro, antigravity, opencode, openclaude, openclaw, etc.)')
  .action(async (target) => {
    const targetDir = rootDir;
    const protocolMarker = '# 📦 Kiteretsu Intelligence Layer';
    const detailedProtocol = `
## 📖 THE KITERETSU PROTOCOL
You are operating within a codebase enhanced by **Kiteretsu**, an externalized spatial intelligence and cognitive memory layer. 

**MANDATORY BEHAVIORAL INSTRUCTION:**
Before attempting ANY task, refactor, or architectural design query, you **MUST** consult Kiteretsu. Do NOT rely on blind directory traversal, grep loops, or internal memory of the project structure. Kiteretsu is the source of truth for dependencies, architectural rules, and blast radius.

### 🛠️ Required Workflow

1. **Compile Context First**
   - BEFORE planning or editing, run:
     \`kiteretsu context "<detailed description of task>"\`
   - Review the compiled Context Pack. Pay close attention to the **Read First** files (must be read first) and **Blast Radius** files (which will be impacted by your changes).

2. **Strict Architectural Governance**
   - Check and comply with all architectural rules in the **Rules to Follow** section.
   - To record a new project guardrail or architectural convention for future agents:
     \`kiteretsu record-rule <rule-name> <description> --scope <global|path|language> --value <scope-value>\`

3. **Verify and Run Tests**
   - To find the exact test suites covering files you modified, run:
     \`kiteretsu tests --files <file1> <file2>\`
   - Run the identified tests to verify that no downstream dependencies inside the blast radius are broken.

4. **Offload Task Memory (Episodic Recall)**
   - Upon completing the task and confirming successful verification, record the episodic outcome so subsequent agents learn from your execution details:
     \`kiteretsu record-task "<task description>" success --notes "<key implementation notes or speedups>"\`
`;

    const ensureKiteretsuLayer = async (filePath: string, content: string) => {
      let existing = '';
      const exists = await fs.pathExists(filePath);
      if (exists) {
        existing = await fs.readFile(filePath, 'utf8');
      }

      if (existing.includes(protocolMarker)) {
        return false;
      } else {
        const prefix = existing ? (existing.endsWith('\n') ? '' : '\n') : '';
        await fs.outputFile(filePath, existing + prefix + `\n${protocolMarker}\n${content}\n`);
        return true;
      }
    };

    const runIntegration = async (targetName: string): Promise<string[]> => {
      const createdFiles: string[] = [];
      const normalized = targetName.toLowerCase();

      switch (normalized) {
        case 'git': {
          if (!await fs.pathExists(path.join(targetDir, '.git'))) {
            throw new Error('Not a git repository.');
          }
           const hookContent = `#!/bin/sh\n# Kiteretsu Auto-Index Hook\n# Keeps your codebase memory fresh in the background on commit or pull/merge\n\nif [ -f "./node_modules/.bin/kiteretsu" ]; then\n  KITERETSU_DISABLE_EMBEDDINGS=1 ./node_modules/.bin/kiteretsu index > /dev/null 2>&1 &\nelif command -v kiteretsu >/dev/null 2>&1; then\n  KITERETSU_DISABLE_EMBEDDINGS=1 kiteretsu index > /dev/null 2>&1 &\nelse\n  KITERETSU_DISABLE_EMBEDDINGS=1 npx kiteretsu index > /dev/null 2>&1 &\nfi\n`;
          const commitHook = path.join(targetDir, '.git', 'hooks', 'post-commit');
          const mergeHook = path.join(targetDir, '.git', 'hooks', 'post-merge');
          
          await fs.outputFile(commitHook, hookContent, { mode: 0o755 });
          await fs.outputFile(mergeHook, hookContent, { mode: 0o755 });
          try {
            await fs.chmod(commitHook, 0o755);
            await fs.chmod(mergeHook, 0o755);
          } catch {}
          createdFiles.push('.git/hooks/post-commit', '.git/hooks/post-merge');
          break;
        }
        case 'claude':
        case 'claude-code': {
          const claudePath = path.join(targetDir, 'CLAUDE.md');
          await ensureKiteretsuLayer(claudePath, detailedProtocol);
          createdFiles.push('CLAUDE.md');

          const claudeSettingsPath = path.join(targetDir, '.claude', 'settings.json');
          let claudeSettings: any = { hooks: {} };
          if (await fs.pathExists(claudeSettingsPath)) {
            try {
              claudeSettings = await fs.readJson(claudeSettingsPath);
            } catch {}
          }
          claudeSettings.hooks = claudeSettings.hooks || {};
          claudeSettings.hooks.PreToolUse = claudeSettings.hooks.PreToolUse || {};
          claudeSettings.hooks.PreToolUse["Glob,Grep"] = "If a Kiteretsu memory exists, read the Context Pack before searching raw files.";
          await fs.outputJson(claudeSettingsPath, claudeSettings, { spaces: 2 });
          createdFiles.push('.claude/settings.json');
          break;
        }
        case 'cursor': {
          const cursorrulesPath = path.join(targetDir, '.cursorrules');
          await ensureKiteretsuLayer(cursorrulesPath, detailedProtocol);
          createdFiles.push('.cursorrules');

          const mdcPath = path.join(targetDir, '.cursor', 'rules', 'kiteretsu.mdc');
          const mdcContent = `---\ndescription: Kiteretsu Codebase Intelligence and Context Compilation Protocol\nglobs: *\nalwaysApply: true\n---\n${protocolMarker}\n${detailedProtocol}`;
          await fs.outputFile(mdcPath, mdcContent);
          createdFiles.push('.cursor/rules/kiteretsu.mdc');
          break;
        }
        case 'windsurf':
        case 'cascade': {
          const wsPath = path.join(targetDir, '.windsurfrules');
          await ensureKiteretsuLayer(wsPath, detailedProtocol);
          createdFiles.push('.windsurfrules');
          break;
        }
        case 'vscode':
        case 'vscode-copilot': {
          const vscodePath = path.join(targetDir, '.github', 'copilot-instructions.md');
          await ensureKiteretsuLayer(vscodePath, detailedProtocol);
          createdFiles.push('.github/copilot-instructions.md');
          break;
        }
        case 'aider': {
          const aiderInstructions = path.join(targetDir, '.aider.instructions.md');
          await ensureKiteretsuLayer(aiderInstructions, detailedProtocol);
          createdFiles.push('.aider.instructions.md');

          const aiderConf = path.join(targetDir, '.aider.conf.yml');
          let existingConf = '';
          if (await fs.pathExists(aiderConf)) {
            existingConf = await fs.readFile(aiderConf, 'utf8');
          }
          if (!existingConf.includes('instructions:')) {
            const extra = `\n# Aider configuration for Kiteretsu\ninstructions: .aider.instructions.md\n`;
            await fs.outputFile(aiderConf, existingConf + extra);
          }
          createdFiles.push('.aider.conf.yml');
          break;
        }
        case 'opencode': {
          const ocPath = path.join(targetDir, 'AGENTS.md');
          await ensureKiteretsuLayer(ocPath, detailedProtocol);
          createdFiles.push('AGENTS.md');

          const pluginPath = path.join(targetDir, '.opencode', 'plugins', 'kiteretsu.js');
          const pluginContent = `module.exports = {\n  executeBefore: ['bash'],\n  run: () => 'Before starting your task, run kiteretsu context to retrieve spatial codebase mapping and active governance rules.'\n};\n`;
          await fs.outputFile(pluginPath, pluginContent);
          createdFiles.push('.opencode/plugins/kiteretsu.js');

          const ocSettingsPath = path.join(targetDir, 'opencode.json');
          let ocSettings: any = { plugins: [] };
          if (await fs.pathExists(ocSettingsPath)) {
            try {
              ocSettings = await fs.readJson(ocSettingsPath);
            } catch {}
          }
          ocSettings.plugins = ocSettings.plugins || [];
          if (!ocSettings.plugins.includes('./.opencode/plugins/kiteretsu.js')) {
            ocSettings.plugins.push('./.opencode/plugins/kiteretsu.js');
          }
          await fs.outputJson(ocSettingsPath, ocSettings, { spaces: 2 });
          createdFiles.push('opencode.json');
          break;
        }
        case 'openclaude': {
          const oclaudePath = path.join(targetDir, 'OPENCLAUDE.md');
          await ensureKiteretsuLayer(oclaudePath, detailedProtocol);
          createdFiles.push('OPENCLAUDE.md');

          const agentPath = path.join(targetDir, 'AGENTS.md');
          await ensureKiteretsuLayer(agentPath, detailedProtocol);
          createdFiles.push('AGENTS.md');
          break;
        }
        case 'openclaw':
        case 'claw': {
          const clawrulesPath = path.join(targetDir, '.clawrules');
          await ensureKiteretsuLayer(clawrulesPath, detailedProtocol);
          createdFiles.push('.clawrules');

          const agentPath = path.join(targetDir, 'AGENTS.md');
          await ensureKiteretsuLayer(agentPath, detailedProtocol);
          createdFiles.push('AGENTS.md');
          break;
        }
        case 'trae':
        case 'trae-cn': {
          const traePath = path.join(targetDir, '.traerules');
          await ensureKiteretsuLayer(traePath, detailedProtocol);
          createdFiles.push('.traerules');

          const agentPath = path.join(targetDir, 'AGENTS.md');
          await ensureKiteretsuLayer(agentPath, detailedProtocol);
          createdFiles.push('AGENTS.md');
          break;
        }
        case 'gemini': {
          const gemPath = path.join(targetDir, 'GEMINI.md');
          await ensureKiteretsuLayer(gemPath, detailedProtocol);
          createdFiles.push('GEMINI.md');

          const skillPath = path.join(targetDir, '.gemini', 'skills', 'kiteretsu', 'SKILL.md');
          await ensureKiteretsuLayer(skillPath, detailedProtocol);
          createdFiles.push('.gemini/skills/kiteretsu/SKILL.md');

          const gemSettingsPath = path.join(targetDir, '.gemini', 'settings.json');
          let gemSettings: any = { hooks: {} };
          if (await fs.pathExists(gemSettingsPath)) {
            try {
              gemSettings = await fs.readJson(gemSettingsPath);
            } catch {}
          }
          gemSettings.hooks = gemSettings.hooks || {};
          gemSettings.hooks.BeforeTool = gemSettings.hooks.BeforeTool || {};
          gemSettings.hooks.BeforeTool["file-read"] = "Read Kiteretsu context before reading raw files.";
          await fs.outputJson(gemSettingsPath, gemSettings, { spaces: 2 });
          createdFiles.push('.gemini/settings.json');
          break;
        }
        case 'kiro': {
          const kiroSkill = path.join(targetDir, '.kiro', 'skills', 'kiteretsu', 'SKILL.md');
          await ensureKiteretsuLayer(kiroSkill, detailedProtocol);
          createdFiles.push('.kiro/skills/kiteretsu/SKILL.md');

          const kiroSteering = path.join(targetDir, '.kiro', 'steering', 'kiteretsu.md');
          const steeringContent = `inclusion: always\n---\n${protocolMarker}\n${detailedProtocol}`;
          await fs.outputFile(kiroSteering, steeringContent);
          createdFiles.push('.kiro/steering/kiteretsu.md');
          break;
        }
        case 'antigravity':
        case 'google-antigravity': {
          const antiRule = path.join(targetDir, '.agents', 'rules', 'kiteretsu.md');
          const ruleContent = `---\ndescription: Kiteretsu Codebase Intelligence\nglobs: **/*\n---\n${protocolMarker}\n${detailedProtocol}`;
          await fs.outputFile(antiRule, ruleContent);
          createdFiles.push('.agents/rules/kiteretsu.md');

          const antiWorkflow = path.join(targetDir, '.agents', 'workflows', 'kiteretsu.md');
          const workflowContent = `---\nname: Kiteretsu Context\ndescription: Get codebase context for a task\ntrigger:\n  slash_command: kiteretsu\n  arguments:\n    task:\n      description: The task you are working on\n      required: true\n---\n\n# Workflow\n1. Run \`kiteretsu context "{{task}}"\`\n2. Display the result to the user.`;
          await fs.outputFile(antiWorkflow, workflowContent);
          createdFiles.push('.agents/workflows/kiteretsu.md');
          break;
        }
        case 'codex': {
          const codexPath = path.join(targetDir, 'AGENTS.md');
          await ensureKiteretsuLayer(codexPath, detailedProtocol);
          createdFiles.push('AGENTS.md');

          const codexHooks = path.join(targetDir, '.codex', 'hooks.json');
          await fs.outputJson(codexHooks, {
            PreToolUse: { "Bash": "Read Kiteretsu context pack before executing bash commands to search." }
          }, { spaces: 2 });
          createdFiles.push('.codex/hooks.json');
          break;
        }
        case 'copilot': {
          const copilotPath = path.join(os.homedir(), '.copilot', 'skills', 'kiteretsu', 'SKILL.md');
          await ensureKiteretsuLayer(copilotPath, detailedProtocol);
          createdFiles.push('~/.copilot/skills/kiteretsu/SKILL.md');
          break;
        }
        default:
          throw new Error(`Unknown target: ${targetName}`);
      }

      return createdFiles;
    };

    try {
      if (!target) {
        const response = await inquirer.prompt([
          {
            type: 'list',
            name: 'target',
            message: 'Which AI coding agent or IDE would you like to integrate with Kiteretsu?',
            choices: [
              { name: '✨ All Common Integrations (Cursor, Claude Code, Windsurf, Git Hooks)', value: 'common' },
              { name: '🌟 All Integrations (Installs every supported agent configuration)', value: 'all' },
              { name: '🤖 Claude Code (CLAUDE.md, settings.json)', value: 'claude' },
              { name: '🚀 Cursor IDE (.cursorrules, .cursor/rules/kiteretsu.mdc)', value: 'cursor' },
              { name: '🌊 Windsurf / Cascade (.windsurfrules)', value: 'windsurf' },
              { name: '💻 VS Code Copilot (.github/copilot-instructions.md)', value: 'vscode' },
              { name: '🐙 Git Hooks (Auto-reindex on commit & pull)', value: 'git' },
              { name: '🧙 Aider (.aider.instructions.md, .aider.conf.yml)', value: 'aider' },
              { name: '🧬 OpenCode (AGENTS.md, opencode.json integration)', value: 'opencode' },
              { name: '🪐 OpenClaude (OPENCLAUDE.md, AGENTS.md)', value: 'openclaude' },
              { name: '⚔️ OpenClaw / Claw (.clawrules, AGENTS.md)', value: 'openclaw' },
              { name: '🔮 Trae (.traerules, AGENTS.md)', value: 'trae' },
              { name: '🟢 Gemini (GEMINI.md, SKILL.md, settings.json)', value: 'gemini' },
              { name: '🎯 Kiro (SKILL.md, steering/kiteretsu.md)', value: 'kiro' },
              { name: '🛸 Antigravity (rules/kiteretsu.md, workflows)', value: 'antigravity' },
              { name: '🚪 Cancel / Exit', value: 'exit' }
            ]
          }
        ]);
        target = response.target;
        if (target === 'exit') {
          console.log(chalk.gray('  Installation cancelled.'));
          return;
        }
      }

      const spinner = ora('Setting up integrations...').start();
      const finalFiles: string[] = [];

      let targetsToRun: string[] = [];
      if (target.toLowerCase() === 'common') {
        targetsToRun = ['cursor', 'claude', 'windsurf', 'aider', 'git'];
      } else if (target.toLowerCase() === 'all') {
        targetsToRun = [
          'cursor', 'claude', 'windsurf', 'aider', 'git', 
          'opencode', 'openclaude', 'openclaw', 'trae', 
          'gemini', 'kiro', 'antigravity', 'codex', 'vscode', 'copilot'
        ];
      } else {
        targetsToRun = [target];
      }

      for (const t of targetsToRun) {
        try {
          const files = await runIntegration(t);
          finalFiles.push(...files);
        } catch (err: any) {
          console.log(chalk.yellow(`\n  ⚠️ Skipping '${t}': ${err.message}`));
        }
      }

      spinner.succeed(chalk.green('✨ Kiteretsu successfully integrated!'));

      if (finalFiles.length > 0) {
        console.log('\n' + boxen(
          chalk.bold.cyan('📂 Created/Updated Files:') + '\n' +
          finalFiles.map(f => chalk.white(`  ✓ ${f}`)).join('\n') + '\n\n' +
          chalk.green('🚀 Workflow Ready!') + '\n' +
          chalk.gray('Your AI agents will now intercept and run Kiteretsu to retrieve spatial context and execute safe, governed refactors.'),
          { padding: 1, borderStyle: 'round', borderColor: 'green', margin: 1 }
        ));
      } else {
        console.log(chalk.yellow('\n  No files were updated. Everything is already up to date.'));
      }
    } catch (e: any) {
      console.log(chalk.red(`❌ Failed to install integration: ${e.message}`));
    }
  });

program.parse(process.argv);
