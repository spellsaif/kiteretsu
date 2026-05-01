# Self-Healing Memory (Git Hooks)

To keep Kiteretsu truly effective, its "Memory" must stay in sync with your source code. Kiteretsu can automatically update its index every time you commit code.

## Installation

Run the following command in your project root:

```bash
kiteretsu install git
```

## How it Works

Kiteretsu installs a **`post-commit`** hook in your `.git/hooks/` directory.

Every time you run `git commit`, the hook triggers a background indexing process:
```bash
#!/bin/sh
# Kiteretsu auto-index
npx @kiteretsu/cli index > /dev/null 2>&1 &
```

## Benefits

### 1. Zero Manual Work
You never have to remember to run `kiteretsu index`. The system "self-heals" its intelligence database automatically as you work.

### 2. Perfect Agent Context
When an AI agent requests a Context Pack, it will always receive information based on the most recent commit. This prevents "Staleness Warnings" and ensures the dependency graph is always accurate.

### 3. Lightweight
The background process is designed to be low-priority and non-blocking, so it won't slow down your git workflow.

---

## Pro Tip: Background Watcher
If you want real-time updates (even before you commit), you can run the Kiteretsu watcher in a separate terminal:
```bash
kiteretsu watch
```
This will update the database the moment you save a file!
