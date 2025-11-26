/**
 * Tool result eviction utility.
 *
 * When tool results exceed a certain size threshold, this utility
 * writes them to the filesystem and returns a reference instead.
 * This prevents context overflow from large tool outputs.
 */

import type { BackendProtocol, BackendFactory, DeepAgentState } from "../types.js";

/**
 * Default token limit before evicting a tool result.
 * Approximately 20,000 tokens (~80KB of text).
 */
export const DEFAULT_EVICTION_TOKEN_LIMIT = 20000;

/**
 * Approximate characters per token (rough estimate).
 */
const CHARS_PER_TOKEN = 4;

/**
 * Sanitize a tool call ID for use as a filename.
 * Removes or replaces characters that are invalid in file paths.
 */
export function sanitizeToolCallId(toolCallId: string): string {
  return toolCallId
    .replace(/[^a-zA-Z0-9_-]/g, "_")
    .substring(0, 100); // Limit length
}

/**
 * Estimate the number of tokens in a string.
 * Uses a simple character-based approximation.
 */
export function estimateTokens(text: string): number {
  return Math.ceil(text.length / CHARS_PER_TOKEN);
}

/**
 * Check if a tool result should be evicted based on size.
 */
export function shouldEvict(
  result: string,
  tokenLimit: number = DEFAULT_EVICTION_TOKEN_LIMIT
): boolean {
  return estimateTokens(result) > tokenLimit;
}

/**
 * Options for evicting a tool result.
 */
export interface EvictOptions {
  /** The tool result content */
  result: string;
  /** The tool call ID (used for filename) */
  toolCallId: string;
  /** The tool name */
  toolName: string;
  /** Backend to write the evicted content to */
  backend: BackendProtocol;
  /** Token limit before eviction (default: 20000) */
  tokenLimit?: number;
}

/**
 * Result of an eviction operation.
 */
export interface EvictResult {
  /** Whether the result was evicted */
  evicted: boolean;
  /** The content to return (either original or truncated message) */
  content: string;
  /** Path where content was evicted to (if evicted) */
  evictedPath?: string;
}

/**
 * Evict a large tool result to the filesystem.
 *
 * If the result exceeds the token limit, writes it to a file and
 * returns a truncated message with the file path.
 *
 * @param options - Eviction options
 * @returns Eviction result with content and metadata
 *
 * @example
 * ```typescript
 * const result = await evictToolResult({
 *   result: veryLongString,
 *   toolCallId: "call_123",
 *   toolName: "grep",
 *   backend: filesystemBackend,
 * });
 *
 * if (result.evicted) {
 *   console.log(`Content saved to ${result.evictedPath}`);
 * }
 * ```
 */
export async function evictToolResult(
  options: EvictOptions
): Promise<EvictResult> {
  const {
    result,
    toolCallId,
    toolName,
    backend,
    tokenLimit = DEFAULT_EVICTION_TOKEN_LIMIT,
  } = options;

  // Check if eviction is needed
  if (!shouldEvict(result, tokenLimit)) {
    return {
      evicted: false,
      content: result,
    };
  }

  // Generate eviction path
  const sanitizedId = sanitizeToolCallId(toolCallId);
  const evictPath = `/large_tool_results/${toolName}_${sanitizedId}.txt`;

  // Write to backend
  const writeResult = await backend.write(evictPath, result);

  if (writeResult.error) {
    // If write fails, return original content (may cause context issues)
    console.warn(`Failed to evict tool result: ${writeResult.error}`);
    return {
      evicted: false,
      content: result,
    };
  }

  // Return truncated message
  const estimatedTokens = estimateTokens(result);
  const truncatedContent = `Tool result too large (~${estimatedTokens} tokens). Content saved to ${evictPath}. Use read_file to access the full content.`;

  return {
    evicted: true,
    content: truncatedContent,
    evictedPath: evictPath,
  };
}

/**
 * Create a tool result wrapper that automatically evicts large results.
 *
 * @param backend - Backend or factory for filesystem operations
 * @param state - Current agent state (for factory backends)
 * @param tokenLimit - Token limit before eviction
 * @returns Function that wraps tool results with eviction
 */
export function createToolResultWrapper(
  backend: BackendProtocol | BackendFactory,
  state: DeepAgentState,
  tokenLimit: number = DEFAULT_EVICTION_TOKEN_LIMIT
): (result: string, toolCallId: string, toolName: string) => Promise<string> {
  // Resolve backend if factory
  const resolvedBackend =
    typeof backend === "function" ? backend(state) : backend;

  return async (
    result: string,
    toolCallId: string,
    toolName: string
  ): Promise<string> => {
    const evictResult = await evictToolResult({
      result,
      toolCallId,
      toolName,
      backend: resolvedBackend,
      tokenLimit,
    });

    return evictResult.content;
  };
}

