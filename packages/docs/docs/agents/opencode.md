# Integrating OpenCode

Kiteretsu integrates with **OpenCode** using project `AGENTS.md` instructions, `.opencode/agents/` definitions, and `opencode.json` MCP server configuration.

---

## Setup

Run in your project root:

```bash
npx kiteretsu init --agent opencode
```

---

## What Kiteretsu Configures

### 1. `AGENTS.md` & `.opencode/agents/`
Kiteretsu injects a managed instruction section into `AGENTS.md` and creates `.opencode/agents/kiteretsu-context.md` for OpenCode agent definitions:

```markdown
---
description: Kiteretsu Context and Repository Intelligence Agent
---

<!-- KITERETSU:START -->
# Kiteretsu Intelligence Bridge (OpenCode / AGENTS.md)

This repository uses Kiteretsu to maintain a continuous Code Intelligence Graph and Memory Layer.

## 🧭 Behavioral Protocol
1. **Context First**: Before planning or making changes, query Kiteretsu for relevant context:
   - Use MCP tool `kiteretsu_context` (or CLI `kiteretsu context "<task>"`)
2. **Check Blast Radius**: Before high-impact refactors, inspect callers & callees with `kiteretsu_blast_radius`.
3. **Verify**: Run related tests suggested by `kiteretsu_tests` or `kiteretsu context`.
4. **Record Outcome**: Record completed tasks with `kiteretsu_record_task`.
<!-- KITERETSU:END -->
```

### 2. `opencode.json` MCP Configuration
Kiteretsu configures the MCP server under `mcp.servers`:

```json
{
  "mcp": {
    "servers": {
      "kiteretsu": {
        "type": "local",
        "command": ["npx", "-y", "@kiteretsu/mcp-server"]
      }
    }
  }
}
```

---

## Workflow with OpenCode

1. **Protocol Discovery**: OpenCode discovers project instructions from `AGENTS.md` and `.opencode/agents/`.
2. **MCP Queries**: OpenCode directly invokes `kiteretsu_context`, `kiteretsu_explain`, and `kiteretsu_blast_radius`.
3. **Memory Storage**: Architectural decisions and task outcomes are committed to the local repository graph via `kiteretsu_record_decision` and `kiteretsu_record_task`.
