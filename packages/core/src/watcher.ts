import chokidar from 'chokidar';
import { Kiteretsu } from './index.js';
import path from 'path';
import fs from 'fs';
import chalk from 'chalk';

export class CodeWatcher {
  private watcher: any = null;
  private kiteretsu: Kiteretsu;

  constructor(kiteretsu: Kiteretsu) {
    this.kiteretsu = kiteretsu;
  }

  private queue: string[] = [];
  private isProcessing: boolean = false;
  private debounceTimeouts: Map<string, NodeJS.Timeout> = new Map();
  private static isStarted: boolean = false;

  async start(rootDir: string) {
    if (CodeWatcher.isStarted) return;
    CodeWatcher.isStarted = true;

    return new Promise<void>(async (resolve, reject) => {
      const absoluteRoot = path.resolve(rootDir).replace(/\\/g, '/');
      const excludes = await this.kiteretsu.scanner.getExcludes();

      console.log('\n' + chalk.bold.cyan('👀 Kiteretsu Intelligence Watcher Active'));
      console.log(chalk.gray(`  Monitoring: ${absoluteRoot}`));
      console.log(chalk.gray('  Mode: Atomic Polling (Ultra-Reliable)\n'));

      this.watcher = chokidar.watch('.', {
        cwd: absoluteRoot,
        ignored: [
          ...excludes,
          /(^|[/\\])\../
        ],
        persistent: true,
        ignoreInitial: true,
        followSymlinks: false,
        usePolling: true,
        interval: 100,
        binaryInterval: 300,
        awaitWriteFinish: { stabilityThreshold: 100, pollInterval: 50 }
      });

      const processQueue = async () => {
        if (this.isProcessing || this.queue.length === 0) return;
        this.isProcessing = true;

        const fullPath = this.queue.shift()!;
        const rootDir = this.kiteretsu.getRootDir();
        const relativePath = path.relative(rootDir, fullPath).replace(/\\/g, '/');

        try {
          if (fs.existsSync(fullPath)) {
            // Get old symbols for comparison
            const knex = this.kiteretsu.getDatabase().getKnex();
            console.log(chalk.gray(`[Watcher] Analyzing semantic changes for ${relativePath}...`));

            const oldSymbols = await knex('symbols')
              .join('files', 'symbols.file_id', 'files.id')
              .whereRaw('LOWER(files.path) = LOWER(?)', [relativePath])
              .select('name');
            const oldNames = new Set(oldSymbols.map((s: any) => s.name));
            console.log(chalk.gray(`[Watcher] Found ${oldSymbols.length} existing symbols.`));

            await this.kiteretsu.indexFile(fullPath);

            // Get new symbols
            const newSymbols = await knex('symbols')
              .join('files', 'symbols.file_id', 'files.id')
              .whereRaw('LOWER(files.path) = LOWER(?)', [relativePath])
              .select('name');
            const newNames = newSymbols.map((s: any) => s.name);

            // Check for changes in exports/symbols
            const added = newNames.filter((n: string) => !oldNames.has(n));
            const removed = Array.from(oldNames).filter((n: any) => !newNames.includes(n));

            if (added.length > 0 || removed.length > 0) {
              const affected = await this.kiteretsu.getBlastRadius(fullPath);
              console.log(`\n🧠 Semantic Update in ${relativePath}:`);
              if (added.length > 0) console.log(`  ➕ Added: ${added.join(', ')}`);
              if (removed.length > 0) console.log(`  ➖ Removed: ${removed.join(', ')}`);

              if (affected.length > 0) {
                console.log(`  💥 Blast Radius: ${affected.length} files might be affected:`);
                affected.slice(0, 5).forEach(f => console.log(`    ⚡ ${f}`));
                if (affected.length > 5) console.log(`    ... and ${affected.length - 5} more`);
              }
            } else {
              console.log(`✅ Incremental Update: ${relativePath}`);
            }
          } else {
            console.log(`🗑️ Removing: ${relativePath}`);
            await this.kiteretsu.removeFile(fullPath);
          }
        } catch (e: any) {
          console.error(`❌ Watcher Error: ${e.message}`);
        } finally {
          this.isProcessing = false;
          processQueue();
        }
      };

      const addToQueue = (filePath: string) => {
        const normalized = filePath.replace(/\\/g, '/');

        // Debounce multiple events for the same file (e.g. Save + Format)
        if (this.debounceTimeouts.has(normalized)) {
          clearTimeout(this.debounceTimeouts.get(normalized)!);
        }

        const timeout = setTimeout(() => {
          this.debounceTimeouts.delete(normalized);
          if (!this.queue.includes(normalized)) {
            this.queue.push(normalized);
            processQueue();
          }
        }, 250);

        this.debounceTimeouts.set(normalized, timeout);
      };

      const supportedExtensions = ['.ts', '.tsx', '.js', '.jsx', '.py', '.go', '.rs', '.java', '.rb', '.c', '.cpp', '.php', '.cs', '.swift', '.lua'];

      this.watcher
        .on('all', (event: string, filePath: string) => {
          const absPath = path.resolve(absoluteRoot, filePath).replace(/\\/g, '/');

          // CRITICAL: Ignore everything in node_modules to avoid pnpm symlink loops
          if (absPath.includes('node_modules')) return;

          const ext = path.extname(filePath).toLowerCase();
          if (!supportedExtensions.includes(ext) && event !== 'unlink') return;

          // No more spamming logs for every event
          addToQueue(absPath);
        })
        .on('ready', () => {
          console.log('✅ Watcher ready.');
          resolve();
        })
        .on('error', (error: Error) => {
          reject(error);
        });
    });
  }

  stop() {
    if (this.watcher) {
      this.watcher.close();
    }
  }
}
