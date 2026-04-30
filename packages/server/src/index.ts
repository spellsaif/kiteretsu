import express from 'express';
import cors from 'cors';
import { Kiteretsu } from '@kiteretsu/core';
import path from 'path';
import fs from 'fs';

export function startServer(rootDir: string, port: number = 3000) {
  const app = express();
  const kiteretsu = new Kiteretsu({ rootDir });

  app.use(cors());
  app.use(express.json());

  // Stats Endpoint
  app.get('/api/stats', async (req, res) => {
    try {
      const knex = kiteretsu.db.getKnex();
      const files = await knex('files').count('id as count').first();
      const symbols = await knex('symbols').count('id as count').first();
      const tasks = await knex('tasks').count('id as count').first();
      const rules = await knex('rules').count('id as count').first();
      const stale = await knex('files').where({ stale: true }).count('id as count').first();

      res.json({
        files: files?.count || 0,
        symbols: symbols?.count || 0,
        tasks: tasks?.count || 0,
        rules: rules?.count || 0,
        stale: stale?.count || 0
      });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Recent Tasks
  app.get('/api/tasks', async (req, res) => {
    try {
      const knex = kiteretsu.db.getKnex();
      const tasks = await knex('tasks').orderBy('created_at', 'desc').limit(50);
      res.json(tasks);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post('/api/tasks', async (req, res) => {
    try {
      const { description, type, outcome, notes } = req.body;
      const knex = kiteretsu.db.getKnex();
      const [id] = await knex('tasks').insert({ description, type, outcome, notes });
      const task = await knex('tasks').where({ id }).first();
      res.status(201).json(task);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.delete('/api/tasks/:id', async (req, res) => {
    try {
      const { id } = req.params;
      const knex = kiteretsu.db.getKnex();
      await knex('tasks').where({ id }).delete();
      res.status(204).end();
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Rules
  app.get('/api/rules', async (req, res) => {
    try {
      const knex = kiteretsu.db.getKnex();
      const rules = await knex('rules').orderBy('created_at', 'desc');
      res.json(rules);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post('/api/rules', async (req, res) => {
    try {
      const { name, description, scope_type, scope_value, severity } = req.body;
      const knex = kiteretsu.db.getKnex();
      const [id] = await knex('rules').insert({ name, description, scope_type: scope_type || 'global', scope_value: scope_value || '', severity: severity || 'info' });
      const rule = await knex('rules').where({ id }).first();
      res.status(201).json(rule);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.delete('/api/rules/:id', async (req, res) => {
    try {
      const { id } = req.params;
      const knex = kiteretsu.db.getKnex();
      await knex('rules').where({ id }).delete();
      res.status(204).end();
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Files with symbols (Memory Graph)
  app.get('/api/memory', async (req, res) => {
    try {
      const knex = kiteretsu.db.getKnex();
      const files = await knex('files').select('id', 'path', 'summary', 'stale').limit(50);

      const fileIds = files.map((f: any) => f.id);
      const symbols = await knex('symbols').whereIn('file_id', fileIds);

      const memoryGraph = files.map((f: any) => ({
        ...f,
        symbols: symbols.filter((s: any) => s.file_id === f.id)
      }));

      res.json(memoryGraph);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Simple Files
  app.get('/api/files', async (req, res) => {
    try {
      const knex = kiteretsu.db.getKnex();
      const files = await knex('files').select('path', 'summary', 'stale').limit(100);
      res.json(files);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Config
  app.get('/api/config', async (req, res) => {
    try {
      const absoluteRoot = path.resolve(rootDir);
      const configPath = path.join(absoluteRoot, '.kiteretsu', 'config.json');

      if (fs.existsSync(configPath)) {
        const configText = fs.readFileSync(configPath, 'utf-8');
        res.json(JSON.parse(configText));
      } else {
        // Return 404 with the path so the frontend can display it for debugging
        res.status(404).json({
          error: 'Config file not found',
          attemptedPath: configPath,
          rootDir: absoluteRoot
        });
      }
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Dependency Graph
  app.get('/api/graph', async (req, res) => {
    try {
      const knex = kiteretsu.db.getKnex();
      const edges = await knex('graph_edges')
        .where({ relation: 'imports' })
        .select('source_id', 'target_id');

      const allIds = new Set<number>();
      edges.forEach((e: any) => { allIds.add(e.source_id); allIds.add(e.target_id); });

      const files = await knex('files')
        .whereIn('id', Array.from(allIds))
        .select('id', 'path', 'summary', 'stale');

      const symbols = await knex('symbols')
        .whereIn('file_id', Array.from(allIds))
        .select('file_id', 'type');

      const nodes = files.map((f: any) => {
        const fileSymbols = symbols.filter((s: any) => s.file_id === f.id);
        return {
          id: f.id,
          label: f.path.split('/').pop() || f.path,
          path: f.path,
          summary: f.summary,
          stale: !!f.stale,
          symbolCount: fileSymbols.length,
          breakdown: {
            functions: fileSymbols.filter((s: any) => s.type === 'function').length,
            classes: fileSymbols.filter((s: any) => s.type === 'class').length,
            variables: fileSymbols.filter((s: any) => s.type === 'variable' || s.type === 'const').length,
          }
        };
      });

      const links = edges.map((e: any) => ({
        source: e.source_id,
        target: e.target_id,
      }));

      res.json({ nodes, links });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.listen(port, () => {
    console.log(`\n🚀 Kiteretsu Dashboard running at: http://localhost:${port}`);
    console.log(`📡 API Engine initialized for: ${rootDir}\n`);
  });

  // Serve Dashboard Static Files (Production)
  const dashboardDistPath = path.join(path.dirname(import.meta.url.replace('file:///', '')), '..', '..', 'dashboard', 'dist');
  
  if (fs.existsSync(dashboardDistPath)) {
    app.use(express.static(dashboardDistPath));
    app.get('*', (req, res) => {
      if (req.path.startsWith('/api')) return;
      res.sendFile(path.join(dashboardDistPath, 'index.html'));
    });
  } else {
    // In development, we might not have the dist folder
    app.get('/', (req, res) => {
      res.send(`
        <html>
          <body style="font-family: sans-serif; background: #0f172a; color: #94a3b8; display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100vh; margin: 0;">
            <h1 style="color: #38bdf8;">Kiteretsu API Server</h1>
            <p>Dashboard UI not built. Run <code>pnpm --filter dashboard build</code> to enable the UI.</p>
            <p>Or use the dev server at <code>http://localhost:5173</code></p>
          </body>
        </html>
      `);
    });
  }
}

// Standalone mode
if (process.argv[1] === import.meta.url.replace('file:///', '')) {
  const rootDir = process.cwd();
  startServer(rootDir);
}
