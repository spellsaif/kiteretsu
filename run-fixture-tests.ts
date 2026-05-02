import { execSync } from 'child_process';
import path from 'path';
import fs from 'fs-extra';
import chalk from 'chalk';

interface ExpectedJson {
  trigger_file: string;
  expected_blast_radius: string[];
  expected_NOT_in_blast_radius: string[];
  expected_UNRESOLVABLE?: string[];
  notes: string;
}

const ROOT_DIR = process.cwd();
const FIXTURES_DIR = path.join(ROOT_DIR, 'test-fixtures');

async function runTests() {
  console.log(chalk.bold.cyan('\n🚀 Kiteretsu Test Fixture Runner\n'));

  // 1. Index everything first
  console.log(chalk.gray('Skipping auto-index (run manually if needed)...'));
  const cliPath = path.join(ROOT_DIR, 'packages/cli/dist/index.js');
  // execSync(`node ${cliPath} index`, { stdio: 'ignore' });

  const expectedFiles = await findFiles(FIXTURES_DIR, 'expected.json');
  const results: any[] = [];

  for (const expectedFile of expectedFiles) {
    const fixtureDir = path.dirname(expectedFile);
    const relativeDir = path.relative(FIXTURES_DIR, fixtureDir);
    const lang = relativeDir.split(path.sep)[0];
    const category = relativeDir.split(path.sep)[1] || 'general';

    const expected: ExpectedJson = await fs.readJson(expectedFile);
    
    console.log(chalk.white(`Testing [${chalk.blue(lang)}] ${chalk.yellow(category)}...`));

    try {
      const rawOutput = execSync(`node ${cliPath} blast-radius ${expected.trigger_file}`, { encoding: 'utf8' });
      
      // Extract JSON from output (it might contain ASCII banner)
      const jsonStart = rawOutput.indexOf('{');
      const jsonEnd = rawOutput.lastIndexOf('}');
      if (jsonStart === -1 || jsonEnd === -1) {
        throw new Error('No JSON found in output');
      }
      const jsonStr = rawOutput.substring(jsonStart, jsonEnd + 1);
      const actual = JSON.parse(jsonStr);
      
      const normalize = (p: string) => p.replace(/\\/g, '/').toLowerCase();
      const actualNormalized = actual.blast_radius.map(normalize);
      
      const missing = expected.expected_blast_radius.filter(f => !actualNormalized.includes(normalize(f)));
      const extra = actualNormalized.filter((f: string) => 
        !expected.expected_blast_radius.some(ef => normalize(ef) === f) && 
        !expected.expected_UNRESOLVABLE?.some(ef => normalize(ef) === f)
      );
      const falsePositives = expected.expected_NOT_in_blast_radius.filter(f => actualNormalized.includes(normalize(f)));

      const passed = missing.length === 0 && falsePositives.length === 0;

      results.push({
        lang,
        category,
        passed,
        missing,
        extra,
        falsePositives
      });
    } catch (e: any) {
      console.error(chalk.red(`  Failed to run fixture: ${e.message}`));
      results.push({ lang, category, passed: false, error: e.message });
    }
  }

  // Print Results Table
  console.log('\n' + chalk.bold.underline('Test Results Summary:'));
  console.log(chalk.white('Language   | Category           | Status | Issues'));
  console.log(chalk.gray('-----------|--------------------|--------|-------'));

  let total = results.length;
  let passedCount = 0;

  for (const r of results) {
    const status = r.passed ? chalk.green('PASS') : chalk.red('FAIL');
    let issues = '';
    if (r.missing?.length) issues += `Missing: ${r.missing.length} `;
    if (r.falsePositives?.length) issues += `FalsePos: ${r.falsePositives.length} `;
    if (r.error) issues = r.error;

    console.log(`${r.lang.padEnd(10)} | ${r.category.padEnd(18)} | ${status.padEnd(10)} | ${issues}`);
    if (r.passed) passedCount++;
  }

  const score = (passedCount / total) * 100;
  console.log('\n' + chalk.bold(`Final Score: ${score.toFixed(1)}%`));

  console.log('\n| Score | Meaning |');
  console.log('|-------|---------|');
  console.log('| 100%  | Ship it |');
  console.log('| 95%+  | Ship with known gaps documented |');
  console.log('| 85%+  | Beta-ready, not production |');
  console.log('| <85%  | Do not ship — blast radius cannot be trusted |');

  if (score < 85) {
    console.log(chalk.red('\n❌ CRITICAL: Blast radius cannot be trusted. Do not ship.'));
    process.exit(1);
  } else if (score < 100) {
    console.log(chalk.yellow('\n⚠️  Caution: Some gaps identified.'));
  } else {
    console.log(chalk.green('\n✅ Perfect! System is ready for production.'));
  }
}

async function findFiles(dir: string, filename: string): Promise<string[]> {
  const results: string[] = [];
  const list = await fs.readdir(dir);
  for (const file of list) {
    const fullPath = path.join(dir, file);
    const stat = await fs.stat(fullPath);
    if (stat && stat.isDirectory()) {
      results.push(...(await findFiles(fullPath, filename)));
    } else if (file === filename) {
      results.push(fullPath);
    }
  }
  return results;
}

runTests().catch(console.error);
