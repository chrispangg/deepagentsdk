# Implementation Plan: SandboxBackendProtocol

## Summary

Add `SandboxBackendProtocol` interface and `BaseSandbox` abstract class to enable command execution in isolated environments. Also implement `LocalSandbox` for local development and testing.

## Prerequisites

- [x] Research phase completed
- [x] Dependencies identified: None (uses Node.js built-in `child_process`)

## Implementation Steps

### Step 1: Add ExecuteResponse and SandboxBackendProtocol to types.ts

**File**: `src/types.ts`
**Action**: Add new interfaces after `BackendProtocol`

```typescript
/**
 * Result of command execution in a sandbox.
 */
export interface ExecuteResponse {
  /** Combined stdout and stderr output */
  output: string;
  /** Exit code (0 = success, non-zero = failure, null = unknown) */
  exitCode: number | null;
  /** Whether output was truncated due to size limits */
  truncated: boolean;
}

/**
 * Protocol for sandbox backends with command execution capability.
 * 
 * Extends BackendProtocol with the ability to execute shell commands
 * in an isolated environment (container, VM, or local process).
 */
export interface SandboxBackendProtocol extends BackendProtocol {
  /**
   * Execute a shell command in the sandbox.
   * @param command - Full shell command string to execute
   * @returns ExecuteResponse with output, exit code, and truncation status
   */
  execute(command: string): Promise<ExecuteResponse>;
  
  /**
   * Unique identifier for this sandbox instance.
   * Used for tracking and debugging.
   */
  readonly id: string;
}
```

**Validation**: Run `bun run typecheck` - should pass

### Step 2: Create BaseSandbox abstract class

**File**: `src/backends/sandbox.ts` (NEW)
**Action**: Create file with BaseSandbox implementation

```typescript
/**
 * BaseSandbox: Abstract base class for sandbox backends.
 * 
 * Implements all BackendProtocol methods using shell commands executed via execute().
 * Subclasses only need to implement execute() and id.
 */

import type {
  BackendProtocol,
  EditResult,
  ExecuteResponse,
  FileData,
  FileInfo,
  GrepMatch,
  SandboxBackendProtocol,
  WriteResult,
} from "../types.ts";

/**
 * Encode string to base64 for safe shell transmission.
 */
function toBase64(str: string): string {
  return Buffer.from(str, "utf-8").toString("base64");
}

/**
 * Shell command templates for file operations.
 * These use base64 encoding to safely pass content through shell.
 */
const GLOB_COMMAND = `node -e "
const fs = require('fs');
const path = require('path');
const { glob } = require('glob');

const basePath = Buffer.from(process.argv[2], 'base64').toString('utf-8');
const pattern = Buffer.from(process.argv[3], 'base64').toString('utf-8');

async function main() {
  const matches = await glob(pattern, { cwd: basePath, dot: true });
  for (const m of matches.sort()) {
    try {
      const fullPath = path.join(basePath, m);
      const stat = fs.statSync(fullPath);
      console.log(JSON.stringify({
        path: m,
        is_dir: stat.isDirectory(),
        size: stat.size,
        modified_at: stat.mtime.toISOString()
      }));
    } catch {}
  }
}
main();
"`;

const READ_COMMAND = `node -e "
const fs = require('fs');
const filePath = Buffer.from(process.argv[2], 'base64').toString('utf-8');
const offset = parseInt(process.argv[3], 10);
const limit = parseInt(process.argv[4], 10);

if (!fs.existsSync(filePath)) {
  console.error('Error: File not found');
  process.exit(1);
}

const stat = fs.statSync(filePath);
if (stat.size === 0) {
  console.log('System reminder: File exists but has empty contents');
  process.exit(0);
}

const content = fs.readFileSync(filePath, 'utf-8');
const lines = content.split('\\n');
const selected = lines.slice(offset, offset + limit);

for (let i = 0; i < selected.length; i++) {
  const lineNum = (offset + i + 1).toString().padStart(6, ' ');
  console.log(lineNum + '\\t' + selected[i]);
}
"`;

const WRITE_COMMAND = `node -e "
const fs = require('fs');
const path = require('path');

const filePath = Buffer.from(process.argv[2], 'base64').toString('utf-8');
const content = Buffer.from(process.argv[3], 'base64').toString('utf-8');

if (fs.existsSync(filePath)) {
  console.error('Error: File already exists');
  process.exit(1);
}

const dir = path.dirname(filePath);
if (dir && dir !== '.') {
  fs.mkdirSync(dir, { recursive: true });
}

fs.writeFileSync(filePath, content, 'utf-8');
"`;

const EDIT_COMMAND = `node -e "
const fs = require('fs');

const filePath = Buffer.from(process.argv[2], 'base64').toString('utf-8');
const oldStr = Buffer.from(process.argv[3], 'base64').toString('utf-8');
const newStr = Buffer.from(process.argv[4], 'base64').toString('utf-8');
const replaceAll = process.argv[5] === 'true';

if (!fs.existsSync(filePath)) {
  console.error('Error: File not found');
  process.exit(1);
}

let content = fs.readFileSync(filePath, 'utf-8');
const count = content.split(oldStr).length - 1;

if (count === 0) {
  process.exit(2); // Not found
}
if (count > 1 && !replaceAll) {
  process.exit(3); // Multiple occurrences
}

if (replaceAll) {
  content = content.split(oldStr).join(newStr);
} else {
  content = content.replace(oldStr, newStr);
}

fs.writeFileSync(filePath, content, 'utf-8');
console.log(count);
"`;

const LS_COMMAND = `node -e "
const fs = require('fs');
const path = require('path');

const dirPath = Buffer.from(process.argv[2], 'base64').toString('utf-8');

try {
  const entries = fs.readdirSync(dirPath, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dirPath, entry.name);
    try {
      const stat = fs.statSync(fullPath);
      console.log(JSON.stringify({
        path: entry.name,
        is_dir: entry.isDirectory(),
        size: stat.size,
        modified_at: stat.mtime.toISOString()
      }));
    } catch {}
  }
} catch (e) {
  // Directory doesn't exist or can't be read
}
"`;

const GREP_COMMAND = `node -e "
const fs = require('fs');
const path = require('path');
const { glob } = require('glob');

const pattern = Buffer.from(process.argv[2], 'base64').toString('utf-8');
const basePath = Buffer.from(process.argv[3], 'base64').toString('utf-8');
const fileGlob = process.argv[4] ? Buffer.from(process.argv[4], 'base64').toString('utf-8') : '**/*';

async function main() {
  const files = await glob(fileGlob, { cwd: basePath, nodir: true, dot: true });
  
  for (const file of files.sort()) {
    try {
      const fullPath = path.join(basePath, file);
      const content = fs.readFileSync(fullPath, 'utf-8');
      const lines = content.split('\\n');
      
      for (let i = 0; i < lines.length; i++) {
        if (lines[i].includes(pattern)) {
          console.log(JSON.stringify({
            path: file,
            line: i + 1,
            text: lines[i]
          }));
        }
      }
    } catch {}
  }
}
main();
"`;

/**
 * Abstract base class for sandbox backends.
 * 
 * Implements all file operations using shell commands via execute().
 * Subclasses only need to implement execute() and id.
 */
export abstract class BaseSandbox implements SandboxBackendProtocol {
  /**
   * Execute a shell command in the sandbox.
   * Must be implemented by subclasses.
   */
  abstract execute(command: string): Promise<ExecuteResponse>;
  
  /**
   * Unique identifier for this sandbox instance.
   * Must be implemented by subclasses.
   */
  abstract readonly id: string;

  /**
   * List files and directories in a path.
   */
  async lsInfo(path: string): Promise<FileInfo[]> {
    const pathB64 = toBase64(path);
    const result = await this.execute(`${LS_COMMAND} "${pathB64}"`);
    
    const infos: FileInfo[] = [];
    for (const line of result.output.trim().split("\n")) {
      if (!line) continue;
      try {
        const data = JSON.parse(line);
        infos.push({
          path: data.path,
          is_dir: data.is_dir,
          size: data.size,
          modified_at: data.modified_at,
        });
      } catch {}
    }
    return infos;
  }

  /**
   * Read file content with line numbers.
   */
  async read(filePath: string, offset: number = 0, limit: number = 2000): Promise<string> {
    const pathB64 = toBase64(filePath);
    const result = await this.execute(`${READ_COMMAND} "${pathB64}" ${offset} ${limit}`);
    
    if (result.exitCode !== 0) {
      if (result.output.includes("Error: File not found")) {
        return `Error: File '${filePath}' not found`;
      }
      return result.output.trim();
    }
    
    return result.output.trimEnd();
  }

  /**
   * Read raw file data.
   */
  async readRaw(filePath: string): Promise<FileData> {
    const pathB64 = toBase64(filePath);
    const result = await this.execute(`cat "${pathB64}" 2>/dev/null`);
    
    if (result.exitCode !== 0) {
      throw new Error(`File '${filePath}' not found`);
    }
    
    const now = new Date().toISOString();
    return {
      content: result.output.split("\n"),
      created_at: now,
      modified_at: now,
    };
  }

  /**
   * Write content to a new file.
   */
  async write(filePath: string, content: string): Promise<WriteResult> {
    const pathB64 = toBase64(filePath);
    const contentB64 = toBase64(content);
    const result = await this.execute(`${WRITE_COMMAND} "${pathB64}" "${contentB64}"`);
    
    if (result.exitCode !== 0) {
      if (result.output.includes("already exists")) {
        return { error: `Cannot write to ${filePath} because it already exists.` };
      }
      return { error: result.output.trim() || `Failed to write '${filePath}'` };
    }
    
    return { path: filePath };
  }

  /**
   * Edit a file by replacing string occurrences.
   */
  async edit(
    filePath: string,
    oldString: string,
    newString: string,
    replaceAll: boolean = false
  ): Promise<EditResult> {
    const pathB64 = toBase64(filePath);
    const oldB64 = toBase64(oldString);
    const newB64 = toBase64(newString);
    
    const result = await this.execute(
      `${EDIT_COMMAND} "${pathB64}" "${oldB64}" "${newB64}" ${replaceAll}`
    );
    
    if (result.exitCode === 1) {
      return { error: `Error: File '${filePath}' not found` };
    }
    if (result.exitCode === 2) {
      return { error: `Error: String not found in file: '${oldString}'` };
    }
    if (result.exitCode === 3) {
      return { 
        error: `Error: String '${oldString}' appears multiple times. Use replaceAll=true to replace all occurrences.` 
      };
    }
    
    const count = parseInt(result.output.trim(), 10) || 1;
    return { path: filePath, occurrences: count };
  }

  /**
   * Search for pattern in files.
   */
  async grepRaw(
    pattern: string,
    path: string = "/",
    glob: string | null = null
  ): Promise<GrepMatch[] | string> {
    const patternB64 = toBase64(pattern);
    const pathB64 = toBase64(path);
    const globB64 = glob ? toBase64(glob) : "";
    
    const result = await this.execute(
      `${GREP_COMMAND} "${patternB64}" "${pathB64}" "${globB64}"`
    );
    
    const matches: GrepMatch[] = [];
    for (const line of result.output.trim().split("\n")) {
      if (!line) continue;
      try {
        const data = JSON.parse(line);
        matches.push({
          path: data.path,
          line: data.line,
          text: data.text,
        });
      } catch {}
    }
    return matches;
  }

  /**
   * Find files matching glob pattern.
   */
  async globInfo(pattern: string, path: string = "/"): Promise<FileInfo[]> {
    const pathB64 = toBase64(path);
    const patternB64 = toBase64(pattern);
    
    const result = await this.execute(`${GLOB_COMMAND} "${pathB64}" "${patternB64}"`);
    
    const infos: FileInfo[] = [];
    for (const line of result.output.trim().split("\n")) {
      if (!line) continue;
      try {
        const data = JSON.parse(line);
        infos.push({
          path: data.path,
          is_dir: data.is_dir,
          size: data.size,
          modified_at: data.modified_at,
        });
      } catch {}
    }
    return infos;
  }
}
```

**Validation**: Run `bun run typecheck` - should pass

### Step 3: Create LocalSandbox implementation

**File**: `src/backends/local-sandbox.ts` (NEW)
**Action**: Create file with LocalSandbox implementation

```typescript
/**
 * LocalSandbox: Execute commands locally using child_process.
 * 
 * Useful for local development and testing without cloud sandboxes.
 */

import { spawn } from "child_process";
import type { ExecuteResponse } from "../types.ts";
import { BaseSandbox } from "./sandbox.ts";

/**
 * Options for LocalSandbox.
 */
export interface LocalSandboxOptions {
  /** Working directory for command execution (default: process.cwd()) */
  cwd?: string;
  /** Timeout in milliseconds (default: 30000 = 30s) */
  timeout?: number;
  /** Environment variables to set */
  env?: Record<string, string>;
}

/**
 * Local sandbox that executes commands using Node.js child_process.
 * 
 * All commands are executed in a shell with the specified working directory.
 * Inherits all file operations from BaseSandbox.
 * 
 * @example Basic usage
 * ```typescript
 * const sandbox = new LocalSandbox({ cwd: './workspace' });
 * const result = await sandbox.execute('ls -la');
 * console.log(result.output);
 * ```
 * 
 * @example With timeout
 * ```typescript
 * const sandbox = new LocalSandbox({ 
 *   cwd: './workspace',
 *   timeout: 60000 // 60 seconds
 * });
 * ```
 */
export class LocalSandbox extends BaseSandbox {
  private readonly cwd: string;
  private readonly timeout: number;
  private readonly env: Record<string, string>;
  private readonly _id: string;

  constructor(options: LocalSandboxOptions = {}) {
    super();
    this.cwd = options.cwd || process.cwd();
    this.timeout = options.timeout || 30000;
    this.env = options.env || {};
    this._id = `local-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  }

  get id(): string {
    return this._id;
  }

  async execute(command: string): Promise<ExecuteResponse> {
    return new Promise((resolve) => {
      const child = spawn("bash", ["-c", command], {
        cwd: this.cwd,
        env: { ...process.env, ...this.env },
        timeout: this.timeout,
      });

      let output = "";
      let truncated = false;
      const maxOutputSize = 1024 * 1024; // 1MB limit

      child.stdout.on("data", (data: Buffer) => {
        if (output.length < maxOutputSize) {
          output += data.toString();
        } else {
          truncated = true;
        }
      });

      child.stderr.on("data", (data: Buffer) => {
        if (output.length < maxOutputSize) {
          output += data.toString();
        } else {
          truncated = true;
        }
      });

      child.on("close", (code) => {
        resolve({
          output,
          exitCode: code,
          truncated,
        });
      });

      child.on("error", (err) => {
        resolve({
          output: `Error: ${err.message}`,
          exitCode: 1,
          truncated: false,
        });
      });
    });
  }
}
```

**Validation**: Run `bun run typecheck` - should pass

### Step 4: Export from backends/index.ts

**File**: `src/backends/index.ts`
**Action**: Add exports for new modules

```typescript
// Add after existing exports:
export { BaseSandbox } from "./sandbox.ts";
export { LocalSandbox, type LocalSandboxOptions } from "./local-sandbox.ts";
```

**Validation**: Run `bun run typecheck` - should pass

### Step 5: Export from main index.ts

**File**: `src/index.ts`
**Action**: Verify exports include new types

The types are already exported from `types.ts` which is re-exported. Just need to ensure the backends are exported.

Check current exports and add if needed:

```typescript
export { BaseSandbox, LocalSandbox, type LocalSandboxOptions } from "./backends/index.ts";
```

**Validation**: Run `bun run typecheck` - should pass

### Step 6: Add basic tests

**File**: `src/backends/local-sandbox.test.ts` (NEW)
**Action**: Create test file

```typescript
import { test, expect, describe, beforeAll, afterAll } from "bun:test";
import { LocalSandbox } from "./local-sandbox.ts";
import * as fs from "fs";
import * as path from "path";

describe("LocalSandbox", () => {
  const testDir = path.join(process.cwd(), ".test-sandbox");
  let sandbox: LocalSandbox;

  beforeAll(() => {
    fs.mkdirSync(testDir, { recursive: true });
    sandbox = new LocalSandbox({ cwd: testDir });
  });

  afterAll(() => {
    fs.rmSync(testDir, { recursive: true, force: true });
  });

  test("execute returns output and exit code", async () => {
    const result = await sandbox.execute("echo hello");
    expect(result.output.trim()).toBe("hello");
    expect(result.exitCode).toBe(0);
    expect(result.truncated).toBe(false);
  });

  test("execute captures stderr", async () => {
    const result = await sandbox.execute("echo error >&2");
    expect(result.output.trim()).toBe("error");
    expect(result.exitCode).toBe(0);
  });

  test("execute returns non-zero exit code on failure", async () => {
    const result = await sandbox.execute("exit 42");
    expect(result.exitCode).toBe(42);
  });

  test("id is unique", () => {
    const sandbox2 = new LocalSandbox({ cwd: testDir });
    expect(sandbox.id).not.toBe(sandbox2.id);
    expect(sandbox.id).toMatch(/^local-\d+-[a-z0-9]+$/);
  });

  test("write and read file", async () => {
    const writeResult = await sandbox.write("/test.txt", "hello world");
    expect(writeResult.error).toBeUndefined();
    expect(writeResult.path).toBe("/test.txt");

    const content = await sandbox.read("/test.txt");
    expect(content).toContain("hello world");
  });

  test("edit file", async () => {
    await sandbox.write("/edit-test.txt", "foo bar baz");
    
    const editResult = await sandbox.edit("/edit-test.txt", "bar", "qux");
    expect(editResult.error).toBeUndefined();
    expect(editResult.occurrences).toBe(1);

    const content = await sandbox.read("/edit-test.txt");
    expect(content).toContain("foo qux baz");
  });

  test("lsInfo lists files", async () => {
    const infos = await sandbox.lsInfo(testDir);
    expect(infos.length).toBeGreaterThan(0);
    expect(infos.some(f => f.path === "test.txt")).toBe(true);
  });
});
```

**Validation**: Run `bun test src/backends/local-sandbox.test.ts` - should pass

## Testing Strategy

1. Run existing tests: `bun test`
2. Run new tests: `bun test src/backends/local-sandbox.test.ts`
3. Test cases covered:
   - Basic command execution (echo, exit codes)
   - File operations (write, read, edit)
   - Directory listing (lsInfo)
   - Error handling (file not found, already exists)
   - Unique sandbox IDs

## Rollback Plan

If implementation fails:

1. Revert changes to: `src/types.ts`, `src/backends/index.ts`, `src/index.ts`
2. Remove new files: `src/backends/sandbox.ts`, `src/backends/local-sandbox.ts`, `src/backends/local-sandbox.test.ts`

## Post-Implementation

- [ ] Update `PROJECT-STATE.md` (move feature to Implemented)
- [ ] Run `bun run typecheck`
- [ ] Run `bun test`
