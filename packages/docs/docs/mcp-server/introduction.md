# Model Context Protocol (MCP)

Kiteretsu supports the **Model Context Protocol (MCP)**, a standard that allows AI agents to communicate with external tools and data sources.

## Why use the MCP Server?

While the CLI and file-based instructions work great, the MCP server provides:
- **Direct Tool Access**: The agent sees Kiteretsu as a native tool (e.g., `get_context_pack`).
- **Higher Fidelity**: Richer data exchange compared to terminal output.
- **Real-time Interaction**: Instant communication between the agent and the Kiteretsu engine.

## Supported Clients

The Kiteretsu MCP server works with any MCP-compatible client, including:
- **Claude Desktop**
- **Cursor**
- **Zed Editor**
- **Sourcegraph Cody**
- **Antigravity**

## Configuration

You can connect Kiteretsu to your agent in two ways depending on how you've installed it.

### A. Production (Binary / CLI)
If you have installed Kiteretsu globally or are using a standalone binary, point your agent directly to the CLI with the `mcp` command.

**Example: Claude Desktop**
```json
{
  "mcpServers": {
    "kiteretsu": {
      "command": "kiteretsu", 
      "args": ["mcp"]
    }
  }
}
```

### B. Developer (Source)
If you are running from the source code, point to the compiled `mcp-server` script using `node`.

**Example: Claude Desktop**
```json
{
  "mcpServers": {
    "kiteretsu": {
      "command": "node",
      "args": ["/absolute/path/to/kiteretsu/packages/mcp-server/dist/index.js"]
    }
  }
}
```

## Available Tools

Once connected, your agent will have access to the following tools:

- **`index_repository`**: Triggers a full project re-index.
- **`get_context_pack`**: Returns a structured context pack for a task.
- **`get_related_tests`**: Finds tests affected by specific files.
- **`record_rule`**: Records a new architectural rule.
- **`record_task_outcome`**: Records a task's success or failure.
