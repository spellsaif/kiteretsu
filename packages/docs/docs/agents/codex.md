# Integrating Codex

Kiteretsu provides a dual-layer integration for **Codex**, including instruction injection and automated tool hooks.

## Installation

Run the following command in your project root:

```bash
kiteretsu install codex
```

## How it Works

Kiteretsu performs two major actions:

### 1. AGENTS.md Update
Appends the **Kiteretsu Intelligence Layer** protocol to your `AGENTS.md` file.

### 2. Tool Hook (Interception)
Kiteretsu creates or updates **`.codex/hooks.json`** to include a **PreToolUse** hook for the Bash tool:

```json
{
  "PreToolUse": {
    "Bash": "Read Kiteretsu context pack before executing bash commands to search."
  }
}
```

## Workflow with Codex

1.  **Thinking**: Codex decides it needs to run a search (e.g., `grep`).
2.  **Intercept**: The PreToolUse hook triggers.
3.  **Remind**: Codex is reminded to check the Kiteretsu Context Pack first.
4.  **Optimized Execution**: Codex runs `kiteretsu context`, gets the specific file list, and avoids doing broad, expensive terminal searches.

## Why this matters
Codex is powerful but can be "aggressive" with terminal commands. This integration steers that power toward precision context gathering, saving you tokens and time.
