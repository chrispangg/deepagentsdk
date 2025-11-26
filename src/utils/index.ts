/**
 * Utility functions for AI SDK Deep Agent.
 */

export { patchToolCalls, hasDanglingToolCalls } from "./patch-tool-calls.js";
export {
  evictToolResult,
  createToolResultWrapper,
  shouldEvict,
  estimateTokens,
  sanitizeToolCallId,
  DEFAULT_EVICTION_TOKEN_LIMIT,
  type EvictOptions,
  type EvictResult,
} from "./eviction.js";
export {
  summarizeIfNeeded,
  needsSummarization,
  estimateMessagesTokens,
  DEFAULT_SUMMARIZATION_THRESHOLD,
  DEFAULT_KEEP_MESSAGES,
  type SummarizationOptions,
  type SummarizationResult,
} from "./summarization.js";

