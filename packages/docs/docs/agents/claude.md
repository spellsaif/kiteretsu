# Integrating Claude Code

Kiteretsu provides a deep integration for **Claude Code** (the Anthropic CLI agent), including both instruction injection and automated tool hooks.

## Installation

Run the following command in your project root:

```bash
kiteretsu install claude
```

## What happens?

Kiteretsu performs two major actions:

### 1. CLAUDE.md Update
Kiteretsu appends the **Kiteretsu Intelligence Layer** protocol to your `CLAUDE.md` file. This ensures that every time Claude starts up, it reads the mandatory protocol.

### 2. Tool Interception
Kiteretsu updates or creates `.claude/settings.json` to include a **PreToolUse** hook:

```json
{
  "hooks": {
    "PreToolUse": {
      "Glob,Grep": "If a Kiteretsu memory exists, read the Context Pack before searching raw files."
    }
  }
}
```

## Workflow with Claude

Once installed, simply ask Claude a question:

**You**: *"How does the executor handle task priorities?"*

**Claude (Thinking)**: *"I should check Kiteretsu first because of my PreToolUse hook."*

**Claude (Executing)**: `kiteretsu context "task priorities in executor"`

**Claude (Result)**: Reads the curated context pack and gives you a precise answer without blindly grepping through the whole repo.
