---
sidebar_position: 0
sidebar_label: What is Kiteretsu?
---

# What is Kiteretsu?

**Kiteretsu** is the missing intelligence layer between your codebase and your AI agents. 

While modern AI agents (like Claude, Cursor, and Antigravity) are incredibly talented at writing code, they suffer from a fundamental problem: **They don't know your codebase as well as you do.**

Kiteretsu exists to give AI agents the "Senior Developer Perspective"—providing them with the bird's-eye view, the hidden dependencies, and the architectural rules that are usually only found in a human developer's head.

---

## ❌ The Problem: "The Agent Tunnel Vision"

When you give an AI agent a task in a large repository, it typically faces three massive hurdles:

1.  **Blind Searching**: The agent doesn't know where to start, so it runs dozens of expensive `grep` or `find` commands, wasting time and tokens.
2.  **Context Overload**: To be safe, agents often try to read too many files, exceeding their context window and becoming confused or "forgetful."
3.  **Hidden Breakages**: An agent might change a function in one file, unaware that it's being used by 10 other crates in a different part of the workspace. This is the "Blast Radius" problem.

## ✅ The Solution: "Codebase Intelligence"

Kiteretsu acts as a **Digital Memory** for your project. It pre-calculates the relationships between every file, symbol, and dependency in your repository.

When an agent is about to start a task, Kiteretsu provides it with a **Context Pack**:
*   **Precision Guidance**: Exactly which files it needs to read (and why).
*   **Safe Boundaries**: A warning of the "Blast Radius" (which other parts of the system might break).
*   **Architectural Guardrails**: The specific rules it must follow for your project.

## 🎯 The Purpose of Kiteretsu

The ultimate goal of Kiteretsu is to **remove the friction of AI-assisted development.** 

By ensuring that the agent always has the "Right Context at the Right Time," Kiteretsu makes agents:
- **Faster**: No more waiting for blind searches.
- **Cheaper**: Reduces token usage by up to 90%.
- **Smarter**: Prevents architectural hallucinations and breaking changes.

---

## 🚀 Key Capabilities

*   **Standardized Protocol**: A universal set of instructions that works with 15+ different AI agents.
*   **Automated Verification**: Tells the agent exactly which tests to run to verify their work.
*   **Governance**: Allows you to codify your project's architecture so agents never "drift" from your standards.
*   **Seamless Integration**: Works via CLI, MCP Server, or direct file injection into your repo.
