---
sidebar_position: 0
---

# What is Kiteretsu?

**Kiteretsu** is a high-performance **Local Intelligence Engine** designed to solve the "last mile" problem of AI-assisted engineering: **Context Blindness.**

While AI agents (like Claude Code, Cursor, and Aider) are incredibly powerful, they are "outsiders" to your codebase. They don't know your hidden dependencies, your architectural rules, or the potential "Blast Radius" of a single change.

Kiteretsu bridges this gap by providing a **Deterministic, Hybrid Map** of your project's soul.

---

## 🏗️ The Hybrid Intelligence Philosophy

Kiteretsu doesn't just "index" files; it understands them through a multi-layered approach:

### 🎯 Sniper Context
Instead of feeding an AI agent 50 files and wasting your tokens, Kiteretsu uses a **3-Way Discovery Pipeline** (Semantic Vector Search + Weighted Keyword Scoring + Graph Analysis) to identify the **exact 5 files** that matter for your task. 

### 💥 Transitive Blast Radius
Kiteretsu calculates the **Ripple Effect**. It knows that if you change the `Auth` module, the `Dashboard` might break—even if they aren't directly connected. It traverses your project's dependency graph to ensure you see the full architectural impact of every change.

### 🛡️ Guardrail Governance
Kiteretsu enforces your project's "Laws." By recording architectural rules, you ensure your AI agent follows your specific design patterns (e.g., "Always use the Repository pattern for DB access").

---

## ⚡ Key Features

- **Hybrid AST/Regex Engine**: High-fidelity parsing for source code, lightning-fast discovery for large assets.
- **Zero-Noise Scanner**: Multi-layer filtering via `.kiteretsuignore` and built-in "Garbage Collection" for lockfiles and build artifacts.
- **Atomic Watcher**: A stable, battery-optimized watcher built to handle the complexities of Windows and massive Monorepos.
- **Local-First Privacy**: Your codebase never leaves your machine. All embeddings and indexing happen locally.

---

## Ready to empower your agents?

[**Explore the Architecture →**](./architecture)  
[**Get Started with Installation →**](./getting-started/installation)
