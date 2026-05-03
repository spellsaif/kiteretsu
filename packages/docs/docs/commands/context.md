# Context Generation

The `context` command is the heart of the Kiteretsu intelligence layer. It is used to generate a **Context Pack** for a specific task.

## Usage

```bash
kiteretsu context "<task_description>"
```

### Example
```bash
kiteretsu context "Refactor the authentication middleware to use JWT"
```

## How it Works

When you run this command, Kiteretsu performs the following steps:

1.  **Task Analysis**: Analyzes the task description to identify relevant symbols and modules.
2.  **Dependency Mapping**: Traverses the dependency graph to find "Read First" files and high-risk areas.
3.  **Transitive Blast Radius Analysis**: Kiteretsu doesn't just look at direct imports. It recursively traverses the dependency graph to find every file that would be affected by a change, even if they are 3 or 4 layers deep in your architecture.
4.  **Rule Injection**: Injects any recorded architectural rules that are relevant to the identified files.
5.  **Output**: Generates a concise, structured report for the AI agent.

## Output Sections

- **Read First**: A prioritized list of files the agent should read before starting.
- **Blast Radius**: A transitive dependency map identifying every file affected by your changes, even through indirect imports.
- **Rules**: Project-specific architectural guardrails.
- **Warnings**: Staleness warnings if the index is out of date.

## Tokens Saved
By providing a curated context, Kiteretsu typically reduces the amount of text an agent needs to read by **70-90%**, significantly lowering your token costs and improving agent speed.
