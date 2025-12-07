/**
 * Shared type definitions for AI SDK Deep Agent.
 */

import type { ToolSet, ModelMessage, LanguageModel } from "ai";

// Re-export for convenience
export type { ModelMessage, LanguageModel };

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
 *
 * Subagents are specialized agents that can be spawned by the main agent to handle
 * specific tasks. They share the filesystem with the parent agent but have independent
 * todo lists and conversation history.
 *
 * @example Basic subagent
 * ```typescript
 * const researchAgent: SubAgent = {
 *   name: 'research-agent',
 *   description: 'Specialized for deep research tasks',
 *   systemPrompt: 'You are a research specialist. Conduct thorough research...',
 * };
 * ```
 *
 * @example Subagent with custom model
 * ```typescript
 * const fastAgent: SubAgent = {
 *   name: 'fast-agent',
 *   description: 'Quick tasks using a faster model',
 *   systemPrompt: 'You handle quick tasks efficiently...',
 *   model: anthropic('claude-haiku-4-5-20251001'), // Use faster/cheaper model
 * };
 * ```
 *
 * @example Subagent with custom tools
 * ```typescript
 * const apiAgent: SubAgent = {
 *   name: 'api-agent',
 *   description: 'Handles API calls',
 *   systemPrompt: 'You make API requests...',
 *   tools: {
 *     fetch_api: myApiTool,
 *   },
 * };
 * ```
 */
export interface SubAgent {
  /** 
   * Unique name identifier for the subagent. Used when the main agent delegates tasks.
   * Should be descriptive (e.g., 'research-agent', 'writer-agent').
   */
  name: string;
  /** 
   * Description shown to the main agent when deciding which subagent to use.
   * Should clearly explain when this subagent should be used.
   */
  description: string;
  /** 
   * System prompt that defines the subagent's behavior and instructions.
   * This is separate from the main agent's system prompt.
   */
  systemPrompt: string;
  /** 
   * Optional custom tools available only to this subagent.
   * If not provided, the subagent uses the same tools as the main agent.
   */
  tools?: ToolSet;
  /** 
   * Optional model override for this subagent.
   * If not provided, the subagent uses the same model as the main agent.
   * Useful for using faster/cheaper models for specific tasks.
   */
  model?: LanguageModel;
}

/**
 * Summarization configuration options for automatic conversation summarization.
 *
 * When enabled, the agent automatically summarizes older conversation messages when
 * the conversation approaches token limits. This helps maintain context in long-running
 * conversations without exceeding model context windows.
 *
 * @example Basic summarization
 * ```typescript
 * const agent = createDeepAgent({
 *   model: anthropic('claude-sonnet-4-20250514'),
 *   summarization: {
 *     enabled: true,
 *   },
 * });
 * ```
 *
 * @example Custom summarization settings
 * ```typescript
 * const agent = createDeepAgent({
 *   model: anthropic('claude-sonnet-4-20250514'),
 *   summarization: {
 *     enabled: true,
 *     tokenThreshold: 150000, // Summarize earlier
 *     keepMessages: 10, // Keep more recent messages
 *     model: anthropic('claude-haiku-4-5-20251001'), // Use faster model for summarization
 *   },
 * });
 * ```
 */
export interface SummarizationConfig {
  /** 
   * Enable automatic summarization when approaching token limits.
   * When true, older messages are automatically summarized to save tokens.
   */
  enabled: boolean;
  /** 
   * Token threshold to trigger summarization (default: 170000).
   * When the conversation exceeds this token count, summarization is triggered.
   */
  tokenThreshold?: number;
  /** 
   * Number of recent messages to keep intact without summarization (default: 6).
   * These messages preserve full context for the most recent conversation.
   */
  keepMessages?: number;
  /** 
   * Model to use for summarization (AI SDK LanguageModel instance).
   * Defaults to the main agent model. Can use a faster/cheaper model for cost savings.
   */
  model?: LanguageModel;
}

/**
 * Configuration parameters for creating a Deep Agent.
 *
 * @see {@link createDeepAgent} for usage examples and detailed documentation.
 */
export interface CreateDeepAgentParams {
  /** 
   * **Required.** The AI SDK LanguageModel instance to use.
   * 
   * Examples:
   * - `anthropic('claude-sonnet-4-20250514')` - Anthropic Claude
   * - `openai('gpt-4o')` - OpenAI GPT-4
   * - `azure('gpt-4', { apiKey, resourceName })` - Azure OpenAI
   * 
   * @see {@link LanguageModel} from '@ai-sdk/core' for more details
   */
  model: LanguageModel;
  
  /** 
   * Optional custom tools the agent should have access to.
   * 
   * These tools are available alongside built-in tools (todos, filesystem, subagents).
   * Use AI SDK's `tool()` function to create tools.
   * 
   * @example
   * ```typescript
   * import { tool } from 'ai';
   * import { z } from 'zod';
   * 
   * tools: {
   *   get_time: tool({
   *     description: 'Get current time',
   *     inputSchema: z.object({}),
   *     execute: async () => new Date().toISOString(),
   *   }),
   * }
   * ```
   * 
   * @see {@link ToolSet} from 'ai' for type definition
   */
  tools?: ToolSet;
  
  /** 
   * Optional custom system prompt for the agent.
   * 
   * This is prepended to the base system prompts for todos, filesystem, and subagents.
   * Use this to customize the agent's behavior and instructions.
   */
  systemPrompt?: string;
  
  /** 
   * Optional list of subagent specifications for task delegation.
   * 
   * Subagents are specialized agents that can be spawned by the main agent.
   * They share the filesystem but have independent todo lists and conversation history.
   * 
   * @see {@link SubAgent} for detailed subagent configuration
   */
  subagents?: SubAgent[];
  
  /** 
   * Optional backend for filesystem operations.
   * 
   * Can be either:
   * - A `BackendProtocol` instance (e.g., `new FilesystemBackend({ rootDir: './workspace' })`)
   * - A `BackendFactory` function that creates a backend from state
   * 
   * Default: `StateBackend` (in-memory, ephemeral storage)
   * 
   * @see {@link BackendProtocol} for interface details
   * @see {@link BackendFactory} for factory function type
   */
  backend?: BackendProtocol | BackendFactory;
  
  /** 
   * Optional maximum number of steps for the agent loop (default: 100).
   * 
   * Each step represents one tool-calling iteration. Set lower for faster responses
   * or higher for more complex tasks.
   */
  maxSteps?: number;
  
  /** 
   * Optional flag to include the general-purpose subagent (default: true).
   * 
   * When true, the agent can spawn a general-purpose subagent for tasks that don't
   * match any specialized subagents. Set to false to only use specialized subagents.
   */
  includeGeneralPurposeAgent?: boolean;
  
  /** 
   * Optional token limit before evicting large tool results to filesystem (default: disabled).
   * 
   * When a tool result exceeds this token count, it's automatically saved to a file
   * and replaced with a file reference. This prevents context overflow in long agent loops.
   * 
   * Example: `toolResultEvictionLimit: 20000` evicts results over 20k tokens.
   */
  toolResultEvictionLimit?: number;
  
  /** 
   * Optional flag to enable prompt caching for improved performance (Anthropic only, default: false).
   * 
   * When enabled, the system prompt is cached using Anthropic's prompt caching feature,
   * reducing latency and costs for subsequent requests with the same prompt.
   * 
   * Only works with Anthropic models.
   */
  enablePromptCaching?: boolean;
  
  /** 
   * Optional summarization configuration for automatic conversation summarization.
   * 
   * When enabled, older conversation messages are automatically summarized when
   * approaching token limits, maintaining context in long-running conversations.
   * 
   * @see {@link SummarizationConfig} for detailed configuration options
   */
  summarization?: SummarizationConfig;
}

/**
 * Protocol for pluggable memory backends.
 *
 * Backends define how files are stored and retrieved by the agent. Different backends
 * provide different persistence strategies:
 *
 * - **StateBackend**: In-memory storage (default, ephemeral)
 * - **FilesystemBackend**: Persists files to actual disk
 * - **PersistentBackend**: Cross-conversation memory with key-value store
 * - **CompositeBackend**: Combines multiple backends
 *
 * You can implement this interface to create custom storage backends (e.g., cloud storage,
 * databases, etc.).
 *
 * @example StateBackend - In-memory ephemeral storage (default)
 * ```typescript
 * import { StateBackend } from 'ai-sdk-deep-agent';
 *
 * const state = { todos: [], files: {} };
 * const agent = createDeepAgent({
 *   model: anthropic('claude-sonnet-4-20250514'),
 *   backend: new StateBackend(state), // Files only persist during agent invocation
 * });
 * ```
 *
 * @example FilesystemBackend - Persist files to disk
 * ```typescript
 * import { FilesystemBackend } from 'ai-sdk-deep-agent';
 *
 * const agent = createDeepAgent({
 *   model: anthropic('claude-sonnet-4-20250514'),
 *   backend: new FilesystemBackend({ rootDir: './workspace' }), // Files saved to disk
 * });
 * ```
 *
 * @example PersistentBackend - Cross-conversation persistence with key-value store
 * ```typescript
 * import { PersistentBackend, InMemoryStore } from 'ai-sdk-deep-agent';
 *
 * const store = new InMemoryStore(); // Or use Redis, SQLite, etc.
 * const agent = createDeepAgent({
 *   model: anthropic('claude-sonnet-4-20250514'),
 *   backend: new PersistentBackend({ 
 *     store,
 *     namespace: 'project-123' // Isolate files by project
 *   }), // Files persist across agent sessions
 * });
 * ```
 *
 * @example CompositeBackend - Route files to different backends by path
 * ```typescript
 * import { CompositeBackend, FilesystemBackend, StateBackend } from 'ai-sdk-deep-agent';
 *
 * const state = { todos: [], files: {} };
 * const agent = createDeepAgent({
 *   model: anthropic('claude-sonnet-4-20250514'),
 *   backend: new CompositeBackend(
 *     new StateBackend(state), // Default: ephemeral
 *     {
 *       '/persistent/': new FilesystemBackend({ rootDir: './persistent' }),
 *       '/cache/': new StateBackend(state),
 *     }
 *   ), // Files under /persistent/ are saved to disk, others are ephemeral
 * });
 * ```
 *
 * @example Custom backend implementation
 * ```typescript
 * class CloudBackend implements BackendProtocol {
 *   async write(filePath: string, content: string): Promise<WriteResult> {
 *     // Upload to cloud storage
 *     await uploadToCloud(filePath, content);
 *     return { path: filePath };
 *   }
 *   // ... implement other methods (read, edit, lsInfo, grepRaw, globInfo)
 * }
 * ```
 */
export interface BackendProtocol {
  /**
   * Structured listing with file metadata.
   * @param path - Directory path to list (use '.' for root)
   * @returns Array of file information objects
   */
  lsInfo(path: string): FileInfo[] | Promise<FileInfo[]>;

  /**
   * Read file content with line numbers or an error string.
   * @param filePath - Path to the file to read
   * @param offset - Optional line number to start reading from (1-indexed)
   * @param limit - Optional maximum number of lines to read
   * @returns Formatted file content with line numbers, or error string
   */
  read(
    filePath: string,
    offset?: number,
    limit?: number
  ): string | Promise<string>;

  /**
   * Read file content as raw FileData.
   * @param filePath - Path to the file to read
   * @returns FileData object with content lines and metadata
   */
  readRaw(filePath: string): FileData | Promise<FileData>;

  /**
   * Structured search results or error string for invalid input.
   * @param pattern - Regular expression pattern to search for
   * @param path - Optional directory path to search in (null = all files)
   * @param glob - Optional glob pattern to filter files (e.g., '*.ts')
   * @returns Array of grep matches or error string
   */
  grepRaw(
    pattern: string,
    path?: string | null,
    glob?: string | null
  ): GrepMatch[] | string | Promise<GrepMatch[] | string>;

  /**
   * Structured glob matching returning FileInfo objects.
   * @param pattern - Glob pattern (e.g., '*.ts', 'src/**\/*.ts')
   * @param path - Optional base directory path
   * @returns Array of matching file information objects
   */
  globInfo(pattern: string, path?: string): FileInfo[] | Promise<FileInfo[]>;

  /**
   * Create a new file or overwrite existing file.
   * @param filePath - Path where the file should be created
   * @param content - File content as a string
   * @returns WriteResult with path on success, or error message on failure
   */
  write(filePath: string, content: string): WriteResult | Promise<WriteResult>;

  /**
   * Edit a file by replacing string occurrences.
   * @param filePath - Path to the file to edit
   * @param oldString - String to find and replace
   * @param newString - Replacement string
   * @param replaceAll - If true, replace all occurrences; if false, replace only first
   * @returns EditResult with occurrences count on success, or error message on failure
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
 *
 * This allows backends to be created dynamically based on the current agent state.
 * Useful when you need state-dependent backend behavior or want to share state
 * between the backend and agent.
 *
 * @param state - The current DeepAgentState containing todos and files
 * @returns A BackendProtocol instance
 *
 * @example State-dependent backend selection
 * ```typescript
 * import { FilesystemBackend, StateBackend } from 'ai-sdk-deep-agent';
 *
 * const backendFactory: BackendFactory = (state) => {
 *   // Use filesystem for large projects, memory for small ones
 *   if (state.todos.length > 10 || Object.keys(state.files).length > 5) {
 *     return new FilesystemBackend({ rootDir: './large-workspace' });
 *   }
 *   return new StateBackend(state);
 * };
 *
 * const agent = createDeepAgent({
 *   model: anthropic('claude-sonnet-4-20250514'),
 *   backend: backendFactory,
 * });
 * ```
 *
 * @example Shared state backend
 * ```typescript
 * import { StateBackend } from 'ai-sdk-deep-agent';
 *
 * // Backend factory that shares state with agent
 * const backendFactory: BackendFactory = (state) => {
 *   return new StateBackend(state); // Backend uses the same state object
 * };
 *
 * const agent = createDeepAgent({
 *   model: anthropic('claude-sonnet-4-20250514'),
 *   backend: backendFactory,
 * });
 * ```
 *
 * @example Project-based backend routing
 * ```typescript
 * import { FilesystemBackend, PersistentBackend, InMemoryStore } from 'ai-sdk-deep-agent';
 *
 * const backendFactory: BackendFactory = (state) => {
 *   // Check if there's a project identifier in files
 *   const projectFile = state.files['/.project'];
 *   if (projectFile) {
 *     const projectId = projectFile.content.join('').trim();
 *     return new PersistentBackend({
 *       store: myKeyValueStore,
 *       namespace: `project-${projectId}`,
 *     });
 *   }
 *   // Default to filesystem
 *   return new FilesystemBackend({ rootDir: './default-workspace' });
 * };
 *
 * const agent = createDeepAgent({
 *   model: anthropic('claude-sonnet-4-20250514'),
 *   backend: backendFactory,
 * });
 * ```
 */
export type BackendFactory = (state: DeepAgentState) => BackendProtocol;

// ============================================================================
// Sandbox Backend Protocol
// ============================================================================

/**
 * Result of command execution in a sandbox.
 *
 * This is the return type for the `execute()` method on sandbox backends.
 * It provides a simplified interface optimized for LLM consumption.
 *
 * @example Success case
 * ```typescript
 * const result: ExecuteResponse = {
 *   output: "Hello, world!\n",
 *   exitCode: 0,
 *   truncated: false,
 * };
 * ```
 *
 * @example Error case
 * ```typescript
 * const result: ExecuteResponse = {
 *   output: "bash: command not found: foo\n",
 *   exitCode: 127,
 *   truncated: false,
 * };
 * ```
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
 *
 * Extends BackendProtocol with the ability to execute shell commands
 * in an isolated environment (container, VM, or local process).
 *
 * Sandbox backends are useful for:
 * - Running code in isolated environments
 * - Executing build/test commands
 * - Interacting with external tools and CLIs
 *
 * @example Using LocalSandbox for local development
 * ```typescript
 * import { LocalSandbox } from 'ai-sdk-deep-agent';
 *
 * const sandbox = new LocalSandbox({ cwd: './workspace' });
 *
 * // Execute a command
 * const result = await sandbox.execute('npm install');
 * console.log(result.output);
 * console.log('Exit code:', result.exitCode);
 *
 * // File operations work the same as other backends
 * await sandbox.write('/src/index.ts', 'console.log("hello")');
 * const content = await sandbox.read('/src/index.ts');
 * ```
 *
 * @example Using with DeepAgent (future Execute Tool)
 * ```typescript
 * const agent = createDeepAgent({
 *   model: anthropic('claude-sonnet-4-20250514'),
 *   backend: new LocalSandbox({ cwd: './workspace' }),
 *   // Execute tool will be added automatically when backend is SandboxBackendProtocol
 * });
 * ```
 */
export interface SandboxBackendProtocol extends BackendProtocol {
  /**
   * Execute a shell command in the sandbox.
   *
   * @param command - Full shell command string to execute (e.g., "npm install", "ls -la")
   * @returns ExecuteResponse with combined output, exit code, and truncation status
   *
   * @example
   * ```typescript
   * const result = await sandbox.execute('echo "Hello" && ls -la');
   * if (result.exitCode === 0) {
   *   console.log('Success:', result.output);
   * } else {
   *   console.log('Failed:', result.output);
   * }
   * ```
   */
  execute(command: string): Promise<ExecuteResponse>;

  /**
   * Unique identifier for this sandbox instance.
   *
   * Used for tracking, debugging, and correlating logs across
   * multiple sandbox operations.
   *
   * @example
   * ```typescript
   * console.log(`Running in sandbox: ${sandbox.id}`);
   * // Output: "Running in sandbox: local-1701234567890-abc123"
   * ```
   */
  readonly id: string;
}

/**
 * Type guard to check if a backend is a SandboxBackendProtocol.
 *
 * @param backend - The backend to check
 * @returns True if the backend supports command execution
 *
 * @example
 * ```typescript
 * if (isSandboxBackend(backend)) {
 *   const result = await backend.execute('ls -la');
 * }
 * ```
 */
export function isSandboxBackend(
  backend: BackendProtocol
): backend is SandboxBackendProtocol {
  return (
    typeof (backend as SandboxBackendProtocol).execute === "function" &&
    typeof (backend as SandboxBackendProtocol).id === "string"
  );
}

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
  | FileReadEvent
  | LsEvent
  | GlobEvent
  | GrepEvent
  | ExecuteStartEvent
  | ExecuteFinishEvent
  | SubagentStartEvent
  | SubagentFinishEvent
  | TextSegmentEvent
  | UserMessageEvent
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

