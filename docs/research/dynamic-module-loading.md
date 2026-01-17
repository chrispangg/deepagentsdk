# Dynamic Module Loading Patterns in Node.js and Bun

This document covers patterns for dynamically loading npm packages at runtime, including checking if packages are installed, dynamic imports, programmatic installation, and security considerations.

## Table of Contents

1. [Checking if a Package is Installed](#1-checking-if-a-package-is-installed)
2. [Dynamic Import Patterns](#2-dynamic-import-patterns)
3. [Programmatic Package Installation](#3-programmatic-package-installation)
4. [Bun-Specific APIs](#4-bun-specific-apis)
5. [Error Handling Patterns](#5-error-handling-patterns)
6. [Security Considerations](#6-security-considerations)
7. [Cross-Runtime Utility Functions](#7-cross-runtime-utility-functions)

---

## 1. Checking if a Package is Installed

### CommonJS (Node.js) - Using `require.resolve()`

```typescript
/**
 * Check if a package is installed using require.resolve (CommonJS)
 * Works in Node.js and Bun
 */
function isPackageInstalled(packageName: string): boolean {
  try {
    require.resolve(packageName);
    return true;
  } catch (err: any) {
    if (err.code === "MODULE_NOT_FOUND") {
      return false;
    }
    // Re-throw unexpected errors (e.g., syntax errors in the module)
    throw err;
  }
}

// Usage
console.log(isPackageInstalled("lodash")); // true if installed
console.log(isPackageInstalled("nonexistent-pkg")); // false
```

### ESM (Node.js 20+, Bun) - Using `import.meta.resolve()`

```typescript
/**
 * Check if a package is installed using import.meta.resolve (ESM)
 * Works in Node.js 20+ and Bun
 */
function isPackageInstalledESM(packageName: string): boolean {
  try {
    // import.meta.resolve is synchronous in Node.js 20+ and Bun
    import.meta.resolve(packageName);
    return true;
  } catch (err: any) {
    const notFoundCodes = [
      "ERR_MODULE_NOT_FOUND",
      "ERR_INVALID_MODULE_SPECIFIER",
      "ERR_PACKAGE_PATH_NOT_EXPORTED",
    ];
    if (notFoundCodes.includes(err.code)) {
      return false;
    }
    throw err;
  }
}
```

### Cross-Runtime Check

```typescript
/**
 * Cross-runtime package existence check
 * Works in both Node.js (CommonJS/ESM) and Bun
 */
function packageExists(packageName: string): boolean {
  // Try ESM resolution first (available in Bun and Node.js 20+)
  if (typeof import.meta !== "undefined" && import.meta.resolve) {
    try {
      import.meta.resolve(packageName);
      return true;
    } catch {
      return false;
    }
  }

  // Fallback to CommonJS resolution
  try {
    require.resolve(packageName);
    return true;
  } catch {
    return false;
  }
}
```

---

## 2. Dynamic Import Patterns

### Basic Dynamic Import

```typescript
/**
 * Dynamically import a package by name
 * Returns the module or null if not found
 */
async function dynamicImport<T = any>(
  packageName: string
): Promise<T | null> {
  try {
    const module = await import(packageName);
    return module as T;
  } catch (err: any) {
    if (err.code === "ERR_MODULE_NOT_FOUND" || err.code === "MODULE_NOT_FOUND") {
      return null;
    }
    throw err;
  }
}

// Usage
const lodash = await dynamicImport("lodash");
if (lodash) {
  console.log(lodash.default.camelCase("hello world"));
}
```

### Conditional Import with Fallback

```typescript
/**
 * Import a package with a fallback alternative
 */
async function importWithFallback<T = any>(
  primary: string,
  fallback: string
): Promise<{ module: T; source: string }> {
  try {
    const module = await import(primary);
    return { module: module as T, source: primary };
  } catch {
    try {
      const module = await import(fallback);
      return { module: module as T, source: fallback };
    } catch (err) {
      throw new Error(
        `Neither ${primary} nor ${fallback} could be imported: ${err}`
      );
    }
  }
}

// Usage: Try native fetch, fall back to node-fetch
const { module: fetch, source } = await importWithFallback(
  "node:fetch",
  "node-fetch"
);
```

### Lazy Loading Pattern

```typescript
/**
 * Create a lazy-loaded module getter
 * Module is only imported when first accessed
 */
function createLazyImport<T>(packageName: string): () => Promise<T> {
  let cached: T | null = null;
  let loading: Promise<T> | null = null;

  return async () => {
    if (cached) return cached;
    if (loading) return loading;

    loading = import(packageName).then((mod) => {
      cached = mod as T;
      return cached;
    });

    return loading;
  };
}

// Usage
const getLodash = createLazyImport<typeof import("lodash")>("lodash");

// Module is only imported when this is called
const _ = await getLodash();
```

### Import with Version Check

```typescript
/**
 * Import a package and verify its version meets requirements
 */
async function importWithVersionCheck(
  packageName: string,
  minVersion: string
): Promise<any> {
  const module = await import(packageName);

  // Try to get version from package.json
  try {
    const pkgPath = import.meta.resolve(`${packageName}/package.json`);
    const pkgUrl = new URL(pkgPath);
    const pkg = await import(pkgUrl.href, { with: { type: "json" } });
    const version = pkg.default.version;

    if (!satisfiesVersion(version, minVersion)) {
      throw new Error(
        `${packageName} version ${version} does not satisfy minimum ${minVersion}`
      );
    }
  } catch (err: any) {
    // Version check failed, but module loaded - warn and continue
    if (err.code !== "ERR_MODULE_NOT_FOUND") {
      console.warn(`Could not verify ${packageName} version: ${err.message}`);
    }
  }

  return module;
}

// Simple semver comparison (for illustration - use 'semver' package in production)
function satisfiesVersion(current: string, minimum: string): boolean {
  const parse = (v: string) => v.split(".").map(Number);
  const [curMajor, curMinor = 0, curPatch = 0] = parse(current);
  const [minMajor, minMinor = 0, minPatch = 0] = parse(minimum);

  if (curMajor !== minMajor) return curMajor > minMajor;
  if (curMinor !== minMinor) return curMinor > minMinor;
  return curPatch >= minPatch;
}
```

---

## 3. Programmatic Package Installation

### Node.js - Using child_process

```typescript
import { spawn } from "child_process";
import { promisify } from "util";
import { exec as execCallback } from "child_process";

const exec = promisify(execCallback);

/**
 * Install a package using npm (Node.js)
 */
async function npmInstall(
  packageName: string,
  options: {
    cwd?: string;
    dev?: boolean;
    global?: boolean;
  } = {}
): Promise<{ success: boolean; output: string }> {
  const args = ["install"];

  if (options.dev) args.push("--save-dev");
  if (options.global) args.push("--global");
  args.push(packageName);

  const cwd = options.cwd || process.cwd();

  try {
    const { stdout, stderr } = await exec(`npm ${args.join(" ")}`, { cwd });
    return { success: true, output: stdout + stderr };
  } catch (err: any) {
    return { success: false, output: err.message };
  }
}

/**
 * Install using spawn for streaming output
 */
function npmInstallWithProgress(
  packageName: string,
  cwd: string = process.cwd()
): Promise<number> {
  return new Promise((resolve, reject) => {
    const proc = spawn("npm", ["install", packageName], {
      cwd,
      stdio: "inherit", // Stream output to console
    });

    proc.on("close", (code) => {
      if (code === 0) {
        resolve(code);
      } else {
        reject(new Error(`npm install failed with code ${code}`));
      }
    });

    proc.on("error", reject);
  });
}
```

### Bun - Using Bun.spawn

```typescript
/**
 * Install a package using Bun's native spawn API
 */
async function bunInstall(
  packageName: string,
  options: {
    cwd?: string;
    dev?: boolean;
  } = {}
): Promise<{ success: boolean; output: string }> {
  const args = ["add"];
  if (options.dev) args.push("--dev");
  args.push(packageName);

  const proc = Bun.spawn(["bun", ...args], {
    cwd: options.cwd || process.cwd(),
    stdout: "pipe",
    stderr: "pipe",
  });

  const exitCode = await proc.exited;
  const stdout = await new Response(proc.stdout).text();
  const stderr = await new Response(proc.stderr).text();

  return {
    success: exitCode === 0,
    output: stdout + stderr,
  };
}

/**
 * Synchronous package installation with Bun
 */
function bunInstallSync(
  packageName: string,
  cwd: string = process.cwd()
): { success: boolean; output: string } {
  const result = Bun.spawnSync(["bun", "add", packageName], {
    cwd,
  });

  return {
    success: result.success,
    output: result.stdout.toString() + result.stderr.toString(),
  };
}
```

### Cross-Runtime Installation

```typescript
/**
 * Install a package using the appropriate package manager
 * Detects runtime and uses bun/npm accordingly
 */
async function installPackage(
  packageName: string,
  options: {
    cwd?: string;
    dev?: boolean;
  } = {}
): Promise<{ success: boolean; output: string }> {
  const isBun = typeof Bun !== "undefined";
  const cwd = options.cwd || process.cwd();

  if (isBun) {
    // Use Bun's native spawn
    const args = ["add"];
    if (options.dev) args.push("--dev");
    args.push(packageName);

    const proc = Bun.spawn(["bun", ...args], {
      cwd,
      stdout: "pipe",
      stderr: "pipe",
    });

    const exitCode = await proc.exited;
    const stdout = await new Response(proc.stdout).text();
    const stderr = await new Response(proc.stderr).text();

    return { success: exitCode === 0, output: stdout + stderr };
  } else {
    // Use Node.js child_process
    const { spawn } = await import("child_process");

    return new Promise((resolve) => {
      const args = ["install"];
      if (options.dev) args.push("--save-dev");
      args.push(packageName);

      const proc = spawn("npm", args, { cwd });

      let output = "";
      proc.stdout?.on("data", (data) => (output += data));
      proc.stderr?.on("data", (data) => (output += data));

      proc.on("close", (code) => {
        resolve({ success: code === 0, output });
      });

      proc.on("error", (err) => {
        resolve({ success: false, output: err.message });
      });
    });
  }
}
```

---

## 4. Bun-Specific APIs

### Auto-Install Feature

Bun has a unique auto-install feature that automatically installs missing packages on import:

```typescript
// In bunfig.toml:
// [install]
// auto = "auto"  # or "force" to always auto-install

// When auto-install is enabled, this will automatically install lodash
// if it's not present in node_modules
import _ from "lodash";
```

**Configuration options in `bunfig.toml`:**

```toml
[install]
# "auto" - install if missing (default)
# "force" - always check and install
# "disable" - never auto-install
auto = "auto"
```

### Bun.spawn for Package Management

```typescript
/**
 * Comprehensive Bun package management utilities
 */
const BunPackageManager = {
  /**
   * Add a package
   */
  async add(
    packages: string | string[],
    options: { dev?: boolean; exact?: boolean; trust?: boolean } = {}
  ): Promise<{ success: boolean; exitCode: number }> {
    const pkgs = Array.isArray(packages) ? packages : [packages];
    const args = ["add"];

    if (options.dev) args.push("--dev");
    if (options.exact) args.push("--exact");
    if (options.trust) args.push("--trust");
    args.push(...pkgs);

    const proc = Bun.spawn(["bun", ...args], { stdout: "pipe", stderr: "pipe" });
    const exitCode = await proc.exited;

    return { success: exitCode === 0, exitCode };
  },

  /**
   * Remove a package
   */
  async remove(packages: string | string[]): Promise<{ success: boolean }> {
    const pkgs = Array.isArray(packages) ? packages : [packages];
    const proc = Bun.spawn(["bun", "remove", ...pkgs], {
      stdout: "pipe",
      stderr: "pipe",
    });
    const exitCode = await proc.exited;
    return { success: exitCode === 0 };
  },

  /**
   * Install all dependencies
   */
  async install(
    options: { frozen?: boolean; production?: boolean } = {}
  ): Promise<{ success: boolean }> {
    const args = ["install"];
    if (options.frozen) args.push("--frozen-lockfile");
    if (options.production) args.push("--production");

    const proc = Bun.spawn(["bun", ...args], {
      stdout: "pipe",
      stderr: "pipe",
    });
    const exitCode = await proc.exited;
    return { success: exitCode === 0 };
  },

  /**
   * Update packages
   */
  async update(packages?: string[]): Promise<{ success: boolean }> {
    const args = ["update"];
    if (packages) args.push(...packages);

    const proc = Bun.spawn(["bun", ...args], {
      stdout: "pipe",
      stderr: "pipe",
    });
    const exitCode = await proc.exited;
    return { success: exitCode === 0 };
  },
};
```

### import.meta Properties in Bun

```typescript
// Bun provides these import.meta properties:

// Resolve a module specifier to a file URL
const resolvedPath = import.meta.resolve("lodash");
// => "file:///path/to/node_modules/lodash/index.js"

// Current file's URL
console.log(import.meta.url);
// => "file:///path/to/current/file.ts"

// Current file's path (Bun-specific convenience)
console.log(import.meta.path);
// => "/path/to/current/file.ts"

// Current file's directory (Bun-specific convenience)
console.log(import.meta.dir);
// => "/path/to/current"

// Main module check
console.log(import.meta.main);
// => true if this is the entry point
```

---

## 5. Error Handling Patterns

### Comprehensive Error Handler

```typescript
/**
 * Error types for module loading
 */
type ModuleLoadError =
  | { type: "not_found"; packageName: string }
  | { type: "version_mismatch"; packageName: string; found: string; required: string }
  | { type: "export_not_found"; packageName: string; exportPath: string }
  | { type: "syntax_error"; packageName: string; message: string }
  | { type: "unknown"; packageName: string; error: Error };

/**
 * Safe dynamic import with detailed error information
 */
async function safeImport<T = any>(
  packageName: string
): Promise<{ module: T } | { error: ModuleLoadError }> {
  try {
    const module = await import(packageName);
    return { module: module as T };
  } catch (err: any) {
    // Module not found
    if (
      err.code === "ERR_MODULE_NOT_FOUND" ||
      err.code === "MODULE_NOT_FOUND"
    ) {
      return {
        error: { type: "not_found", packageName },
      };
    }

    // Export path not allowed by package.json exports
    if (err.code === "ERR_PACKAGE_PATH_NOT_EXPORTED") {
      const exportPath = err.message.match(/subpath '(.+)'/)?.[1] || "unknown";
      return {
        error: { type: "export_not_found", packageName, exportPath },
      };
    }

    // Syntax error in the module
    if (err instanceof SyntaxError) {
      return {
        error: { type: "syntax_error", packageName, message: err.message },
      };
    }

    // Unknown error
    return {
      error: { type: "unknown", packageName, error: err },
    };
  }
}

// Usage
const result = await safeImport("some-package");
if ("error" in result) {
  switch (result.error.type) {
    case "not_found":
      console.log(`Package ${result.error.packageName} is not installed`);
      break;
    case "export_not_found":
      console.log(`Export ${result.error.exportPath} not available`);
      break;
    default:
      console.log(`Failed to load: ${JSON.stringify(result.error)}`);
  }
} else {
  console.log("Module loaded successfully");
}
```

### Install-on-Demand Pattern

```typescript
/**
 * Import a package, installing it if not found
 */
async function importOrInstall<T = any>(
  packageName: string,
  options: {
    cwd?: string;
    autoInstall?: boolean;
  } = {}
): Promise<T> {
  const { cwd = process.cwd(), autoInstall = true } = options;

  try {
    return await import(packageName);
  } catch (err: any) {
    if (
      err.code !== "ERR_MODULE_NOT_FOUND" &&
      err.code !== "MODULE_NOT_FOUND"
    ) {
      throw err;
    }

    if (!autoInstall) {
      throw new Error(
        `Package "${packageName}" is not installed. ` +
          `Run: npm install ${packageName}`
      );
    }

    console.log(`Installing ${packageName}...`);

    const installResult = await installPackage(packageName, { cwd });
    if (!installResult.success) {
      throw new Error(`Failed to install ${packageName}: ${installResult.output}`);
    }

    // Clear module cache and retry import
    // Note: This may not work in all cases due to module caching
    return await import(packageName);
  }
}
```

---

## 6. Security Considerations

### Risks of Dynamic Package Loading

1. **Code Injection**: Untrusted input determining module names can lead to arbitrary code execution
2. **Supply Chain Attacks**: Dynamically loaded packages may be compromised
3. **Typosquatting**: Similar package names can trick users into loading malicious code
4. **Data Exfiltration**: Loaded modules have access to environment variables and filesystem

### Safe Dynamic Import Patterns

```typescript
/**
 * Allowlist-based dynamic import
 * Only allows importing from a predefined list of packages
 */
const ALLOWED_PACKAGES = new Set([
  "lodash",
  "axios",
  "zod",
  "date-fns",
]);

async function safeAllowlistImport<T = any>(
  packageName: string
): Promise<T> {
  // Normalize package name (handle scoped packages)
  const normalizedName = packageName.split("/")[0].replace(/^@/, "");

  if (!ALLOWED_PACKAGES.has(packageName) && !ALLOWED_PACKAGES.has(normalizedName)) {
    throw new Error(
      `Package "${packageName}" is not in the allowed list. ` +
        `Allowed packages: ${[...ALLOWED_PACKAGES].join(", ")}`
    );
  }

  return await import(packageName);
}
```

```typescript
/**
 * Validate package name format to prevent path traversal
 */
function isValidPackageName(name: string): boolean {
  // npm package name rules:
  // - Can't start with . or _
  // - Can't contain path separators
  // - Must be lowercase
  // - Can be scoped (@org/package)

  const packageNameRegex = /^(@[a-z0-9-~][a-z0-9-._~]*\/)?[a-z0-9-~][a-z0-9-._~]*$/;

  if (!packageNameRegex.test(name)) {
    return false;
  }

  // Additional checks
  if (name.includes("..") || name.includes("//")) {
    return false;
  }

  return true;
}

async function validateAndImport<T = any>(packageName: string): Promise<T> {
  if (!isValidPackageName(packageName)) {
    throw new Error(`Invalid package name: "${packageName}"`);
  }

  return await import(packageName);
}
```

### Sandboxed Execution

```typescript
/**
 * Import and execute code in a more isolated context
 * Note: This is NOT a security sandbox - use proper sandboxing for untrusted code
 */
async function isolatedImport(packageName: string): Promise<any> {
  // Validate package name
  if (!isValidPackageName(packageName)) {
    throw new Error(`Invalid package name: ${packageName}`);
  }

  // Check if package is installed (don't auto-install)
  if (!packageExists(packageName)) {
    throw new Error(`Package ${packageName} is not installed`);
  }

  // Import with a timeout to prevent hanging
  const timeoutMs = 5000;
  const importPromise = import(packageName);
  const timeoutPromise = new Promise((_, reject) =>
    setTimeout(() => reject(new Error("Import timeout")), timeoutMs)
  );

  return Promise.race([importPromise, timeoutPromise]);
}
```

### Audit Logging

```typescript
/**
 * Dynamic import with audit logging
 */
async function auditedImport<T = any>(
  packageName: string,
  context: { userId?: string; reason?: string } = {}
): Promise<T> {
  const timestamp = new Date().toISOString();
  const logEntry = {
    timestamp,
    action: "dynamic_import",
    packageName,
    ...context,
    success: false,
    error: null as string | null,
  };

  try {
    const module = await import(packageName);
    logEntry.success = true;

    // Log to your audit system
    console.log("[AUDIT]", JSON.stringify(logEntry));

    return module as T;
  } catch (err: any) {
    logEntry.error = err.message;

    // Log failed attempt
    console.error("[AUDIT]", JSON.stringify(logEntry));

    throw err;
  }
}
```

---

## 7. Cross-Runtime Utility Functions

### Complete Dynamic Module Loader

```typescript
/**
 * Cross-runtime dynamic module loader
 * Works in Node.js and Bun
 */
export class DynamicModuleLoader {
  private cache = new Map<string, any>();
  private allowlist?: Set<string>;

  constructor(options: { allowlist?: string[] } = {}) {
    if (options.allowlist) {
      this.allowlist = new Set(options.allowlist);
    }
  }

  /**
   * Check if a package is installed
   */
  isInstalled(packageName: string): boolean {
    try {
      if (typeof import.meta !== "undefined" && import.meta.resolve) {
        import.meta.resolve(packageName);
        return true;
      }
      require.resolve(packageName);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Get the resolved path of a package
   */
  resolvePath(packageName: string): string | null {
    try {
      if (typeof import.meta !== "undefined" && import.meta.resolve) {
        return import.meta.resolve(packageName);
      }
      return require.resolve(packageName);
    } catch {
      return null;
    }
  }

  /**
   * Dynamically import a package
   */
  async import<T = any>(
    packageName: string,
    options: { useCache?: boolean } = {}
  ): Promise<T> {
    const { useCache = true } = options;

    // Check allowlist
    if (this.allowlist && !this.allowlist.has(packageName)) {
      throw new Error(`Package "${packageName}" is not allowed`);
    }

    // Check cache
    if (useCache && this.cache.has(packageName)) {
      return this.cache.get(packageName);
    }

    // Import
    const module = await import(packageName);

    // Cache
    if (useCache) {
      this.cache.set(packageName, module);
    }

    return module as T;
  }

  /**
   * Import with automatic installation
   */
  async importOrInstall<T = any>(
    packageName: string,
    options: { cwd?: string } = {}
  ): Promise<T> {
    if (this.isInstalled(packageName)) {
      return this.import<T>(packageName);
    }

    // Install
    const result = await this.install(packageName, options);
    if (!result.success) {
      throw new Error(`Failed to install ${packageName}`);
    }

    return this.import<T>(packageName, { useCache: false });
  }

  /**
   * Install a package
   */
  async install(
    packageName: string,
    options: { cwd?: string; dev?: boolean } = {}
  ): Promise<{ success: boolean; output: string }> {
    const isBun = typeof Bun !== "undefined";
    const cwd = options.cwd || process.cwd();

    if (isBun) {
      const args = ["add"];
      if (options.dev) args.push("--dev");
      args.push(packageName);

      const proc = Bun.spawn(["bun", ...args], {
        cwd,
        stdout: "pipe",
        stderr: "pipe",
      });

      const exitCode = await proc.exited;
      const stdout = await new Response(proc.stdout).text();
      const stderr = await new Response(proc.stderr).text();

      return { success: exitCode === 0, output: stdout + stderr };
    }

    // Node.js fallback
    const { exec } = await import("child_process");
    const { promisify } = await import("util");
    const execAsync = promisify(exec);

    const cmd = options.dev
      ? `npm install --save-dev ${packageName}`
      : `npm install ${packageName}`;

    try {
      const { stdout, stderr } = await execAsync(cmd, { cwd });
      return { success: true, output: stdout + stderr };
    } catch (err: any) {
      return { success: false, output: err.message };
    }
  }

  /**
   * Clear the module cache
   */
  clearCache(packageName?: string): void {
    if (packageName) {
      this.cache.delete(packageName);
    } else {
      this.cache.clear();
    }
  }
}

// Usage
const loader = new DynamicModuleLoader({
  allowlist: ["lodash", "axios", "zod"],
});

// Check if installed
console.log(loader.isInstalled("lodash")); // true/false

// Import (cached)
const _ = await loader.import("lodash");

// Import or install if missing
const axios = await loader.importOrInstall("axios");
```

### Runtime Detection Utilities

```typescript
/**
 * Runtime detection utilities
 */
export const Runtime = {
  isBun: typeof Bun !== "undefined",
  isNode: typeof process !== "undefined" && !!(process.versions?.node),
  isDeno: typeof Deno !== "undefined",

  get name(): "bun" | "node" | "deno" | "unknown" {
    if (this.isBun) return "bun";
    if (this.isDeno) return "deno";
    if (this.isNode) return "node";
    return "unknown";
  },

  get version(): string {
    if (this.isBun) return Bun.version;
    if (this.isNode) return process.versions.node;
    if (this.isDeno) return Deno.version.deno;
    return "unknown";
  },
};
```

---

## 8. Plugin System Patterns

This section covers patterns used by popular tools like Vite, ESLint, and Babel for dynamic plugin loading.

### Plugin Resolution Pattern (ESLint-style)

```typescript
/**
 * Plugin resolver following ESLint's naming convention
 * Plugins are resolved by name with automatic prefix handling
 */
class PluginResolver {
  private prefix: string;
  private cache = new Map<string, any>();

  constructor(options: { prefix?: string } = {}) {
    this.prefix = options.prefix || "plugin-";
  }

  /**
   * Resolve a plugin name to its full package name
   * e.g., "typescript" -> "eslint-plugin-typescript"
   */
  resolvePluginName(shortName: string): string {
    // Handle scoped packages: @scope/name -> @scope/eslint-plugin-name
    if (shortName.startsWith("@")) {
      const [scope, name] = shortName.split("/");
      if (name) {
        return `${scope}/${this.prefix}${name}`;
      }
      return `${scope}/${this.prefix}`;
    }

    // Handle already-prefixed names
    if (shortName.startsWith(this.prefix)) {
      return shortName;
    }

    return `${this.prefix}${shortName}`;
  }

  /**
   * Load a plugin by short name
   */
  async loadPlugin<T = any>(shortName: string): Promise<T> {
    const fullName = this.resolvePluginName(shortName);

    if (this.cache.has(fullName)) {
      return this.cache.get(fullName);
    }

    try {
      const plugin = await import(fullName);
      const resolved = plugin.default || plugin;
      this.cache.set(fullName, resolved);
      return resolved;
    } catch (err: any) {
      if (err.code === "ERR_MODULE_NOT_FOUND") {
        throw new Error(
          `Plugin "${shortName}" not found. ` +
          `Tried to load: ${fullName}. ` +
          `Run: npm install ${fullName}`
        );
      }
      throw err;
    }
  }
}

// Usage
const resolver = new PluginResolver({ prefix: "eslint-plugin-" });
const plugin = await resolver.loadPlugin("typescript");
```

### Virtual Module Pattern (Vite-style)

```typescript
/**
 * Virtual module system for runtime-generated modules
 * Useful for plugin systems that need to inject code
 */
const VIRTUAL_PREFIX = "\0virtual:";

interface VirtualModule {
  id: string;
  code: string;
  exports?: Record<string, any>;
}

class VirtualModuleSystem {
  private modules = new Map<string, VirtualModule>();

  /**
   * Register a virtual module
   */
  register(id: string, code: string): void {
    const virtualId = id.startsWith("virtual:") ? id : `virtual:${id}`;
    this.modules.set(virtualId, { id: virtualId, code });
  }

  /**
   * Check if a module ID is virtual
   */
  isVirtual(id: string): boolean {
    return id.startsWith("virtual:") || id.startsWith(VIRTUAL_PREFIX);
  }

  /**
   * Resolve a virtual module
   */
  resolve(id: string): VirtualModule | null {
    const normalizedId = id.replace(VIRTUAL_PREFIX, "virtual:");
    return this.modules.get(normalizedId) || null;
  }

  /**
   * Load and execute a virtual module
   */
  async load(id: string): Promise<any> {
    const module = this.resolve(id);
    if (!module) {
      throw new Error(`Virtual module not found: ${id}`);
    }

    // For simple cases, evaluate the code
    // In production, use a proper module evaluator
    const exports: Record<string, any> = {};
    const moduleWrapper = new Function(
      "exports",
      "require",
      module.code
    );
    moduleWrapper(exports, require);
    return exports;
  }
}

// Usage
const virtualModules = new VirtualModuleSystem();
virtualModules.register("virtual:config", `
  exports.apiKey = process.env.API_KEY;
  exports.debug = process.env.DEBUG === 'true';
`);
```

### Plugin Hook System (Rollup/Vite-style)

```typescript
/**
 * Plugin hook system with ordering support
 */
type HookOrder = "pre" | "post" | "default";

interface Plugin {
  name: string;
  enforce?: HookOrder;
  
  // Lifecycle hooks
  setup?: () => Promise<void> | void;
  transform?: (code: string, id: string) => Promise<string> | string;
  resolve?: (id: string) => Promise<string | null> | string | null;
  teardown?: () => Promise<void> | void;
}

class PluginContainer {
  private plugins: Plugin[] = [];

  /**
   * Add plugins with ordering
   */
  use(plugins: Plugin[]): void {
    // Sort plugins by enforce order: pre -> default -> post
    const sorted = [...plugins].sort((a, b) => {
      const order: Record<HookOrder, number> = { pre: 0, default: 1, post: 2 };
      const aOrder = order[a.enforce || "default"];
      const bOrder = order[b.enforce || "default"];
      return aOrder - bOrder;
    });

    this.plugins.push(...sorted);
  }

  /**
   * Run a hook across all plugins
   */
  async runHook<T>(
    hookName: keyof Plugin,
    ...args: any[]
  ): Promise<T | null> {
    for (const plugin of this.plugins) {
      const hook = plugin[hookName];
      if (typeof hook === "function") {
        const result = await (hook as Function).apply(plugin, args);
        if (result !== undefined && result !== null) {
          return result as T;
        }
      }
    }
    return null;
  }

  /**
   * Run a hook that transforms a value through all plugins
   */
  async runTransformHook(
    hookName: "transform",
    initial: string,
    ...args: any[]
  ): Promise<string> {
    let result = initial;
    for (const plugin of this.plugins) {
      const hook = plugin[hookName];
      if (typeof hook === "function") {
        result = await hook.call(plugin, result, ...args);
      }
    }
    return result;
  }
}

// Usage
const container = new PluginContainer();
container.use([
  {
    name: "minify",
    enforce: "post",
    transform: (code) => code.replace(/\s+/g, " "),
  },
  {
    name: "prefix",
    enforce: "pre",
    transform: (code) => `/* Generated */\n${code}`,
  },
]);
```

---

## 9. Provider Registry Pattern (AI SDK-style)

This pattern is used by Vercel AI SDK for managing multiple AI providers dynamically.

### Basic Provider Registry

```typescript
/**
 * Provider registry for dynamic provider selection
 * Inspired by Vercel AI SDK's experimental_createProviderRegistry
 */
interface Provider<T = any> {
  id: string;
  create: (config?: Record<string, any>) => T;
}

interface ProviderInstance<T = any> {
  provider: Provider<T>;
  instance: T;
  config: Record<string, any>;
}

class ProviderRegistry<T = any> {
  private providers = new Map<string, Provider<T>>();
  private instances = new Map<string, ProviderInstance<T>>();

  /**
   * Register a provider factory
   */
  register(id: string, create: (config?: Record<string, any>) => T): void {
    this.providers.set(id, { id, create });
  }

  /**
   * Get or create a provider instance
   */
  get(id: string, config?: Record<string, any>): T {
    const cacheKey = `${id}:${JSON.stringify(config || {})}`;

    if (this.instances.has(cacheKey)) {
      return this.instances.get(cacheKey)!.instance;
    }

    const provider = this.providers.get(id);
    if (!provider) {
      throw new Error(
        `Provider "${id}" not registered. ` +
        `Available: ${[...this.providers.keys()].join(", ")}`
      );
    }

    const instance = provider.create(config);
    this.instances.set(cacheKey, { provider, instance, config: config || {} });
    return instance;
  }

  /**
   * Check if a provider is registered
   */
  has(id: string): boolean {
    return this.providers.has(id);
  }

  /**
   * List all registered provider IDs
   */
  list(): string[] {
    return [...this.providers.keys()];
  }
}

// Usage for AI providers
const aiRegistry = new ProviderRegistry();

aiRegistry.register("openai", (config) => ({
  name: "openai",
  apiKey: config?.apiKey || process.env.OPENAI_API_KEY,
  model: (name: string) => ({ provider: "openai", model: name }),
}));

aiRegistry.register("anthropic", (config) => ({
  name: "anthropic",
  apiKey: config?.apiKey || process.env.ANTHROPIC_API_KEY,
  model: (name: string) => ({ provider: "anthropic", model: name }),
}));

// Dynamic provider selection
const provider = aiRegistry.get("openai");
```

### Dynamic Provider Loading with Auto-Install

```typescript
/**
 * Provider registry with dynamic loading and auto-installation
 * Loads provider packages on-demand
 */
interface ProviderSpec {
  /** npm package name */
  package: string;
  /** Export name to use (default: "default") */
  export?: string;
  /** Factory function name if not using default export */
  factory?: string;
  /** Required environment variables */
  envVars?: string[];
}

const PROVIDER_SPECS: Record<string, ProviderSpec> = {
  openai: {
    package: "@ai-sdk/openai",
    factory: "createOpenAI",
    envVars: ["OPENAI_API_KEY"],
  },
  anthropic: {
    package: "@ai-sdk/anthropic",
    factory: "createAnthropic",
    envVars: ["ANTHROPIC_API_KEY"],
  },
  google: {
    package: "@ai-sdk/google",
    factory: "createGoogleGenerativeAI",
    envVars: ["GOOGLE_GENERATIVE_AI_API_KEY"],
  },
  mistral: {
    package: "@ai-sdk/mistral",
    factory: "createMistral",
    envVars: ["MISTRAL_API_KEY"],
  },
};

class DynamicProviderRegistry {
  private loaded = new Map<string, any>();
  private loader: DynamicModuleLoader;

  constructor() {
    this.loader = new DynamicModuleLoader();
  }

  /**
   * Check if required env vars are set for a provider
   */
  private checkEnvVars(spec: ProviderSpec): { valid: boolean; missing: string[] } {
    const missing = (spec.envVars || []).filter(
      (v) => !process.env[v]
    );
    return { valid: missing.length === 0, missing };
  }

  /**
   * Load a provider, installing if necessary
   */
  async load(providerId: string): Promise<any> {
    if (this.loaded.has(providerId)) {
      return this.loaded.get(providerId);
    }

    const spec = PROVIDER_SPECS[providerId];
    if (!spec) {
      throw new Error(
        `Unknown provider: ${providerId}. ` +
        `Available: ${Object.keys(PROVIDER_SPECS).join(", ")}`
      );
    }

    // Check environment variables
    const envCheck = this.checkEnvVars(spec);
    if (!envCheck.valid) {
      throw new Error(
        `Missing environment variables for ${providerId}: ${envCheck.missing.join(", ")}`
      );
    }

    // Load or install the package
    const module = await this.loader.importOrInstall(spec.package);

    // Get the factory function
    let factory: any;
    if (spec.factory) {
      factory = module[spec.factory];
      if (!factory) {
        throw new Error(
          `Factory "${spec.factory}" not found in ${spec.package}`
        );
      }
    } else if (spec.export) {
      factory = module[spec.export];
    } else {
      factory = module.default || module;
    }

    // Create the provider instance
    const instance = typeof factory === "function" ? factory() : factory;
    this.loaded.set(providerId, instance);
    return instance;
  }

  /**
   * Get a model from a provider string like "openai/gpt-4"
   */
  async getModel(modelString: string): Promise<any> {
    const [providerId, ...modelParts] = modelString.split("/");
    const modelName = modelParts.join("/");

    const provider = await this.load(providerId);

    // Most AI SDK providers are callable with model name
    if (typeof provider === "function") {
      return provider(modelName);
    }

    // Or have a model method
    if (typeof provider.model === "function") {
      return provider.model(modelName);
    }

    throw new Error(
      `Provider ${providerId} doesn't support model selection`
    );
  }
}

// Usage
const registry = new DynamicProviderRegistry();

// Load provider on-demand (installs if not present)
const anthropic = await registry.load("anthropic");

// Or get a specific model
const model = await registry.getModel("anthropic/claude-3-5-sonnet-20241022");
```

---

## 10. Module Caching Considerations

### Understanding Node.js Module Cache

```typescript
/**
 * Module cache utilities
 * Node.js caches modules after first import
 */

/**
 * Clear a module from Node.js require cache (CommonJS only)
 * Note: This doesn't work for ESM imports
 */
function clearRequireCache(modulePath: string): boolean {
  try {
    const resolved = require.resolve(modulePath);
    if (require.cache[resolved]) {
      delete require.cache[resolved];
      return true;
    }
    return false;
  } catch {
    return false;
  }
}

/**
 * Force reimport of an ESM module using cache-busting
 * Note: This creates a new module instance, not truly clearing cache
 */
async function reimportModule<T = any>(modulePath: string): Promise<T> {
  // Add a unique query parameter to bust the cache
  const cacheBuster = `?t=${Date.now()}`;
  
  // For file paths, we need to resolve first
  let importPath = modulePath;
  if (!modulePath.startsWith("file://") && !modulePath.includes("://")) {
    try {
      const resolved = import.meta.resolve(modulePath);
      importPath = resolved;
    } catch {
      // Module not found, try direct import
    }
  }

  return await import(`${importPath}${cacheBuster}`);
}

/**
 * Create a module loader that can optionally bypass cache
 */
function createModuleLoader(options: { bypassCache?: boolean } = {}) {
  const moduleCache = new Map<string, any>();

  return {
    async import<T = any>(modulePath: string): Promise<T> {
      if (!options.bypassCache && moduleCache.has(modulePath)) {
        return moduleCache.get(modulePath);
      }

      let module: T;
      if (options.bypassCache) {
        module = await reimportModule<T>(modulePath);
      } else {
        module = await import(modulePath);
      }

      moduleCache.set(modulePath, module);
      return module;
    },

    clearCache(modulePath?: string): void {
      if (modulePath) {
        moduleCache.delete(modulePath);
      } else {
        moduleCache.clear();
      }
    },
  };
}
```

### Hot Module Replacement Pattern

```typescript
/**
 * Simple HMR-like pattern for development
 * Watches for file changes and reloads modules
 */
import { watch } from "fs";
import { EventEmitter } from "events";

class ModuleHotReloader extends EventEmitter {
  private watchers = new Map<string, ReturnType<typeof watch>>();
  private modules = new Map<string, any>();

  /**
   * Load a module and watch for changes
   */
  async load<T = any>(modulePath: string): Promise<T> {
    // Initial load
    const module = await reimportModule<T>(modulePath);
    this.modules.set(modulePath, module);

    // Set up watcher if not already watching
    if (!this.watchers.has(modulePath)) {
      this.setupWatcher(modulePath);
    }

    return module;
  }

  private setupWatcher(modulePath: string): void {
    try {
      const resolved = import.meta.resolve(modulePath);
      const filePath = new URL(resolved).pathname;

      const watcher = watch(filePath, async (eventType) => {
        if (eventType === "change") {
          console.log(`[HMR] Reloading: ${modulePath}`);
          try {
            const newModule = await reimportModule(modulePath);
            const oldModule = this.modules.get(modulePath);
            this.modules.set(modulePath, newModule);
            this.emit("update", { modulePath, oldModule, newModule });
          } catch (err) {
            this.emit("error", { modulePath, error: err });
          }
        }
      });

      this.watchers.set(modulePath, watcher);
    } catch (err) {
      console.warn(`[HMR] Cannot watch ${modulePath}:`, err);
    }
  }

  /**
   * Get the current version of a module
   */
  get<T = any>(modulePath: string): T | undefined {
    return this.modules.get(modulePath);
  }

  /**
   * Stop watching all modules
   */
  dispose(): void {
    for (const watcher of this.watchers.values()) {
      watcher.close();
    }
    this.watchers.clear();
    this.modules.clear();
  }
}

// Usage
const hmr = new ModuleHotReloader();

hmr.on("update", ({ modulePath, newModule }) => {
  console.log(`Module updated: ${modulePath}`);
  // Re-initialize with new module
});

const config = await hmr.load("./config.js");
```

---

## 11. Node.js 20+ Specific Features

### require(esm) - Synchronous ESM Loading

```typescript
/**
 * Node.js 20.19.0+ allows synchronous require() of ESM modules
 * (as long as they don't have top-level await)
 */

// Check if the feature is available
const canRequireESM = process.features?.require_module ?? false;

/**
 * Synchronously load a module (ESM or CJS)
 * Falls back to dynamic import if require(esm) not available
 */
function requireModule<T = any>(modulePath: string): T | Promise<T> {
  if (canRequireESM) {
    try {
      // Try synchronous require first
      return require(modulePath);
    } catch (err: any) {
      // ERR_REQUIRE_ASYNC_MODULE means the module has top-level await
      if (err.code === "ERR_REQUIRE_ASYNC_MODULE") {
        // Fall back to async import
        return import(modulePath) as Promise<T>;
      }
      throw err;
    }
  }

  // Fallback for older Node.js versions
  return import(modulePath) as Promise<T>;
}

/**
 * Check if a module can be synchronously required
 */
function canSyncRequire(modulePath: string): boolean {
  if (!canRequireESM) return false;

  try {
    require.resolve(modulePath);
    // Try to require it - if it has top-level await, it will throw
    require(modulePath);
    return true;
  } catch (err: any) {
    return err.code !== "ERR_REQUIRE_ASYNC_MODULE";
  }
}
```

### module-sync Export Condition

```typescript
/**
 * Package.json exports with module-sync condition
 * Allows the same file to work with both require() and import
 */
const packageJsonExample = {
  name: "my-package",
  type: "module",
  exports: {
    ".": {
      // For import statements
      import: "./dist/index.js",
      // For require() in Node.js 20.19.0+
      "module-sync": "./dist/index.js",
      // Fallback for older Node.js require()
      require: "./dist/index.cjs",
    },
  },
};

/**
 * Detect which export condition was used
 */
function detectExportCondition(): "import" | "require" | "module-sync" | "unknown" {
  // Check if we're in an ESM context
  if (typeof import.meta !== "undefined") {
    return "import";
  }

  // Check if require(esm) is being used
  if (process.features?.require_module && module?.exports) {
    return "module-sync";
  }

  // Traditional CommonJS
  if (typeof require !== "undefined" && typeof module !== "undefined") {
    return "require";
  }

  return "unknown";
}
```

---

## 12. Bun vs Node.js Differences

### Key Differences Summary

| Feature | Node.js | Bun |
|---------|---------|-----|
| Auto-install on import | No | Yes (when no node_modules) |
| `import.meta.resolve()` | Sync in v20.6.0+ | Always sync |
| `import.meta.path` | Not available | Returns file path |
| `import.meta.dir` | Not available | Returns directory |
| `import.meta.main` | Not available | Returns true if entry point |
| `require(esm)` | v20.19.0+ (no TLA) | Always supported |
| Package manager | npm (external) | Built-in (bun add) |
| Subprocess | child_process | Bun.spawn / Bun.spawnSync |

### Cross-Runtime Compatibility Layer

```typescript
/**
 * Cross-runtime compatibility utilities
 */
export const CrossRuntime = {
  /**
   * Runtime detection
   */
  isBun: typeof Bun !== "undefined",
  isNode: typeof process !== "undefined" && !!(process.versions?.node),

  /**
   * Get current file path (works in both runtimes)
   */
  getCurrentFilePath(): string {
    if (this.isBun) {
      return import.meta.path;
    }
    // Node.js - derive from import.meta.url
    return new URL(import.meta.url).pathname;
  },

  /**
   * Get current directory (works in both runtimes)
   */
  getCurrentDir(): string {
    if (this.isBun) {
      return import.meta.dir;
    }
    // Node.js - derive from import.meta.url
    const filePath = new URL(import.meta.url).pathname;
    return filePath.substring(0, filePath.lastIndexOf("/"));
  },

  /**
   * Check if current file is the entry point
   */
  isMainModule(): boolean {
    if (this.isBun) {
      return import.meta.main;
    }
    // Node.js - compare with process.argv[1]
    const currentPath = this.getCurrentFilePath();
    return process.argv[1] === currentPath;
  },

  /**
   * Resolve a module path
   */
  resolveModule(specifier: string): string | null {
    try {
      return import.meta.resolve(specifier);
    } catch {
      return null;
    }
  },

  /**
   * Install a package
   */
  async installPackage(
    packageName: string,
    options: { cwd?: string; dev?: boolean } = {}
  ): Promise<{ success: boolean; output: string }> {
    const cwd = options.cwd || process.cwd();

    if (this.isBun) {
      const args = ["add"];
      if (options.dev) args.push("--dev");
      args.push(packageName);

      const proc = Bun.spawn(["bun", ...args], {
        cwd,
        stdout: "pipe",
        stderr: "pipe",
      });

      const exitCode = await proc.exited;
      const stdout = await new Response(proc.stdout).text();
      const stderr = await new Response(proc.stderr).text();

      return { success: exitCode === 0, output: stdout + stderr };
    }

    // Node.js
    const { spawn } = await import("child_process");

    return new Promise((resolve) => {
      const args = ["install"];
      if (options.dev) args.push("--save-dev");
      args.push(packageName);

      const proc = spawn("npm", args, { cwd });
      let output = "";

      proc.stdout?.on("data", (data) => (output += data));
      proc.stderr?.on("data", (data) => (output += data));

      proc.on("close", (code) => {
        resolve({ success: code === 0, output });
      });

      proc.on("error", (err) => {
        resolve({ success: false, output: err.message });
      });
    });
  },
};
```

---

## Summary

| Feature | Node.js | Bun |
|---------|---------|-----|
| Check if installed | `require.resolve()` or `import.meta.resolve()` | `import.meta.resolve()` |
| Dynamic import | `await import()` | `await import()` |
| Install packages | `child_process.spawn("npm", ...)` | `Bun.spawn(["bun", "add", ...])` |
| Auto-install | Not available | `bunfig.toml` `[install].auto` |
| Sync subprocess | `child_process.spawnSync()` | `Bun.spawnSync()` |
| require(esm) | v20.19.0+ (no top-level await) | Always supported |
| module-sync exports | v20.19.0+ | Supported |

### Best Practices

1. **Always validate package names** before dynamic import
2. **Use allowlists** for known safe packages
3. **Implement audit logging** for dynamic imports in production
4. **Prefer static imports** when possible
5. **Handle errors gracefully** with specific error types
6. **Cache imported modules** to avoid repeated resolution
7. **Use timeouts** for import operations to prevent hanging
8. **Never trust user input** for package names without validation
9. **Use provider registry pattern** for managing multiple dynamic providers
10. **Consider module caching** when reloading modules dynamically
11. **Test on both Node.js and Bun** if targeting both runtimes
12. **Use cross-runtime utilities** for portable code
