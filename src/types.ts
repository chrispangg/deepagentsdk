/**
 * Shared type definitions for AI SDK Deep Agent.
 */

import type { Tool, ToolSet, ModelMessage } from "ai";

// Re-export ModelMessage for convenience
export type { ModelMessage };

/**
 * Todo item for task planning and tracking.
 */
export interface TodoItem {
  /** Unique identifier for the todo */
  id: string;
  /** Description of the task */
  content: string;
  /** Current status */
  status: "pending" | "in_progress" | "completed" | "cancelled";
}

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
  /** Error message on failure, undefined on success */
  error?: string;
  /** File path of written file, undefined on failure */
  path?: string;
}

/**
 * Result from backend edit operations.
 */
export interface EditResult {
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
 * SubAgent specification for task delegation.
 */
export interface SubAgent {
  /** The name of the agent */
  name: string;
  /** The description of the agent shown to the main agent */
  description: string;
  /** The system prompt to use for the agent */
  systemPrompt: string;
  /** The tools to use for the agent */
  tools?: ToolSet;
  /** The model for the agent (model string or provider instance) */
  model?: string;
}

/**
 * Summarization configuration options.
 */
export interface SummarizationConfig {
  /** Enable automatic summarization when approaching token limits */
  enabled: boolean;
  /** Token threshold to trigger summarization (default: 170000) */
  tokenThreshold?: number;
  /** Number of recent messages to keep intact (default: 6) */
  keepMessages?: number;
  /** Model to use for summarization (defaults to main model) */
  model?: string;
}

/**
 * Configuration parameters for creating a Deep Agent.
 */
export interface CreateDeepAgentParams {
  /** The model to use (e.g., 'anthropic/claude-sonnet-4-20250514'). Defaults to claude-sonnet */
  model?: string;
  /** Custom tools the agent should have access to */
  tools?: ToolSet;
  /** Custom system prompt for the agent */
  systemPrompt?: string;
  /** List of subagent specifications for task delegation */
  subagents?: SubAgent[];
  /** Backend for filesystem operations (default: StateBackend) */
  backend?: BackendProtocol | BackendFactory;
  /** Maximum number of steps for the agent loop */
  maxSteps?: number;
  /** Whether to include the general-purpose subagent */
  includeGeneralPurposeAgent?: boolean;
  /** Token limit before evicting large tool results to filesystem (default: disabled) */
  toolResultEvictionLimit?: number;
  /** Enable Anthropic prompt caching for improved performance */
  enablePromptCaching?: boolean;
  /** Summarization configuration for automatic conversation summarization */
  summarization?: SummarizationConfig;
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
   * Create a new file.
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
 * Factory function type for creating backend instances.
 */
export type BackendFactory = (state: DeepAgentState) => BackendProtocol;

// ============================================================================
// Event Types for Streaming
// ============================================================================

/**
 * Event emitted when text is streamed from the agent.
 */
export interface TextEvent {
  type: "text";
  text: string;
}

/**
 * Event emitted when a step starts.
 */
export interface StepStartEvent {
  type: "step-start";
  stepNumber: number;
}

/**
 * Event emitted when a step finishes.
 */
export interface StepFinishEvent {
  type: "step-finish";
  stepNumber: number;
  toolCalls: Array<{
    toolName: string;
    args: unknown;
    result: unknown;
  }>;
}

/**
 * Event emitted when a tool is called.
 */
export interface ToolCallEvent {
  type: "tool-call";
  toolName: string;
  toolCallId: string;
  args: unknown;
}

/**
 * Event emitted when a tool returns a result.
 */
export interface ToolResultEvent {
  type: "tool-result";
  toolName: string;
  toolCallId: string;
  result: unknown;
}

/**
 * Event emitted when the todo list changes.
 */
export interface TodosChangedEvent {
  type: "todos-changed";
  todos: TodoItem[];
}

/**
 * Event emitted when a file write starts (for preview).
 */
export interface FileWriteStartEvent {
  type: "file-write-start";
  path: string;
  content: string;
}

/**
 * Event emitted when a file is written.
 */
export interface FileWrittenEvent {
  type: "file-written";
  path: string;
  content: string;
}

/**
 * Event emitted when a file is edited.
 */
export interface FileEditedEvent {
  type: "file-edited";
  path: string;
  occurrences: number;
}

/**
 * Event emitted when a subagent starts.
 */
export interface SubagentStartEvent {
  type: "subagent-start";
  name: string;
  task: string;
}

/**
 * Event emitted when a subagent finishes.
 */
export interface SubagentFinishEvent {
  type: "subagent-finish";
  name: string;
  result: string;
}

/**
 * Event emitted when the agent is done.
 */
export interface DoneEvent {
  type: "done";
  state: DeepAgentState;
  text?: string;
  /** Updated conversation history including the assistant's response */
  messages?: ModelMessage[];
}

/**
 * Event emitted when an error occurs.
 */
export interface ErrorEvent {
  type: "error";
  error: Error;
}

/**
 * Union type of all possible Deep Agent events.
 */
export type DeepAgentEvent =
  | TextEvent
  | StepStartEvent
  | StepFinishEvent
  | ToolCallEvent
  | ToolResultEvent
  | TodosChangedEvent
  | FileWriteStartEvent
  | FileWrittenEvent
  | FileEditedEvent
  | SubagentStartEvent
  | SubagentFinishEvent
  | DoneEvent
  | ErrorEvent;

/**
 * Callback function for handling Deep Agent events.
 */
export type EventCallback = (event: DeepAgentEvent) => void;

/**
 * Context passed to tools for emitting events.
 */
export interface ToolEventContext {
  emit: EventCallback;
}

/**
 * Options for streamWithEvents method.
 */
export interface StreamWithEventsOptions {
  /** The user's prompt/message */
  prompt: string;
  /** Maximum number of steps for the agent loop */
  maxSteps?: number;
  /** Shared state for todos and files */
  state?: DeepAgentState;
  /** Conversation history for multi-turn conversations */
  messages?: ModelMessage[];
  /** Signal to abort the generation */
  abortSignal?: AbortSignal;
}

