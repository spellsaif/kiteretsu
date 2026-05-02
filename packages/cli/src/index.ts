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
      return;
    } catch (error: any) {
      progressBar.stop();
      console.error(chalk.red('\nIndexing failed: ' + error.message));
      process.exitCode = 1;
      return;
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
            console.log(chalk.white(`  - ${f.path}`));
            if (f.summary && !f.summary.toLowerCase().includes('no summary')) {
              console.log(chalk.gray(`    ${f.summary}`));
            }
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
  .command('ui')
  .alias('dashboard')
  .description('Start the Kiteretsu interactive UI')
  .option('-p, --port <port>', 'Port to run the UI on', '3000')
  .action(async (options) => {
    console.log(chalk.bold.cyan('\n🚀 Launching Kiteretsu intelligence...'));
    const [{ startServer }, { default: open }] = await Promise.all([
      import('@kiteretsu/server'),
      import('open')
    ]);

    // 1. Start Watcher (Self-healing memory)
    const watcher = new CodeWatcher(getKiteretsu());
    watcher.start(rootDir).catch(e => console.error(chalk.red(`Watcher failed: ${e.message}`)));

    // 2. Start Server
    startServer(rootDir, parseInt(options.port));

    // 3. Open Browser
    setTimeout(() => {
      open(`http://localhost:${options.port}`);
    }, 800);
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
  .command('integrate <target>')
  .alias('install')
  .description('Install Kiteretsu hooks for specific agents (claude, cursor, aider, vscode, copilot, trae, kiro, antigravity, etc.)')
  .action(async (target) => {
    const targetDir = rootDir;
    const protocolMarker = '# 📦 Kiteretsu Intelligence Layer';
    const detailedProtocol = `
## ⚠️ MANDATORY PROTOCOL
Before answering ANY questions about architecture, dependencies, or blast radius, you **MUST** call Kiteretsu (via the \`get_context_pack\` tool or the \`kiteretsu context "<task>"\` command). 

**NEVER** rely on your internal memory for project structure. The source code is the only truth, and Kiteretsu is your only window into it.

### 🛠 Workflow
1. **Context**: Run \`kiteretsu context "<task>"\` before planning.
2. **Read First**: Always read the files listed in the "Read First" section.
3. **Verify**: Find related tests using \`kiteretsu tests --files <changed_files>\`.
4. **Governance**: Use \`kiteretsu record-rule <name> <description>\` to save architectural rules. (DO NOT just write them in markdown files; use the tool so they can be enforced).
5. **Learn**: Record task outcomes using \`kiteretsu record-task "<task>" <success|failure>\`.
`;

    const ensureKiteretsuLayer = async (filePath: string, content: string) => {
      let existing = '';
      if (fs.existsSync(filePath)) {
        existing = await fs.readFile(filePath, 'utf8');
      }

      if (existing.includes(protocolMarker)) {
        // Replace existing layer
        const lines = existing.split('\n');
        const markerIndex = lines.findIndex(l => l.includes(protocolMarker));
        // Simple strategy: remove everything from marker to end if it's the last section, 
        // or just keep it as is if we don't want to risk breaking other stuff.
        // For now, we will just not append if it already exists.
        return false; 
      } else {
        await fs.appendFile(filePath, `\n${protocolMarker}\n${content}\n`);
        return true;
      }
    };

    try {
      switch (target.toLowerCase()) {
        case 'git':
          const hookPath = path.join(targetDir, '.git', 'hooks', 'post-commit');
          if (fs.existsSync(path.join(targetDir, '.git'))) {
            const hookContent = `#!/bin/sh\n# Kiteretsu auto-index\nnpx @kiteretsu/cli index > /dev/null 2>&1 &\n`;
            await fs.outputFile(hookPath, hookContent, { mode: 0o755 });
            console.log(chalk.green('✨ Git post-commit hook installed.'));
          } else {
            console.log(chalk.red('❌ Not a git repository.'));
          }
          break;

        case 'claude':
          const claudePath = path.join(targetDir, 'CLAUDE.md');
          const installedClaude = await ensureKiteretsuLayer(claudePath, detailedProtocol);
          const claudeSettingsPath = path.join(targetDir, '.claude', 'settings.json');
          let claudeSettings: any = { hooks: {} };
          if (fs.existsSync(claudeSettingsPath)) claudeSettings = JSON.parse(await fs.readFile(claudeSettingsPath, 'utf8'));
          claudeSettings.hooks.PreToolUse = claudeSettings.hooks.PreToolUse || {};
          claudeSettings.hooks.PreToolUse["Glob,Grep"] = "If a Kiteretsu memory exists, read the Context Pack before searching raw files.";
          await fs.outputFile(claudeSettingsPath, JSON.stringify(claudeSettings, null, 2));
          console.log(chalk.green(installedClaude ? '✨ Claude Code protocol and hooks installed.' : '✨ Claude Code hooks updated (Protocol already exists).'));
          break;

        case 'codex':
          const codexPath = path.join(targetDir, 'AGENTS.md');
          const installedCodex = await ensureKiteretsuLayer(codexPath, detailedProtocol);
          await fs.outputFile(path.join(targetDir, '.codex', 'hooks.json'), JSON.stringify({
            PreToolUse: { "Bash": "Read Kiteretsu context pack before executing bash commands to search." }
          }, null, 2));
          console.log(chalk.green(installedCodex ? '✨ Codex protocol and hooks installed.' : '✨ Codex hooks updated (Protocol already exists).'));
          break;

        case 'opencode':
          const ocPath = path.join(targetDir, 'AGENTS.md');
          const installedOC = await ensureKiteretsuLayer(ocPath, detailedProtocol);
          await fs.outputFile(path.join(targetDir, '.opencode', 'plugins', 'kiteretsu.js'), `module.exports = { executeBefore: ['bash'], run: () => 'Read Kiteretsu context first.' };`);
          const ocSettingsPath = path.join(targetDir, 'opencode.json');
          let ocSettings: any = { plugins: [] };
          if (fs.existsSync(ocSettingsPath)) ocSettings = JSON.parse(await fs.readFile(ocSettingsPath, 'utf8'));
          if (!ocSettings.plugins.includes('./.opencode/plugins/kiteretsu.js')) ocSettings.plugins.push('./.opencode/plugins/kiteretsu.js');
          await fs.outputFile(ocSettingsPath, JSON.stringify(ocSettings, null, 2));
          console.log(chalk.green(installedOC ? '✨ OpenCode protocol and plugin installed.' : '✨ OpenCode plugin updated (Protocol already exists).'));
          break;

        case 'cursor':
          await fs.outputFile(path.join(targetDir, '.cursor', 'rules', 'kiteretsu.mdc'), `description: Kiteretsu Context\nglobs: *\nalwaysApply: true\n---\n${protocolMarker}\n${detailedProtocol}`);
          console.log(chalk.green('✨ Cursor rule (.mdc) installed with alwaysApply: true'));
          break;

        case 'windsurf':
        case 'cascade':
          await fs.outputFile(path.join(targetDir, '.windsurfrules'), `${protocolMarker}\n${detailedProtocol}`);
          console.log(chalk.green('✨ Windsurf .windsurfrules installed successfully.'));
          break;

        case 'gemini':
          await fs.outputFile(path.join(targetDir, '.gemini', 'skills', 'kiteretsu', 'SKILL.md'), detailedProtocol);
          const gemPath = path.join(targetDir, 'GEMINI.md');
          const installedGem = await ensureKiteretsuLayer(gemPath, detailedProtocol);
          const gemSettingsPath = path.join(targetDir, '.gemini', 'settings.json');
          let gemSettings: any = { hooks: {} };
          if (fs.existsSync(gemSettingsPath)) gemSettings = JSON.parse(await fs.readFile(gemSettingsPath, 'utf8'));
          gemSettings.hooks.BeforeTool = gemSettings.hooks.BeforeTool || {};
          gemSettings.hooks.BeforeTool["file-read"] = "Read Kiteretsu context before reading raw files.";
          await fs.outputFile(gemSettingsPath, JSON.stringify(gemSettings, null, 2));
          console.log(chalk.green(installedGem ? '✨ Gemini protocol and hooks installed.' : '✨ Gemini hooks updated (Protocol already exists).'));
          break;

        case 'kiro':
          await fs.outputFile(path.join(targetDir, '.kiro', 'skills', 'kiteretsu', 'SKILL.md'), detailedProtocol);
          await fs.outputFile(path.join(targetDir, '.kiro', 'steering', 'kiteretsu.md'), `inclusion: always\n---\n${protocolMarker}\n${detailedProtocol}`);
          console.log(chalk.green('✨ Kiro IDE steering file (inclusion: always) installed.'));
          break;

        case 'antigravity':
        case 'google-antigravity':
          await fs.outputFile(path.join(targetDir, '.agents', 'rules', 'kiteretsu.md'), `---
description: Kiteretsu Codebase Intelligence
globs: **/*
---
${protocolMarker}
${detailedProtocol}`);

          await fs.outputFile(path.join(targetDir, '.agents', 'workflows', 'kiteretsu.md'), `---
name: Kiteretsu Context
description: Get codebase context for a task
trigger:
  slash_command: kiteretsu
  arguments:
    task:
      description: The task you are working on
      required: true
---

# Workflow
1. Run \`kiteretsu context "{{task}}"\`
2. Display the result to the user.`);
          console.log(chalk.green('✨ Antigravity rules and workflows installed successfully.'));
          break;

        case 'vscode':
        case 'vscode-copilot':
          await fs.outputFile(path.join(targetDir, '.github', 'copilot-instructions.md'), `${protocolMarker}\n${detailedProtocol}`);
          console.log(chalk.green('✨ VS Code Copilot Chat instructions installed in .github/copilot-instructions.md'));
          break;

        case 'copilot':
          await fs.outputFile(path.join(require('os').homedir(), '.copilot', 'skills', 'kiteretsu', 'SKILL.md'), detailedProtocol);
          console.log(chalk.green('✨ GitHub Copilot CLI global skill installed.'));
          break;

        case 'aider':
        case 'openclaw':
        case 'droid':
        case 'factory-droid':
        case 'trae':
        case 'trae-cn':
        case 'hermes':
        case 'claw':
          const agentPath = path.join(targetDir, 'AGENTS.md');
          const installedAgent = await ensureKiteretsuLayer(agentPath, detailedProtocol);
          console.log(chalk.green(installedAgent ? `✨ ${target} protocol appended to AGENTS.md.` : `✨ ${target} protocol already exists in AGENTS.md.`));
          break;

        default:
          console.log(chalk.yellow(`Unknown integration target: ${target}. Supported: claude, codex, opencode, copilot, vscode, aider, openclaw, droid, trae, cursor, gemini, hermes, kiro, antigravity, git.`));
      }
    } catch (e: any) {
      console.log(chalk.red(`❌ Failed to install integration: ${e.message}`));
    }
  });

program.parse(process.argv);
