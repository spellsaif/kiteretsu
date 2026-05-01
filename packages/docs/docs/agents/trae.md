# Integrating Trae

**Trae** is an adaptive AI IDE by ByteDance. Kiteretsu integrates with Trae using the standardized **`AGENTS.md`** protocol.

## Installation

Run the following command in your project root:

```bash
kiteretsu install trae
```

## How it Works

Kiteretsu appends the **Kiteretsu Intelligence Layer** protocol to your `AGENTS.md` file. 

Trae's agent is designed to prioritize project-level instructions found in the root directory. By establishing the Mandatory Protocol in `AGENTS.md`, you ensure that the Trae agent uses the `kiteretsu context` command to understand the codebase before making changes.

## Workflow with Trae

1.  **Project Initialization**: When you open your project, Trae's agent scans the `AGENTS.md` file.
2.  **Autonomous Context**: When you ask Trae a complex question, the agent will recognize the need for context and run `kiteretsu context` in its internal terminal.
3.  **Accurate Refactoring**: Because Trae has access to the curated Context Pack, it will respect your architectural rules and avoid breaking dependencies identified in the blast radius.
