<div align="center">
  <img src="https://i.ibb.co/cKjWsd7p/kiteretsu.png" width="320" alt="Kiteretsu Logo" />
  <h1>Kiteretsu</h1>
  <p><strong>Codebase Intelligence & Agent Memory Layer</strong></p>
  <p>Stop letting AI agents hallucinate code. Give them a map.</p>
</div>

---

## 🧠 The Philosophy

LLMs are brilliant code generators, but they are terrible at codebase navigation. When you ask an AI agent to build a feature, it usually wastes time grepping through unrelated files, hallucinates context, or breaks downstream dependencies it didn't know existed.

**Kiteretsu acts as a Context Compiler and Memory Layer.** 

Instead of an AI reading your codebase blindly, it asks Kiteretsu: *"What do I need to read to complete this task?"* 
Kiteretsu instantly returns the precise files, the calculated blast radius, and any architectural rules the team has set.

* **Kiteretsu is the Librarian:** "Read these three files, follow these rules, and be careful—changing this breaks that."
* **AI Agent is the Reader:** Understands the exact files provided and writes the code perfectly.

## ✨ Features

- ⚡ **Lightning Fast Indexing**: Uses Tree-sitter to parse your codebase and extract symbols and dependencies.
- 💥 **Blast Radius Calculation**: Graph-based dependency analysis tells you exactly what files will break before you make a change.
- 🛡️ **Architectural Governance (Rules)**: Teach Kiteretsu your team's conventions (e.g., "Use Hono, not Express"). Agents will automatically see these rules when modifying related code.
- 📖 **Task Memory**: Record successful patterns and failed attempts. When an agent attempts a similar task in the future, it learns from the past.
- 🔒 **100% Local**: Powered by a local SQLite WAL database. Zero external API calls. Your code never leaves your machine.
- 📊 **Interactive Dashboard**: Visualize your codebase dependency graph, monitor memory, and manage rules.

## 🚀 Quick Start

Initialize Kiteretsu in your existing monorepo or project:

```bash
# 1. Install via npm/pnpm
pnpm add -w @kiteretsu/cli @kiteretsu/core

# 2. Initialize the project (Creates .kiteretsu/ folder)
pnpm cli init

# 3. Index your codebase
pnpm cli index
```

## 🛠️ The Agentic Workflow

Kiteretsu changes how you pair-program with AI. Instead of giving an agent an open-ended prompt and hoping it doesn't break your architecture, follow this loop:

### Step 1: The Human Sets the Guardrails
Before the agent starts, the human developer ensures Kiteretsu knows the rules.
```bash
# Add an architectural rule
pnpm cli record-rule "no-axios" "Use native fetch API. Do not install or use axios."
```

### Step 2: The Agent Asks for Directions
The human prompts the agent: *"Add a shopping cart."*
The very first thing the AI agent does is ask Kiteretsu for the context map:
```bash
pnpm cli context "add shopping cart feature"
```

**Kiteretsu's Output:**
```text
📦 Context Pack Compiled

📁 Read First:
  - src/store/cartStore.ts
  - src/components/CartIcon.tsx

💥 Blast Radius:
  ⚡ src/components/Header.tsx (Will break if CartIcon props change)

📏 Rules:
  - no-axios: Use native fetch API. Do not install or use axios.
```

### Step 3: The Agent Writes Code Safely
Armed with the Context Pack, the agent:
1. Only reads `cartStore.ts` and `CartIcon.tsx` (ignoring 200 other irrelevant files).
2. Modifies `Header.tsx` proactively because it saw it in the Blast Radius.
3. Uses `fetch` instead of `axios` because it read the Rule.

### Step 4: The Team Remembers
Once the feature is successfully merged, record the task. Kiteretsu will surface this memory to future agents working on similar features.
```bash
pnpm cli record-task "added cart" success --notes "Used Zustand for state management."
```

## 🖥️ The Dashboard

Kiteretsu includes a beautiful, local-first dashboard to visualize your codebase memory, manage rules, and view the interactive dependency graph.

Run the dashboard from your monorepo root:
```bash
# Start the backend API server
pnpm server

# Start the dashboard UI (in a new terminal)
pnpm dashboard
```
Open `http://localhost:5173` to see your codebase visually mapped out.

## 🤖 Integrations

Kiteretsu is designed to be agent-agnostic. It can be integrated via CLI hooks, or natively via our **Model Context Protocol (MCP)** server, making it compatible with:
- Cursor
- Claude Code
- Antigravity
- Devin / Devika
- Any other LLM tooling

---
<div align="center">
  <p>Built for the next generation of agentic development.</p>
</div>
