import chokidar from 'chokidar';
import { Kiteretsu } from './index.js';
import path from 'path';
import fs from 'fs';

export class CodeWatcher {
  private watcher: any = null;
  private kiteretsu: Kiteretsu;

  constructor(kiteretsu: Kiteretsu) {
    this.kiteretsu = kiteretsu;
  }

  private queue: string[] = [];
  private isProcessing: boolean = false;

  async start(rootDir: string) {
    return new Promise<void>((resolve, reject) => {
      console.log('👀 Starting Kiteretsu Incremental Intelligence Watcher...');

      const absoluteRoot = path.resolve(rootDir).replace(/\\/g, '/');
      const pattern = path.join(absoluteRoot, '**/*.{ts,tsx,js,jsx,py,go,rs,java,rb,c,cpp,php,cs,swift,lua}').replace(/\\/g, '/');

      this.watcher = chokidar.watch(pattern, {
        ignored: ['**/node_modules/**', '**/dist/**', '**/.git/**', '**/.kiteretsu/**'],
        persistent: true,
        ignoreInitial: true,
        awaitWriteFinish: { stabilityThreshold: 100, pollInterval: 50 }
      });

      const processQueue = async () => {
        if (this.isProcessing || this.queue.length === 0) return;
        this.isProcessing = true;

        const fullPath = this.queue.shift()!;

        try {
          if (fs.existsSync(fullPath)) {
            await this.kiteretsu.indexFile(fullPath);
          } else {
            await this.kiteretsu.removeFile(fullPath);
          }
        } catch (e: any) {
          // Silent error in watcher
        } finally {
          this.isProcessing = false;
          processQueue();
        }
      };

      const addToQueue = (filePath: string) => {
        const normalized = filePath.replace(/\\/g, '/');
        if (!this.queue.includes(normalized)) {
          this.queue.push(normalized);
          processQueue();
        }
      };

      this.watcher
        .on('add', addToQueue)
        .on('change', addToQueue)
        .on('unlink', addToQueue)
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
