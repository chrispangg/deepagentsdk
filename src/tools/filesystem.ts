/**
 * Filesystem tools for virtual file operations.
 */

import { tool } from "ai";
import { z } from "zod";
import type {
  BackendProtocol,
  DeepAgentState,
  BackendFactory,
  EventCallback,
} from "../types";
import { StateBackend } from "../backends/state";
import {
  evictToolResult,
  DEFAULT_EVICTION_TOKEN_LIMIT,
} from "../utils/eviction";

// Tool descriptions
const LS_TOOL_DESCRIPTION = "List files and directories in a directory. Paths are relative to the working directory.";
const READ_FILE_TOOL_DESCRIPTION = "Read the contents of a file. Paths are relative to the working directory.";
const WRITE_FILE_TOOL_DESCRIPTION =
  "Write content to a new file. Returns an error if the file already exists. Paths are relative to the working directory.";
const EDIT_FILE_TOOL_DESCRIPTION =
  "Edit a file by replacing a specific string with a new string. Paths are relative to the working directory.";
const GLOB_TOOL_DESCRIPTION =
  "Find files matching a glob pattern (e.g., '**/*.py' for all Python files). Paths are relative to the working directory.";
const GREP_TOOL_DESCRIPTION =
  "Search for a regex pattern in files. Returns matching files and line numbers. Paths are relative to the working directory.";

/**
 * Resolve backend from factory or instance.
 */
function getBackend(
  backend: BackendProtocol | BackendFactory,
  state: DeepAgentState
): BackendProtocol {
  if (typeof backend === "function") {
    return backend(state);
  }
  return backend;
}

/**
 * Create the ls tool.
 */
function createLsTool(
  state: DeepAgentState,
  backend: BackendProtocol | BackendFactory,
  onEvent?: EventCallback
) {
  return tool({
    description: LS_TOOL_DESCRIPTION,
    inputSchema: z.object({
      path: z
        .string()
        .default("/")
        .describe("Directory path to list (default: /)"),
    }),
    execute: async ({ path }) => {
      const resolvedBackend = getBackend(backend, state);
      const infos = await resolvedBackend.lsInfo(path || "/");

      // Emit ls event
      if (onEvent) {
        onEvent({
          type: "ls",
          path: path || "/",
          count: infos.length,
        });
      }

      if (infos.length === 0) {
        return `No files found in ${path}`;
      }

      const lines: string[] = [];
      for (const info of infos) {
        if (info.is_dir) {
          lines.push(`${info.path} (directory)`);
        } else {
          const size = info.size ? ` (${info.size} bytes)` : "";
          lines.push(`${info.path}${size}`);
        }
      }
      return lines.join("\n");
    },
  });
}

/**
 * Create the read_file tool.
 */
function createReadFileTool(
  state: DeepAgentState,
  backend: BackendProtocol | BackendFactory,
  evictionLimit?: number,
  onEvent?: EventCallback
) {
  return tool({
    description: READ_FILE_TOOL_DESCRIPTION,
    inputSchema: z.object({
      file_path: z.string().describe("Path to the file to read (e.g., '/src/main.ts' or 'main.ts')"),
      offset: z
        .number()
        .default(0)
        .describe("Line offset to start reading from (0-indexed)"),
      limit: z
        .number()
        .default(2000)
        .describe("Maximum number of lines to read"),
    }),
    execute: async ({ file_path, offset, limit }, { toolCallId }) => {
      const resolvedBackend = getBackend(backend, state);
      const content = await resolvedBackend.read(file_path, offset ?? 0, limit ?? 2000);
      
      // Emit file-read event
      if (onEvent) {
        const lineCount = content.split("\n").length;
        onEvent({
          type: "file-read",
          path: file_path,
          lines: lineCount,
        });
      }
      
      // Evict large results if limit is set
      if (evictionLimit && evictionLimit > 0) {
        const evictResult = await evictToolResult({
          result: content,
          toolCallId: toolCallId || `read_${Date.now()}`,
          toolName: "read_file",
          backend: resolvedBackend,
          tokenLimit: evictionLimit,
        });
        return evictResult.content;
      }
      
      return content;
    },
  });
}

/**
 * Create the write_file tool.
 */
function createWriteFileTool(
  state: DeepAgentState,
  backend: BackendProtocol | BackendFactory,
  onEvent?: EventCallback
) {
  return tool({
    description: WRITE_FILE_TOOL_DESCRIPTION,
    inputSchema: z.object({
      file_path: z.string().describe("Path to the file to write (e.g., '/src/main.ts' or 'main.ts')"),
      content: z.string().describe("Content to write to the file"),
    }),
    execute: async ({ file_path, content }) => {
      // Emit file-write-start event for preview
      if (onEvent) {
        onEvent({
          type: "file-write-start",
          path: file_path,
          content,
        });
      }

      const resolvedBackend = getBackend(backend, state);
      const result = await resolvedBackend.write(file_path, content);

      if (result.error) {
        return result.error;
      }

      // Emit file-written event with content
      if (onEvent) {
        onEvent({
          type: "file-written",
          path: file_path,
          content,
        });
      }

      return `Successfully wrote to '${file_path}'`;
    },
  });
}

/**
 * Create the edit_file tool.
 */
function createEditFileTool(
  state: DeepAgentState,
  backend: BackendProtocol | BackendFactory,
  onEvent?: EventCallback
) {
  return tool({
    description: EDIT_FILE_TOOL_DESCRIPTION,
    inputSchema: z.object({
      file_path: z.string().describe("Path to the file to edit (e.g., '/src/main.ts' or 'main.ts')"),
      old_string: z
        .string()
        .describe("String to be replaced (must match exactly)"),
      new_string: z.string().describe("String to replace with"),
      replace_all: z
        .boolean()
        .default(false)
        .describe("Whether to replace all occurrences"),
    }),
    execute: async ({ file_path, old_string, new_string, replace_all }) => {
      const resolvedBackend = getBackend(backend, state);
      const result = await resolvedBackend.edit(
        file_path,
        old_string,
        new_string,
        replace_all ?? false
      );

      if (result.error) {
        return result.error;
      }

      // Emit event if callback provided
      if (onEvent) {
        onEvent({
          type: "file-edited",
          path: file_path,
          occurrences: result.occurrences ?? 0,
        });
      }

      return `Successfully replaced ${result.occurrences} occurrence(s) in '${file_path}'`;
    },
  });
}

/**
 * Create the glob tool.
 */
function createGlobTool(
  state: DeepAgentState,
  backend: BackendProtocol | BackendFactory,
  onEvent?: EventCallback
) {
  return tool({
    description: GLOB_TOOL_DESCRIPTION,
    inputSchema: z.object({
      pattern: z.string().describe("Glob pattern (e.g., '*.py', '**/*.ts')"),
      path: z
        .string()
        .default("/")
        .describe("Base path to search from (default: /)"),
    }),
    execute: async ({ pattern, path }) => {
      const resolvedBackend = getBackend(backend, state);
      const infos = await resolvedBackend.globInfo(pattern, path || "/");

      // Emit glob event
      if (onEvent) {
        onEvent({
          type: "glob",
          pattern,
          count: infos.length,
        });
      }

      if (infos.length === 0) {
        return `No files found matching pattern '${pattern}'`;
      }

      return infos.map((info) => info.path).join("\n");
    },
  });
}

/**
 * Create the grep tool.
 */
function createGrepTool(
  state: DeepAgentState,
  backend: BackendProtocol | BackendFactory,
  evictionLimit?: number,
  onEvent?: EventCallback
) {
  return tool({
    description: GREP_TOOL_DESCRIPTION,
    inputSchema: z.object({
      pattern: z.string().describe("Regex pattern to search for"),
      path: z
        .string()
        .default("/")
        .describe("Base path to search from (default: /)"),
      glob: z
        .string()
        .optional()
        .nullable()
        .describe("Optional glob pattern to filter files (e.g., '*.py')"),
    }),
    execute: async ({ pattern, path, glob }, { toolCallId }) => {
      const resolvedBackend = getBackend(backend, state);
      const result = await resolvedBackend.grepRaw(
        pattern,
        path || "/",
        glob ?? null
      );

      if (typeof result === "string") {
        // Emit grep event even for string results (errors)
        if (onEvent) {
          onEvent({
            type: "grep",
            pattern,
            count: 0,
          });
        }
        return result;
      }

      // Emit grep event
      if (onEvent) {
        onEvent({
          type: "grep",
          pattern,
          count: result.length,
        });
      }

      if (result.length === 0) {
        return `No matches found for pattern '${pattern}'`;
      }

      // Format output: group by file
      const lines: string[] = [];
      let currentFile: string | null = null;
      for (const match of result) {
        if (match.path !== currentFile) {
          currentFile = match.path;
          lines.push(`\n${currentFile}:`);
        }
        lines.push(`  ${match.line}: ${match.text}`);
      }

      const content = lines.join("\n");
      
      // Evict large results if limit is set
      if (evictionLimit && evictionLimit > 0) {
        const evictResult = await evictToolResult({
          result: content,
          toolCallId: toolCallId || `grep_${Date.now()}`,
          toolName: "grep",
          backend: resolvedBackend,
          tokenLimit: evictionLimit,
        });
        return evictResult.content;
      }

      return content;
    },
  });
}

/**
 * Options for creating filesystem tools.
 */
export interface CreateFilesystemToolsOptions {
  /** Backend for filesystem operations */
  backend?: BackendProtocol | BackendFactory;
  /** Callback for emitting events */
  onEvent?: EventCallback;
  /** Token limit before evicting large tool results (default: disabled) */
  toolResultEvictionLimit?: number;
}

/**
 * Create all filesystem tools.
 * @param state - The shared agent state
 * @param backendOrOptions - Backend or options object
 * @param onEvent - Optional callback for emitting events (deprecated, use options)
 */
export function createFilesystemTools(
  state: DeepAgentState,
  backendOrOptions?: BackendProtocol | BackendFactory | CreateFilesystemToolsOptions,
  onEvent?: EventCallback
) {
  // Handle both old and new API
  let backend: BackendProtocol | BackendFactory | undefined;
  let eventCallback: EventCallback | undefined = onEvent;
  let evictionLimit: number | undefined;

  if (backendOrOptions && typeof backendOrOptions === "object" && "backend" in backendOrOptions) {
    // New options API
    const options = backendOrOptions as CreateFilesystemToolsOptions;
    backend = options.backend;
    eventCallback = options.onEvent;
    evictionLimit = options.toolResultEvictionLimit;
  } else {
    // Old API (backend directly)
    backend = backendOrOptions as BackendProtocol | BackendFactory | undefined;
  }

  // Default to StateBackend if no backend provided
  const resolvedBackend =
    backend || ((s: DeepAgentState) => new StateBackend(s));

  return {
    ls: createLsTool(state, resolvedBackend, eventCallback),
    read_file: createReadFileTool(state, resolvedBackend, evictionLimit, eventCallback),
    write_file: createWriteFileTool(state, resolvedBackend, eventCallback),
    edit_file: createEditFileTool(state, resolvedBackend, eventCallback),
    glob: createGlobTool(state, resolvedBackend, eventCallback),
    grep: createGrepTool(state, resolvedBackend, evictionLimit, eventCallback),
  };
}
