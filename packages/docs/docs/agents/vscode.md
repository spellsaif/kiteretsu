# Integrating VS Code (Copilot Chat)

Kiteretsu integrates with **GitHub Copilot Chat** in VS Code to provide project-specific intelligence and architectural guardrails.

## Installation

Run the following command in your project root:

```bash
kiteretsu install vscode
```

## How it Works

Kiteretsu creates a file at **`.github/copilot-instructions.md`**. 

This is the official way to provide custom instructions to GitHub Copilot Chat. Whenever you open a chat session in VS Code, Copilot reads this file to understand the "Rules of the House."

## Workflow with VS Code

1.  **Chat Session**: You ask Copilot Chat a question about your code.
2.  **Instruction Awareness**: Copilot sees the **Mandatory Protocol** in the instructions file.
3.  **Terminal Execution**: Copilot will suggest or execute `kiteretsu context` to gather the necessary data before providing an answer.
4.  **Consistency**: This ensures that Copilot Chat follows the same architectural rules as your other AI agents (like Claude or Cursor).

## Benefits
- **Zero Hallucination**: Prevents Copilot from guessing about your project structure.
- **Project Awareness**: Injects your specific `record-rule` entries into the chat context.
