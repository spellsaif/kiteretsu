# Generic MCP Agent & AGENTS.md

Kiteretsu provides universal compatibility for any AI coding assistant that supports the **Model Context Protocol (MCP)** or standard project instructions in **`AGENTS.md`**.

---

## Setup

Run in your project root:

```bash
npx kiteretsu init --agent generic
```

---

## What Kiteretsu Configures

### 1. `AGENTS.md` Protocol
Creates or updates `AGENTS.md` with standard repository instructions:

```markdown
<!-- KITERETSU:START -->
# Kiteretsu Intelligence Bridge (Generic MCP Agent / AGENTS.md)

This repository uses Kiteretsu to maintain a continuous Code Intelligence Graph and Memory Layer.

## 🧭 Behavioral Protocol
1. **Context First**: Before planning or making changes, query Kiteretsu for relevant context:
   - Use MCP tool `kiteretsu_context` (or CLI `kiteretsu context "<task>"`)
2. **Check Blast Radius**: Before high-impact refactors, inspect callers & callees with `kiteretsu_blast_radius`.
3. **Verify**: Run related tests suggested by `kiteretsu_tests` or `kiteretsu context`.
4. **Record Outcome**: Record completed tasks with `kiteretsu_record_task`.
<!-- KITERETSU:END -->
```

### 2. Universal `mcp.json`
Generates a standard `mcp.json` file in the project root:

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

## Manual MCP Configuration

If you are configuring a custom agent or MCP client (e.g. Zed, Neovim MCP, Continue.dev):

| Field | Value |
| :--- | :--- |
| **Command** | `npx` |
| **Args** | `["-y", "@kiteretsu/mcp-server"]` |
| **Transport** | Stdio |
