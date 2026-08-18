#!/usr/bin/env node
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  ListResourcesRequestSchema,
  ReadResourceRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import { Kiteretsu } from '@spellsaif/kiteretsu-core';
import path from 'path';
import { fileURLToPath } from 'url';

export async function runMcpServer(customRootDir?: string) {
  const finalRootDir = customRootDir || process.cwd();
  const kiteretsu = new Kiteretsu({ rootDir: finalRootDir });

  const server = new Server(
    {
      name: 'kiteretsu',
      version: '0.1.0',
    },
    {
      capabilities: {
        tools: {},
        resources: {},
      },
    }
  );

  // ─── MCP Resources ───
  server.setRequestHandler(ListResourcesRequestSchema, async () => {
    return {
      resources: [
        {
          uri: 'kiteretsu://repo/overview',
          name: 'Repository Overview',
          description: 'High-level metrics and orientation for the repository',
          mimeType: 'application/json',
        },
        {
          uri: 'kiteretsu://repo/architecture',
          name: 'Architecture & Central Modules',
          description: 'Architectural layers and core modules by dependency in-degree',
          mimeType: 'application/json',
        },
        {
          uri: 'kiteretsu://repo/health',
          name: 'Repository Health Diagnostics',
          description: 'Diagnostic report on index, graph, embeddings, memory, and database integrity',
          mimeType: 'application/json',
        },
        {
          uri: 'kiteretsu://repo/decisions',
          name: 'Architectural Decisions (ADRs)',
          description: 'All recorded architectural decisions, rationale, and affected path scopes',
          mimeType: 'application/json',
        },
        {
          uri: 'kiteretsu://repo/rules',
          name: 'Repository Governance Rules',
          description: 'Enforced architectural and coding rules',
          mimeType: 'application/json',
        },
      ],
    };
  });

  server.setRequestHandler(ReadResourceRequestSchema, async (request) => {
    await kiteretsu.init();
    const uri = request.params.uri;

    if (uri === 'kiteretsu://repo/overview') {
      const summary = await kiteretsu.getBootstrapSummary();
      return {
        contents: [
          {
            uri,
            mimeType: 'application/json',
            text: JSON.stringify(summary, null, 2),
          },
        ],
      };
    }

    if (uri === 'kiteretsu://repo/architecture') {
      const summary = await kiteretsu.getBootstrapSummary();
      return {
        contents: [
          {
            uri,
            mimeType: 'application/json',
            text: JSON.stringify({
              architecture: summary.architecture,
              centralModules: summary.centralModules,
            }, null, 2),
          },
        ],
      };
    }

    if (uri === 'kiteretsu://repo/health') {
      const diagnostics = await kiteretsu.runDiagnostics();
      return {
        contents: [
          {
            uri,
            mimeType: 'application/json',
            text: JSON.stringify(diagnostics, null, 2),
          },
        ],
      };
    }

    if (uri === 'kiteretsu://repo/decisions') {
      const decisions = await kiteretsu.getAllDecisions();
      return {
        contents: [
          {
            uri,
            mimeType: 'application/json',
            text: JSON.stringify(decisions, null, 2),
          },
        ],
      };
    }

    if (uri === 'kiteretsu://repo/rules') {
      const rules = await kiteretsu.ruleStore.getAllRules();
      return {
        contents: [
          {
            uri,
            mimeType: 'application/json',
            text: JSON.stringify(rules, null, 2),
          },
        ],
      };
    }

    throw new Error(`Unknown resource URI: ${uri}`);
  });

  // ─── MCP Tools ───
  server.setRequestHandler(ListToolsRequestSchema, async () => {
    return {
      tools: [
        {
          name: 'kiteretsu_context',
          description: 'MANDATORY: Compile a precision Context Pack for a coding task with four-signal multi-sensor relevance scoring, blast radius, tests, and ADRs',
          inputSchema: {
            type: 'object',
            properties: {
              task: {
                type: 'string',
                description: 'The description of the task to perform',
              },
              budget_tokens: {
                type: 'number',
                description: 'Maximum tokens for the context pack (default 8000)',
                default: 8000,
              },
            },
            required: ['task'],
          },
        },
        {
          name: 'get_context_pack',
          description: 'Alias for kiteretsu_context',
          inputSchema: {
            type: 'object',
            properties: {
              task: { type: 'string' },
              budget_tokens: { type: 'number', default: 8000 }
            },
            required: ['task']
          }
        },
        {
          name: 'kiteretsu_search',
          description: 'Search the repository using hybrid semantic and keyword retrieval',
          inputSchema: {
            type: 'object',
            properties: {
              query: { type: 'string', description: 'Search term or query' },
              limit: { type: 'number', default: 10 }
            },
            required: ['query']
          }
        },
        {
          name: 'kiteretsu_explain',
          description: 'Explain why a file or symbol is designed the way it is, combining source, graph, ADRs, rules, and tests',
          inputSchema: {
            type: 'object',
            properties: {
              target: { type: 'string', description: 'File path or symbol name to explain' }
            },
            required: ['target']
          }
        },
        {
          name: 'kiteretsu_symbol',
          description: 'Get symbol declaration details, type, and heritage',
          inputSchema: {
            type: 'object',
            properties: {
              name: { type: 'string', description: 'Symbol name' },
              file: { type: 'string', description: 'Optional declaring file path' }
            },
            required: ['name']
          }
        },
        {
          name: 'kiteretsu_callers',
          description: 'Find all functions, methods, and symbols across the repository that call or reference a symbol',
          inputSchema: {
            type: 'object',
            properties: {
              symbol: { type: 'string', description: 'Symbol name to query callers for' },
              file: { type: 'string', description: 'Optional declaring file path' }
            },
            required: ['symbol']
          }
        },
        {
          name: 'kiteretsu_callees',
          description: 'Find all functions and symbols called by a given symbol',
          inputSchema: {
            type: 'object',
            properties: {
              symbol: { type: 'string', description: 'Symbol name' },
              file: { type: 'string', description: 'Optional declaring file path' }
            },
            required: ['symbol']
          }
        },
        {
          name: 'kiteretsu_blast_radius',
          description: 'Calculate detailed downstream risk assessment and affected tests for modifying a symbol or file',
          inputSchema: {
            type: 'object',
            properties: {
              target: { type: 'string', description: 'Symbol name or file path' }
            },
            required: ['target']
          }
        },
        {
          name: 'kiteretsu_decisions',
          description: 'Retrieve architectural decisions (ADRs) relevant to a query or paths',
          inputSchema: {
            type: 'object',
            properties: {
              query: { type: 'string', description: 'Query for decisions' },
              paths: { type: 'array', items: { type: 'string' }, description: 'Optional file paths' }
            }
          }
        },
        {
          name: 'kiteretsu_history',
          description: 'Retrieve similar past tasks, outcomes, and developer learnings',
          inputSchema: {
            type: 'object',
            properties: {
              query: { type: 'string', description: 'Task description query' },
              limit: { type: 'number', default: 5 }
            },
            required: ['query']
          }
        },
        {
          name: 'kiteretsu_record_decision',
          description: 'Record a new architectural decision (ADR) in the repository memory',
          inputSchema: {
            type: 'object',
            properties: {
              title: { type: 'string', description: 'Decision title' },
              rationale: { type: 'string', description: 'Why this decision was chosen' },
              alternatives_considered: { type: 'string', description: 'Alternatives evaluated' },
              affected_paths: { type: 'array', items: { type: 'string' }, description: 'Affected paths or globs' },
              status: { type: 'string', enum: ['proposed', 'accepted', 'superseded', 'deprecated', 'rejected', 'active'], default: 'active' }
            },
            required: ['title', 'rationale']
          }
        },
        {
          name: 'kiteretsu_record_task',
          description: 'Record task execution outcome and developer learnings',
          inputSchema: {
            type: 'object',
            properties: {
              task: { type: 'string' },
              result: { type: 'string', enum: ['success', 'failure'] },
              notes: { type: 'string', default: '' },
              type: { type: 'string', default: 'unknown' }
            },
            required: ['task', 'result']
          }
        },
        {
          name: 'kiteretsu_bootstrap',
          description: 'Get initial mental model of repository architecture and central modules',
          inputSchema: {
            type: 'object',
            properties: {}
          }
        },
        {
          name: 'kiteretsu_doctor',
          description: 'Run health diagnostics across index, graph, embeddings, memory, and database',
          inputSchema: {
            type: 'object',
            properties: {}
          }
        },
        {
          name: 'index_repository',
          description: 'Scan and index the current repository',
          inputSchema: {
            type: 'object',
            properties: {},
          },
        },
        {
          name: 'record_rule',
          description: 'Record an architectural rule in repository memory',
          inputSchema: {
            type: 'object',
            properties: {
              name: { type: 'string' },
              description: { type: 'string' },
              scope: { type: 'string', default: 'global' },
              value: { type: 'string', default: '' }
            },
            required: ['name', 'description']
          }
        },
        {
          name: 'get_related_tests',
          description: 'Find related test files for changed source files',
          inputSchema: {
            type: 'object',
            properties: {
              files: { type: 'array', items: { type: 'string' } }
            },
            required: ['files']
          }
        }
      ],
    };
  });

  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args } = request.params;
    await kiteretsu.init();

    try {
      if (name === 'kiteretsu_context' || name === 'get_context_pack') {
        const task = (args as any).task;
        const budgetTokens = (args as any).budget_tokens;
        const pack = await kiteretsu.getContextPack(task, { budgetTokens });
        return { content: [{ type: 'text', text: JSON.stringify(pack, null, 2) }] };
      }

      if (name === 'kiteretsu_search') {
        const { query, limit = 10 } = (args as any) || {};
        const results = await kiteretsu.semanticSearch(query, limit);
        return { content: [{ type: 'text', text: JSON.stringify(results, null, 2) }] };
      }

      if (name === 'kiteretsu_explain') {
        const { target } = (args as any) || {};
        const result = await kiteretsu.explain(target);
        return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
      }

      if (name === 'kiteretsu_symbol') {
        const { name: symName, file } = (args as any) || {};
        const result = await kiteretsu.getSymbolGraph(symName, file);
        return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
      }

      if (name === 'kiteretsu_callers') {
        const { symbol, file } = (args as any) || {};
        const callers = await kiteretsu.getSymbolCallers(symbol, file);
        return { content: [{ type: 'text', text: JSON.stringify(callers, null, 2) }] };
      }

      if (name === 'kiteretsu_callees') {
        const { symbol, file } = (args as any) || {};
        const callees = await kiteretsu.getSymbolCallees(symbol, file);
        return { content: [{ type: 'text', text: JSON.stringify(callees, null, 2) }] };
      }

      if (name === 'kiteretsu_blast_radius') {
        const { target } = (args as any) || {};
        const result = await kiteretsu.getDetailedBlastRadius(target);
        return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
      }

      if (name === 'kiteretsu_decisions') {
        const { query = '', paths = [] } = (args as any) || {};
        const decisions = query
          ? await kiteretsu.getRelevantDecisions(query, paths, 10)
          : await kiteretsu.getAllDecisions();
        return { content: [{ type: 'text', text: JSON.stringify(decisions, null, 2) }] };
      }

      if (name === 'kiteretsu_history') {
        const { query, limit = 5 } = (args as any) || {};
        const tasks = await kiteretsu.getSimilarTasks(query, limit);
        return { content: [{ type: 'text', text: JSON.stringify(tasks, null, 2) }] };
      }

      if (name === 'kiteretsu_record_decision') {
        const { title, rationale, alternatives_considered = '', affected_paths = [], status = 'active' } = args as any;
        await kiteretsu.recordDecision(title, rationale, alternatives_considered, affected_paths, status as any);
        return { content: [{ type: 'text', text: 'Architectural decision recorded successfully.' }] };
      }

      if (name === 'kiteretsu_record_task') {
        const { task, result, type = 'unknown', notes = '' } = args as any;
        await kiteretsu.recordTaskOutcome(task, type, result, notes);
        return { content: [{ type: 'text', text: 'Task outcome recorded successfully.' }] };
      }

      if (name === 'kiteretsu_bootstrap') {
        const summary = await kiteretsu.getBootstrapSummary();
        return { content: [{ type: 'text', text: JSON.stringify(summary, null, 2) }] };
      }

      if (name === 'kiteretsu_doctor') {
        const diagnostics = await kiteretsu.runDiagnostics();
        return { content: [{ type: 'text', text: JSON.stringify(diagnostics, null, 2) }] };
      }

      if (name === 'index_repository') {
        await kiteretsu.index();
        return { content: [{ type: 'text', text: 'Repository indexing complete.' }] };
      }

      if (name === 'record_rule') {
        const { name: ruleName, description, scope = 'global', value = '' } = args as any;
        await kiteretsu.addRule(ruleName, description, scope, value);
        return { content: [{ type: 'text', text: 'Rule recorded successfully.' }] };
      }

      if (name === 'get_related_tests') {
        const { files } = args as any;
        const tests = await kiteretsu.getRelatedTests(files);
        return { content: [{ type: 'text', text: JSON.stringify(tests, null, 2) }] };
      }

      throw new Error(`Unknown tool: ${name}`);
    } catch (error: any) {
      return {
        content: [{ type: 'text', text: `Error: ${error.message}` }],
        isError: true,
      };
    }
  });

  const transport = new StdioServerTransport();
  await server.connect(transport);
}

const isDirectExecution =
  !process.env.VITEST &&
  (process.argv[1] === fileURLToPath(import.meta.url) ||
    process.argv[1]?.endsWith('kiteretsu-mcp') ||
    process.argv[1]?.endsWith('kiteretsu-mcp.js') ||
    process.argv[1]?.endsWith('dist/index.js') ||
    process.argv[1]?.endsWith('src/index.ts'));

if (isDirectExecution) {
  runMcpServer().catch((error) => {
    console.error('Fatal error running Kiteretsu MCP server:', error);
    process.exit(1);
  });
}
