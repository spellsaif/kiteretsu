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
