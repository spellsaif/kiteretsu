# Integrating Gemini CLI

Kiteretsu integrates with **Google Gemini CLI** and Gemini-based coding tools through `GEMINI.md` project instructions and MCP server configuration in `.gemini/settings.json`.

---

## Setup

Run in your project root:

```bash
npx kiteretsu init --agent gemini
```

---

## What Kiteretsu Configures

### 1. `GEMINI.md` Managed Section
Kiteretsu injects a managed instruction block into `GEMINI.md`:

```markdown
<!-- KITERETSU:START -->
# Kiteretsu Intelligence Bridge (Gemini CLI / GEMINI.md)

This repository uses Kiteretsu to maintain a continuous Code Intelligence Graph and Memory Layer.

## 🧭 Behavioral Protocol
1. **Context First**: Before planning or making changes, query Kiteretsu for relevant context:
   - Use MCP tool `kiteretsu_context` (or CLI `kiteretsu context "<task>"`)
2. **Check Blast Radius**: Before high-impact refactors, inspect callers & callees with `kiteretsu_blast_radius`.
3. **Verify**: Run related tests suggested by `kiteretsu_tests` or `kiteretsu context`.
4. **Record Outcome**: Record completed tasks with `kiteretsu_record_task`.
<!-- KITERETSU:END -->
```

### 2. `.gemini/settings.json` MCP Server Configuration
Kiteretsu configures the MCP server under `mcpServers`:

```json
{
  "mcpServers": {
    "kiteretsu": {
      "command": "npx",
      "args": ["-y", "@kiteretsu/mcp-server"]
    }
  }
}
```

---

## Workflow with Gemini CLI

1. **Context Retrieval**: Gemini queries `kiteretsu_context` before generating code for architectural or multi-file tasks.
2. **Token Efficiency**: Instead of recursively exploring directories, Gemini focuses on the ranked candidate files provided in the context pack.
3. **Task Persistence**: Gemini logs task outcomes to Kiteretsu's episodic memory store via `kiteretsu_record_task`.
