# Integrating Antigravity

**Antigravity** is the first-class agent for Kiteretsu. It is designed to utilize the Kiteretsu intelligence layer for every architectural decision.

## Installation

Run the following command in your project root:

```bash
kiteretsu install antigravity
```

## What happens?

Kiteretsu sets up a dedicated intelligence environment for Antigravity:

### 1. Agent Rules
Creates `.agents/rules/kiteretsu.md`. This file contains the **Mandatory Protocol** that Antigravity reads before starting any task.

### 2. Workflows
Creates `.agents/workflows/kiteretsu.md`. This adds a native `/kiteretsu` slash command to the agent, allowing you to manually trigger context gathering.

## Workflow with Antigravity

1.  **Task Start**: You give Antigravity a task.
2.  **Protocol Check**: Antigravity reads `.agents/rules/kiteretsu.md` and realizes it **must** get context.
3.  **Context Call**: Antigravity automatically runs `kiteretsu context "<task>"` using its internal tools.
4.  **Guided Coding**: Antigravity proceeds with the task, adhering to all architectural rules and staying aware of the blast radius.

## Manual Trigger
You can also manually ask Antigravity for context:
`@antigravity /kiteretsu task="Implement new logger"`
