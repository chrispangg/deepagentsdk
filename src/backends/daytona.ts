/**
 * Daytona Sandbox Backend
 *
 * Daytona provides secure and elastic infrastructure for running AI-generated code.
 * Documentation: https://www.daytona.io/docs/en/typescript-sdk/
 * Package: @daytonaio/sdk
 *
 * Authentication:
 * - Set DAYTONA_API_KEY environment variable
 * - Or pass apiKey option to constructor
 *
 * Features:
 * - No auto-cleanup (must call dispose())
 * - Medium startup (~5-10 seconds)
 * - Default working directory: /workspace
 * - Supports multiple languages (typescript, python, etc.)
 */

import { BaseSandbox } from "./sandbox";
import type {
  ExecuteResponse,
  FileUploadResponse,
  FileDownloadResponse,
  FileOperationError,
} from "../types";
import { Daytona } from "@daytonaio/sdk";

/**
 * Options for creating a Daytona backend.
 */
/**
 * Map Daytona errors to FileOperationError literals.
 */
function mapDaytonaError(error: string): FileOperationError {
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

export interface DaytonaBackendOptions {
  /**
   * Daytona API key. If not provided, reads from DAYTONA_API_KEY environment variable.
   */
  apiKey?: string;

  /**
   * Language/runtime for the sandbox.
   * Defaults to "typescript".
   * Options: "typescript", "python", "go", etc.
   */
  language?: string;

  /**
   * Existing sandbox ID to reconnect to.
   * If provided, connects to existing sandbox instead of creating new one.
   */
  sandboxId?: string;

  /**
   * Timeout for command execution in milliseconds.
   * Defaults to 30 minutes.
   */
  timeout?: number;
}

/**
 * Daytona sandbox backend implementation.
 *
 * @example Creating a new sandbox
 * ```typescript
 * const backend = new DaytonaBackend({
 *   language: "typescript",
 * });
 * ```
 *
 * @example Reconnecting to existing sandbox
 * ```typescript
 * const backend = new DaytonaBackend({
 *   sandboxId: "ds-abc123",
 * });
 * ```
 */
export class DaytonaBackend extends BaseSandbox {
  readonly id: string;
  private readonly _daytona: Daytona;
  private readonly _sandbox: any;
  private readonly _timeout: number;
  private readonly _owned: boolean;

  constructor(options: DaytonaBackendOptions = {}) {
    super();

    const apiKey = options.apiKey ?? process.env.DAYTONA_API_KEY;
    if (!apiKey) {
      throw new Error("DAYTONA_API_KEY environment variable must be set");
    }

    this._daytona = new Daytona({ apiKey });
    this._timeout = options.timeout ?? 30 * 60 * 1000;

    // Note: Daytona SDK has async create() method
    // For simplicity, we're using a synchronous pattern here
    // In production, this would use an async factory
    if (options.sandboxId) {
      // Connect to existing sandbox
      this._sandbox = { id: options.sandboxId };
      this.id = options.sandboxId;
      this._owned = false;
    } else {
      // Create new sandbox
      this._sandbox = null as any;
      this.id = `pending-${Date.now()}`;
      this._owned = true;

      // Initialize sandbox asynchronously
      this._initializeSandbox(options.language ?? "typescript");
    }
  }

  private async _initializeSandbox(language: string): Promise<void> {
    const sandbox = await this._daytona.create({ language });
    (this as any)._sandbox = sandbox;
    (this as any).id = sandbox.id;
  }

  private async _getSandbox(): Promise<any> {
    if (!this._sandbox || !(this._sandbox as any).process) {
      if ((this as any)._owned) {
        // Wait for initialization
        await new Promise(resolve => setTimeout(resolve, 100));
        return (this as any)._sandbox;
      }
    }
    return this._sandbox;
  }

  /**
   * Execute a shell command in the Daytona sandbox.
   */
  async execute(command: string): Promise<ExecuteResponse> {
    const sandbox = await this._getSandbox();

    // Daytona SDK: sandbox.process.executeCommand(command, cwd, envVars, timeout)
    const response = await sandbox.process.executeCommand(
      command,
      "/workspace",
      undefined,
      this._timeout / 1000 // Daytona uses seconds
    );

    return {
      output: response.result,
      exitCode: response.exitCode ?? 0,
      truncated: false,
    };
  }

  /**
   * Upload files to the Daytona sandbox.
   */
  override async uploadFiles(files: Array<[string, Uint8Array]>): Promise<FileUploadResponse[]> {
    const sandbox = await this._getSandbox();
    const responses: FileUploadResponse[] = [];

    for (const [path, content] of files) {
      try {
        // Daytona uses source/destination pattern for file operations
        await sandbox.fs.uploadFiles([
          {
            source: Buffer.from(content),
            destination: path,
          },
        ]);
        responses.push({ path, error: null });
      } catch (error) {
        responses.push({
          path,
          error: mapDaytonaError(error instanceof Error ? error.message : String(error)),
        });
      }
    }

    return responses;
  }

  /**
   * Download files from the Daytona sandbox.
   */
  override async downloadFiles(paths: string[]): Promise<FileDownloadResponse[]> {
    const sandbox = await this._getSandbox();
    const responses: FileDownloadResponse[] = [];

    for (const path of paths) {
      try {
        const downloads = await sandbox.fs.downloadFiles([{ source: path }]);
        const fileData = downloads[0];

        if (fileData.error) {
          responses.push({
            path,
            content: null,
            error: mapDaytonaError(fileData.error),
          });
        } else {
          // Handle both buffer and string results
          const content =
            typeof fileData.result === "string"
              ? Buffer.from(fileData.result)
              : fileData.result;
          responses.push({ path, content: new Uint8Array(content), error: null });
        }
      } catch (error) {
        responses.push({
          path,
          content: null,
          error: mapDaytonaError(error instanceof Error ? error.message : String(error)),
        });
      }
    }

    return responses;
  }

  /**
   * Delete the Daytona sandbox.
   *
   * Daytona has no auto-cleanup, so dispose() must be called to clean up resources.
   * Only deletes sandbox if we created it (owned: true).
   */
  async dispose(): Promise<void> {
    if (this._owned) {
      const sandbox = await this._getSandbox();
      await this._daytona.delete(sandbox);
    }
  }
}
