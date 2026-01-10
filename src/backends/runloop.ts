/**
 * Runloop Sandbox Backend
 *
 * Runloop provides AI-optimized devboxes for code execution.
 * Documentation: https://runloopai.github.io/api-client-ts/stable/
 * Package: @runloop/api-client
 *
 * Authentication:
 * - Set RUNLOOP_API_KEY environment variable
 * - Or pass apiKey option to constructor
 *
 * Features:
 * - No auto-cleanup (must call dispose())
 * - Medium startup (~5-10 seconds)
 * - Default working directory: /home/user
 *
 * Note: Runloop uses seconds for timeout (not milliseconds like other providers).
 */

import { BaseSandbox } from "./sandbox";
import type {
  ExecuteResponse,
  FileUploadResponse,
  FileDownloadResponse,
  FileOperationError,
} from "../types";
import { RunloopSDK } from "@runloop/api-client";

/**
 * Options for creating a Runloop backend.
 */
/**
 * Map Runloop errors to FileOperationError literals.
 */
function mapRunloopError(error: string): FileOperationError {
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

export interface RunloopBackendOptions {
  /**
   * Runloop API key. If not provided, reads from RUNLOOP_API_KEY environment variable.
   */
  apiKey?: string;

  /**
   * Existing devbox ID to reconnect to.
   * If provided, connects to existing devbox instead of creating new one.
   */
  devboxId?: string;

  /**
   * Timeout for command execution in milliseconds.
   * Defaults to 30 minutes.
   */
  timeout?: number;
}

/**
 * Runloop devbox backend implementation.
 *
 * @example Creating a new devbox
 * ```typescript
 * const backend = new RunloopBackend({
 *   timeout: 15 * 60 * 1000, // 15 minutes
 * });
 * ```
 *
 * @example Reconnecting to existing devbox
 * ```typescript
 * const backend = new RunloopBackend({
 *   devboxId: "db-abc123",
 * });
 * ```
 */
export class RunloopBackend extends BaseSandbox {
  readonly id: string;
  private readonly _sdk: RunloopSDK;
  private readonly _devbox: Awaited<ReturnType<RunloopSDK["devbox"]["create"]>>;
  private readonly _timeout: number;
  private readonly _owned: boolean; // Whether we created the devbox

  constructor(options: RunloopBackendOptions = {}) {
    super();

    const apiKey = options.apiKey ?? process.env.RUNLOOP_API_KEY;
    if (!apiKey) {
      throw new Error("RUNLOOP_API_KEY environment variable must be set");
    }

    this._sdk = new RunloopSDK({ bearerToken: apiKey });
    this._timeout = options.timeout ?? 30 * 60 * 1000;

    // Note: This is synchronous but creates devbox asynchronously
    // In production code, this would need to be async or use a factory pattern
    // For now, we'll initialize synchronously and let the first operation wait
    if (options.devboxId) {
      // Connect to existing devbox - this is sync, just stores reference
      this._devbox = null as any; // Will be fetched on first use
      this.id = options.devboxId;
      this._owned = false;
    } else {
      // Create new devbox (waits for it to be ready)
      // Since constructor can't be async, we need to handle this differently
      this._devbox = null as any;
      this.id = `pending-${Date.now()}`;
      this._owned = true;

      // Initialize devbox asynchronously
      this._initializeDevbox();
    }
  }

  private async _initializeDevbox(): Promise<void> {
    const devbox = await this._sdk.devbox.create();
    (this as any)._devbox = devbox;
    // Devbox ID is typically 'id' property in the SDK
    (this as any).id = (devbox as any).id || (devbox as any).devboxId;
  }

  private async _getDevbox(): Promise<any> {
    if (!this._devbox) {
      if ((this as any)._owned) {
        // Wait for initialization - poll until ready
        let attempts = 0;
        while (!(this as any)._devbox && attempts < 50) {
          await new Promise(resolve => setTimeout(resolve, 100));
          attempts++;
        }
        return (this as any)._devbox;
      } else {
        // Fetch existing devbox - use list to find the one we want
        const devboxes = await this._sdk.devbox.list();
        const devbox = devboxes.find((d: any) => (d.id || d.devboxId) === this.id);
        if (devbox) {
          (this as any)._devbox = devbox;
        }
        return devbox;
      }
    }
    return this._devbox;
  }

  /**
   * Execute a shell command in the Runloop devbox.
   */
  async execute(command: string): Promise<ExecuteResponse> {
    const devbox = await this._getDevbox();
    const result = await devbox.cmd.exec(command, {
      timeout: this._timeout / 1000, // Runloop uses seconds
    });

    const stdout = await result.stdout();
    const stderr = await result.stderr();

    return {
      output: stdout + (stderr ? "\n" + stderr : ""),
      exitCode: result.exitCode,
      truncated: false,
    };
  }

  /**
   * Upload files to the Runloop devbox.
   *
   * Uses base64 encoding to transfer file content via shell commands.
   */
  override async uploadFiles(files: Array<[string, Uint8Array]>): Promise<FileUploadResponse[]> {
    const responses: FileUploadResponse[] = [];

    for (const [path, content] of files) {
      try {
        // Use shell command to write file (simpler than using storage API)
        const base64Content = Buffer.from(content).toString("base64");
        await this.execute(`echo "${base64Content}" | base64 -d > "${path}"`);
        responses.push({ path, error: null });
      } catch (error) {
        responses.push({
          path,
          error: mapRunloopError(error instanceof Error ? error.message : String(error)),
        });
      }
    }

    return responses;
  }

  /**
   * Download files from the Runloop devbox.
   *
   * Uses base64 encoding to transfer file content via shell commands.
   */
  override async downloadFiles(paths: string[]): Promise<FileDownloadResponse[]> {
    const responses: FileDownloadResponse[] = [];

    for (const path of paths) {
      try {
        // Read file via base64 encoding
        const result = await this.execute(`base64 "${path}"`);
        const base64Content = result.output.trim();
        const content = Buffer.from(base64Content, "base64");
        responses.push({ path, content, error: null });
      } catch (error) {
        responses.push({
          path,
          content: null,
          error: mapRunloopError(error instanceof Error ? error.message : String(error)),
        });
      }
    }

    return responses;
  }

  /**
   * Shutdown the Runloop devbox.
   *
   * Runloop has no auto-cleanup, so dispose() must be called to clean up resources.
   * Only shuts down devbox if we created it (owned: true).
   */
  async dispose(): Promise<void> {
    if (this._owned) {
      const devbox = await this._getDevbox();
      await devbox.shutdown();
    }
  }
}
