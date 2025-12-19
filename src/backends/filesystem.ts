/**
 * FilesystemBackend: Read and write files directly from the filesystem.
 */

import * as fs from "fs/promises";
import * as fsSync from "fs";
import * as path from "path";
import { spawn } from "child_process";
import fg from "fast-glob";
import micromatch from "micromatch";
import type {
  BackendProtocol,
  EditResult,
  FileData,
  FileInfo,
  GrepMatch,
  WriteResult,
} from "../types";
import {
  checkEmptyContent,
  formatContentWithLineNumbers,
  performStringReplacement,
} from "./utils";

const SUPPORTS_NOFOLLOW = fsSync.constants.O_NOFOLLOW !== undefined;

/**
 * Backend that reads and writes files directly from the filesystem.
 *
 * Files are persisted to disk, making them available across agent invocations.
 * This backend provides real file I/O operations with security checks to prevent
 * directory traversal attacks.
 *
 * @example Basic usage
 * ```typescript
 * const backend = new FilesystemBackend({ rootDir: './workspace' });
 * const agent = createDeepAgent({
 *   model: anthropic('claude-sonnet-4-20250514'),
 *   backend,
 * });
 * ```
 *
 * @example With custom options
 * ```typescript
 * const backend = new FilesystemBackend({
 *   rootDir: './my-project',
 *   virtualMode: false,
 *   maxFileSizeMb: 50, // Allow larger files
 * });
 * ```
 */
export class FilesystemBackend implements BackendProtocol {
  private cwd: string;
  private virtualMode: boolean;
  private maxFileSizeBytes: number;

  /**
   * Create a new FilesystemBackend instance.
   *
   * @param options - Configuration options
   * @param options.rootDir - Optional root directory for file operations (default: current working directory).
   *                          All file paths are resolved relative to this directory.
   * @param options.virtualMode - Optional flag for virtual mode (default: false).
   *                              When true, files are stored in memory but paths are validated against filesystem.
   * @param options.maxFileSizeMb - Optional maximum file size in MB (default: 10).
   *                                Files larger than this will be rejected.
   */
  constructor(
    options: {
      rootDir?: string;
      virtualMode?: boolean;
      maxFileSizeMb?: number;
    } = {}
  ) {
    const { rootDir, virtualMode = false, maxFileSizeMb = 10 } = options;
    this.cwd = rootDir ? path.resolve(rootDir) : process.cwd();
    this.virtualMode = virtualMode;
    this.maxFileSizeBytes = maxFileSizeMb * 1024 * 1024;
  }

  /**
   * Resolve a file path with security checks.
   */
  private resolvePath(key: string): string {
    if (this.virtualMode) {
      const vpath = key.startsWith("/") ? key : "/" + key;
      if (vpath.includes("..") || vpath.startsWith("~")) {
        throw new Error("Path traversal not allowed");
      }
      const full = path.resolve(this.cwd, vpath.substring(1));
      const relative = path.relative(this.cwd, full);
      if (relative.startsWith("..") || path.isAbsolute(relative)) {
        throw new Error(`Path: ${full} outside root directory: ${this.cwd}`);
      }
      return full;
    }

    if (path.isAbsolute(key)) {
      return key;
    }
    return path.resolve(this.cwd, key);
  }

  /**
   * List files and directories in the specified directory (non-recursive).
   */
  async lsInfo(dirPath: string): Promise<FileInfo[]> {
    try {
      const resolvedPath = this.resolvePath(dirPath);
      const stat = await fs.stat(resolvedPath);

      if (!stat.isDirectory()) {
        return [];
      }

      const entries = await fs.readdir(resolvedPath, { withFileTypes: true });
      const results: FileInfo[] = [];

      const cwdStr = this.cwd.endsWith(path.sep)
        ? this.cwd
        : this.cwd + path.sep;

      for (const entry of entries) {
        const fullPath = path.join(resolvedPath, entry.name);

        try {
          const entryStat = await fs.stat(fullPath);
          const isFile = entryStat.isFile();
          const isDir = entryStat.isDirectory();

          if (!this.virtualMode) {
            if (isFile) {
              results.push({
                path: fullPath,
                is_dir: false,
                size: entryStat.size,
                modified_at: entryStat.mtime.toISOString(),
              });
            } else if (isDir) {
              results.push({
                path: fullPath + path.sep,
                is_dir: true,
                size: 0,
                modified_at: entryStat.mtime.toISOString(),
              });
            }
          } else {
            let relativePath: string;
            if (fullPath.startsWith(cwdStr)) {
              relativePath = fullPath.substring(cwdStr.length);
            } else if (fullPath.startsWith(this.cwd)) {
              relativePath = fullPath
                .substring(this.cwd.length)
                .replace(/^[/\\]/, "");
            } else {
              relativePath = fullPath;
            }

            relativePath = relativePath.split(path.sep).join("/");
            const virtPath = "/" + relativePath;

            if (isFile) {
              results.push({
                path: virtPath,
                is_dir: false,
                size: entryStat.size,
                modified_at: entryStat.mtime.toISOString(),
              });
            } else if (isDir) {
              results.push({
                path: virtPath + "/",
                is_dir: true,
                size: 0,
                modified_at: entryStat.mtime.toISOString(),
              });
            }
          }
        } catch {
          continue;
        }
      }

      results.sort((a, b) => a.path.localeCompare(b.path));
      return results;
    } catch {
      return [];
    }
  }

  /**
   * Read file content with line numbers.
   */
  async read(
    filePath: string,
    offset: number = 0,
    limit: number = 2000
  ): Promise<string> {
    try {
      const resolvedPath = this.resolvePath(filePath);

      let content: string;

      if (SUPPORTS_NOFOLLOW) {
        const stat = await fs.stat(resolvedPath);
        if (!stat.isFile()) {
          return `Error: File '${filePath}' not found`;
        }
        const fd = await fs.open(
          resolvedPath,
          fsSync.constants.O_RDONLY | fsSync.constants.O_NOFOLLOW
        );
        try {
          content = await fd.readFile({ encoding: "utf-8" });
        } finally {
          await fd.close();
        }
      } else {
        const stat = await fs.lstat(resolvedPath);
        if (stat.isSymbolicLink()) {
          return `Error: Symlinks are not allowed: ${filePath}`;
        }
        if (!stat.isFile()) {
          return `Error: File '${filePath}' not found`;
        }
        content = await fs.readFile(resolvedPath, "utf-8");
      }

      const emptyMsg = checkEmptyContent(content);
      if (emptyMsg) {
        return emptyMsg;
      }

      const lines = content.split("\n");
      const startIdx = offset;
      const endIdx = Math.min(startIdx + limit, lines.length);

      if (startIdx >= lines.length) {
        return `Error: Line offset ${offset} exceeds file length (${lines.length} lines)`;
      }

      const selectedLines = lines.slice(startIdx, endIdx);
      return formatContentWithLineNumbers(selectedLines, startIdx + 1);
    } catch (e: unknown) {
      const error = e as Error;
      return `Error reading file '${filePath}': ${error.message}`;
    }
  }

  /**
   * Read file content as raw FileData.
   */
  async readRaw(filePath: string): Promise<FileData> {
    const resolvedPath = this.resolvePath(filePath);

    let content: string;
    let stat: fsSync.Stats;

    if (SUPPORTS_NOFOLLOW) {
      stat = await fs.stat(resolvedPath);
      if (!stat.isFile()) throw new Error(`File '${filePath}' not found`);
      const fd = await fs.open(
        resolvedPath,
        fsSync.constants.O_RDONLY | fsSync.constants.O_NOFOLLOW
      );
      try {
        content = await fd.readFile({ encoding: "utf-8" });
      } finally {
        await fd.close();
      }
    } else {
      stat = await fs.lstat(resolvedPath);
      if (stat.isSymbolicLink()) {
        throw new Error(`Symlinks are not allowed: ${filePath}`);
      }
      if (!stat.isFile()) throw new Error(`File '${filePath}' not found`);
      content = await fs.readFile(resolvedPath, "utf-8");
    }

    return {
      content: content.split("\n"),
      created_at: stat.ctime.toISOString(),
      modified_at: stat.mtime.toISOString(),
    };
  }

  /**
   * Create a new file with content.
   */
  async write(filePath: string, content: string): Promise<WriteResult> {
    try {
      const resolvedPath = this.resolvePath(filePath);

      try {
        const stat = await fs.lstat(resolvedPath);
        if (stat.isSymbolicLink()) {
          return {
            error: `Cannot write to ${filePath} because it is a symlink. Symlinks are not allowed.`,
          };
        }
        return {
          error: `Cannot write to ${filePath} because it already exists. Read and then make an edit, or write to a new path.`,
        };
      } catch {
        // File doesn't exist, good to proceed
      }

      await fs.mkdir(path.dirname(resolvedPath), { recursive: true });

      if (SUPPORTS_NOFOLLOW) {
        const flags =
          fsSync.constants.O_WRONLY |
          fsSync.constants.O_CREAT |
          fsSync.constants.O_TRUNC |
          fsSync.constants.O_NOFOLLOW;

        const fd = await fs.open(resolvedPath, flags, 0o644);
        try {
          await fd.writeFile(content, "utf-8");
        } finally {
          await fd.close();
        }
      } else {
        await fs.writeFile(resolvedPath, content, "utf-8");
      }

      return { path: filePath };
    } catch (e: unknown) {
      const error = e as Error;
      return { error: `Error writing file '${filePath}': ${error.message}` };
    }
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
    try {
      const resolvedPath = this.resolvePath(filePath);

      let content: string;

      if (SUPPORTS_NOFOLLOW) {
        const stat = await fs.stat(resolvedPath);
        if (!stat.isFile()) {
          return { error: `Error: File '${filePath}' not found` };
        }

        const fd = await fs.open(
          resolvedPath,
          fsSync.constants.O_RDONLY | fsSync.constants.O_NOFOLLOW
        );
        try {
          content = await fd.readFile({ encoding: "utf-8" });
        } finally {
          await fd.close();
        }
      } else {
        const stat = await fs.lstat(resolvedPath);
        if (stat.isSymbolicLink()) {
          return { error: `Error: Symlinks are not allowed: ${filePath}` };
        }
        if (!stat.isFile()) {
          return { error: `Error: File '${filePath}' not found` };
        }
        content = await fs.readFile(resolvedPath, "utf-8");
      }

      const result = performStringReplacement(
        content,
        oldString,
        newString,
        replaceAll
      );

      if (typeof result === "string") {
        return { error: result };
      }

      const [newContent, occurrences] = result;

      if (SUPPORTS_NOFOLLOW) {
        const flags =
          fsSync.constants.O_WRONLY |
          fsSync.constants.O_TRUNC |
          fsSync.constants.O_NOFOLLOW;

        const fd = await fs.open(resolvedPath, flags);
        try {
          await fd.writeFile(newContent, "utf-8");
        } finally {
          await fd.close();
        }
      } else {
        await fs.writeFile(resolvedPath, newContent, "utf-8");
      }

      return { path: filePath, occurrences };
    } catch (e: unknown) {
      const error = e as Error;
      return { error: `Error editing file '${filePath}': ${error.message}` };
    }
  }

  /**
   * Structured search results or error string for invalid input.
   */
  async grepRaw(
    pattern: string,
    dirPath: string = "/",
    glob: string | null = null
  ): Promise<GrepMatch[] | string> {
    // Validate regex
    try {
      new RegExp(pattern);
    } catch (e: unknown) {
      const error = e as Error;
      return `Invalid regex pattern: ${error.message}`;
    }

    // Resolve base path
    let baseFull: string;
    try {
      baseFull = this.resolvePath(dirPath || ".");
    } catch {
      return [];
    }

    try {
      await fs.stat(baseFull);
    } catch {
      return [];
    }

    // Try ripgrep first, fallback to regex search
    let results = await this.ripgrepSearch(pattern, baseFull, glob);
    if (results === null) {
      results = await this.regexSearch(pattern, baseFull, glob);
    }

    const matches: GrepMatch[] = [];
    for (const [fpath, items] of Object.entries(results)) {
      for (const [lineNum, lineText] of items) {
        matches.push({ path: fpath, line: lineNum, text: lineText });
      }
    }
    return matches;
  }

  /**
   * Try to use ripgrep for fast searching.
   */
  private async ripgrepSearch(
    pattern: string,
    baseFull: string,
    includeGlob: string | null
  ): Promise<Record<string, Array<[number, string]>> | null> {
    return new Promise((resolve) => {
      const args = ["--json"];
      if (includeGlob) {
        args.push("--glob", includeGlob);
      }
      args.push("--", pattern, baseFull);

      const proc = spawn("rg", args, { timeout: 30000 });
      const results: Record<string, Array<[number, string]>> = {};
      let output = "";

      proc.stdout.on("data", (data) => {
        output += data.toString();
      });

      proc.on("close", (code) => {
        if (code !== 0 && code !== 1) {
          resolve(null);
          return;
        }

        for (const line of output.split("\n")) {
          if (!line.trim()) continue;
          try {
            const data = JSON.parse(line);
            if (data.type !== "match") continue;

            const pdata = data.data || {};
            const ftext = pdata.path?.text;
            if (!ftext) continue;

            let virtPath: string;
            if (this.virtualMode) {
              try {
                const resolved = path.resolve(ftext);
                const relative = path.relative(this.cwd, resolved);
                if (relative.startsWith("..")) continue;
                const normalizedRelative = relative.split(path.sep).join("/");
                virtPath = "/" + normalizedRelative;
              } catch {
                continue;
              }
            } else {
              virtPath = ftext;
            }

            const ln = pdata.line_number;
            const lt = pdata.lines?.text?.replace(/\n$/, "") || "";
            if (ln === undefined) continue;

            if (!results[virtPath]) {
              results[virtPath] = [];
            }
            results[virtPath]!.push([ln, lt]);
          } catch {
            continue;
          }
        }

        resolve(results);
      });

      proc.on("error", () => {
        resolve(null);
      });
    });
  }

  /**
   * Fallback regex search implementation.
   */
  private async regexSearch(
    pattern: string,
    baseFull: string,
    includeGlob: string | null
  ): Promise<Record<string, Array<[number, string]>>> {
    let regex: RegExp;
    try {
      regex = new RegExp(pattern);
    } catch {
      return {};
    }

    const results: Record<string, Array<[number, string]>> = {};
    const stat = await fs.stat(baseFull);
    const root = stat.isDirectory() ? baseFull : path.dirname(baseFull);

    const files = await fg("**/*", {
      cwd: root,
      absolute: true,
      onlyFiles: true,
      dot: true,
    });

    for (const fp of files) {
      try {
        if (
          includeGlob &&
          !micromatch.isMatch(path.basename(fp), includeGlob)
        ) {
          continue;
        }

        const fileStat = await fs.stat(fp);
        if (fileStat.size > this.maxFileSizeBytes) {
          continue;
        }

        const content = await fs.readFile(fp, "utf-8");
        const lines = content.split("\n");

        for (let i = 0; i < lines.length; i++) {
          const line = lines[i];
          if (line && regex.test(line)) {
            let virtPath: string;
            if (this.virtualMode) {
              try {
                const relative = path.relative(this.cwd, fp);
                if (relative.startsWith("..")) continue;
                const normalizedRelative = relative.split(path.sep).join("/");
                virtPath = "/" + normalizedRelative;
              } catch {
                continue;
              }
            } else {
              virtPath = fp;
            }

            if (!results[virtPath]) {
              results[virtPath] = [];
            }
            results[virtPath]!.push([i + 1, line]);
          }
        }
      } catch {
        continue;
      }
    }

    return results;
  }

  /**
   * Structured glob matching returning FileInfo objects.
   */
  async globInfo(pattern: string, searchPath: string = "/"): Promise<FileInfo[]> {
    if (pattern.startsWith("/")) {
      pattern = pattern.substring(1);
    }

    const resolvedSearchPath =
      searchPath === "/" ? this.cwd : this.resolvePath(searchPath);

    try {
      const stat = await fs.stat(resolvedSearchPath);
      if (!stat.isDirectory()) {
        return [];
      }
    } catch {
      return [];
    }

    const results: FileInfo[] = [];

    try {
      const matches = await fg(pattern, {
        cwd: resolvedSearchPath,
        absolute: true,
        onlyFiles: true,
        dot: true,
      });

      for (const matchedPath of matches) {
        try {
          const fileStat = await fs.stat(matchedPath);
          if (!fileStat.isFile()) continue;

          const normalizedPath = matchedPath.split("/").join(path.sep);

          if (!this.virtualMode) {
            results.push({
              path: normalizedPath,
              is_dir: false,
              size: fileStat.size,
              modified_at: fileStat.mtime.toISOString(),
            });
          } else {
            const cwdStr = this.cwd.endsWith(path.sep)
              ? this.cwd
              : this.cwd + path.sep;
            let relativePath: string;

            if (normalizedPath.startsWith(cwdStr)) {
              relativePath = normalizedPath.substring(cwdStr.length);
            } else if (normalizedPath.startsWith(this.cwd)) {
              relativePath = normalizedPath
                .substring(this.cwd.length)
                .replace(/^[/\\]/, "");
            } else {
              relativePath = normalizedPath;
            }

            relativePath = relativePath.split(path.sep).join("/");
            const virt = "/" + relativePath;
            results.push({
              path: virt,
              is_dir: false,
              size: fileStat.size,
              modified_at: fileStat.mtime.toISOString(),
            });
          }
        } catch {
          continue;
        }
      }
    } catch {
      // Ignore glob errors
    }

    results.sort((a, b) => a.path.localeCompare(b.path));
    return results;
  }
}

