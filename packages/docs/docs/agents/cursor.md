# Integrating Cursor

Kiteretsu integrates with **Cursor** using its powerful `.mdc` (Cursor Rules) system. This ensures that the Cursor agent is always aware of the Kiteretsu intelligence layer.

## Installation

Run the following command in your project root:

```bash
kiteretsu install cursor
```

## What happens?

Kiteretsu creates a new file at `.cursor/rules/kiteretsu.mdc`. This file is configured with `alwaysApply: true`, meaning the Cursor agent will take these rules into account for every single message.

### The Rule Content
The generated rule includes the **Kiteretsu Protocol**, mandating that the agent use `kiteretsu context` before answering architectural questions.

## Workflow with Cursor

When you use **Cursor Chat** or **Cursor Composer**:

1.  **Cursor reads the rules**: It sees that Kiteretsu is the "Primary Source of Truth."
2.  **Cursor calls the CLI**: When you ask a complex question, Cursor will use its terminal capability to run `kiteretsu context`.
3.  **Accurate Proposals**: Because Cursor has the curated context pack, its code completions and refactoring proposals will be significantly more accurate and aware of dependencies.

## Using MCP with Cursor

If you want an even tighter integration, you can also add Kiteretsu as an **MCP Server** in Cursor's settings. See the [MCP Guide](../mcp-server/introduction) for more details.
