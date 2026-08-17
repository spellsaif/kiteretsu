import { Knex } from 'knex';
import { Database } from '../database.js';

export interface RuleRecord {
  id?: number;
  name: string;
  description: string;
  scope_type?: string;
  scope_value?: string;
  severity?: string;
  created_at?: string;
  updated_at?: string;
}

export class RuleStore {
  constructor(private db: Database) { }

  get knex(): Knex {
    return this.db.getKnex();
  }

  async getAllRules(): Promise<RuleRecord[]> {
    return this.knex('rules').select('*');
  }

  async addOrUpdateRule(name: string, description: string, scopeType: string = 'global', scopeValue: string = '', severity: string = 'info'): Promise<void> {
    const existing = await this.knex('rules').where({ name }).first();
    if (existing) {
      await this.knex('rules').where({ name }).update({
        description,
        scope_type: scopeType,
        scope_value: scopeValue,
        severity,
        updated_at: this.knex.fn.now()
      });
    } else {
      await this.knex('rules').insert({
        name,
        description,
        scope_type: scopeType,
        scope_value: scopeValue,
        severity
      });
    }
  }
}
