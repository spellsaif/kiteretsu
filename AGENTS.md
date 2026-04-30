# Kiteretsu Agent Instructions 📦

Before working on any task in this repository, you must request a **Context Pack** from Kiteretsu. This will ensure you have the smallest, most accurate context needed to complete the task safely.

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

### 4. Record Outcome
After completing a task (success or failure), record the outcome to help Kiteretsu learn:
`record_task_outcome(task="...", result="success", notes="...")`

---

> **Note**: Memory helps routing. Source code remains the truth. Always read the current source before editing.
