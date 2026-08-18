# Model Context Protocol (MCP) Server

Kiteretsu exposes its Code Intelligence Graph, Context Compiler, and Memory Layer as a standard **Model Context Protocol (MCP)** server via `@spellsaif/kiteretsu-mcp-server`.

---

## Connection Configuration

Add Kiteretsu to your MCP client configuration (e.g. `claude_desktop_config.json`, `.cursor/mcp.json`, `opencode.json`):

```json
{
  "mcpServers": {
    "kiteretsu": {
      "command": "npx",
      "args": ["-y", "@spellsaif/kiteretsu-mcp-server"]
    }
  }
}
```

Or when installed globally:

```json
{
  "mcpServers": {
    "kiteretsu": {
      "command": "kiteretsu-mcp"
    }
  }
}
```

---

## Complete MCP Tools Reference

### 1. Primary Context Tool
- **`kiteretsu_context`**: Compiles an explainable Context Pack for a task using Four-Signal Multi-Sensor Fusion.
  - Arguments: `task` (string), `budget_tokens` (optional number), `min_score` (optional number).

### 2. Symbol & Graph Traversal
- **`kiteretsu_symbol`**: Locates declaration sites and references for a specific symbol.
  - Arguments: `symbol_name` (string).
- **`kiteretsu_callers`**: Finds all symbols and files that call or extend a target symbol.
  - Arguments: `symbol_name` (string).
- **`kiteretsu_callees`**: Finds all downstream symbols called by a target symbol.
  - Arguments: `symbol_name` (string).
- **`kiteretsu_blast_radius`**: Computes transitive downstream impact, callers tree, affected tests, and risk rating (`LOW`, `MEDIUM`, `HIGH`).
  - Arguments: `target` (string file path or symbol), `max_depth` (optional number).

### 3. Code Understanding & Retrieval
- **`kiteretsu_explain`**: Deeply explains *why* a file or symbol is designed the way it is, synthesizing AST, graph callers/callees, ADRs, rules, and tests.
  - Arguments: `target` (string file path or symbol).
- **`kiteretsu_search`**: Performs semantic vector search across indexed files and symbols.
  - Arguments: `query` (string), `limit` (optional number).

### 4. Memory & Architectural Governance
- **`kiteretsu_decisions`**: Lists all recorded Architectural Decision Records (ADRs) and path scopes.
- **`kiteretsu_history`**: Queries episodic memory for past completed tasks and engineer learnings.
  - Arguments: `task_query` (optional string).
- **`kiteretsu_record_decision`**: Records a new architectural decision.
  - Arguments: `title` (string), `rationale` (string), `alternatives` (optional string[]), `paths` (optional string[]), `status` (optional string).
- **`kiteretsu_record_task`**: Records the outcome of a coding task to episodic memory.
  - Arguments: `task` (string), `result` (`"success"` or `"failure"`), `type` (optional string), `notes` (optional string).
- **`record_rule`**: Stores a scoped architectural rule (`global`, path-specific, or language-specific).
  - Arguments: `name` (string), `description` (string), `scope` (optional string), `value` (optional string).

### 5. Repository Diagnostics & Operations
- **`kiteretsu_bootstrap`**: Generates a high-level mental model of repository architecture and central modules.
- **`kiteretsu_doctor`**: Runs health diagnostics across index integrity, SQLite WAL database, embeddings, and agent integrations.
- **`index_repository`**: Triggers incremental repository re-indexing.
- **`get_related_tests`**: Discovers test files affected by changes to specified source files.
  - Arguments: `files` (string[]).

---

## MCP Resources

Kiteretsu exposes standard readable resources:
- `kiteretsu://repo/overview`: High-level metrics and repository orientation.
- `kiteretsu://repo/architecture`: Central modules ranked by graph in-degree.
- `kiteretsu://repo/health`: Diagnostic health report.
- `kiteretsu://repo/decisions`: All recorded ADRs.
- `kiteretsu://repo/rules`: All active architectural rules.
