# Troubleshooting & Stability

Kiteretsu is designed to be a "Zero-Maintenance" engine, but large or complex codebases can sometimes hit physical system limits. Use this guide to resolve common stability issues.

---

## 🚫 Fatal Process Out of Memory (OOM)

If you see a `Fatal process out of memory: Zone` error on Windows, it is usually because a native worker thread (ONNX or OpenSSL) was interrupted before it could finish its cleanup.

### The Fix
We have implemented a **Graceful Finalization Delay** (300ms) in the CLI. If you still encounter this:
1.  **Increase Node Heap**: Run the indexer with more memory:
    ```bash
    NODE_OPTIONS="--max-old-space-size=4096" kiteretsu index
    ```
2.  **Check File Sizes**: Ensure you don't have massive text files (e.g., 50MB log files) that aren't being ignored. Kiteretsu automatically skips files > 10MB, but many files just under that limit can still stress the heap.

---

## 🔍 Missing Files in Context/Search

If a file exists on disk but Kiteretsu can't find it:

### 1. Check the 4-Layer Sieve
Kiteretsu might be automatically ignoring the file if it matches one of these:
- It is listed in your **`.kiteretsuignore`**.
- It is a "Garbage" file (e.g., a lockfile like `pnpm-lock.yaml`).
- it is a binary file (images, PDFs, WASM).

### 2. Verify File Size
Files larger than **10MB** are registered but not deeply indexed. They won't appear in symbol searches or semantic context packs to protect engine stability.

---

## ⏳ Stale Context

If Kiteretsu is suggesting code that you've already changed:

1.  **Start the Watcher**: Ensure `kiteretsu watch` is running in a background terminal.
2.  **Force Re-index**: If the watcher was missed, run a fresh index:
    ```bash
    kiteretsu index
    ```

---

## 🛠 Advanced Diagnostics

If you need to see exactly what the engine is doing, check the debug log:
```bash
tail -f .kiteretsu/debug.log
```

If you encounter a persistent issue with the AI embedding engine, you can temporarily disable it for debugging:
```bash
# Windows (PowerShell)
$env:KITERETSU_SKIP_EMBEDDINGS="true"; kiteretsu index
```
