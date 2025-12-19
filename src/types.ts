/**
 * Shared type definitions for AI SDK Deep Agent.
 */

import type {
  ToolSet,
  ModelMessage,
  LanguageModel,
  LanguageModelMiddleware,
  ToolLoopAgent,
  StopCondition,
  ToolLoopAgentSettings,
} from "ai";
import type { BaseCheckpointSaver, ResumeOptions } from "./checkpointer/types";
import type { z } from "zod";

// Re-export for convenience
export type { ModelMessage, LanguageModel };

/**
 * Configuration options for agent memory middleware.
 */
export interface AgentMemoryOptions {
  /**
   * Unique identifier for the agent (e.g., "code-architect", "research-agent").
   * Used to locate agent-specific memory at ~/.deepagents/{agentId}/agent.md
   */
  agentId: string;

  /**
   * Optional working directory for project-level memory detection.
   * Defaults to process.cwd().
   */
  workingDirectory?: string;

  /**
   * Optional custom path for user-level .deepagents directory.
   * Defaults to os.homedir() + '/.deepagents'.
   *
   * Useful for testing or custom deployment environments.
   */
  userDeepagentsDir?: string;

  /**
   * Optional callback to request user approval for creating project-level .deepagents/ directory.
   * If not provided, project memory will be silently skipped if directory doesn't exist.
   *
   * @param projectPath - Absolute path to the detected git root
   * @returns Promise<boolean> - true if user approves, false otherwise
   */
  requestProjectApproval?: (projectPath: string) => Promise<boolean>;
}

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

// ============================================================================
// ToolLoopAgent Passthrough Types
// ============================================================================

/**
 * Tool choice type for prepareStep. More permissive than AI SDK's generic version
 * to allow specifying tool names as strings (e.g., for built-in tools like 'write_todos').
 */
export type DeepAgentToolChoice =
  | "auto"
  | "none"
  | "required"
  | { type: "tool"; toolName: string };

/**
 * Result from prepareStep callback. More permissive version that allows
 * toolName to be any string rather than requiring exact tool name inference.
 */
export interface PrepareStepResult {
  toolChoice?: DeepAgentToolChoice;
  model?: LanguageModel;
  // Allow additional properties from ToolLoopAgentSettings
  [key: string]: unknown;
}

/**
 * Arguments passed to prepareStep callback.
 */
export interface PrepareStepArgs {
  stepNumber: number;
  steps: unknown[];
  model: LanguageModel;
  messages: ModelMessage[];
  experimental_context?: unknown;
}

/**
 * Prepare step function type with permissive tool choice typing.
 */
export type PrepareStepFunction = (
  args: PrepareStepArgs
) => PrepareStepResult | PromiseLike<PrepareStepResult>;

/**
 * Loop control callbacks for agent iteration.
 *
 * These callbacks allow customization of agent behavior during execution.
 * User callbacks execute BEFORE DeepAgent's internal logic (checkpointing, events).
 *
 * @see https://v6.ai-sdk.dev/docs/agents/loop-control
 */
export interface LoopControlOptions {
  /**
   * Called before each step to dynamically adjust settings.
   *
   * Use cases:
   * - Dynamic model switching based on step complexity
   * - Tool availability control at different phases
   * - Message transformation before sending to model
   *
   * @example Force planning tool on first step
   * ```typescript
   * prepareStep: ({ stepNumber }) => {
   *   if (stepNumber === 0) {
   *     return { toolChoice: { type: 'tool', toolName: 'write_todos' } };
   *   }
   *   return {}; // Use defaults
   * }
   * ```
   */
  prepareStep?: PrepareStepFunction;

  /**
   * Called after each step finishes.
   *
   * Your callback runs BEFORE DeepAgent's internal checkpointing and event emission.
   * Errors in your callback are caught and logged, but don't break checkpointing.
   *
   * @example Log step progress
   * ```typescript
   * onStepFinish: (stepResult) => {
   *   console.log(`Step completed with ${stepResult.toolCalls.length} tool calls`);
   * }
   * ```
   */
  onStepFinish?: ToolLoopAgentSettings['onStepFinish'];

  /**
   * Called when all steps are finished.
   *
   * Receives aggregated information about the entire run including all steps
   * and total token usage.
   *
   * @example Log total usage
   * ```typescript
   * onFinish: (event) => {
   *   console.log(`Completed in ${event.steps.length} steps`);
   *   console.log(`Total tokens: ${event.totalUsage.totalTokens}`);
   * }
   * ```
   */
  onFinish?: ToolLoopAgentSettings['onFinish'];

  /**
   * Custom stop conditions (composed with maxSteps safety limit).
   *
   * When provided, agent stops if ANY condition is met (OR logic):
   * - Your custom condition(s) return true, OR
   * - maxSteps limit is reached
   *
   * @example Stop when specific tool is called
   * ```typescript
   * import { hasToolCall } from 'ai';
   *
   * stopWhen: hasToolCall('submit_final_answer')
   * ```
   *
   * @example Multiple conditions
   * ```typescript
   * stopWhen: [
   *   hasToolCall('done'),
   *   ({ steps }) => steps.some(s => s.text.includes('[COMPLETE]'))
   * ]
   * ```
   */
  stopWhen?: StopCondition<ToolSet> | StopCondition<ToolSet>[];
}

/**
 * Sampling and generation parameters for model calls.
 *
 * These are passed directly to the ToolLoopAgent and affect how the model
 * generates responses. Safe for direct passthrough with no conflicts.
 */
export interface GenerationOptions {
  /**
   * Sampling temperature (0-2). Higher = more creative, lower = more focused.
   * Recommended to set either temperature or topP, not both.
   */
  temperature?: number;

  /**
   * Nucleus sampling (0-1). Only tokens with cumulative probability <= topP are considered.
   * Recommended to set either temperature or topP, not both.
   */
  topP?: number;

  /**
   * Top-K sampling. Only the top K tokens are considered for each step.
   */
  topK?: number;

  /**
   * Maximum number of tokens to generate per response.
   */
  maxOutputTokens?: number;

  /**
   * Presence penalty (-1 to 1). Positive values reduce repetition of topics.
   */
  presencePenalty?: number;

  /**
   * Frequency penalty (-1 to 1). Positive values reduce repetition of exact phrases.
   */
  frequencyPenalty?: number;

  /**
   * Random seed for deterministic generation (if supported by model).
   */
  seed?: number;

  /**
   * Sequences that stop generation when encountered.
   */
  stopSequences?: string[];

  /**
   * Maximum number of retries for failed API calls (default: 2).
   */
  maxRetries?: number;
}

/**
 * Advanced options for power users.
 *
 * These options provide access to experimental and provider-specific features.
 * Use with caution - some may affect DeepAgent's behavior.
 */
export interface AdvancedAgentOptions {
  /**
   * OpenTelemetry configuration for observability.
   *
   * @example Enable telemetry
   * ```typescript
   * experimental_telemetry: { isEnabled: true }
   * ```
   */
  experimental_telemetry?: ToolLoopAgentSettings['experimental_telemetry'];

  /**
   * Provider-specific options passed through to the model provider.
   *
   * @example Anthropic prompt caching
   * ```typescript
   * providerOptions: {
   *   anthropic: { cacheControl: { type: 'ephemeral' } }
   * }
   * ```
   */
  providerOptions?: ToolLoopAgentSettings['providerOptions'];

  /**
   * Custom context passed to tool executions.
   *
   * WARNING: Experimental - may change in patch releases.
   */
  experimental_context?: ToolLoopAgentSettings['experimental_context'];

  /**
   * Control which tool the model should call.
   *
   * Options:
   * - 'auto' (default): Model decides
   * - 'none': No tool calls
   * - 'required': Must call a tool
   * - { type: 'tool', toolName: string }: Must call specific tool
   */
  toolChoice?: ToolLoopAgentSettings['toolChoice'];

  /**
   * Limit which tools are available for the model to call.
   *
   * @example Only allow read operations
   * ```typescript
   * activeTools: ['read_file', 'ls', 'grep', 'glob']
   * ```
   */
  activeTools?: string[];
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
  /**
   * Optional interrupt configuration for this subagent.
   * If not provided, uses the parent agent's interruptOn config.
   */
  interruptOn?: InterruptOnConfig;

  /**
   * Optional structured output configuration for this subagent.
   * When provided, the subagent returns typed, validated output to the parent agent.
   *
   * @example
   * ```typescript
   * {
   *   name: 'research-agent',
   *   description: 'Research specialist',
   *   systemPrompt: 'You conduct thorough research...',
   *   output: {
   *     schema: z.object({
   *       summary: z.string(),
   *       sources: z.array(z.string()),
   *       confidence: z.number(),
   *     }),
   *     description: 'Research findings with sources',
   *   },
   * }
   * ```
   */
  output?: {
    /** Zod schema defining the expected output structure */
    schema: z.ZodType<any>;
    /** Optional description of the output format */
    description?: string;
  };

  /**
   * Advanced AI SDK ToolLoopAgent passthrough options for generation parameters.
   * These options control the LLM's text generation behavior for this subagent.
   * Note: Loop control options are not available for subagents as they are managed by the parent.
   */
  generationOptions?: GenerationOptions;

  /**
   * Advanced AI SDK ToolLoopAgent passthrough options for advanced agent features.
   * These options provide access to experimental and advanced AI SDK features for this subagent.
   */
  advancedOptions?: AdvancedAgentOptions;
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
 * Configuration for dynamic tool approval.
 */
export interface DynamicApprovalConfig {
  /**
   * Function to determine if approval is needed based on tool arguments.
   * Return true to require approval, false to auto-approve.
   */
  shouldApprove?: (args: unknown) => boolean | Promise<boolean>;
}

/**
 * Configuration for human-in-the-loop tool approval.
 * Maps tool names to approval configurations.
 * 
 * - `true`: Always require approval
 * - `false`: Never require approval (same as not including)
 * - `DynamicApprovalConfig`: Dynamic approval based on arguments
 * 
 * @example
 * ```typescript
 * interruptOn: {
 *   execute: true,  // Always require approval
 *   write_file: true,
 *   edit_file: { shouldApprove: (args) => !args.file_path.startsWith('/tmp/') },
 * }
 * ```
 */
export type InterruptOnConfig = Record<string, boolean | DynamicApprovalConfig>;

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
   * Optional middleware to wrap the model for logging, caching, RAG, guardrails, etc.
   * Uses AI SDK's wrapLanguageModel under the hood.
   *
   * @example Single middleware
   * ```typescript
   * middleware: loggingMiddleware
   * ```
   *
   * @example Multiple middlewares (applied in order: first transforms input, last wraps model)
   * ```typescript
   * middleware: [loggingMiddleware, cachingMiddleware, ragMiddleware]
   * ```
   */
  middleware?: LanguageModelMiddleware | LanguageModelMiddleware[];

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
  
  /**
   * Configuration for human-in-the-loop tool approval.
   * 
   * Maps tool names to approval configurations. When a tool requires approval,
   * the agent will pause and emit an `approval-requested` event before execution.
   * 
   * @example
   * ```typescript
   * interruptOn: {
   *   execute: true,        // Always require approval
   *   write_file: true,     // Always require approval
   *   edit_file: {          // Dynamic approval
   *     shouldApprove: (args) => !args.file_path.startsWith('/tmp/')
   *   },
   * }
   * ```
   */
  interruptOn?: InterruptOnConfig;
  
  /**
   * Optional checkpointer for persisting agent state between invocations.
   * 
   * When provided, the agent automatically saves checkpoints after each step.
   * Use with `threadId` in streamWithEvents to enable conversation persistence.
   * 
   * @example
   * ```typescript
   * import { MemorySaver } from 'ai-sdk-deep-agent';
   *
   * const agent = createDeepAgent({
   *   model: anthropic('claude-sonnet-4-20250514'),
   *   checkpointer: new MemorySaver(),
   * });
   * ```
   */
  checkpointer?: BaseCheckpointSaver;

  /**
   * Optional directory to load skills from.
   * Skills are SKILL.md files with YAML frontmatter in subdirectories.
   *
   * User-level: ~/.deepagents/skills/
   * Project-level: ./.deepagents/skills/
   *
   * Project skills override user skills with the same name.
   *
   * @deprecated Use `agentId` instead for automatic directory resolution
   *
   * @example
   * ```typescript
   * skillsDir: './skills'
   * ```
   */
  skillsDir?: string;

  /**
   * Optional agent identifier for loading agent-specific memory and skills.
   *
   * When provided, the agent will:
   * - Load agent memory from ~/.deepagents/{agentId}/agent.md (user-level)
   * - Load agent memory from [git-root]/.deepagents/agent.md (project-level)
   * - Load skills from ~/.deepagents/{agentId}/skills/ (user-level)
   * - Load skills from [git-root]/.deepagents/skills/ (project-level, shared)
   *
   * This enables persistent memory and skill libraries organized by agent identity.
   *
   * @example
   * ```typescript
   * const agent = createDeepAgent({
   *   model: anthropic('claude-sonnet-4-20250514'),
   *   agentId: 'code-architect',
   *   // Skills and memory auto-loaded from .deepagents/code-architect/
   * });
   * ```
   */
  agentId?: string;

  /**
   * Optional configuration for structured output parsing.
   *
   * When provided, the agent's final output will be parsed and validated against the schema
   * using ToolLoopAgent's native output parsing feature.
   *
   * @see https://v6.ai-sdk.dev/docs/reference/ai-sdk-core/tool-loop-agent#agent-with-output-parsing
   *
   * @example Basic usage
   * ```typescript
   * const agent = createDeepAgent({
   *   model: anthropic('claude-sonnet-4-20250514'),
   *   output: {
   *     schema: z.object({
   *       sentiment: z.enum(['positive', 'negative', 'neutral']),
   *       score: z.number(),
   *       summary: z.string(),
   *     }),
   *   },
   * });
   * ```
   *
   * @example With description
   * ```typescript
   * const agent = createDeepAgent({
   *   model: anthropic('claude-sonnet-4-20250514'),
   *   output: {
   *     schema: z.object({
   *       findings: z.array(z.string()),
   *       confidence: z.number().min(0).max(1),
   *     }),
   *     description: 'Research findings with confidence score',
   *   },
   * });
   * ```
   */
  output?: {
    /** Zod schema defining the expected output structure */
    schema: z.ZodType<any>;
    /** Optional description of the output format (helps LLM understand structure) */
    description?: string;
  };

  /**
   * Advanced AI SDK ToolLoopAgent passthrough options for loop control.
   * These options provide fine-grained control over the agent execution loop.
   */
  loopControl?: LoopControlOptions;

  /**
   * Advanced AI SDK ToolLoopAgent passthrough options for generation parameters.
   * These options control the LLM's text generation behavior.
   */
  generationOptions?: GenerationOptions;

  /**
   * Advanced AI SDK ToolLoopAgent passthrough options for advanced agent features.
   * These options provide access to experimental and advanced AI SDK features.
   */
  advancedOptions?: AdvancedAgentOptions;
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
  /** The user's prompt/message */
  prompt?: string;  // Make optional for resume-only calls
  /** Maximum number of steps for the agent loop */
  maxSteps?: number;
  /** Shared state for todos and files */
  state?: DeepAgentState;
  /** Conversation history for multi-turn conversations */
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

