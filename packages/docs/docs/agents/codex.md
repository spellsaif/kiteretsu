# Integrating OpenAI Codex

Kiteretsu integrates with **OpenAI Codex** through project-level instructions in `AGENTS.md` and standard MCP server configuration.

---

## Setup

Run in your project root:

```bash
npx kiteretsu init --agent codex
```

---

## What Kiteretsu Configures

### `AGENTS.md` Managed Section
OpenAI's Codex conventions center on `AGENTS.md` for steering repository tasks. Kiteretsu maintains a managed instruction section:

```markdown
<!-- KITERETSU:START -->
# Kiteretsu Intelligence Bridge (OpenAI Codex / AGENTS.md)

This repository uses Kiteretsu to maintain a continuous Code Intelligence Graph and Memory Layer.

## 🧭 Behavioral Protocol
1. **Context First**: Before planning or making changes, query Kiteretsu for relevant context:
   - Use MCP tool `kiteretsu_context` (or CLI `kiteretsu context "<task>"`)
2. **Check Blast Radius**: Before high-impact refactors, inspect callers & callees with `kiteretsu_blast_radius`.
3. **Verify**: Run related tests suggested by `kiteretsu_tests` or `kiteretsu context`.
4. **Record Outcome**: Record completed tasks with `kiteretsu_record_task`.
<!-- KITERETSU:END -->
```

---

## Workflow with Codex

1. **Protocol Adherence**: Codex reads `AGENTS.md` on startup and obeys the architectural protocol.
2. **Targeted Exploration**: When formulating implementation plans, Codex queries `kiteretsu context "<task>"` to obtain the exact symbols, rules, and blast radius.
3. **Outcome Persistence**: Codex records task success or notes to enrich repository memory.
