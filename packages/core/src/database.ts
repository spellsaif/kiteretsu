import knex, { Knex } from 'knex';
import path from 'path';
import fs from 'fs-extra';

export class Database {
  private db: Knex;

  constructor(dbPath: string) {
    const dir = path.dirname(dbPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirpSync(dir);
    }

    this.db = knex({
      client: 'better-sqlite3',
      connection: {
        filename: dbPath,
      },
      useNullAsDefault: true,
    });
  }

  async initialize() {
    // Enable WAL mode for better concurrent read performance
    await this.db.raw('PRAGMA journal_mode = WAL');

    if (!(await this.db.schema.hasTable('files'))) {
      await this.db.schema.createTable('files', (table) => {
        table.increments('id').primary();
        table.string('path').unique().notNullable();
        table.string('hash').notNullable();
        table.string('summary');
        table.boolean('stale').defaultTo(false);
        table.timestamp('last_indexed').defaultTo(this.db.fn.now());
        table.timestamps(true, true);
      });
    }

    if (!(await this.db.schema.hasTable('symbols'))) {
      await this.db.schema.createTable('symbols', (table) => {
        table.increments('id').primary();
        table.string('name').notNullable();
        table.string('type').notNullable(); // class, function, interface, etc.
        table.integer('file_id').references('id').inTable('files').onDelete('CASCADE');
        table.integer('start_line');
        table.integer('end_line');
        table.timestamps(true, true);

        // Index for fast lookups during context pack generation
        table.index(['file_id']);
        table.index(['name']);
      });
    }

    if (!(await this.db.schema.hasTable('graph_edges'))) {
      await this.db.schema.createTable('graph_edges', (table) => {
        table.increments('id').primary();
        table.string('source_type').notNullable();
        table.integer('source_id').notNullable();
        table.string('relation').notNullable(); // imports, tested_by
        table.string('target_type').notNullable();
        table.integer('target_id').notNullable();
        table.float('confidence').defaultTo(1.0);
        table.string('provenance');
        table.timestamps(true, true);

        // Indexes for fast blast radius lookups
        table.index(['source_id', 'relation']);
        table.index(['target_id', 'relation']);
      });
    }

    if (!(await this.db.schema.hasTable('tasks'))) {
      await this.db.schema.createTable('tasks', (table) => {
        table.increments('id').primary();
        table.string('description').notNullable();
        table.string('type').notNullable();
        table.string('outcome'); // success, failure
        table.text('notes');
        table.timestamps(true, true);
      });
    }

    if (!(await this.db.schema.hasTable('rules'))) {
      await this.db.schema.createTable('rules', (table) => {
        table.increments('id').primary();
        table.string('name').notNullable();
        table.text('description').notNullable();
        table.string('scope_type'); // global, path, language
        table.string('scope_value');
        table.string('severity').defaultTo('info');
        table.timestamps(true, true);
      });
    }
  }

  getKnex(): Knex {
    return this.db;
  }

  async getSymbolsForFile(filePath: string): Promise<any[]> {
    const file = await this.db('files').where({ path: filePath }).first();
    if (!file) return [];
    return this.db('symbols').where({ file_id: file.id });
  }

  async destroy() {
    await this.db.destroy();
  }
}
