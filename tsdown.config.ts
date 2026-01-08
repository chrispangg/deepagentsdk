import { defineConfig } from "tsdown";

export default defineConfig({
  // Multiple entry points for different exports
  entry: [
    "src/index.ts",                      // Main library
    "src/cli/index.tsx",                 // CLI entry point
    "src/adapters/elements/index.ts",    // Elements adapter
  ],

  // Output both ESM and CJS for maximum compatibility
  format: ["esm", "cjs"],

  // Generate TypeScript declaration files
  dts: true,

  // Clean dist directory before build
  clean: true,

  // Output directory
  outDir: "dist",

  // Source maps for debugging
  sourcemap: true,

  // External dependencies (don't bundle them)
  external: [
    "ai",
    "@ai-sdk/*",
    "zod",
    "react",
    "react-dom",
    "@inkjs/ui",
    "ink",
    "jsdom",
    "@mozilla/readability",
    "turndown",
    "@tavily/core",
    "fast-glob",
    "micromatch",
    "react-devtools-core",
  ],
});
