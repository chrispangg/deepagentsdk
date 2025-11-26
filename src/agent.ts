/**
 * Deep Agent implementation using Vercel AI SDK v6 ToolLoopAgent.
 */

import {
  ToolLoopAgent,
  stepCountIs,
  generateText,
  streamText,
  type ToolSet,
  type StopCondition,
} from "ai";
import { anthropic } from "@ai-sdk/anthropic";
import { openai } from "@ai-sdk/openai";
import type {
  CreateDeepAgentParams,
  DeepAgentState,
  BackendProtocol,
  BackendFactory,
  DeepAgentEvent,
  EventCallback,
  StreamWithEventsOptions,
  ModelMessage,
} from "./types.ts";
import {
  BASE_PROMPT,
  TODO_SYSTEM_PROMPT,
  FILESYSTEM_SYSTEM_PROMPT,
  TASK_SYSTEM_PROMPT,
} from "./prompts.ts";
import { createTodosTool } from "./tools/todos.ts";
import { createFilesystemTools } from "./tools/filesystem.ts";
import { createSubagentTool } from "./tools/subagent.ts";
import { StateBackend } from "./backends/state.ts";
import { patchToolCalls } from "./utils/patch-tool-calls.ts";
import { summarizeIfNeeded } from "./utils/summarization.ts";
import type { SummarizationConfig } from "./types.ts";

/**
 * Build the full system prompt from components.
 */
function buildSystemPrompt(
  customPrompt?: string,
  hasSubagents?: boolean
): string {
  const parts = [
    customPrompt || "",
    BASE_PROMPT,
    TODO_SYSTEM_PROMPT,
    FILESYSTEM_SYSTEM_PROMPT,
  ];

  if (hasSubagents) {
    parts.push(TASK_SYSTEM_PROMPT);
  }

  return parts.filter(Boolean).join("\n\n");
}

/**
 * Parse model string to get the appropriate model instance.
 * Supports formats like "anthropic/claude-sonnet-4-20250514" or "openai/gpt-4o"
 */
function parseModel(modelString: string) {
  const [provider, modelName] = modelString.split("/");

  if (provider === "anthropic") {
    return anthropic(modelName || "claude-sonnet-4-20250514");
  } else if (provider === "openai") {
    return openai(modelName || "gpt-4o");
  }

  // Default to anthropic
  return anthropic(modelString);
}

/**
 * Deep Agent wrapper class that provides generate() and stream() methods.
 * Uses ToolLoopAgent from AI SDK v6 for the agent loop.
 */
export class DeepAgent {
  private model: string;
  private systemPrompt: string;
  private userTools: ToolSet;
  private maxSteps: number;
  private backend: BackendProtocol | BackendFactory;
  private subagentOptions: {
    defaultModel: string;
    defaultTools: ToolSet;
    subagents: CreateDeepAgentParams["subagents"];
    includeGeneralPurposeAgent: boolean;
  };
  private toolResultEvictionLimit?: number;
  private enablePromptCaching: boolean;
  private summarizationConfig?: SummarizationConfig;

  constructor(params: CreateDeepAgentParams = {}) {
    const {
      model = "anthropic/claude-sonnet-4-20250514",
      tools = {},
      systemPrompt,
      subagents = [],
      backend,
      maxSteps = 100,
      includeGeneralPurposeAgent = true,
      toolResultEvictionLimit,
      enablePromptCaching = false,
      summarization,
    } = params;

    this.model = model;
    this.maxSteps = maxSteps;
    this.backend =
      backend || ((state: DeepAgentState) => new StateBackend(state));
    this.toolResultEvictionLimit = toolResultEvictionLimit;
    this.enablePromptCaching = enablePromptCaching;
    this.summarizationConfig = summarization;

    // Determine if we have subagents
    const hasSubagents =
      includeGeneralPurposeAgent || (subagents && subagents.length > 0);

    this.systemPrompt = buildSystemPrompt(systemPrompt, hasSubagents);

    // Store user-provided tools
    this.userTools = tools;

    // Store subagent options for later use
    this.subagentOptions = {
      defaultModel: model,
      defaultTools: tools,
      subagents,
      includeGeneralPurposeAgent,
    };
  }

  /**
   * Create all tools for a given state.
   * @param state - The shared agent state
   * @param onEvent - Optional callback for emitting events
   */
  private createTools(state: DeepAgentState, onEvent?: EventCallback): ToolSet {
    const todosTool = createTodosTool(state, onEvent);
    const filesystemTools = createFilesystemTools(state, {
      backend: this.backend,
      onEvent,
      toolResultEvictionLimit: this.toolResultEvictionLimit,
    });

    const allTools: ToolSet = {
      write_todos: todosTool,
      ...filesystemTools,
      ...this.userTools,
    };

    // Add subagent tool if configured
    if (
      this.subagentOptions.includeGeneralPurposeAgent ||
      (this.subagentOptions.subagents &&
        this.subagentOptions.subagents.length > 0)
    ) {
      const subagentTool = createSubagentTool(state, {
        defaultModel: this.subagentOptions.defaultModel,
        defaultTools: this.userTools,
        subagents: this.subagentOptions.subagents,
        includeGeneralPurposeAgent:
          this.subagentOptions.includeGeneralPurposeAgent,
        backend: this.backend,
        onEvent,
      });
      allTools.task = subagentTool;
    }

    return allTools;
  }

  /**
   * Create a ToolLoopAgent for a given state.
   * @param state - The shared agent state
   * @param maxSteps - Optional max steps override
   * @param onEvent - Optional callback for emitting events
   */
  private createAgent(state: DeepAgentState, maxSteps?: number, onEvent?: EventCallback) {
    const tools = this.createTools(state, onEvent);

    return new ToolLoopAgent({
      model: parseModel(this.model),
      instructions: this.systemPrompt,
      tools,
      stopWhen: stepCountIs(maxSteps ?? this.maxSteps),
    });
  }

  /**
   * Generate a response (non-streaming).
   */
  async generate(options: { prompt: string; maxSteps?: number }) {
    // Create fresh state for this invocation
    const state: DeepAgentState = {
      todos: [],
      files: {},
    };

    const agent = this.createAgent(state, options.maxSteps);
    const result = await agent.generate({ prompt: options.prompt });

    // Return result with state attached
    return {
      ...result,
      state,
    };
  }

  /**
   * Stream a response.
   */
  async stream(options: { prompt: string; maxSteps?: number }) {
    // Create fresh state for this invocation
    const state: DeepAgentState = {
      todos: [],
      files: {},
    };

    const agent = this.createAgent(state, options.maxSteps);
    const result = await agent.stream({ prompt: options.prompt });

    // Return result with state attached
    return {
      ...result,
      state,
    };
  }

  /**
   * Generate with an existing state (for continuing conversations).
   */
  async generateWithState(options: {
    prompt: string;
    state: DeepAgentState;
    maxSteps?: number;
  }) {
    const agent = this.createAgent(options.state, options.maxSteps);
    const result = await agent.generate({ prompt: options.prompt });

    return {
      ...result,
      state: options.state,
    };
  }

  /**
   * Get the underlying ToolLoopAgent for advanced usage.
   * This allows using AI SDK's createAgentUIStream and other utilities.
   */
  getAgent(state?: DeepAgentState) {
    const agentState = state || { todos: [], files: {} };
    return this.createAgent(agentState);
  }

  /**
   * Stream a response with real-time events.
   * This is an async generator that yields DeepAgentEvent objects.
   * 
   * Supports conversation history via the `messages` option for multi-turn conversations.
   * 
   * @example
   * ```typescript
   * // Single turn
   * for await (const event of agent.streamWithEvents({ prompt: "..." })) {
   *   switch (event.type) {
   *     case 'text':
   *       process.stdout.write(event.text);
   *       break;
   *     case 'done':
   *       // event.messages contains the updated conversation history
   *       console.log('Messages:', event.messages);
   *       break;
   *   }
   * }
   * 
   * // Multi-turn conversation
   * let messages = [];
   * for await (const event of agent.streamWithEvents({ prompt: "Hello", messages })) {
   *   if (event.type === 'done') {
   *     messages = event.messages; // Save for next turn
   *   }
   * }
   * for await (const event of agent.streamWithEvents({ prompt: "Follow up", messages })) {
   *   // Agent now has context from previous turn
   * }
   * ```
   */
  async *streamWithEvents(
    options: StreamWithEventsOptions
  ): AsyncGenerator<DeepAgentEvent, void, unknown> {
    // Create or use provided state
    const state: DeepAgentState = options.state || {
      todos: [],
      files: {},
    };

    // Build messages array: previous history + new user message
    // Patch any dangling tool calls in the history first
    let patchedHistory = patchToolCalls(options.messages || []);

    // Apply summarization if enabled and needed
    if (this.summarizationConfig?.enabled && patchedHistory.length > 0) {
      const summarizationResult = await summarizeIfNeeded(patchedHistory, {
        model: this.summarizationConfig.model || this.model,
        tokenThreshold: this.summarizationConfig.tokenThreshold,
        keepMessages: this.summarizationConfig.keepMessages,
      });
      patchedHistory = summarizationResult.messages;
    }

    const inputMessages: ModelMessage[] = [
      ...patchedHistory,
      { role: "user", content: options.prompt } as ModelMessage,
    ];

    // Event queue for collecting events from tool executions
    const eventQueue: DeepAgentEvent[] = [];
    let stepNumber = 0;

    // Event callback that tools will use to emit events
    const onEvent: EventCallback = (event) => {
      eventQueue.push(event);
    };

    // Create tools with event callback
    const tools = this.createTools(state, onEvent);

    try {
      // Build streamText options
      const streamOptions: Parameters<typeof streamText>[0] = {
        model: parseModel(this.model),
        messages: inputMessages,
        tools,
        stopWhen: stepCountIs(options.maxSteps ?? this.maxSteps),
        abortSignal: options.abortSignal,
        onStepFinish: ({ toolCalls, toolResults }) => {
          stepNumber++;
          
          // Emit step finish event
          const stepEvent: DeepAgentEvent = {
            type: "step-finish",
            stepNumber,
            toolCalls: toolCalls.map((tc, i) => ({
              toolName: tc.toolName,
              args: "input" in tc ? tc.input : undefined,
              result: toolResults[i] ? ("output" in toolResults[i] ? toolResults[i].output : undefined) : undefined,
            })),
          };
          eventQueue.push(stepEvent);
        },
      };

      // Add system prompt with optional caching for Anthropic models
      if (this.enablePromptCaching && this.model.includes("anthropic")) {
        // Use messages format with cache control for Anthropic
        streamOptions.messages = [
          {
            role: "system",
            content: this.systemPrompt,
            providerOptions: {
              anthropic: { cacheControl: { type: "ephemeral" } },
            },
          } as ModelMessage,
          ...inputMessages,
        ];
      } else {
        // Use standard system prompt
        streamOptions.system = this.systemPrompt;
      }

      // Use streamText with messages array for conversation history
      const result = streamText(streamOptions);

      // Yield step start event
      yield { type: "step-start", stepNumber: 1 };

      // Stream text chunks
      for await (const chunk of result.textStream) {
        // First, yield any queued events from tool executions
        while (eventQueue.length > 0) {
          const event = eventQueue.shift()!;
          yield event;
          
          // If a step finished, yield the next step start
          if (event.type === "step-finish") {
            yield { type: "step-start", stepNumber: event.stepNumber + 1 };
          }
        }

        // Then yield the text chunk
        if (chunk) {
          yield { type: "text", text: chunk };
        }
      }

      // Yield any remaining queued events
      while (eventQueue.length > 0) {
        yield eventQueue.shift()!;
      }

      // Get the final text
      const finalText = await result.text;

      // Build updated messages array with assistant response
      const updatedMessages: ModelMessage[] = [
        ...inputMessages,
        { role: "assistant", content: finalText } as ModelMessage,
      ];

      // Yield done event with updated messages
      yield {
        type: "done",
        state,
        text: finalText,
        messages: updatedMessages,
      };
    } catch (error) {
      // Yield error event
      yield {
        type: "error",
        error: error instanceof Error ? error : new Error(String(error)),
      };
    }
  }

  /**
   * Stream with a simple callback interface.
   * This is a convenience wrapper around streamWithEvents.
   */
  async streamWithCallback(
    options: StreamWithEventsOptions,
    onEvent: EventCallback
  ): Promise<{ state: DeepAgentState; text?: string; messages?: ModelMessage[] }> {
    let finalState: DeepAgentState = options.state || { todos: [], files: {} };
    let finalText: string | undefined;
    let finalMessages: ModelMessage[] | undefined;

    for await (const event of this.streamWithEvents(options)) {
      onEvent(event);

      if (event.type === "done") {
        finalState = event.state;
        finalText = event.text;
        finalMessages = event.messages;
      }
    }

    return { state: finalState, text: finalText, messages: finalMessages };
  }
}

/**
 * Create a Deep Agent with planning, filesystem, and subagent capabilities.
 *
 * @example
 * ```typescript
 * import { createDeepAgent } from 'ai-sdk-deep-agent';
 *
 * const agent = createDeepAgent({
 *   model: 'anthropic/claude-sonnet-4-20250514',
 *   systemPrompt: 'You are a research assistant...',
 * });
 *
 * const result = await agent.generate({
 *   prompt: 'Research the topic and write a report',
 * });
 *
 * console.log(result.text);
 * console.log(result.state.todos);
 * console.log(result.state.files);
 * ```
 */
export function createDeepAgent(params: CreateDeepAgentParams = {}): DeepAgent {
  return new DeepAgent(params);
}

// Re-export useful AI SDK v6 primitives
export { ToolLoopAgent, stepCountIs, hasToolCall } from "ai";
