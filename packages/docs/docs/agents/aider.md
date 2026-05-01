# Integrating Aider

**Aider** is a high-performance CLI pair programmer. Kiteretsu integrates with Aider using the standardized **`AGENTS.md`** protocol.

## Installation

Run the following command in your project root:

```bash
kiteretsu install aider
```

## How it Works

Kiteretsu appends the **Kiteretsu Intelligence Layer** protocol to your `AGENTS.md` file. 

Aider is designed to read `AGENTS.md` (and other markdown files) on startup to understand the project structure and rules. By putting Kiteretsu instructions here, you ensure Aider uses the correct context for every session.

## Workflow with Aider

1.  **Initial Scan**: When you run `aider`, the agent reads `AGENTS.md`.
2.  **Context Request**: You can tell Aider: *"Follow the Kiteretsu protocol for [task]"*.
3.  **Command Execution**: Aider will use its `/run` or terminal capability to execute `kiteretsu context` and read the resulting Context Pack.
4.  **Selective File Addition**: Instead of adding every file manually to Aider, let Kiteretsu tell Aider exactly which files to `/add` based on the dependency graph.

## Why use Aider + Kiteretsu?
Aider is excellent at editing code, but it can get "lost" in large repos. Kiteretsu acts as the **Navigator**, telling Aider exactly where the critical code lives so it doesn't waste tokens on irrelevant files.
