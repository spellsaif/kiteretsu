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
