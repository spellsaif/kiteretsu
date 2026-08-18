# Installation & Quick Start

Get up and running with Kiteretsu in your repository.

---

## Requirements

- **Node.js**: `v20.0.0` or higher
- **OS**: Linux, macOS, or Windows

---

## Quick Start (Recommended)

Run directly inside your project root with `npx`:

```bash
npx kiteretsu init
```

### What Happens During `init`:
1. **Detects Environment**: Discovers project languages and existing AI coding agent configurations.
2. **Configures Agents**: Non-destructively updates agent instruction files (`AGENTS.md`, `CLAUDE.md`, `.cursor/rules/`, etc.).
3. **Configures MCP**: Registers `@spellsaif/kiteretsu-mcp-server` with detected agent tools.
4. **Creates Configuration**: Generates canonical `kiteretsu.config.ts` if missing.
5. **Initializes & Indexes**: Creates `.kiteretsu/` local SQLite database and indexes symbols and dependencies.

---

## Global CLI Installation (Optional)

You can also install Kiteretsu globally:

```bash
npm install -g kiteretsu
# or
pnpm add -g kiteretsu
```

Then run commands directly:

```bash
kiteretsu --help
```

---

## Targeting Specific Agents

```bash
# Configure for Claude Code only
npx kiteretsu init --agent claude

# Configure for Cursor IDE only
npx kiteretsu init --agent cursor

# Configure for Gemini CLI only
npx kiteretsu init --agent gemini

# Configure for OpenCode only
npx kiteretsu init --agent opencode

# Configure for OpenAI Codex only
npx kiteretsu init --agent codex

# Configure for GitHub Copilot only
npx kiteretsu init --agent copilot

# Configure all supported agent integrations
npx kiteretsu init --all
```

---

## Manual Indexing & Diagnostics

```bash
# Run incremental repository re-indexing
npx kiteretsu index

# Run comprehensive health diagnostics
npx kiteretsu doctor

# Generate architectural mental model
npx kiteretsu bootstrap
```
