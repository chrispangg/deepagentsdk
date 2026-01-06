/**
 * LocalSandbox: Execute commands locally using child_process.
 *
 * Useful for local development and testing without cloud sandboxes.
 * All file operations are inherited from BaseSandbox and executed
 * via shell commands in the local filesystem.
 */

import { spawn } from "child_process";
import type { ExecuteResponse } from "../types";
import { BaseSandbox } from "./sandbox";

/**
 * Options for LocalSandbox.
 */
export interface LocalSandboxOptions {
  /**
   * Working directory for command execution.
   * All file paths in sandbox operations are relative to this directory.
   * @default process.cwd()
   */
  cwd?: string;

  /**
   * Timeout in milliseconds for command execution.
   * Commands that exceed this timeout will be terminated.
   * @default 30000 (30 seconds)
   */
  timeout?: number;

  /**
   * Additional environment variables to set for command execution.
   * These are merged with the current process environment.
   */
  env?: Record<string, string>;

  /**
   * Maximum output size in bytes before truncation.
   * @default 1048576 (1MB)
   */
  maxOutputSize?: number;
}

/**
 * Local sandbox that executes commands using Node.js child_process.
 *
 * All commands are executed in a bash shell with the specified working directory.
 * Inherits all file operations (read, write, edit, ls, grep, glob) from BaseSandbox.
 *
 * @example Basic usage
 * ```typescript
 * import { LocalSandbox } from 'deepagentsdk';
 *
 * const sandbox = new LocalSandbox({ cwd: './workspace' });
 *
 * // Execute commands
 * const result = await sandbox.execute('ls -la');
 * console.log(result.output);
 *
 * // File operations
 * await sandbox.write('./src/index.ts', 'console.log("hello")');
 * const content = await sandbox.read('./src/index.ts');
 * ```
 *
 * @example With timeout and environment
 * ```typescript
 * const sandbox = new LocalSandbox({
 *   cwd: './workspace',
 *   timeout: 60000, // 60 seconds
 *   env: {
 *     NODE_ENV: 'development',
 *     DEBUG: '*',
 *   },
 * });
 * ```
 *
 * @example Error handling
 * ```typescript
 * const result = await sandbox.execute('npm test');
 * if (result.exitCode !== 0) {
 *   console.error('Tests failed:', result.output);
 * }
 * ```
 */
export class LocalSandbox extends BaseSandbox {
  private readonly cwd: string;
  private readonly timeout: number;
  private readonly env: Record<string, string>;
  private readonly maxOutputSize: number;
  private readonly _id: string;

  /**
   * Create a new LocalSandbox instance.
   *
   * @param options - Configuration options for the sandbox
   */
  constructor(options: LocalSandboxOptions = {}) {
    super();
    this.cwd = options.cwd || process.cwd();
    this.timeout = options.timeout || 30000;
    this.env = options.env || {};
    this.maxOutputSize = options.maxOutputSize || 1024 * 1024; // 1MB
    this._id = `local-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  }

  /**
   * Unique identifier for this sandbox instance.
   * Format: `local-{timestamp}-{random}`
   */
  get id(): string {
    return this._id;
  }

  /**
   * Execute a shell command in the local filesystem.
   *
   * Commands are executed using bash with the configured working directory
   * and environment variables. Output is captured from both stdout and stderr.
   *
   * @param command - Shell command to execute
   * @returns ExecuteResponse with output, exit code, and truncation status
   *
   * @example
   * ```typescript
   * const result = await sandbox.execute('echo "Hello" && ls -la');
   * console.log(result.output);
   * console.log('Exit code:', result.exitCode);
   * ```
   */
  async execute(command: string): Promise<ExecuteResponse> {
    return new Promise((resolve) => {
      const child = spawn("bash", ["-c", command], {
        cwd: this.cwd,
        env: { ...process.env, ...this.env },
        timeout: this.timeout,
      });

      let output = "";
      let truncated = false;

      child.stdout.on("data", (data: Buffer) => {
        if (output.length < this.maxOutputSize) {
          output += data.toString();
        } else {
          truncated = true;
        }
      });

      child.stderr.on("data", (data: Buffer) => {
        if (output.length < this.maxOutputSize) {
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

