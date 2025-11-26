/**
 * AI SDK Deep Agent
 *
 * A TypeScript library for building controllable AI agents using Vercel AI SDK v6.
 * Implements the four pillars of deep agents:
 * - Planning tools (write_todos)
 * - Filesystem access (ls, read_file, write_file, edit_file, glob, grep)
 * - Subagent spawning (task)
 * - Detailed prompting
 */

// Main agent
export { createDeepAgent, DeepAgent } from "./agent.ts";

// Re-export AI SDK v6 primitives for convenience
export { ToolLoopAgent, stepCountIs, hasToolCall } from "ai";

// Types
export type {
  CreateDeepAgentParams,
  DeepAgentState,
  SubAgent,
  TodoItem,
  FileData,
  FileInfo,
  GrepMatch,
  WriteResult,
  EditResult,
  BackendProtocol,
  BackendFactory,
  SummarizationConfig,
  // Event types for streaming
  DeepAgentEvent,
  EventCallback,
  TextEvent,
  StepStartEvent,
  StepFinishEvent,
  ToolCallEvent,
  ToolResultEvent,
  TodosChangedEvent,
  FileWriteStartEvent,
  FileWrittenEvent,
  FileEditedEvent,
  SubagentStartEvent,
  SubagentFinishEvent,
  DoneEvent,
  ErrorEvent,
} from "./types.ts";

// Backends
export {
  StateBackend,
  FilesystemBackend,
  CompositeBackend,
  PersistentBackend,
  InMemoryStore,
  type KeyValueStore,
  type PersistentBackendOptions,
} from "./backends/index.ts";

// Tools (for advanced usage)
export {
  createTodosTool,
  createFilesystemTools,
  createSubagentTool,
  type CreateSubagentToolOptions,
} from "./tools/index.ts";

// Prompts (for customization)
export {
  BASE_PROMPT,
  TODO_SYSTEM_PROMPT,
  FILESYSTEM_SYSTEM_PROMPT,
  TASK_SYSTEM_PROMPT,
  getTaskToolDescription,
  DEFAULT_GENERAL_PURPOSE_DESCRIPTION,
  DEFAULT_SUBAGENT_PROMPT,
} from "./prompts.ts";

// Utilities
export {
  patchToolCalls,
  hasDanglingToolCalls,
  evictToolResult,
  createToolResultWrapper,
  shouldEvict,
  estimateTokens,
  DEFAULT_EVICTION_TOKEN_LIMIT,
  type EvictOptions,
  type EvictResult,
  summarizeIfNeeded,
  needsSummarization,
  estimateMessagesTokens,
  DEFAULT_SUMMARIZATION_THRESHOLD,
  DEFAULT_KEEP_MESSAGES,
  type SummarizationOptions,
  type SummarizationResult,
} from "./utils/index.ts";
