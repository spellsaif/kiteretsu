---
sidebar_position: 0
---

# What is Kiteretsu?

**Kiteretsu** is a high-performance **Local Intelligence Engine** designed to solve the "last mile" problem of AI-assisted engineering: **Context Blindness.**

While AI agents (like Claude Code, Cursor, and Aider) are incredibly powerful, they are "outsiders" to your codebase. They don't know your hidden dependencies, your architectural rules, or the potential "Blast Radius" of a single change.

Kiteretsu bridges this gap by providing a deterministic, real-time map of your project's soul.

---

## The Problem: "Agent Tunnel Vision" 😵‍💫

When you ask an AI to "Refactor the login flow," it usually does one of two things:

1. **The Shotgun Approach**: It tries to read every file in your repo. This is **slow**, **expensive** (thousands of tokens), and often **confuses** the agent.
2. **The Guesswork Approach**: It only reads 2 files, misses a critical dependency in `auth-utils.ts`, and accidentally breaks your production login.

### 💸 The Cost of Ignorance
In large codebases, "Context Bloat" can cost you hundreds of dollars in wasted tokens and hours of debugging AI-generated hallucinations.

---

## The Solution: Kiteretsu 📦

Kiteretsu acts as a **Local Context Curator**. It uses a sub-second SQLite dependency graph and semantic indexing to provide your agent with the **exact "Sniper" Context** it needs.

### 🛰️ Precise Context Packs
Instead of reading 50 files, Kiteretsu identifies the **5 critical files** and **3 architectural rules** that actually matter for your task.

### 🛡️ Architectural Governance
Kiteretsu enforces your project's "Laws." If you have a rule that "Database calls must never happen in the UI layer," Kiteretsu injects that rule directly into the agent's brain before it writes a single line of code.

### ✨ Self-Healing Memory
With its real-time watcher, Kiteretsu's memory is never stale. It updates its understanding of your code the millisecond you hit `Ctrl+S`.

---

## Why "Kiteretsu"? 💠

In Japanese, **Kiteretsu (奇天烈)** means "Extremely Strange" or "Inventive." It’s named after the legendary inventor who could build complex machines from simple scrolls. 

Kiteretsu does exactly that: it takes your "scrolls" (source code) and builds a complex, living machine of intelligence that your AI agents can finally understand.

---

## Ready to stop the guessing?
[**Get Started with Kiteretsu →**](./getting-started/installation)
