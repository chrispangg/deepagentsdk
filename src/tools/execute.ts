/**
 * Execute tool for running shell commands in sandbox backends.
 *
 * This tool is only available when the backend implements SandboxBackendProtocol.
 */

import { tool } from "ai";
import { z } from "zod";
import type { SandboxBackendProtocol, EventCallback } from "../types";

/**
 * Tool description for the execute tool.
 */
const EXECUTE_TOOL_DESCRIPTION = `Execute a shell command in the sandbox environment.

Use this tool to:
- Run build commands (npm install, npm run build, bun install)
- Run tests (npm test, bun test, pytest)
- Execute scripts (node script.js, python script.py)
- Check system state (ls, cat, pwd, which)
- Install dependencies
- Run any shell command

The command runs in the sandbox's working directory. Commands have a timeout limit.

IMPORTANT:
- Always check the exit code to determine success (0 = success)
- Long-running commands may timeout
- Use && to chain commands that depend on each other
- Use ; to run commands sequentially regardless of success`;

/**
 * Options for creating the execute tool.
 */
export interface CreateExecuteToolOptions {
  /** The sandbox backend to execute commands in */
  backend: SandboxBackendProtocol;
  /** Optional callback for emitting events */
  onEvent?: EventCallback;
  /** Optional custom description for the tool */
  description?: string;
}

/**
 * Create an execute tool for running shell commands.
 *
 * @param options - Options including the sandbox backend and optional event callback
 * @returns An AI SDK tool that executes shell commands
 *
 * @example Basic usage
 * ```typescript
 * import { LocalSandbox, createExecuteTool } from 'ai-sdk-deep-agent';
 *
 * const sandbox = new LocalSandbox({ cwd: './workspace' });
 * const executeTool = createExecuteTool({ backend: sandbox });
 *
 * // Use with agent
 * const agent = createDeepAgent({
 *   model: anthropic('claude-sonnet-4-20250514'),
 *   backend: sandbox,
 *   tools: { execute: executeTool },
 * });
 * ```
 *
 * @example With event streaming
 * ```typescript
 * const executeTool = createExecuteTool({
 *   backend: sandbox,
 *   onEvent: (event) => {
 *     if (event.type === 'execute-start') {
 *       console.log(`Running: ${event.command}`);
 *     } else if (event.type === 'execute-finish') {
 *       console.log(`Exit code: ${event.exitCode}`);
 *     }
 *   },
 * });
 * ```
 */
export function createExecuteTool(options: CreateExecuteToolOptions) {
  const { backend, onEvent, description } = options;

  return tool({
    description: description || EXECUTE_TOOL_DESCRIPTION,
    inputSchema: z.object({
      command: z
        .string()
        .describe("The shell command to execute (e.g., 'npm install', 'ls -la', 'cat file.txt')"),
    }),
    execute: async ({ command }) => {
      // Emit execute-start event
      if (onEvent) {
        onEvent({
          type: "execute-start",
          command,
          sandboxId: backend.id,
        });
      }

      // Execute the command
      const result = await backend.execute(command);

      // Emit execute-finish event
      if (onEvent) {
        onEvent({
          type: "execute-finish",
          command,
          exitCode: result.exitCode,
          truncated: result.truncated,
          sandboxId: backend.id,
        });
      }

      // Format the response
      const parts: string[] = [];

      if (result.output) {
        parts.push(result.output);
      }

      // Add exit code information
      if (result.exitCode === 0) {
        parts.push(`\n[Exit code: 0 (success)]`);
      } else if (result.exitCode !== null) {
        parts.push(`\n[Exit code: ${result.exitCode} (failure)]`);
      } else {
        parts.push(`\n[Exit code: unknown (possibly timed out)]`);
      }

      // Note if output was truncated
      if (result.truncated) {
        parts.push(`[Output truncated due to size limit]`);
      }

      return parts.join("");
    },
  });
}

/**
 * Convenience function to create execute tool from just a backend.
 * Useful for simple cases without event handling.
 *
 * @param backend - The sandbox backend
 * @returns An AI SDK tool that executes shell commands
 *
 * @example
 * ```typescript
 * const sandbox = new LocalSandbox({ cwd: './workspace' });
 * const tools = {
 *   execute: createExecuteToolFromBackend(sandbox),
 * };
 * ```
 */
export function createExecuteToolFromBackend(backend: SandboxBackendProtocol) {
  return createExecuteTool({ backend });
}

