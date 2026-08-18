<div align="center">
  <img src="https://i.ibb.co/cKjWsd7p/kiteretsu.png" width="280" alt="Kiteretsu Logo" />
  <h1>Kiteretsu</h1>
  <p><strong>Persistent Repository Intelligence for AI Coding Agents</strong></p>
  <p><em>Kiteretsu continuously builds a graph of your codebase, remembers architectural decisions and engineering history, and compiles task-specific context for coding agents.</em></p>

  <p>
    <a href="https://github.com/spellsaif/kiteretsu/actions"><img src="https://img.shields.io/badge/build-passing-brightgreen?style=flat-square" alt="Build Status" /></a>
    <a href="https://www.sqlite.org/wal.html"><img src="https://img.shields.io/badge/database-SQLite%20WAL-orange?style=flat-square" alt="Database" /></a>
    <a href="https://tree-sitter.github.io/tree-sitter/"><img src="https://img.shields.io/badge/parser-tree--sitter-blue?style=flat-square" alt="Parser" /></a>
    <a href="https://modelcontextprotocol.io"><img src="https://img.shields.io/badge/protocol-MCP%20Enabled-purple?style=flat-square" alt="MCP" /></a>
    <a href="./LICENSE"><img src="https://img.shields.io/badge/license-MIT-blue?style=flat-square" alt="License" /></a>
  </p>

  <h4>"Stop letting AI agents blindly navigate your architecture. Give them the Encyclopedia."</h4>
</div>

---

## ⚡ 15-Second Overview

**Kiteretsu** (キテレツ) is an open-source, local-first **Code Intelligence Graph + Context Compiler + Structured Memory Layer** that runs alongside your AI coding agents (**Claude Code**, **Cursor**, **Gemini CLI**, **OpenCode**, **OpenAI Codex**, **GitHub Copilot**, and **Generic MCP / AGENTS.md**).

Instead of forcing LLMs to greedily grep through hundreds of files or rely on naive text vector chunks, Kiteretsu continuously maintains an AST symbol graph, tracks Architectural Decision Records (ADRs), retains episodic task learnings, and compiles precision, budget-optimized **Context Packs** with explainable evidence before the agent touches your code.

```bash
npx kiteretsu init
```

---

## 🛑 The Problem

Modern AI coding agents are extraordinarily capable code generators, but they are architecturally blind:

1. **Repetitive Rediscovery**: Agents repeatedly explore, grep, and guess repository structure from scratch on every prompt.
2. **Context Window Pollution**: Large repositories overwhelm LLM attention with irrelevant boilerplate, degrading code quality and spiking token costs.
3. **Lost Architectural Decisions**: Crucial engineering decisions ("why we use SQLite WAL instead of Postgres for local state") disappear into old PR descriptions and Git logs.
4. **Text RAG Doesn't Understand Code**: Naive text chunking splits classes, drops inheritance hierarchies, and misses cross-file function call chains.
5. **No Cross-Agent Memory**: If Claude Code solves a tricky token expiration bug on Monday, Cursor, OpenCode, or Gemini will repeat the exact same mistake on Tuesday.

---

## 💡 The Solution

Kiteretsu is **not another AI coding agent**. It is the **intelligence layer underneath all coding agents**.

```
                   Repository Source Code (AST)
                                ↓
┌─────────────────────────────────────────────────────────────────────────┐
│                           K I T E R E T S U                             │
│ ┌─────────────────────────────┬───────────────────────────────────────┐ │
│ │  Symbol-Level Code Graph    │  Architectural Decision Records (ADR) │ │
│ │  Calls, Extends, Implements │  Rationale, Alternatives, Path Scopes │ │
│ ├─────────────────────────────┼───────────────────────────────────────┤ │
│ │  Scoped Governance Rules    │  Episodic Task & Error Memory         │ │
│ │  Path & Language Scoped     │  Successes, Pitfalls, Lessons Learned │ │
│ ├─────────────────────────────┼───────────────────────────────────────┤ │
│ │  4-Signal Fusion Ranker     │  Context Budget Optimizer             │ │
│ │  Lexical + Vector + Graph   │  Topological Optimal Reading Order    │ │
│ └─────────────────────────────┴───────────────────────────────────────┘ │
└────────────────────────────────────┬────────────────────────────────────┘
                                     ↓
                Canonical MCP Protocol & Local CLI Engine
                                     ↓
 Claude Code • Cursor • Gemini CLI • OpenCode • OpenAI Codex • GitHub Copilot
```

---

## 🔮 The Heritage & Philosophy: The Inventor's Encyclopedia

### 1. The Heritage of Invention
**Kiteretsu** (キテレツ) draws its name and spirit from the classic Japanese anime and manga *Kiteretsu Daihyakka* (キテレツ大百科). In the story, the brilliant young inventor, Eiichi, constructs marvelous inventions (like Korosuke the automaton) not through blind trial-and-error or brute-force guessing, but by referencing the **Kiteretsu Encyclopedia**—a multi-volume codex containing the architectural designs, physical laws, formulas, and warnings left behind by his genius ancestor, Kiteretsu-sai.

### 2. The Modern Engineering Analogy
In modern software engineering, AI coding agents are extraordinarily talented builders, but they are operating without an encyclopedia. When left on their own, even the most capable LLMs waste context tokens repeatedly guessing directory structures, hallucinating dependency graphs, violating team idioms, and repeating previous mistakes.

**Kiteretsu is the externalized Encyclopedia for your AI agents.** It provides a continuous, persistent code intelligence graph and memory layer that gives agents spatial awareness, architectural guardrails, and historical lessons before they write a single line of code.

---

## 🏆 Why Kiteretsu?

| Capability | Plain Vector RAG | Generic Agent Memory | Code Search (grep/ripgrep) | Kiteretsu |
| :--- | :---: | :---: | :---: | :---: |
| **Symbol-Level Call Graph** | ❌ | ❌ | Partial (text) | **✅ True AST Graph** |
| **Cross-File Heritage (`extends`/`impl`)** | ❌ | ❌ | ❌ | **✅ Full AST Tracking** |
| **Architectural Decisions (ADRs)** | ❌ | Partial | ❌ | **✅ First-Class ADR Store** |
| **Episodic Engineering Memory** | ❌ | ✅ (Unstructured) | ❌ | **✅ Vector-Indexed Tasks** |
| **Scoped Governance Rules** | ❌ | Partial | ❌ | **✅ Path & Lang Scoped** |
| **Multi-Sensor Fusion Retrieval** | ❌ (Vector only) | ❌ (Text only) | ❌ (Lexical only) | **✅ 4-Signal Ranked** |
| **Explainable Evidence Traces** | ❌ | ❌ | ❌ | **✅ Symbol, Graph, Vector traces** |
| **Token Budget Optimization** | ❌ | ❌ | ❌ | **✅ Dynamic Token Packing** |
| **Zero-Config Agent Bridge** | ❌ | ❌ | ❌ | **✅ 1-Command Setup** |
| **100% Local & Private** | Varies | Varies | ✅ | **✅ Local SQLite WAL & ONNX** |

---

## 🔄 Before vs. After Kiteretsu

```
WITHOUT KITERETSU                               WITH KITERETSU
─────────────────                               ──────────────
Task: "Refactor Auth Session Token"             Task: "Refactor Auth Session Token"
       ↓                                               ↓
Agent greps repository                          kiteretsu_context / kiteretsu context
       ↓                                               ↓
Reads 28 irrelevant files                       Kiteretsu Context Compiler synthesizes:
       ↓                                          • Primary files (auth_service.ts, session.ts)
Misses ADR-008 (JWT standard)                     • Inbound callers & heritage tree
       ↓                                          • Applicable ADR-008 & token rules
Hallucinates dependency graph                     • Past task learnings & related tests
       ↓                                               ↓
Breaks downstream consumers                     Agent reads 4 exact files with full context
       ↓                                               ↓
Frustrating debugging loop                      Clean, safe, idiomatic implementation
```

---

## 🏛 Architecture

```
                               AI Coding Agents
        (Claude Code, Cursor, Gemini CLI, OpenCode, Codex, Copilot)
                                      │
                         Model Context Protocol (MCP) / CLI
                                      │
                         Canonical Agent Bridge API
                                      │
        ┌─────────────────────────────┼─────────────────────────────┐
        │                             │                             │
    Retrieval Subsystem        Memory Subsystem             Graph Subsystem
   • IDF Lexical Search       • Architectural ADRs        • Polymorphic Edges
   • Semantic Search (ONNX)   • Scoped Rules (path/lang)  • AST Symbol Graph
   • Graph Proximity Walker   • Episodic Task History     • Resolution Engine
        │                             │                             │
        └─────────────────────────────┼─────────────────────────────┘
                                      │
                          Hybrid Context Compiler
                        • Four-Signal Multi-Sensor Fusion Ranker
                        • Explainable Signal Traces & Relevance Score
                        • Context Budget & Reading Order Optimizer
                                      │
                         SQLite WAL Intelligence DB
                          (Knex + sqlite-vec engine)
                                      │
                      Universal Resolution Engine & IR
               ┌──────────────────────┴──────────────────────┐
               ▼                                             ▼
       Language Registry                              Project Context
   (Extensions, Tiers, Grammars)                (tsconfig, Cargo, go.mod, etc.)
               │                                             │
               └──────────────────────┬──────────────────────┘
                                      ▼
                                  Import IR
                        (Kind, Source, Location, Spec)
                                      │
                          4-Pass Incremental Indexer
                     (Diff → Parse → Declare → Link Edges)
                                      │
                        Web-Tree-Sitter AST Parsers
```

---

## ✨ Core Capabilities

- **Universal Resolution Engine & Import IR**: Eliminates language-spaghetti resolvers by decoupling Tree-sitter AST extraction into semantic `ImportReference` IR, feeding project adapters (`tsconfig`, `Cargo.toml`, `go.mod`, `pyproject`) through verified candidate resolution.
- **Master Language Registry**: Centralizes extensions, WASM grammars, entrypoints, and capability tiers into a single source of truth consumed across the scanner, parser, and resolver.
- **AST Symbol-Level Graph**: Extracts functions, methods, classes, and interfaces alongside their `calls`, `extends`, `implements`, `references`, and `exports` relations.
- **Four-Signal Multi-Sensor Fusion Retrieval**: Combines IDF-Weighted Lexical matching, ONNX Vector Cosine Similarity, Symbol Heritage & Graph Proximity, and Memory Scope matching with explainable relevance scoring.
- **Symbol-Aware Graph Expansion**: Traverses spatial symbol links (`calls`, `extends`, `implements`, `tested_by`) to aggregate interconnected files into candidate ranking.
- **Architectural Decision Records (ADRs)**: Store and enforce architectural decisions with title, rationale, alternatives considered, and affected path scopes.
- **Episodic Task Memory**: Automatically indexes task outcomes and developer notes, retrieving relevant past learnings when similar tasks are executed.
- **Scoped Rule Governance**: Enforce architectural rules scoped to `global`, specific directories/paths, or specific languages.
- **First-Class Blast Radius**: Predict downstream impact before making edits with risk ratings (`LOW`, `MEDIUM`, `HIGH`), caller trees, and affected tests.
- **Deep Code Explanation (`kiteretsu explain`)**: Synthesizes source AST, graph callers/callees, ADRs, rules, and tests to explain *why* code exists.
- **Zero-Friction Agent Bridge**: Predictably configures instructions and MCP settings for Claude Code, Cursor, Gemini CLI, OpenCode, OpenAI Codex, GitHub Copilot, and Generic MCP agents.
- **First-Class Fixture Conformance**: Normal `pnpm test` CI suite continuously validates 32 multi-language fixtures against true blast radius and negative false-positive assertions.

---

## 🌐 Supported Languages & Capability Tiers

Kiteretsu categorizes language support into explicit, verifiable capability tiers:

### Tier A — Project-Aware Resolution
*Full AST parsing, symbol extraction, call/heritage graph, project metadata (`tsconfig`, `Cargo.toml`, `go.mod`, `pyproject`, `pom.xml`), candidate verification, and semantic search.*

| Language | AST Parser | Declared Symbols | Call & Heritage Graph | Project Metadata Adapter | Conformance |
| :--- | :---: | :---: | :---: | :---: | :---: |
| **TypeScript / TSX** | ✅ Tree-sitter | ✅ Functions, Classes, Methods, Types | ✅ `calls`, `extends`, `implements` | ✅ `tsconfig.json` paths, baseUrl | **100% PASS** |
| **JavaScript / JSX** | ✅ Tree-sitter | ✅ Functions, Classes, Methods | ✅ `calls`, `extends` | ✅ `package.json` workspaces/exports | **100% PASS** |
| **Python** | ✅ Tree-sitter | ✅ Functions, Classes, Methods | ✅ `calls`, inheritance | ✅ `pyproject.toml`, src layout | **100% PASS** |
| **Rust** | ✅ Tree-sitter | ✅ Structs, Enums, Traits, Functions | ✅ `impl`, `trait` references | ✅ `Cargo.toml` workspace/crates | **100% PASS** |
| **Go** | ✅ Tree-sitter | ✅ Structs, Interfaces, Functions | ✅ struct embeds, calls | ✅ `go.mod` module prefix | **100% PASS** |
| **Java / Kotlin** | ✅ Tree-sitter | ✅ Classes, Methods, Interfaces | ✅ references | ✅ Maven / Gradle source roots | **100% PASS** |
| **Scala** | ✅ Tree-sitter | ✅ Classes, Objects, Traits | ✅ references | ✅ JVM package resolution | **100% PASS** |
| **C / C++** | ✅ Tree-sitter | ✅ Functions, Structs, Classes | ✅ references | ✅ Include directories & headers | **100% PASS** |
| **Ruby** | ✅ Tree-sitter | ✅ Classes, Modules, Methods | ✅ `calls`, inheritance | ✅ `lib/` directory & relative | **100% PASS** |

### Tier B — AST-Aware Resolution
*Tree-sitter AST parsing, symbol extraction, AST reference graph, candidate verification, and semantic search.*
- **C#**, **PHP**, **Swift**, **Dart**, **Elixir**, **Lua**, **Zig**, **Julia**, **Objective-C**, **Vue**, **Svelte**

### Tier C — Syntax & Symbol Indexing
*Lexical & symbol declaration indexing with semantic retrieval.*
- **PowerShell**, **Verilog**, **SystemVerilog**

---

## 🌐 Supported Languages

| Language | AST Parsing | Symbol Extraction | Call / Heritage Graph | Dependency Resolution | Semantic Retrieval |
| :--- | :---: | :---: | :---: | :---: | :---: |
| **TypeScript / TSX** | ✅ Tree-sitter | ✅ Functions, Classes, Methods, Types | ✅ calls, extends, implements | ✅ Pluggable Resolver | ✅ Full ONNX |
| **JavaScript / JSX** | ✅ Tree-sitter | ✅ Functions, Classes, Methods | ✅ calls, extends | ✅ Pluggable Resolver | ✅ Full ONNX |
| **Python** | ✅ Tree-sitter | ✅ Functions, Classes, Methods | ✅ calls, inheritance | ✅ Module / Import Resolver | ✅ Full ONNX |
| **Rust** | ✅ Tree-sitter | ✅ Structs, Enums, Traits, Functions | ✅ impl, trait references | ✅ Mod / Use Resolver | ✅ Full ONNX |
| **Go** | ✅ Tree-sitter | ✅ Structs, Interfaces, Functions | ✅ struct embeds, calls | ✅ Package / Import Resolver | ✅ Full ONNX |
| **Ruby** | ✅ Tree-sitter | ✅ Classes, Modules, Methods | ✅ calls, inheritance | ✅ Require / Load Resolver | ✅ Full ONNX |
| **Java / Kotlin** | ✅ Tree-sitter | ✅ Classes, Methods, Interfaces | ✅ references | ✅ Package Fallback | ✅ Full ONNX |
| **C / C++** | ✅ Tree-sitter | ✅ Functions, Structs, Classes | ✅ references | ✅ Header Fallback | ✅ Full ONNX |
| **C# / Swift / Scala**| ✅ Tree-sitter | ✅ Functions, Classes | ✅ references | ✅ Generic Fallback | ✅ Full ONNX |

---

## 🤖 Supported AI Agents

| Agent | Native Instructions | MCP Integration | Setup Mechanism |
| :--- | :---: | :---: | :---: |
| **Claude Code** | `CLAUDE.md` (Managed Section) | `.claude.json` | `kiteretsu init` |
| **Cursor IDE** | `.cursor/rules/kiteretsu.mdc` | `.cursor/mcp.json` | `kiteretsu init` |
| **Gemini CLI / Antigravity** | `GEMINI.md` | `.gemini/settings.json` | `kiteretsu init` |
| **OpenCode** | `AGENTS.md` & `.opencode/agents/` | `opencode.json` (`mcp` key) | `kiteretsu init` |
| **OpenAI Codex** | `AGENTS.md` | Universal MCP | `kiteretsu init` |
| **GitHub Copilot** | `.github/copilot-instructions.md` | Copilot instructions | `kiteretsu init` |
| **Generic MCP Agent** | `AGENTS.md` | `mcp.json` | `kiteretsu init` |

---

## 📦 Installation & Setup

### One-Command Setup (Recommended)

Run inside your repository root:

```bash
npx kiteretsu init
```

You can also target specific agents or install all integrations:

```bash
npx kiteretsu init --agent claude --agent cursor
# or install all
npx kiteretsu init --all
```

**What `kiteretsu init` does automatically:**
1. Detects your active AI agents and IDEs (or prompts for selection in interactive terminal).
2. Injects managed instruction sections into agent configuration files (`CLAUDE.md`, `.cursor/rules/kiteretsu.mdc`, `opencode.json`, etc.).
3. Configures Kiteretsu's MCP server in your agent settings.
4. Initializes local `.kiteretsu/` SQLite database with WAL mode.
5. Indexes all files, symbols, and dependencies.
6. Runs a full diagnostic health check.

### Global CLI Installation

```bash
npm install -g kiteretsu
# or with pnpm
pnpm add -g kiteretsu
```

---

## ⏱ 5-Minute Quick Start

```bash
# 1. Initialize and index the repository
kiteretsu init

# 2. Check repository scale and mental model
kiteretsu bootstrap

# 3. Compile context for a specific task
kiteretsu context "Add Stripe idempotency keys to payment service"

# 4. Deeply explain a module's architecture and ADRs
kiteretsu explain packages/core/src/database.ts

# 5. Check blast radius before refactoring
kiteretsu blast-radius Database.initialize
```

---

## 🔌 Canonical MCP Tools & Resources

Kiteretsu implements the standard [Model Context Protocol (MCP)](https://modelcontextprotocol.io).

### MCP Tools

| Tool Name | Description |
| :--- | :--- |
| `kiteretsu_context` | Compiles a multi-sensor Context Pack for a coding task with relevance score and evidence. |
| `kiteretsu_search` | Performs hybrid semantic vector and keyword retrieval across the repository. |
| `kiteretsu_explain` | Explains why a file or symbol is designed the way it is (source + graph + ADRs + rules + tests). |
| `kiteretsu_symbol` | Inspects symbol declaration details, lines, and AST relationship graph. |
| `kiteretsu_callers` | Finds all functions and symbols across the repository that call or reference a symbol. |
| `kiteretsu_callees` | Finds all outbound functions and symbols invoked by a given symbol. |
| `kiteretsu_blast_radius` | Computes downstream risk assessment (`LOW`/`MEDIUM`/`HIGH`), callers, tests, and ADRs. |
| `kiteretsu_decisions` | Queries active and historical Architectural Decision Records (ADRs). |
| `kiteretsu_history` | Retrieves past engineering tasks, outcomes, and developer learnings. |
| `kiteretsu_record_decision` | Records a new ADR with rationale, alternatives considered, and path scopes. |
| `kiteretsu_record_task` | Records task outcome (`success`/`failure`) and developer learnings. |
| `kiteretsu_bootstrap` | Returns the initial mental model of repository architecture and central modules. |
| `kiteretsu_doctor` | Runs health diagnostics across database, index, graph, embeddings, and memory. |

### MCP Resources

| Resource URI | Description |
| :--- | :--- |
| `kiteretsu://repo/overview` | High-level metrics, file/symbol counts, and index confidence. |
| `kiteretsu://repo/architecture` | Architectural layers and central modules ranked by dependency in-degree. |
| `kiteretsu://repo/health` | Live diagnostic report on database integrity, graph, and embedding health. |
| `kiteretsu://repo/decisions` | Complete log of architectural decisions, status, and path scopes. |
| `kiteretsu://repo/rules` | Repository governance rules and constraints. |

---

## 🔬 Real-World Examples

### 1. Context Pack Compilation (`kiteretsu context`)

```text
$ kiteretsu context "Add Stripe idempotency keys to payment service"

📦 Context Pack Compiled

Task: Add Stripe idempotency keys to payment service

📁 Read First:
  - src/services/payment.ts (89% relevance score) [symbol:PaymentService, vector_sim:82%, graph:imports_target]
    Core structures: PaymentService. Key logic: processCharge, refundTransaction.
  - src/storage/idempotency.ts (84% relevance score) [symbol:IdempotencyStore, terms:idempotency]
    Core structures: IdempotencyStore. Key logic: lockKey, resolveKey.

📄 Optional Context:
  - src/api/routes/checkout.ts (45%)

💥 Blast Radius (files affected by changes):
  ⚡ src/api/routes/checkout.ts
  ⚡ src/workers/reconciliation.ts

🧪 Tests to Run:
  ✓ test/payment.test.ts
  ✓ test/idempotency.test.ts

💡 Architectural Decisions:
  • Stripe Payment Gateway Standard (ADR-012)
    All payment processing in src/services/payment.ts must use idempotency keys with Stripe v3.
    Scope: src/services/payment.ts

🧠 Relevant Past Tasks & Learnings:
  ✓ Implement Stripe webhook signature validation
    Note: Always parse raw request body buffer before JSON decoding.

📏 Rules to Follow:
  - no-raw-stripe-calls: All Stripe calls must go through PaymentService wrapper.
```

---

### 2. Deep Architecture Explanation (`kiteretsu explain`)

```text
$ kiteretsu explain src/services/payment.ts

🔍 Architecture & Design Explanation for "src/services/payment.ts"

Summary:
  Core structures: PaymentService. Key logic: processCharge, refundTransaction.

Declared Symbols:
  • class PaymentService
  • method processCharge
  • method refundTransaction

Inbound Callers:
  ← checkoutRouter in src/api/routes/checkout.ts (calls)
  ← retryFailedCharges in src/workers/reconciliation.ts (calls)

💡 Applicable Architectural Decisions:
  • Stripe Payment Gateway Standard: All payment processing must use idempotency keys with Stripe v3 API.

📏 Applicable Rules:
  - no-raw-stripe-calls: All Stripe calls must go through PaymentService wrapper.

🧪 Related Tests:
  ✓ test/payment.test.ts
```

---

### 3. Risk Assessment (`kiteretsu blast-radius`)

```text
$ kiteretsu blast-radius PaymentService.processCharge

💥 Blast Radius Analysis: PaymentService.processCharge

Risk Level:           HIGH
Direct Dependents:    6 callers
Indirect Dependents:  17 consumers
Related Tests:        4 test suites

Direct Callers / Importers:
  ⚡ checkoutEndpoint (src/api/routes/checkout.ts)
  ⚡ subscriptionWorker (src/workers/subscriptions.ts)
  ⚡ recurringBillingJob (src/cron/billing.ts)

Tests to Run:
  ✓ test/payment.test.ts
  ✓ test/checkout.test.ts
  ✓ test/subscriptions.test.ts

Affected ADRs:
  • Stripe Payment Gateway Standard (ADR-012)
```

---

## 🧠 Repository Intelligence & Memory Model

Kiteretsu tracks 12 distinct dimensions of repository knowledge:

```
┌──────────────────────────────┬──────────────────────────────┐
│       Structural Graph       │      Structured Memory       │
├──────────────────────────────┼──────────────────────────────┤
│ 1. Files & Modules           │ 7. Architectural ADRs        │
│ 2. AST Declared Symbols      │ 8. Scoped Governance Rules   │
│ 3. Inbound & Outbound Calls  │ 9. Episodic Task History     │
│ 4. Type & Heritage Relations │ 10. Developer Pitfall Notes  │
│ 5. File Imports & Exports    │ 11. Multi-Sensor Evidence    │
│ 6. Related Test Suites       │ 12. Composite Relevance Score│
└──────────────────────────────┴──────────────────────────────┘
```

### Architectural Decisions (ADR Lifecycle)
Every ADR includes:
- `title`: Short descriptive name.
- `rationale`: Why this architectural choice was made.
- `alternatives_considered`: Other options evaluated.
- `affected_paths`: Exact file paths or glob patterns scoped to the decision.
- `status`: `proposed` | `accepted` | `superseded` | `deprecated` | `rejected` | `active`

---

## 🎯 Four-Signal Multi-Sensor Fusion & Explainability

Embeddings are **one signal among four**, combined in a weighted fusion pipeline:

1. **Lexical Retrieval (35% weight)**: Exact and partial symbol matches, identifier sub-tokens, IDF-weighted keyword significance.
2. **Semantic Vector Retrieval (35% weight)**: Local ONNX cosine vector similarity.
3. **Symbol & Graph Proximity Retrieval (20% weight)**: Traverses symbol call hierarchy (`calls`, `references`), inheritance trees (`extends`, `implements`), and file imports.
4. **Memory Scope Retrieval (10% weight)**: Correlates ADR and rule path overlap against candidate files.

### Explainable Signals Output
Every retrieved file reports explicit evidence:
```json
{
  "path": "src/services/payment.ts",
  "relevance_score": 0.89,
  "confidence": 0.89,
  "signals": [
    "symbol:PaymentService,processCharge",
    "vector_sim:82%",
    "terms:payment,stripe",
    "graph:calls:PaymentService",
    "memory:adr_rule_match"
  ]
}
```

---

## 🔄 Incremental 4-Pass Indexing

Kiteretsu never does expensive full-repository re-indexes unless requested:

```
Pass 1: Diff & Reconcile ──> Scans filesystem, detects modified files, purges deleted records
Pass 2: Parse & Embed    ──> Batch AST parses symbols and generates vector embeddings
Pass 3: Write Declarations─> Persists file records, technical summaries, and symbol declarations
Pass 4: Link Call Graph  ──> Resolves cross-file symbol call and inheritance edges across DB
```

---

## 🩺 Health & Diagnostics (`kiteretsu doctor`)

Run `kiteretsu doctor` anytime to verify all intelligence systems:

```text
$ kiteretsu doctor

🩺 Running Kiteretsu Diagnostics...

✓ SQLite Database Integrity: Healthy
✓ Index: 247 files indexed (0 stale)
✓ Code Graph: 172 dependency & symbol edges
✓ Embeddings: Transformers.js (local ONNX)
✓ Memory: 4 ADRs, 6 Rules, 12 Task logs

🤖 Agent Integrations:
  ✓ Claude Code integration: Healthy
  ✓ Cursor integration: Healthy
  ✓ OpenCode integration: Healthy
  ✓ Generic MCP Agent / AGENTS.md integration: Healthy
```

---

## 🔒 Privacy & Security

- **100% Local Execution**: All indexing, parsing, SQLite storage, and embedding computations happen locally on your machine.
- **No Cloud Dependencies**: Uses local Web-Tree-Sitter WASM grammars and local `@xenova/transformers` ONNX models (`Xenova/all-MiniLM-L6-v2`).
- **No Telemetry / No Phone-Home**: Zero analytics or tracking.
- **Isolated Storage**: All metadata is stored strictly in `.kiteretsu/memory/kiteretsu.sqlite` within your repository.

---

## ⚡ Performance

Measured on the Kiteretsu repository (247 files, 1,032 symbols, 172 dependency edges):

| Operation | Time | Notes |
| :--- | :---: | :--- |
| **Initial Full Repository Index** | **~4.2 s** | 247 files parsed & embedded with local ONNX |
| **Incremental File Re-Index** | **~38 ms** | Single-file AST diff & edge update |
| **Context Pack Compilation** | **~18 ms** | Multi-sensor fusion, blast radius, tests, ADRs |
| **Detailed Blast Radius** | **~12 ms** | Recursive call & import graph traversal |
| **SQLite WAL Query Latency** | **< 1 ms** | Synchronous in-process `better-sqlite3` execution |

---

## 📖 CLI Reference

| Command | Description |
| :--- | :--- |
| `kiteretsu init` | 1-command onboarding: detects agents, sets up MCP, initializes, and indexes. |
| `kiteretsu bootstrap` | Compiles initial mental model of architecture, central modules, and ADRs. |
| `kiteretsu doctor` | Comprehensive health check across DB, index, graph, embeddings, and agent bridges. |
| `kiteretsu sync` | Safely updates managed instruction sections and refreshes MCP configs. |
| `kiteretsu context <task>` | Compiles a precision Context Pack for a specific coding task. |
| `kiteretsu explain <target>` | Deeply explains why a file or symbol is designed the way it is. |
| `kiteretsu blast-radius <target>` | Computes downstream risk assessment (`LOW`/`MEDIUM`/`HIGH`), callers, and tests. |
| `kiteretsu record` | Analyzes uncommitted git diff changes and records task outcome and learnings. |
| `kiteretsu index` | Scans and incrementally updates the repository intelligence graph. |
| `kiteretsu search <query>` | Performs hybrid semantic vector and keyword search across the codebase. |
| `kiteretsu record-decision <title> <rationale>` | Records a new Architectural Decision Record (ADR). |
| `kiteretsu decisions` | Lists all recorded architectural decisions and path scopes. |
| `kiteretsu record-rule <name> <desc>` | Records an architectural governance rule. |
| `kiteretsu record-task <task> <outcome>` | Records task execution outcome (`success`/`failure`) and developer notes. |
| `kiteretsu watch` | Starts real-time filesystem watcher to keep index continuously synchronized. |

---

## ⚙️ Configuration (`kiteretsu.config.json`)

Created automatically by `kiteretsu init`:

```json
{
  "name": "my-project",
  "version": "0.1.0",
  "indexing": {
    "include": ["**/*"],
    "exclude": [
      "**/.kiteretsu/**",
      "**/.git/**",
      "**/node_modules/**",
      "**/dist/**",
      "**/build/**",
      "**/coverage/**"
    ]
  }
}
```

---

## 🗺 Roadmap

- [x] **Symbol-Level Code Intelligence Graph** (`calls`, `extends`, `implements`, `references`, `exports`)
- [x] **Architectural Decision Records (ADRs)** with lifecycle and path scoping
- [x] **Episodic Task Memory** with semantic similarity retrieval
- [x] **Four-Signal Hybrid Context Compiler** with explainable relevance scoring and evidence traces
- [x] **Zero-Friction Agent Bridge** (Claude Code, Cursor, Gemini CLI, OpenCode, OpenAI Codex, GitHub Copilot, Generic)
- [x] **Canonical MCP Tools & Resources**
- [ ] **Multi-Repository Federation** (linking frontend, backend, and shared libraries)
- [ ] **Team Architecture Sync** (shared ADR cloud synchronization)
- [ ] **Automated Agent Benchmark Suite** (`packages/benchmark`)

---

## 🤝 Contributing

We welcome contributions from developers passionate about agentic AI and developer tooling!

```bash
# 1. Clone the repository
git clone https://github.com/spellsaif/kiteretsu.git
cd kiteretsu

# 2. Install dependencies
pnpm install

# 3. Build all workspace packages
pnpm build

# 4. Run automated test suites
pnpm test
```

### Adding a New AI Agent Integration
To add support for a new AI agent:
1. Create `packages/agent-bridge/src/<agent>.ts` implementing the `AgentIntegration` interface.
2. Register the integration in `packages/agent-bridge/src/detector.ts`.
3. Add unit tests in `packages/agent-bridge/test/bridge.test.ts`.

---

## 📄 License

Distributed under the **MIT License**. See [LICENSE](./LICENSE) for details.

---

## 🙏 Acknowledgements

- [Tree-sitter](https://tree-sitter.github.io/tree-sitter/) — Fast, incremental AST parsing grammars.
- [SQLite](https://www.sqlite.org/) & [better-sqlite3](https://github.com/WiseLibs/better-sqlite3) — Lightning-fast, embedded WAL database engine.
- [sqlite-vec](https://github.com/asg017/sqlite-vec) — High-performance vector search in SQLite.
- [@xenova/transformers](https://github.com/xenova/transformers.js) — Local ONNX embedding inference.
- [Model Context Protocol (MCP)](https://modelcontextprotocol.io) — Open standard for AI tool and resource integration.

---

<div align="center">
  <h3>Build agents that understand the repository, not just the prompt.</h3>
  <p><code>npx kiteretsu init</code></p>
</div>
