/**
 * Modal Sandbox Backend
 *
 * Modal provides serverless cloud compute with sandboxed execution.
 * Documentation: https://modal.com/docs/guide/sdk-javascript-go
 * GitHub: https://github.com/modal-labs/libmodal
 * Package: modal
 *
 * Authentication:
 * - Set MODAL_TOKEN_ID and MODAL_TOKEN_SECRET environment variables
 * - Or use `modal setup` CLI to authenticate (creates ~/.modal.toml)
 *
 * Features:
 * - No auto-cleanup (must call dispose())
 * - Slower startup (~10-20 seconds for cold start)
 * - Default working directory: /workspace
 * - Requires Node 22+
 *
 * Note: Modal's JavaScript SDK requires async constructors due to app/sandbox creation.
 * This backend uses an async factory pattern via `createModalBackend()`.
 */

import { BaseSandbox } from "./sandbox";
import type {
  ExecuteResponse,
  FileDownloadResponse,
  FileOperationError,
  FileUploadResponse,
} from "../types";
import { ModalClient, type Sandbox } from "modal";

/**
 * Options for creating a Modal backend.
 */
export interface ModalBackendOptions {
  /**
   * Modal app name. Defaults to "deepagentsdk-sandbox".
   * App will be created if it doesn't exist.
   */
  appName?: string;

  /**
   * Container image to use for sandbox.
   * Defaults to "python:3.13-slim".
   */
  image?: string;

  /**
   * Timeout for command execution in milliseconds.
   * Defaults to 30 minutes.
   */
  timeout?: number;
}

/**
 * Map Modal errors to FileOperationError literals.
 */
function mapModalError(error: string): FileOperationError {
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
 * Modal sandbox backend implementation.
 *
 * Use createModalBackend() factory function to create instances.
 */
export class ModalBackend extends BaseSandbox {
  readonly id: string;
  private readonly _client: ModalClient;
  private readonly _sandbox: Sandbox;
  private readonly _timeout: number;

  constructor(
    client: ModalClient,
    sandbox: Sandbox,
    timeout: number
  ) {
    super();
    this._client = client;
    this._sandbox = sandbox;
    this.id = sandbox.sandboxId;
    this._timeout = timeout;
  }

  /**
   * Execute a shell command in the Modal sandbox.
   */
  async execute(command: string): Promise<ExecuteResponse> {
    // Parse command into arguments (simple shlex-like behavior)
    const args = command.split(/\s+/);

    const process = await this._sandbox.exec(args, {
      stdout: "pipe",
      stderr: "pipe",
    });

    const [stdout, stderr, exitCode] = await Promise.all([
      process.stdout.readText().catch(() => ""),
      process.stderr.readText().catch(() => ""),
      process.wait(),
    ]);

    return {
      output: stdout + (stderr ? "\n" + stderr : ""),
      exitCode,
      truncated: false,
    };
  }

  /**
   * Upload files to the Modal sandbox.
   */
  override async uploadFiles(files: Array<[string, Uint8Array]>): Promise<FileUploadResponse[]> {
    const responses: FileUploadResponse[] = [];

    for (const [path, content] of files) {
      try {
        const handle = await this._sandbox.open(path, "w");
        await handle.write(content);
        await handle.close();
        responses.push({ path, error: null });
      } catch (error) {
        responses.push({
          path,
          error: mapModalError(error instanceof Error ? error.message : String(error)),
        });
      }
    }

    return responses;
  }

  /**
   * Download files from the Modal sandbox.
   */
  override async downloadFiles(paths: string[]): Promise<FileDownloadResponse[]> {
    const responses: FileDownloadResponse[] = [];

    for (const path of paths) {
      try {
        const handle = await this._sandbox.open(path, "r");
        const content = await handle.read();
        await handle.close();
        responses.push({ path, content: new Uint8Array(content), error: null });
      } catch (error) {
        responses.push({
          path,
          content: null,
          error: mapModalError(error instanceof Error ? error.message : String(error)),
        });
      }
    }

    return responses;
  }

  /**
   * Terminate the Modal sandbox.
   *
   * Modal has no auto-cleanup, so dispose() must be called to clean up resources.
   */
  async dispose(): Promise<void> {
    await this._sandbox.terminate();
  }
}

/**
 * Create a Modal sandbox backend.
 *
 * This is an async factory function because Modal requires async operations
 * to create apps and sandboxes.
 *
 * @example
 * ```typescript
 * const backend = await createModalBackend({
 *   appName: "my-agent-sandbox",
 *   image: "node:22-alpine",
 * });
 * ```
 */
export async function createModalBackend(
  options: ModalBackendOptions = {}
): Promise<ModalBackend> {
  // Initialize Modal client (reads from ~/.modal.toml or env vars)
  const client = new ModalClient();

  // Get or create app
  const appName = options.appName ?? "deepagentsdk-sandbox";
  const app = await client.apps.fromName(appName, {
    createIfMissing: true,
  });

  // Create image
  const imageRef = options.image ?? "python:3.13-slim";
  const image = client.images.fromRegistry(imageRef);

  // Create sandbox
  const sandbox = await client.sandboxes.create(app, image);
  const timeout = options.timeout ?? 30 * 60 * 1000;

  return new ModalBackend(client, sandbox, timeout);
}
