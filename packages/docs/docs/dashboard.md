---
sidebar_position: 3
---

# Interactive Dashboard

The Interactive Dashboard is your codebase's "Command Center." It provides a high-fidelity visual interface to explore your dependency graph, manage architectural rules, and track agent performance.

## Launching the Dashboard

To start the UI and open it in your default browser:

```bash
kiteretsu ui
```

*Default address: `http://localhost:3000`*

---

## Key Features

### 🕸️ 3D Dependency Mapping
Visualize how your files interact. Identify circular dependencies, "God Modules" (files with too many responsibilities), and isolated components.

### 📜 Rule Management
A clean interface to add, delete, and modify project-wide architectural rules. Any rule you save here is instantly available to your AI agents via the MCP server.

### 📈 Task Analytics
See a history of all tasks your AI agents have performed. This help you identify patterns in agent errors and improve your project's "Intelligence Score."

### 🔬 Blast Radius Exploration
Click on any file in the graph to see its **Blast Radius**—the exact files that will be affected if you change that module.

---

## Built-in Watcher
The Dashboard automatically starts the **Kiteretsu Watcher** in the background. This means the graph will live-update as you code—no refresh needed.
