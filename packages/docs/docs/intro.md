---
sidebar_position: 0
---

# What is Kiteretsu?

**Kiteretsu** (キテレツ) is a continuous **Codebase Intelligence Graph, Context Compiler & Agent Memory Layer** designed to solve the fundamental limitation of modern AI coding assistants: **Context Blindness.**

Named after the classic Japanese anime *Kiteretsu Daihyakka* (キテレツ大百科 — "Kiteretsu Encyclopedia"), where a young inventor brings visionary inventions to life using his ancestor's handwritten encyclopedia of mechanisms and blueprints, Kiteretsu serves as that **living encyclopedia** for AI coding agents.

---

## 🏗️ The Four-Signal Fusion Architecture

AI coding agents excel at reading individual files, but struggle to retain repository architecture, unwritten conventions, or transitive downstream blast radius across large codebases.

Kiteretsu bridges this gap by unifying four complementary retrieval signals:

### 1. 🔤 Lexical Precision
BM25-inspired inverse document frequency (IDF) weighted token matching with camelCase/snake_case sub-tokenization.

### 2. 🧠 Semantic Meaning
Deterministic vector embeddings (local cosine similarity) that capture high-level conceptual intent.

### 3. 🕸️ Graph Intelligence
Multi-hop dependency traversal (symbol calls, type implementations, class inheritance, and test coverage).

### 4. 📜 Episodic Memory & ADRs
Historical task outcomes, engineering notes, and path-scoped Architectural Decision Records (ADRs).

---

## 🎯 Explainable Context Compiler

Instead of flooding agent context windows with entire directories, Kiteretsu's Context Compiler synthesizes these four sensors into a compact, budget-aware **Context Pack**:

- **Ranked Candidate Files**: Scored with transparent, explainable signal traces (`lexical`, `semantic`, `graph`, `memory`).
- **Target Symbols**: Extracted functions, classes, interfaces, and methods.
- **Architectural Rules**: Scoped governance rules (`global`, path-specific, or language-specific).
- **Blast Radius & Tests**: Recommended tests and downstream impacted callers.

---

## ⚡ Key Capabilities

- **Universal AST & Dependency Resolution**: High-fidelity Tree-sitter parsing with language capability tiers.
- **Transitive Blast Radius**: Evaluates downstream ripple effects with risk ratings (`LOW`, `MEDIUM`, `HIGH`) before code is changed.
- **Deep Code Explanation (`kiteretsu explain`)**: Combines AST source, dependency graph, ADRs, rules, and tests to explain *why* code was designed the way it is.
- **Zero-Friction Agent Bridge**: One-command non-destructive onboarding for Claude Code, Cursor IDE, Gemini CLI, OpenCode, OpenAI Codex, GitHub Copilot, and Generic MCP agents.
- **Local-First & Private**: Everything runs locally via embedded SQLite and local vector processing. No source code leaves your workstation.

---

## Ready to get started?

[**Explore the Architecture →**](./architecture)  
[**Quick Start & Installation →**](./getting-started/installation)
