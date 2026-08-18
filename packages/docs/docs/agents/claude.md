# Integrating Claude Code

Kiteretsu integrates natively with **Claude Code** (Anthropic's official CLI coding agent) using a non-destructive instruction block and local **Model Context Protocol (MCP)** server configuration.

---

## Setup

Run in your project root:

```bash
npx kiteretsu init --agent claude
```

---

## What Kiteretsu Configures

### 1. `CLAUDE.md` Managed Section
Kiteretsu injects an isolated instruction block into your `CLAUDE.md`:

```markdown
<!-- KITERETSU:START -->
# Kiteretsu Intelligence Bridge (Claude Code / CLAUDE.md)

This repository uses Kiteretsu to maintain a continuous Code Intelligence Graph and Memory Layer.

## 🧭 Behavioral Protocol
1. **Context First**: Before planning or making changes, query Kiteretsu for relevant context:
   - Use MCP tool `kiteretsu_context` (or CLI `kiteretsu context "<task>"`)
2. **Check Blast Radius**: Before high-impact refactors, inspect callers & callees with `kiteretsu_blast_radius`.
3. **Verify**: Run related tests suggested by `kiteretsu_tests` or `kiteretsu context`.
4. **Record Outcome**: Record completed tasks with `kiteretsu_record_task`.
<!-- KITERETSU:END -->
```

Your custom instructions in `CLAUDE.md` outside this block are **never overwritten**.

### 2. `.claude.json` MCP Server Configuration
Kiteretsu configures Claude Code's project MCP connection:

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

## Workflow with Claude Code

When Claude Code handles architectural queries or refactoring tasks, it invokes Kiteretsu MCP tools:

1. **Planning**: Calls `kiteretsu_context(task: "refactor auth token verification")`.
2. **Blast Radius**: Calls `kiteretsu_blast_radius(target: "src/auth/token.ts")` to inspect downstream dependencies.
3. **Task Memory**: Calls `kiteretsu_record_task` to persist architectural learnings upon completion.
