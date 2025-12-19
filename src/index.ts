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
export { createDeepAgent, DeepAgent } from "./agent";

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
  // Sandbox types
  ExecuteResponse,
  SandboxBackendProtocol,
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
  ExecuteStartEvent,
  ExecuteFinishEvent,
  WebSearchStartEvent,
  WebSearchFinishEvent,
  HttpRequestStartEvent,
  HttpRequestFinishEvent,
  FetchUrlStartEvent,
  FetchUrlFinishEvent,
  SubagentStartEvent,
  SubagentFinishEvent,
  ApprovalRequestedEvent,
  ApprovalResponseEvent,
  CheckpointSavedEvent,
  CheckpointLoadedEvent,
  DoneEvent,
  ErrorEvent,
  // Approval configuration types
  InterruptOnConfig,
  DynamicApprovalConfig,
} from "./types";

// Type guard for sandbox backends
export { isSandboxBackend } from "./types";

// Backends
export {
  StateBackend,
  FilesystemBackend,
  CompositeBackend,
  PersistentBackend,
  InMemoryStore,
  type KeyValueStore,
  type PersistentBackendOptions,
  // Sandbox backends
  BaseSandbox,
  LocalSandbox,
  type LocalSandboxOptions,
} from "./backends/index";

// Tools (for advanced usage)
export {
  createTodosTool,
  createFilesystemTools,
  createSubagentTool,
  type CreateSubagentToolOptions,
  // Execute tool for sandbox backends
  createExecuteTool,
  createExecuteToolFromBackend,
  type CreateExecuteToolOptions,
  // Web tools
  createWebTools,
  htmlToMarkdown,
  type CreateWebToolsOptions,
} from "./tools/index";

// Prompts (for customization)
export {
  BASE_PROMPT,
  TODO_SYSTEM_PROMPT,
  FILESYSTEM_SYSTEM_PROMPT,
  TASK_SYSTEM_PROMPT,
  EXECUTE_SYSTEM_PROMPT,
  getTaskToolDescription,
  DEFAULT_GENERAL_PURPOSE_DESCRIPTION,
  DEFAULT_SUBAGENT_PROMPT,
} from "./prompts";

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
} from "./utils/index";

// Checkpointer
export * from "./checkpointer/index";

// Re-export AI SDK middleware types for user convenience
export type { LanguageModelMiddleware } from 'ai';
export { wrapLanguageModel } from 'ai';

// Skills System
export { listSkills, parseSkillMetadata } from "./skills/index";
export type { SkillMetadata, SkillLoadOptions } from "./skills/index";

// Agent Memory Middleware
export { createAgentMemoryMiddleware } from "./middleware/agent-memory";
export type { AgentMemoryOptions } from "./types";

// Project Detection Utilities
export { findGitRoot } from "./utils/project-detection";
