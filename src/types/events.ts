import type { TodoItem } from "./core.js";
import type { DeepAgentState } from "./backend.js";
import type { ModelMessage } from "ai";
import type { ResumeOptions } from "../checkpointer/types.js";

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
  isError?: boolean;
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
 * Event emitted when a file is read.
 */
export interface FileReadEvent {
  type: "file-read";
  path: string;
  /** Number of lines read */
  lines: number;
}

/**
 * Event emitted when listing directory contents.
 */
export interface LsEvent {
  type: "ls";
  path: string;
  /** Number of items found */
  count: number;
}

/**
 * Event emitted when searching with glob pattern.
 */
export interface GlobEvent {
  type: "glob";
  pattern: string;
  /** Number of files found */
  count: number;
}

/**
 * Event emitted when searching with grep.
 */
export interface GrepEvent {
  type: "grep";
  pattern: string;
  /** Number of matches found */
  count: number;
}

/**
 * Event emitted when a command execution starts.
 */
export interface ExecuteStartEvent {
  type: "execute-start";
  /** The command being executed */
  command: string;
  /** The sandbox ID where the command is running */
  sandboxId: string;
}

/**
 * Event emitted when a command execution finishes.
 */
export interface ExecuteFinishEvent {
  type: "execute-finish";
  /** The command that was executed */
  command: string;
  /** Exit code (0 = success, non-zero = failure, null = unknown/timeout) */
  exitCode: number | null;
  /** Whether the output was truncated */
  truncated: boolean;
  /** The sandbox ID where the command ran */
  sandboxId: string;
}

/**
 * Event emitted when a web search starts.
 */
export interface WebSearchStartEvent {
  type: "web-search-start";
  /** The search query */
  query: string;
}

/**
 * Event emitted when a web search finishes.
 */
export interface WebSearchFinishEvent {
  type: "web-search-finish";
  /** The search query */
  query: string;
  /** Number of results returned */
  resultCount: number;
}

/**
 * Event emitted when an HTTP request starts.
 */
export interface HttpRequestStartEvent {
  type: "http-request-start";
  /** The request URL */
  url: string;
  /** HTTP method (GET, POST, etc.) */
  method: string;
}

/**
 * Event emitted when an HTTP request finishes.
 */
export interface HttpRequestFinishEvent {
  type: "http-request-finish";
  /** The request URL */
  url: string;
  /** HTTP status code */
  statusCode: number;
}

/**
 * Event emitted when a URL fetch starts.
 */
export interface FetchUrlStartEvent {
  type: "fetch-url-start";
  /** The URL being fetched */
  url: string;
}

/**
 * Event emitted when a URL fetch finishes.
 */
export interface FetchUrlFinishEvent {
  type: "fetch-url-finish";
  /** The URL that was fetched */
  url: string;
  /** Whether extraction was successful */
  success: boolean;
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
 * Event emitted when a subagent completes a step with tool calls.
 */
export interface SubagentStepEvent {
  type: "subagent-step";
  stepIndex: number;
  toolCalls: Array<{
    toolName: string;
    args: any;
    result: any;
  }>;
}

/**
 * Event emitted for a segment of text (used for CLI display).
 * Text segments are flushed before tool events to maintain chronological order.
 */
export interface TextSegmentEvent {
  type: "text-segment";
  text: string;
}

/**
 * Event emitted when a user sends a message (used for CLI history).
 */
export interface UserMessageEvent {
  type: "user-message";
  content: string;
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
  /** Structured output if schema was provided (validated by Zod) */
  output?: unknown;  // Will be typed based on schema at call site
}

/**
 * Event emitted when an error occurs.
 */
export interface ErrorEvent {
  type: "error";
  error: Error;
}

/**
 * Event emitted when a tool requires approval before execution.
 */
export interface ApprovalRequestedEvent {
  type: "approval-requested";
  /** Unique ID for this approval request */
  approvalId: string;
  /** The tool call ID */
  toolCallId: string;
  /** Name of the tool requiring approval */
  toolName: string;
  /** Arguments that will be passed to the tool */
  args: unknown;
}

/**
 * Event emitted when user responds to an approval request.
 */
export interface ApprovalResponseEvent {
  type: "approval-response";
  /** The approval ID being responded to */
  approvalId: string;
  /** Whether the tool was approved */
  approved: boolean;
}

/**
 * Event emitted when a checkpoint is saved.
 */
export interface CheckpointSavedEvent {
  type: "checkpoint-saved";
  /** Thread ID */
  threadId: string;
  /** Step number */
  step: number;
}

/**
 * Event emitted when a checkpoint is loaded.
 */
export interface CheckpointLoadedEvent {
  type: "checkpoint-loaded";
  /** Thread ID */
  threadId: string;
  /** Step number from loaded checkpoint */
  step: number;
  /** Number of messages restored */
  messagesCount: number;
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
  | FileReadEvent
  | LsEvent
  | GlobEvent
  | GrepEvent
  | ExecuteStartEvent
  | ExecuteFinishEvent
  | WebSearchStartEvent
  | WebSearchFinishEvent
  | HttpRequestStartEvent
  | HttpRequestFinishEvent
  | FetchUrlStartEvent
  | FetchUrlFinishEvent
  | SubagentStartEvent
  | SubagentFinishEvent
  | SubagentStepEvent
  | TextSegmentEvent
  | UserMessageEvent
  | ApprovalRequestedEvent
  | ApprovalResponseEvent
  | CheckpointSavedEvent
  | CheckpointLoadedEvent
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
  /** @deprecated Use messages instead for better conversation context support */
  /** The user's prompt/message */
  prompt?: string;  // Make optional for resume-only calls
  /** Maximum number of steps for the agent loop */
  maxSteps?: number;
  /** Shared state for todos and files */
  state?: DeepAgentState;
  /** Conversation history for multi-turn conversations. Takes precedence over prompt. */
  messages?: ModelMessage[];
  /** Signal to abort the generation */
  abortSignal?: AbortSignal;
  /**
   * Thread ID for checkpoint persistence.
   * When provided with a checkpointer, enables:
   * - Auto-saving checkpoints after each step
   * - Loading previous conversation state on start
   * - Resume from interrupts
   */
  threadId?: string;
  /**
   * Resume options for continuing from an interrupt.
   * Use when resuming from a tool approval request.
   */
  resume?: ResumeOptions;
  /**
   * Callback to handle tool approval requests.
   * Return true to approve, false to deny.
   * If not provided, tools requiring approval will be auto-denied.
   */
  onApprovalRequest?: (request: {
    approvalId: string;
    toolCallId: string;
    toolName: string;
    args: unknown;
  }) => Promise<boolean>;
}