# Configuration

Kiteretsu uses two simple files to govern its behavior and intelligence. Both are located in your project root.

---

## 1. `kiteretsu.config.json`

This file controls the **behavior** of the Kiteretsu engine.

```json
{
  "name": "my-project",
  "version": "1.0.0",
  "indexing": {
    "maxFileSize": "10MB",
    "deepParseLimit": "500KB"
  },
  "search": {
    "precision": "high"
  }
}
```

### Properties

| Property | Description | Default |
| :--- | :--- | :--- |
| `name` | Your project name. | Directory name |
| `version` | Your project version. | `1.0.0` |
| `indexing.maxFileSize` | The absolute limit for indexing a file. Files larger than this are skipped. | `10MB` |
| `indexing.deepParseLimit` | Files smaller than this get full AST analysis. Larger files get "Lite" Regex analysis. | `500KB` |
| `search.precision` | The semantic search precision level (`low`, `medium`, `high`). | `high` |

---

## 2. `.kiteretsuignore`

This file controls the **governance** of your files. It uses the same syntax as `.gitignore`.

### Default Patterns
When you run `kiteretsu init`, this file is pre-populated with standard industry ignores:
- `node_modules/`
- `dist/`, `build/`, `out/`
- `.git/`
- `*.log`, `*.tmp`

### How it works
1. **Global Blacklist**: Kiteretsu always ignores system-critical folders like `.git` and `node_modules`.
2. **.kiteretsuignore**: Overrides and adds project-specific rules.
3. **Smart Filtering**: Kiteretsu automatically excludes "Garbage" files like lockfiles (`pnpm-lock.yaml`, `package-lock.json`) to keep your search results clean.

---

## Why Two Files?

- **Governance (`.kiteretsuignore`)**: Tells Kiteretsu **where** to look.
- **Behavior (`kiteretsu.config.json`)**: Tells Kiteretsu **how** to think.

By separating these, you can easily share your ignore rules with your team while keeping your engine settings flexible.
