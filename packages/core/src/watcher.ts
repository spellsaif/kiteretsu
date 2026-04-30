import chokidar from 'chokidar';
import { Kiteretsu } from './index.js';
import path from 'path';

export class CodeWatcher {
  private watcher: any = null;
  private kiteretsu: Kiteretsu;

  constructor(kiteretsu: Kiteretsu) {
    this.kiteretsu = kiteretsu;
  }

  async start(rootDir: string) {
    console.log('👀 Starting Kiteretsu self-healing memory watcher...');
    
    this.watcher = chokidar.watch([
      path.join(rootDir, 'src/**/*.ts'),
      path.join(rootDir, 'packages/**/*.ts')
    ], {
      ignored: /(^|[\/\\])\../, // ignore dotfiles
      persistent: true
    });

    this.watcher
      .on('change', async (filePath: string) => {
        console.log(`\n🔄 File changed: ${filePath}`);
        console.log(`🧠 Triggering self-healing memory update...`);
        // Simple implementation: re-run full index
        // In a production version, we would only index the changed file.
        try {
          await this.kiteretsu.index();
          console.log(`✅ Memory updated successfully.`);
        } catch (e) {
          console.error(`❌ Failed to update memory:`, e);
        }
      });
  }

  stop() {
    if (this.watcher) {
      this.watcher.close();
    }
  }
}
