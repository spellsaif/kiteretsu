---
sidebar_position: 2
---

# Quick Start

Follow this guide to get Kiteretsu intelligence running with your coding agents in seconds.

---

### 1. One-Command Initialization
Run in your project root:

```bash
npx kiteretsu init
```

This will:
- Detect your repository languages and existing agent configurations.
- Create `kiteretsu.config.ts` if missing.
- Inject non-destructive instructions into `AGENTS.md`, `CLAUDE.md`, `.cursor/rules/`, etc.
- Register `@spellsaif/kiteretsu-mcp-server` MCP endpoints.
- Build the initial code graph index.

---

### 2. Supported Agent Guides

Explore the setup guides for your specific agent:

- [**Claude Code**](../agents/claude) (`CLAUDE.md` + `.claude.json`)
- [**Cursor IDE**](../agents/cursor) (`.cursor/rules/kiteretsu.mdc` + `.cursor/mcp.json`)
- [**Gemini CLI**](../agents/gemini) (`GEMINI.md` + `.gemini/settings.json`)
- [**OpenCode**](../agents/opencode) (`AGENTS.md` + `opencode.json`)
- [**OpenAI Codex**](../agents/codex) (`AGENTS.md` protocol)
- [**GitHub Copilot**](../agents/copilot) (`.github/copilot-instructions.md`)
- [**Generic MCP Agent**](../agents/generic) (`mcp.json` + `AGENTS.md`)
- [**Model Context Protocol (MCP) Server**](../mcp-server)

---

### 3. Verify Health
Run a diagnostic health check across the local index, graph, and agent bridges:

```bash
npx kiteretsu doctor
```
