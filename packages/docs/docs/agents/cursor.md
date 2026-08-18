# Integrating Cursor IDE

Kiteretsu integrates with **Cursor IDE** using project rules (`.cursor/rules/kiteretsu.mdc`) and Cursor's Model Context Protocol (MCP) support.

---

## Setup

Run in your project root:

```bash
npx kiteretsu init --agent cursor
```

---

## What Kiteretsu Configures

### 1. Cursor Rule (`.cursor/rules/kiteretsu.mdc`)
Kiteretsu creates `.cursor/rules/kiteretsu.mdc` with `alwaysApply: true`:

```markdown
---
description: Kiteretsu Codebase Intelligence & Memory Layer Protocol
globs: *
alwaysApply: true
---

# Kiteretsu Intelligence Bridge (Cursor IDE)

This repository uses Kiteretsu to maintain a continuous Code Intelligence Graph and Memory Layer.

## 🧭 Behavioral Protocol
1. **Context First**: Before planning or making changes, query Kiteretsu for relevant context:
   - Use MCP tool `kiteretsu_context` (or CLI `kiteretsu context "<task>"`)
2. **Check Blast Radius**: Before high-impact refactors, inspect callers & callees with `kiteretsu_blast_radius`.
3. **Verify**: Run related tests suggested by `kiteretsu_tests` or `kiteretsu context`.
4. **Record Outcome**: Record completed tasks with `kiteretsu_record_task`.
```

### 2. Cursor MCP Configuration (`.cursor/mcp.json`)
Kiteretsu configures the MCP server in `.cursor/mcp.json`:

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

---

## Workflow with Cursor

When you interact with **Cursor Agent**, **Cursor Chat**, or **Cursor Composer**:

1. **Rule Awareness**: The rule instructs Cursor to query Kiteretsu for repository architecture, symbol relationships, and blast radius.
2. **Direct MCP Access**: Cursor invokes `kiteretsu_context` or `kiteretsu_blast_radius` via MCP to inspect relevant files before modifying code.
3. **Precision Edits**: Cursor avoids hallucinating import paths or missing transitive callers across the codebase.
