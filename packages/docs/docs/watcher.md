---
sidebar_position: 2
---

# Self-Healing Memory (Watcher)

The Kiteretsu Watcher is the "Guardian" of your project's intelligence. It ensures that your AI agents never have "Tunnel Vision" by keeping your codebase memory in sync with every save.

## How it Works

When you run the watcher, Kiteretsu subscribes to your operating system's file events. 

1. **Detection**: You save a file in your IDE.
2. **Incremental Indexing**: Kiteretsu identifies exactly what changed (imports, exports, symbols).
3. **Graph Update**: The local SQLite dependency graph is updated in milliseconds.
4. **Agent Awareness**: The next time your AI agent (Claude, Cursor, etc.) asks for context, it receives the absolute latest version of the truth.

---

## The "Watcher" Command

To start the watcher in your terminal:

```bash
kiteretsu watch
```

---

## Why is it critical?

### 🚫 No Stale Context
Without a watcher, your AI agent is essentially "blind" to any changes you've made since the last manual index. It will suggest code based on old file structures, leading to frustrating circular loops and bugs.

### 🔋 Battery Optimized
The watcher uses **Zero-CPU idle**. It doesn't scan your files constantly; it only wakes up for 50ms when a file is actually modified.

### 🏗️ Monorepo Ready
Kiteretsu's watcher handles large monorepos with thousands of files, automatically respecting your **`.kiteretsuignore`** and **`kiteretsu.config.json`** settings to stay lightweight and focused.

---

## Configuration

The watcher automatically inherits all exclusions defined in:
1. Your **`.kiteretsuignore`** file.
2. The **`indexing.exclude`** patterns in `kiteretsu.config.json`.
3. Standard global ignores (`node_modules`, `.git`, etc.).
