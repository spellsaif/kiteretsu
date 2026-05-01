# Agent Integrations Directory

Kiteretsu is designed to be **agent-agnostic**. It provides a standardized intelligence layer for **15+ different AI agents and IDEs**.

## Integration Methods

Kiteretsu uses three primary methods to integrate with agents:

1.  **Markdown Protocols**: Injecting instructions into `AGENTS.md`, `CLAUDE.md`, etc.
2.  **Tool Interception**: Using hooks (PreToolUse) to steer agent behavior.
3.  **Native Tools**: Using the **MCP Server** for direct communication.

---

## Supported Agents & IDEs

| Agent / IDE | Integration Type | Command |
| :--- | :--- | :--- |
| **Antigravity** | Protocol + Workflows | `kiteretsu install antigravity` |
| **Claude Code** | Protocol + Hooks | `kiteretsu install claude` |
| **Cursor** | Rules (.mdc) + MCP | `kiteretsu install cursor` |
| **Windsurf / Cascade** | Rules (.windsurfrules) | `kiteretsu install windsurf` |
| **Trae / Trae-CN** | AGENTS.md Protocol | `kiteretsu install trae` |
| **Aider** | AGENTS.md Protocol | `kiteretsu install aider` |
| **VS Code Copilot** | .github/copilot-instructions.md | `kiteretsu install vscode` |
| **GitHub Copilot CLI** | Global Skill (SKILL.md) | `kiteretsu install copilot` |
| **Google Gemini CLI** | Skill + BeforeTool Hook | `kiteretsu install gemini` |
| **Kiro IDE** | Persistent Steering Rules | `kiteretsu install kiro` |
| **Codex** | AGENTS.md + Hooks | `kiteretsu install codex` |
| **OpenCode** | Plugin-based Interception | `kiteretsu install opencode` |
| **OpenClaw / Claw** | AGENTS.md Protocol | `kiteretsu install claw` |
| **Droid / Factory-Droid** | AGENTS.md Protocol | `kiteretsu install droid` |
| **Hermes** | AGENTS.md Protocol | `kiteretsu install hermes` |
| **Git (Self-Healing)** | post-commit Hook | `kiteretsu install git` |

---

## Quick Setup
To install Kiteretsu for any of these agents, simply run:
```bash
kiteretsu install <agent_name>
```

For detailed guides on the most popular integrations, check the sidebar!
