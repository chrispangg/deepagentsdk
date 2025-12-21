/**
 * Core agent configuration, state, and control types.
 */

import type {
  ToolSet,
  LanguageModel,
  LanguageModelMiddleware,
  StopCondition,
  ToolLoopAgentSettings,
} from "ai";
import type { z } from "zod";
import type { BaseCheckpointSaver } from "../checkpointer/types.js";
import type { BackendProtocol, BackendFactory } from "./backend.js";
import type { SubAgent, InterruptOnConfig } from "./subagent.js";

// Re-export LanguageModel for convenience
export type { LanguageModel };

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
   */
  userDeepagentsDir?: string;

  /**
   * Optional callback to request user approval for creating project-level .deepagents/ directory.
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

/**
 * Tool choice type for prepareStep.
 */
export type DeepAgentToolChoice =
  | "auto"
  | "none"
  | "required"
  | { type: "tool"; toolName: string };

/**
 * Result from prepareStep callback.
 */
export interface PrepareStepResult {
  toolChoice?: DeepAgentToolChoice;
  model?: LanguageModel;
  [key: string]: unknown;
}

/**
 * Arguments passed to prepareStep callback.
 */
export interface PrepareStepArgs {
  stepNumber: number;
  steps: unknown[];
  model: LanguageModel;
  messages: import("ai").ModelMessage[];
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
 */
export interface LoopControlOptions {
  /**
   * Called before each step to dynamically adjust settings.
   */
  prepareStep?: PrepareStepFunction;

  /**
   * Called after each step finishes.
   */
  onStepFinish?: ToolLoopAgentSettings["onStepFinish"];

  /**
   * Called when all steps are finished.
   */
  onFinish?: ToolLoopAgentSettings["onFinish"];

  /**
   * Custom stop conditions (composed with maxSteps safety limit).
   */
  stopWhen?: StopCondition<ToolSet> | StopCondition<ToolSet>[];
}

/**
 * Sampling and generation parameters for model calls.
 */
export interface GenerationOptions {
  /** Sampling temperature (0-2). */
  temperature?: number;
  /** Nucleus sampling (0-1). */
  topP?: number;
  /** Top-K sampling. */
  topK?: number;
  /** Maximum number of tokens to generate per response. */
  maxOutputTokens?: number;
  /** Presence penalty (-1 to 1). */
  presencePenalty?: number;
  /** Frequency penalty (-1 to 1). */
  frequencyPenalty?: number;
  /** Random seed for deterministic generation. */
  seed?: number;
  /** Sequences that stop generation when encountered. */
  stopSequences?: string[];
  /** Maximum number of retries for failed API calls. */
  maxRetries?: number;
}

/**
 * Advanced options for power users.
 */
export interface AdvancedAgentOptions {
  /** OpenTelemetry configuration for observability. */
  experimental_telemetry?: ToolLoopAgentSettings["experimental_telemetry"];
  /** Provider-specific options passed through to the model provider. */
  providerOptions?: ToolLoopAgentSettings["providerOptions"];
  /** Custom context passed to tool executions. */
  experimental_context?: ToolLoopAgentSettings["experimental_context"];
  /** Control which tool the model should call. */
  toolChoice?: ToolLoopAgentSettings["toolChoice"];
  /** Limit which tools are available for the model to call. */
  activeTools?: string[];
}

/**
 * Summarization configuration options.
 */
export interface SummarizationConfig {
  /** Enable automatic summarization when approaching token limits. */
  enabled: boolean;
  /** Token threshold to trigger summarization (default: 170000). */
  tokenThreshold?: number;
  /** Number of recent messages to keep intact without summarization (default: 6). */
  keepMessages?: number;
  /** Model to use for summarization. */
  model?: LanguageModel;
}

/**
 * Configuration parameters for creating a Deep Agent.
 */
export interface CreateDeepAgentParams {
  /** The AI SDK LanguageModel instance to use. */
  model: LanguageModel;
  /** Optional middleware to wrap the model. */
  middleware?: LanguageModelMiddleware | LanguageModelMiddleware[];
  /** Optional custom tools the agent should have access to. */
  tools?: ToolSet;
  /** Optional custom system prompt for the agent. */
  systemPrompt?: string;
  /** Optional list of subagent specifications for task delegation. */
  subagents?: SubAgent[];
  /** Optional backend for filesystem operations. */
  backend?: BackendProtocol | BackendFactory;
  /** Optional maximum number of steps for the agent loop (default: 100). */
  maxSteps?: number;
  /** Optional flag to include the general-purpose subagent (default: true). */
  includeGeneralPurposeAgent?: boolean;
  /** Optional token limit before evicting large tool results to filesystem. */
  toolResultEvictionLimit?: number;
  /** Optional flag to enable prompt caching (Anthropic only). */
  enablePromptCaching?: boolean;
  /** Optional summarization configuration. */
  summarization?: SummarizationConfig;
  /** Configuration for human-in-the-loop tool approval. */
  interruptOn?: InterruptOnConfig;
  /** Optional checkpointer for persisting agent state. */
  checkpointer?: BaseCheckpointSaver;
  /** @deprecated Use `agentId` instead. */
  skillsDir?: string;
  /** Optional agent identifier for loading agent-specific memory and skills. */
  agentId?: string;
  /** Optional configuration for structured output parsing. */
  output?: {
    schema: z.ZodType<any>;
    description?: string;
  };
  /** Advanced loop control options. */
  loopControl?: LoopControlOptions;
  /** Advanced generation options. */
  generationOptions?: GenerationOptions;
  /** Advanced agent options. */
  advancedOptions?: AdvancedAgentOptions;
}
