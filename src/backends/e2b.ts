/**
 * E2B Sandbox Backend
 *
 * E2B provides secure, isolated cloud sandboxes using Firecracker microVMs.
 * Documentation: https://e2b.dev/docs
 * Package: e2b
 *
 * Authentication:
 * - Set E2B_API_KEY environment variable
 *
 * Features:
 * - Auto-cleanup after 5 minutes of inactivity
 * - Fast startup (~2-3 seconds)
 * - Default working directory: /home/user
 *
 * Note: This backend uses an async factory pattern because E2B's Sandbox.create() is async.
 */

import { BaseSandbox } from "./sandbox";
import type {
  ExecuteResponse,
  FileDownloadResponse,
  FileOperationError,
  FileUploadResponse,
  WriteResult,
} from "../types";
import { Sandbox } from "e2b";

/**
 * Options for creating an E2B backend.
 */
export interface E2BBackendOptions {
  /**
   * E2B API key. If not provided, reads from E2B_API_KEY environment variable.
   */
  apiKey?: string;

  /**
   * Sandbox template to use. Defaults to "base".
   */
  template?: string;

  /**
   * Timeout for command execution in milliseconds.
   * Defaults to 30 minutes.
   */
  timeout?: number;
}

/**
 * Map E2B errors to FileOperationError literals.
 */
function mapE2BError(error: string): FileOperationError {
  const lower = error.toLowerCase();
  if (lower.includes("no such file") || lower.includes("not found")) {
    return "file_not_found";
  }
  if (lower.includes("permission") || lower.includes("denied")) {
    return "permission_denied";
  }
  if (lower.includes("is a directory")) {
    return "is_directory";
  }
  return "invalid_path";
}

/**
 * E2B sandbox backend implementation.
 *
 * Use createE2BBackend() factory function to create instances.
 */
export class E2BBackend extends BaseSandbox {
  readonly id: string;
  private readonly _sandbox: Sandbox;
  private readonly _timeout: number;

  constructor(sandbox: Sandbox, timeout: number) {
    super();
    this._sandbox = sandbox;
    this.id = sandbox.sandboxId;
    this._timeout = timeout;
  }

  /**
   * Execute a shell command in the E2B sandbox.
   */
  async execute(command: string): Promise<ExecuteResponse> {
    try {
      const result = await this._sandbox.commands.run(command);

      // Combine stdout and stderr
      const output = result.stdout + (result.stderr ? "\n" + result.stderr : "");

      return {
        output,
        exitCode: result.exitCode,
        truncated: false,
      };
    } catch (error) {
      // E2B SDK throws CommandExitError for non-zero exit codes
      // Extract the exit code and output from the error
      if (error && typeof error === "object") {
        const err = error as any;
        // CommandExitError has result property with stdout, stderr, exitCode
        if (err.result) {
          return {
            output:
              (err.result.stdout || "") +
              (err.result.stderr ? "\n" + err.result.stderr : ""),
            exitCode: err.result.exitCode ?? 1,
            truncated: false,
          };
        }
        // Other errors - return as output with exit code 1
        return {
          output: err.message || String(error),
          exitCode: 1,
          truncated: false,
        };
      }
      return {
        output: String(error),
        exitCode: 1,
        truncated: false,
      };
    }
  }

  /**
   * Upload files to the E2B sandbox using the native filesystem API.
   */
  override async uploadFiles(files: Array<[string, Uint8Array]>): Promise<FileUploadResponse[]> {
    const responses: FileUploadResponse[] = [];

    for (const [path, content] of files) {
      try {
        // E2B's write accepts string | ArrayBuffer | Blob
        // Cast to ArrayBuffer because Uint8Array.buffer might be SharedArrayBuffer
        await this._sandbox.files.write(path, content.buffer as ArrayBuffer);
        responses.push({ path, error: null });
      } catch (error) {
        responses.push({
          path,
          error: mapE2BError(error instanceof Error ? error.message : String(error)),
        });
      }
    }

    return responses;
  }

  /**
   * Write a file using the native filesystem API.
   * Override to avoid shell command limits for large files.
   */
  override async write(filePath: string, content: string): Promise<WriteResult> {
    try {
      // Convert string to bytes and write using native API
      const encoder = new TextEncoder();
      const bytes = encoder.encode(content);
      await this._sandbox.files.write(filePath, bytes.buffer as ArrayBuffer);
      return { success: true, path: filePath };
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      if (errorMsg.includes("exists") || errorMsg.includes("already")) {
        return {
          success: false,
          error: `Cannot write to ${filePath} because it already exists.`,
        };
      }
      return { success: false, error: errorMsg };
    }
  }

  /**
   * Download files from the E2B sandbox using the native filesystem API.
   */
  override async downloadFiles(paths: string[]): Promise<FileDownloadResponse[]> {
    const responses: FileDownloadResponse[] = [];

    for (const path of paths) {
      try {
        // Read as bytes
        const content = await this._sandbox.files.read(path, { format: "bytes" });
        responses.push({
          path,
          content: new Uint8Array(content),
          error: null,
        });
      } catch (error) {
        responses.push({
          path,
          content: null,
          error: mapE2BError(error instanceof Error ? error.message : String(error)),
        });
      }
    }

    return responses;
  }

  /**
   * Kill the E2B sandbox.
   *
   * E2B automatically cleans up after 5 minutes of inactivity, but we can
   * manually kill it to clean up immediately.
   */
  async dispose(): Promise<void> {
    await this._sandbox.kill();
  }
}

/**
 * Create an E2B sandbox backend.
 *
 * This is an async factory function because E2B requires async operations
 * to create sandboxes.
 *
 * @example
 * ```typescript
 * const backend = await createE2BBackend({
 *   template: "base",
 *   timeout: 10 * 60 * 1000,
 * });
 * ```
 */
export async function createE2BBackend(
  options: E2BBackendOptions = {}
): Promise<E2BBackend> {
  const apiKey = options.apiKey ?? process.env.E2B_API_KEY;
  if (!apiKey) {
    throw new Error("E2B_API_KEY environment variable must be set");
  }

  const template = options.template ?? "base";
  const timeout = options.timeout ?? 30 * 60 * 1000;

  // Create the E2B sandbox
  const sandbox = await Sandbox.create(template, {
    apiKey,
  });

  return new E2BBackend(sandbox, timeout);
}
