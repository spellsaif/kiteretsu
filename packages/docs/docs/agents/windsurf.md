# Integrating Windsurf (Cascade)

Kiteretsu provides a seamless integration for **Windsurf**, the agentic IDE from Codeium. It utilizes the `.windsurfrules` system to guide the **Cascade** agent.

## Installation

Run the following command in your project root:

```bash
kiteretsu install windsurf
```

## How it Works

Kiteretsu creates a **`.windsurfrules`** file at the root of your repository. 

Cascade reads this file before starting any task. It acts as a "Permanent Instruction Set" that overrides the agent's default behavior and forces it to use Kiteretsu for codebase context.

## Workflow with Cascade

When you open a project in Windsurf:

1.  **Protocol Awareness**: Cascade immediately sees the `# 🧠 Kiteretsu Intelligence Layer` in your project rules.
2.  **Mandatory Context**: When you ask Cascade to refactor or explain something, it will run `kiteretsu context` to identify the blast radius and architectural rules first.
3.  **Cross-File Accuracy**: Because Cascade uses Kiteretsu's dependency graph, it is much less likely to make changes that break unrelated parts of your project.

## Pro Tip
You can also use Kiteretsu's **MCP Server** with Windsurf for an even more direct integration. See the [MCP Guide](../mcp-server/introduction) for details.
