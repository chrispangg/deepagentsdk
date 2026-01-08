/**
 * Backend protocol and filesystem types.
 */

import type { TodoItem } from "./core";

/**
 * File data structure used by backends.
 */
export interface FileData {
  /** Lines of text content */
  content: string[];
  /** ISO format timestamp of creation */
  created_at: string;
  /** ISO format timestamp of last modification */
  modified_at: string;
}

/**
 * Structured file listing info.
 */
export interface FileInfo {
  /** File path */
  path: string;
  /** Whether this is a directory */
  is_dir?: boolean;
  /** File size in bytes (approximate) */
  size?: number;
  /** ISO 8601 timestamp of last modification */
  modified_at?: string;
}

/**
 * Structured grep match entry.
 */
export interface GrepMatch {
  /** File path where match was found */
  path: string;
  /** Line number (1-indexed) */
  line: number;
  /** The matching line text */
  text: string;
}

/**
 * Result from backend write operations.
 */
export interface WriteResult {
  /** Whether the write operation succeeded */
  success: boolean;
  /** Error message on failure, undefined on success */
  error?: string;
  /** File path of written file, undefined on failure */
  path?: string;
}

/**
 * Result from backend edit operations.
 */
export interface EditResult {
  /** Whether the edit operation succeeded */
  success: boolean;
  /** Error message on failure, undefined on success */
  error?: string;
  /** File path of edited file, undefined on failure */
  path?: string;
  /** Number of replacements made, undefined on failure */
  occurrences?: number;
}

/**
 * Shared state for deep agent operations.
 * This is passed to tools and modified during execution.
 */
export interface DeepAgentState {
  /** Current todo list */
  todos: TodoItem[];
  /** Virtual filesystem (for StateBackend) */
  files: Record<string, FileData>;
}

/**
 * Protocol for pluggable memory backends.
 */
export interface BackendProtocol {
  /**
   * Structured listing with file metadata.
   */
  lsInfo(path: string): FileInfo[] | Promise<FileInfo[]>;

  /**
   * Read file content with line numbers or an error string.
   */
  read(
    filePath: string,
    offset?: number,
    limit?: number
  ): string | Promise<string>;

  /**
   * Read file content as raw FileData.
   */
  readRaw(filePath: string): FileData | Promise<FileData>;

  /**
   * Structured search results or error string for invalid input.
   */
  grepRaw(
    pattern: string,
    path?: string | null,
    glob?: string | null
  ): GrepMatch[] | string | Promise<GrepMatch[] | string>;

  /**
   * Structured glob matching returning FileInfo objects.
   */
  globInfo(pattern: string, path?: string): FileInfo[] | Promise<FileInfo[]>;

  /**
   * Create a new file or overwrite existing file.
   */
  write(filePath: string, content: string): WriteResult | Promise<WriteResult>;

  /**
   * Edit a file by replacing string occurrences.
   */
  edit(
    filePath: string,
    oldString: string,
    newString: string,
    replaceAll?: boolean
  ): EditResult | Promise<EditResult>;
}

/**
 * Factory function type for creating backend instances from agent state.
 */
export type BackendFactory = (state: DeepAgentState) => BackendProtocol;

/**
 * Result of command execution in a sandbox.
 */
export interface ExecuteResponse {
  /** Combined stdout and stderr output of the executed command */
  output: string;
  /** Exit code (0 = success, non-zero = failure, null = unknown/timeout) */
  exitCode: number | null;
  /** Whether the output was truncated due to size limits */
  truncated: boolean;
}

/**
 * Protocol for sandbox backends with command execution capability.
 */
export interface SandboxBackendProtocol extends BackendProtocol {
  /**
   * Execute a shell command in the sandbox.
   */
  execute(command: string): Promise<ExecuteResponse>;

  /**
   * Unique identifier for this sandbox instance.
   */
  readonly id: string;
}

/**
 * Type guard to check if a backend is a SandboxBackendProtocol.
 */
export function isSandboxBackend(
  backend: BackendProtocol
): backend is SandboxBackendProtocol {
  return (
    typeof (backend as SandboxBackendProtocol).execute === "function" &&
    typeof (backend as SandboxBackendProtocol).id === "string"
  );
}
