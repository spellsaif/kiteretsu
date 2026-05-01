import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import { Kiteretsu } from '@kiteretsu/core';
import path from 'path';

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
      },
    }
  );

  server.setRequestHandler(ListToolsRequestSchema, async () => {
    return {
      tools: [
        {
          name: 'get_context_pack',
          description: 'Generate a Context Pack for a specific coding task',
          inputSchema: {
            type: 'object',
            properties: {
              task: {
                type: 'string',
                description: 'The description of the task to be performed',
              },
              budget_tokens: {
                type: 'number',
                description: 'Maximum tokens for the context pack',
                default: 6000,
              },
            },
            required: ['task'],
          },
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
          description: 'MANDATORY: Use this tool to record a new architectural rule in the Kiteretsu database. DO NOT just write to a markdown file. Rules recorded here are automatically injected into the context of all future tasks for this project.',
          inputSchema: {
            type: 'object',
            properties: {
              name: { 
                type: 'string',
                description: 'A short, unique name for the rule (e.g., "no-db-in-ui")'
              },
              description: { 
                type: 'string',
                description: 'The full explanation of the rule and why it exists.'
              },
              scope: { 
                type: 'string', 
                description: 'The scope of the rule (global or a specific directory)',
                default: 'global' 
              },
              value: { 
                type: 'string', 
                description: 'Optional technical value or pattern to enforce.',
                default: '' 
              }
            },
            required: ['name', 'description']
          }
        },
        {
          name: 'record_task_outcome',
          description: 'Record the outcome of a coding task to help the agent learn',
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
          name: 'get_related_tests',
          description: 'Find test files related to specific source files',
          inputSchema: {
            type: 'object',
            properties: {
              files: {
                type: 'array',
                items: { type: 'string' },
                description: 'The source files to find tests for'
              }
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
      if (name === 'get_context_pack') {
        const task = (args as any).task;
        const pack = await kiteretsu.getContextPack(task);
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(pack, null, 2),
            },
          ],
        };
      }

      if (name === 'index_repository') {
        await kiteretsu.index();
        return {
          content: [{ type: 'text', text: 'Repository indexing complete.' }],
        };
      }

      if (name === 'record_rule') {
        const { name: ruleName, description, scope = 'global', value = '' } = args as any;
        await kiteretsu.addRule(ruleName, description, scope, value);
        return {
          content: [{ type: 'text', text: 'Rule recorded successfully.' }],
        };
      }

      if (name === 'record_task_outcome') {
        const { task, result, type = 'unknown', notes = '' } = args as any;
        await kiteretsu.recordTaskOutcome(task, type, result, notes);
        return {
          content: [{ type: 'text', text: 'Task outcome recorded successfully.' }],
        };
      }

      if (name === 'get_related_tests') {
        const { files } = args as any;
        const tests = await kiteretsu.getRelatedTests(files);
        return {
          content: [{ type: 'text', text: JSON.stringify(tests, null, 2) }],
        };
      }

      throw new Error(`Unknown tool: ${name}`);
    } catch (error: any) {
      return {
        content: [
          {
            type: 'text',
            text: `Error: ${error.message}`,
          },
        ],
        isError: true,
      };
    }
  });

  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error('Kiteretsu MCP server running on stdio');
}

// Auto-start if run directly
if (require.main === module) {
  runMcpServer().catch((error) => {
    console.error('Fatal error in MCP server:', error);
    process.exit(1);
  });
}
