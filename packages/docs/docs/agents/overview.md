# Agent Integrations

Kiteretsu is designed to be **agent-agnostic**. It provides continuous code intelligence, blast radius calculation, and memory for any AI coding agent via standardized instructions and the **Model Context Protocol (MCP)**.

---

## Supported Agents (0.1.0)

| Agent | Native Instructions | MCP Integration | Onboarding Command |
| :--- | :--- | :--- | :--- |
| **Claude Code** | `CLAUDE.md` (Managed Section) | `.claude.json` | `npx kiteretsu init --agent claude` |
| **Cursor IDE** | `.cursor/rules/kiteretsu.mdc` | `.cursor/mcp.json` | `npx kiteretsu init --agent cursor` |
| **Gemini CLI** | `GEMINI.md` | `.gemini/settings.json` | `npx kiteretsu init --agent gemini` |
| **OpenCode** | `AGENTS.md` & `.opencode/agents/` | `opencode.json` (`mcp.servers`) | `npx kiteretsu init --agent opencode` |
| **OpenAI Codex** | `AGENTS.md` (Managed Section) | Universal MCP | `npx kiteretsu init --agent codex` |
| **GitHub Copilot** | `.github/copilot-instructions.md` | Copilot instructions | `npx kiteretsu init --agent copilot` |
| **Generic MCP Agent** | `AGENTS.md` | `mcp.json` | `npx kiteretsu init --agent generic` |

---

## How It Works

Kiteretsu connects to agents using two non-destructive mechanisms:

1. **Managed Instruction Sections**:
   Kiteretsu injects behavioral rules into project instruction files using bounded tags:
   ```markdown
   <!-- KITERETSU:START -->
   # Kiteretsu Intelligence Bridge
   ...
   <!-- KITERETSU:END -->
   ```
   Your custom instructions outside these tags are **never overwritten**.

2. **Model Context Protocol (MCP)**:
   Agents connect to Kiteretsu's local Stdio MCP server (`@kiteretsu/mcp-server`) to query symbols, dependencies, blast radius, ADRs, and context packs in real time.

---

## Configuration Commands

```bash
# Automatic detection (configures detected agents)
npx kiteretsu init

# Configure a specific agent
npx kiteretsu init --agent claude
npx kiteretsu init --agent cursor
npx kiteretsu init --agent gemini

# Configure all supported agents
npx kiteretsu init --all

# Update managed sections when upgrading
npx kiteretsu sync
```

---

## Planned Future Integrations

The following adapters are planned for subsequent releases:
- **Aider** (CLI memory bridge)
- **Windsurf / Cascade** (`.windsurfrules` adapter)
- **Trae / Trae-CN**
- **Google Antigravity**
- **VS Code Extension**
