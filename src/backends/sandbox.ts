/**
 * BaseSandbox: Abstract base class for sandbox backends.
 *
 * Implements all BackendProtocol methods using shell commands executed via execute().
 * Subclasses only need to implement execute() and id.
 *
 * This pattern allows creating sandbox backends for different environments
 * (local, Modal, Runloop, Daytona, etc.) by only implementing the command
 * execution layer.
 */

import type {
  EditResult,
  ExecuteResponse,
  FileData,
  FileInfo,
  GrepMatch,
  SandboxBackendProtocol,
  WriteResult,
} from "../types";

/**
 * Encode string to base64 for safe shell transmission.
 */
function toBase64(str: string): string {
  return Buffer.from(str, "utf-8").toString("base64");
}

/**
 * Build a Node.js script command with embedded base64 arguments.
 * This avoids shell argument parsing issues by embedding values directly in the script.
 */
function buildNodeScript(script: string, args: Record<string, string>): string {
  // Replace placeholders with actual values
  let result = script;
  for (const [key, value] of Object.entries(args)) {
    result = result.replace(new RegExp(`__${key}__`, "g"), value);
  }
  return `node -e '${result}'`;
}

/**
 * Abstract base class for sandbox backends.
 *
 * Implements all file operations using shell commands via execute().
 * Subclasses only need to implement execute() and id.
 *
 * @example Creating a custom sandbox backend
 * ```typescript
 * class MyCloudSandbox extends BaseSandbox {
 *   readonly id = 'my-cloud-123';
 *
 *   async execute(command: string): Promise<ExecuteResponse> {
 *     // Call your cloud provider's API
 *     const result = await myCloudApi.runCommand(command);
 *     return {
 *       output: result.stdout + result.stderr,
 *       exitCode: result.exitCode,
 *       truncated: false,
 *     };
 *   }
 * }
 * ```
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
    const script = `
const fs = require("fs");
const path = require("path");

const dirPath = Buffer.from("__PATH__", "base64").toString("utf-8");

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
    } catch (e) {}
  }
} catch (e) {}
`;
    const result = await this.execute(buildNodeScript(script, { PATH: pathB64 }));

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
      } catch {
        // Skip malformed lines
      }
    }
    return infos;
  }

  /**
   * Read file content with line numbers.
   */
  async read(
    filePath: string,
    offset: number = 0,
    limit: number = 2000
  ): Promise<string> {
    const pathB64 = toBase64(filePath);
    const script = `
const fs = require("fs");
const filePath = Buffer.from("__PATH__", "base64").toString("utf-8");
const offset = __OFFSET__;
const limit = __LIMIT__;

if (!fs.existsSync(filePath)) {
  console.error("Error: File not found");
  process.exit(1);
}

const stat = fs.statSync(filePath);
if (stat.size === 0) {
  console.log("System reminder: File exists but has empty contents");
  process.exit(0);
}

const content = fs.readFileSync(filePath, "utf-8");
const lines = content.split("\\n");
const selected = lines.slice(offset, offset + limit);

for (let i = 0; i < selected.length; i++) {
  const lineNum = (offset + i + 1).toString().padStart(6, " ");
  console.log(lineNum + "\\t" + selected[i]);
}
`;
    const result = await this.execute(
      buildNodeScript(script, {
        PATH: pathB64,
        OFFSET: String(offset),
        LIMIT: String(limit),
      })
    );

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
    const script = `
const fs = require("fs");
const filePath = Buffer.from("__PATH__", "base64").toString("utf-8");

if (!fs.existsSync(filePath)) {
  console.error("Error: File not found");
  process.exit(1);
}

const stat = fs.statSync(filePath);
const content = fs.readFileSync(filePath, "utf-8");

console.log(JSON.stringify({
  content: content.split("\\n"),
  created_at: stat.birthtime.toISOString(),
  modified_at: stat.mtime.toISOString()
}));
`;
    const result = await this.execute(buildNodeScript(script, { PATH: pathB64 }));

    if (result.exitCode !== 0) {
      throw new Error(`File '${filePath}' not found`);
    }

    try {
      const data = JSON.parse(result.output.trim());
      return {
        content: data.content,
        created_at: data.created_at,
        modified_at: data.modified_at,
      };
    } catch {
      throw new Error(`Failed to parse file data for '${filePath}'`);
    }
  }

  /**
   * Write content to a new file.
   */
  async write(filePath: string, content: string): Promise<WriteResult> {
    const pathB64 = toBase64(filePath);
    const contentB64 = toBase64(content);
    const script = `
const fs = require("fs");
const path = require("path");

const filePath = Buffer.from("__PATH__", "base64").toString("utf-8");
const content = Buffer.from("__CONTENT__", "base64").toString("utf-8");

if (fs.existsSync(filePath)) {
  console.error("Error: File already exists");
  process.exit(1);
}

const dir = path.dirname(filePath);
if (dir && dir !== ".") {
  fs.mkdirSync(dir, { recursive: true });
}

fs.writeFileSync(filePath, content, "utf-8");
`;
    const result = await this.execute(
      buildNodeScript(script, { PATH: pathB64, CONTENT: contentB64 })
    );

    if (result.exitCode !== 0) {
      if (result.output.includes("already exists")) {
        return {
          success: false,
          error: `Cannot write to ${filePath} because it already exists. Read and then make an edit, or write to a new path.`,
        };
      }
      return { success: false, error: result.output.trim() || `Failed to write '${filePath}'` };
    }

    return { success: true, path: filePath };
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
    const script = `
const fs = require("fs");

const filePath = Buffer.from("__PATH__", "base64").toString("utf-8");
const oldStr = Buffer.from("__OLD__", "base64").toString("utf-8");
const newStr = Buffer.from("__NEW__", "base64").toString("utf-8");
const replaceAll = __REPLACE_ALL__;

if (!fs.existsSync(filePath)) {
  console.error("Error: File not found");
  process.exit(1);
}

let content = fs.readFileSync(filePath, "utf-8");
const count = content.split(oldStr).length - 1;

if (count === 0) {
  process.exit(2);
}
if (count > 1 && !replaceAll) {
  process.exit(3);
}

if (replaceAll) {
  content = content.split(oldStr).join(newStr);
} else {
  content = content.replace(oldStr, newStr);
}

fs.writeFileSync(filePath, content, "utf-8");
console.log(count);
`;
    const result = await this.execute(
      buildNodeScript(script, {
        PATH: pathB64,
        OLD: oldB64,
        NEW: newB64,
        REPLACE_ALL: String(replaceAll),
      })
    );

    if (result.exitCode === 1) {
      return { success: false, error: `Error: File '${filePath}' not found` };
    }
    if (result.exitCode === 2) {
      return { success: false, error: `Error: String not found in file: '${oldString}'` };
    }
    if (result.exitCode === 3) {
      return {
        success: false,
        error: `Error: String '${oldString}' appears multiple times. Use replaceAll=true to replace all occurrences.`,
      };
    }

    const count = parseInt(result.output.trim(), 10) || 1;
    return { success: true, path: filePath, occurrences: count };
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
    const globB64 = glob ? toBase64(glob) : toBase64("**/*");
    const script = `
const fs = require("fs");
const path = require("path");

const pattern = Buffer.from("__PATTERN__", "base64").toString("utf-8");
const basePath = Buffer.from("__PATH__", "base64").toString("utf-8");
const fileGlob = Buffer.from("__GLOB__", "base64").toString("utf-8");

function walkDir(dir, baseDir) {
  const results = [];
  try {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      const relativePath = path.relative(baseDir, fullPath);
      
      if (entry.isDirectory()) {
        results.push(...walkDir(fullPath, baseDir));
      } else {
        results.push(relativePath);
      }
    }
  } catch (e) {}
  return results;
}

function matchGlob(filepath, pattern) {
  if (!pattern || pattern === "**/*") return true;
  const regex = pattern
    .replace(/\\./g, "\\\\.")
    .replace(/\\*\\*/g, "<<<GLOBSTAR>>>")
    .replace(/\\*/g, "[^/]*")
    .replace(/<<<GLOBSTAR>>>/g, ".*")
    .replace(/\\?/g, ".");
  return new RegExp("^" + regex + "$").test(filepath);
}

const allFiles = walkDir(basePath, basePath);
const files = allFiles.filter(f => matchGlob(f, fileGlob)).sort();

for (const file of files) {
  try {
    const fullPath = path.join(basePath, file);
    const content = fs.readFileSync(fullPath, "utf-8");
    const lines = content.split("\\n");
    
    for (let i = 0; i < lines.length; i++) {
      if (lines[i].includes(pattern)) {
        console.log(JSON.stringify({
          path: file,
          line: i + 1,
          text: lines[i]
        }));
      }
    }
  } catch (e) {}
}
`;
    const result = await this.execute(
      buildNodeScript(script, {
        PATTERN: patternB64,
        PATH: pathB64,
        GLOB: globB64,
      })
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
      } catch {
        // Skip malformed lines
      }
    }
    return matches;
  }

  /**
   * Find files matching glob pattern.
   */
  async globInfo(pattern: string, path: string = "/"): Promise<FileInfo[]> {
    const pathB64 = toBase64(path);
    const patternB64 = toBase64(pattern);
    const script = `
const fs = require("fs");
const path = require("path");

const basePath = Buffer.from("__PATH__", "base64").toString("utf-8");
const pattern = Buffer.from("__PATTERN__", "base64").toString("utf-8");

function walkDir(dir, baseDir) {
  const results = [];
  try {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      const relativePath = path.relative(baseDir, fullPath);
      
      if (entry.isDirectory()) {
        results.push(...walkDir(fullPath, baseDir));
      } else {
        results.push(relativePath);
      }
    }
  } catch (e) {}
  return results;
}

function matchGlob(filepath, pattern) {
  const regex = pattern
    .replace(/\\./g, "\\\\.")
    .replace(/\\*\\*/g, "<<<GLOBSTAR>>>")
    .replace(/\\*/g, "[^/]*")
    .replace(/<<<GLOBSTAR>>>/g, ".*")
    .replace(/\\?/g, ".");
  return new RegExp("^" + regex + "$").test(filepath);
}

const allFiles = walkDir(basePath, basePath);
const matches = allFiles.filter(f => matchGlob(f, pattern)).sort();

for (const m of matches) {
  try {
    const fullPath = path.join(basePath, m);
    const stat = fs.statSync(fullPath);
    console.log(JSON.stringify({
      path: m,
      is_dir: stat.isDirectory(),
      size: stat.size,
      modified_at: stat.mtime.toISOString()
    }));
  } catch (e) {}
}
`;
    const result = await this.execute(
      buildNodeScript(script, { PATH: pathB64, PATTERN: patternB64 })
    );

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
      } catch {
        // Skip malformed lines
      }
    }
    return infos;
  }
}
