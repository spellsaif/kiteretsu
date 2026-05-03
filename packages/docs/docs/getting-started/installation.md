# Installation

Get up and running with Kiteretsu in seconds.

## Prerequisites

- **Node.js**: v18.0 or higher.
- **Package Manager**: pnpm (recommended), npm, or yarn.

## Install the CLI

The Kiteretsu CLI is the primary way to interact with the engine. Install it globally or use it via `npx`.

```bash
# Install globally
npm install -g @kiteretsu/cli

# Or use with npx
npx @kiteretsu/cli --help
```

## Initializing a Project

Once installed, navigate to your project root and run the initialization command:

```bash
kiteretsu init
```

This will:
1. Create a `.kiteretsu` directory for internal metadata and database.
2. Generate a **`kiteretsu.config.json`** in your project root for behavioral settings.
3. Generate a **`.kiteretsuignore`** in your project root to manage indexing exclusions.

## Your First Index

After initialization, run a full index to build the initial codebase map:

```bash
kiteretsu index
```

> **Tip**: For large projects, the first index may take a few seconds. Subsequent updates are incremental and nearly instantaneous.
