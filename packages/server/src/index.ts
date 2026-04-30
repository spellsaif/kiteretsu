import express from 'express';
import cors from 'cors';
import { Kiteretsu } from '@kiteretsu/core';
import path from 'path';

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
      const configPath = path.join(rootDir, '.kiteretsu', 'config.json');
      if (require('fs').existsSync(configPath)) {
        const config = require('fs').readFileSync(configPath, 'utf-8');
        res.json(JSON.parse(config));
      } else {
        res.status(404).json({ error: 'Config not found' });
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

      const files = await knex('files').whereIn('id', Array.from(allIds)).select('id', 'path');
      const fileMap = new Map(files.map((f: any) => [f.id, f.path]));

      const nodes = files.map((f: any) => ({
        id: f.id,
        label: f.path.split('/').pop() || f.path,
        path: f.path
      }));

      const links = edges.map((e: any) => ({
        source: e.source_id,
        target: e.target_id,
        sourceLabel: fileMap.get(e.source_id),
        targetLabel: fileMap.get(e.target_id)
      }));

      res.json({ nodes, links });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.listen(port, () => {
    console.log(`Kiteretsu Dashboard API running at http://localhost:${port}`);
  });
}

// Standalone mode
if (process.argv[1] === import.meta.url.replace('file:///', '')) {
  const rootDir = process.cwd();
  startServer(rootDir);
}
