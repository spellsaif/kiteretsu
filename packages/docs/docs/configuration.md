# Configuration

Kiteretsu uses a single, canonical TypeScript configuration file: **`kiteretsu.config.ts`** located in your project root.

---

## Canonical Configuration (`kiteretsu.config.ts`)

Created automatically by `kiteretsu init`:

```typescript
import { defineConfig } from "kiteretsu";

export default defineConfig({
  indexing: {
    maxFileSize: "10MB",
    deepParseLimit: "500KB",
  },
  search: {
    precision: "high",
    provider: "transformers",
  },
  ignore: [
    "**/node_modules/**",
    "**/.git/**",
    "**/dist/**",
    "**/build/**",
    "**/.next/**",
    "**/coverage/**",
    "**/.kiteretsu/**",
  ],
});
```

---

## Configuration Properties

### Indexing (`indexing`)
| Property | Description | Default |
| :--- | :--- | :--- |
| `maxFileSize` | Absolute limit for file indexing. Files larger than this are skipped. | `"10MB"` |
| `deepParseLimit` | Files smaller than this receive full Tree-sitter AST symbol extraction. | `"500KB"` |
| `include` | Optional glob array of files to index. | `["**/*"]` |
| `exclude` | Optional glob array of paths to exclude from indexing. | `[]` |

### Search & Embeddings (`search`)
| Property | Description | Default |
| :--- | :--- | :--- |
| `precision` | The semantic search precision level (`"low"`, `"medium"`, `"high"`). | `"high"` |
| `provider` | Embedding and retrieval provider (`"transformers"` or `"remote"`). | `"transformers"` |

### Exclusions (`ignore`)
Array of glob patterns to exclude from code scanning and symbol graph generation:
- `**/node_modules/**`
- `**/.git/**`
- `**/dist/**`, `**/build/**`, `**/target/**`
- `**/.next/**`, `**/.nuxt/**`, `**/.svelte-kit/**`
- `**/coverage/**`

---

## Single Source of Truth

Kiteretsu establishes a clean separation of concerns:
- **`kiteretsu.config.ts`**: User-authored project configuration and ignore rules.
- **`AGENTS.md` / `CLAUDE.md` / `.cursor/rules/`**: AI Agent instruction files.
- **`.kiteretsu/`**: Internal SQLite WAL database, indices, and runtime cache (never manually edited).
