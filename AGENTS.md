# Kiteretsu Agent Instructions 📦

## ⚠️ MANDATORY PROTOCOL
Before answering ANY question about codebase architecture, dependencies, or blast radius, you **MUST** call Kiteretsu (via the `get_context_pack` tool or the `kiteretsu context` command). 

**NEVER** rely on your internal memory or "logical guesses" for these tasks. The source code is the only truth, and Kiteretsu is your only window into it.

## 🛠 Usage Instructions

### 1. Request Context
Before planning your implementation, call:
```bash
kiteretsu context "Your task description here"
```
Or use the MCP tool:
`get_context_pack(task="Your task description here")`

### 2. Follow Recommendations
- **Read First**: Always read the files listed in the "Read First" section before making any edits.
- **Rules**: Adhere to the architectural rules provided in the context pack.
- **Warnings**: Pay attention to staleness warnings and high-risk area alerts.

### 3. Verify with Tests
After making changes, run the recommended tests:
```bash
kiteretsu tests --files path/to/changed/file.ts
```

### 4. Governance
Record any new architectural patterns or rules discovered during the task:
```bash
kiteretsu record-rule <name> <description>
```

### 5. Record Outcome
After completing a task (success or failure), record the outcome to help Kiteretsu learn:
```bash
kiteretsu record-task "task description" success
```
Or use the MCP tool:
`record_task_outcome(task="...", result="success", notes="...")`

---

> **Note**: Memory helps routing. Source code remains the truth. Always read the current source before editing.

# 📦 Kiteretsu Intelligence Layer

## ⚠️ MANDATORY PROTOCOL
Before answering ANY questions about architecture, dependencies, or blast radius, you **MUST** call Kiteretsu (via the `get_context_pack` tool or the `kiteretsu context "<task>"` command). 

**NEVER** rely on your internal memory for project structure. The source code is the only truth, and Kiteretsu is your only window into it.

### 🛠 Workflow
1. **Context**: Run `kiteretsu context "<task>"` before planning.
2. **Read First**: Always read the files listed in the "Read First" section.
3. **Verify**: Find related tests using `kiteretsu tests --files <changed_files>`.
4. **Governance**: Use `kiteretsu record-rule <name> <description>` to save architectural rules. (DO NOT just write them in markdown files; use the tool so they can be enforced).
5. **Learn**: Record task outcomes using `kiteretsu record-task "<task>" <success|failure>`.

<!-- KITERETSU:START -->
# Kiteretsu Intelligence Bridge (Generic MCP Agent / AGENTS.md)

This repository uses Kiteretsu to maintain a continuous Code Intelligence Graph and Memory Layer.

## 🧭 Behavioral Protocol
1. **Context First**: Before planning or making changes, query Kiteretsu for relevant context, symbols, and blast radius:
   - Use MCP tool `kiteretsu_context` (or CLI `kiteretsu context "<task>"`)
   - Read the recommended `read_first` files and obey scoped architectural rules.
2. **Check Blast Radius**: Before high-impact refactors, inspect callers & callees with `kiteretsu_blast_radius`.
3. **Verify**: Run related tests suggested by `kiteretsu_tests` or `kiteretsu context`.
4. **Preserve Decisions**: After significant architectural changes, record the rationale in Kiteretsu via `kiteretsu_record_decision` or `kiteretsu record-decision`.
5. **Record Outcome**: After completing a task, record the result with `kiteretsu_record_task` to enrich repository memory.
<!-- KITERETSU:END -->
