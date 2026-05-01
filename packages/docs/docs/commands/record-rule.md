# Architectural Governance

The `record-rule` command allows you to codify architectural patterns, security requirements, or project-specific best practices into the Kiteretsu intelligence layer.

## Usage

```bash
kiteretsu record-rule "<rule_name>" "<rule_description>"
```

### Example
```bash
kiteretsu record-rule "Snake Case Crate Names" "All crates in the workspace must use snake_case and be prefixed with momo-."
```

## Why Record Rules?

AI agents often know general programming patterns but are unaware of your project's specific "unwritten rules." By recording rules:

1.  **Consistency**: Agents will follow your project's specific naming conventions and structure.
2.  **Safety**: You can record security rules (e.g., *"Never use unsafe blocks in the networking crate"*).
3.  **Automatic Enforcement**: Whenever an agent requests a Context Pack for a task related to a specific file, Kiteretsu will inject any relevant rules directly into the agent's prompt.

## Where are Rules Stored?

Rules are stored in the local Kiteretsu SQLite database. They are persistent and are shared across all agents working on the same repository.

## Agent Triggering

When an agent calls `kiteretsu context`, Kiteretsu checks the target files and symbols. If any recorded rules are associated with those modules, they are included in the **Rules** section of the Context Pack.
