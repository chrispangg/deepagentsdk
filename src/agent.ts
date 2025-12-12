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
  type LanguageModel,
} from "ai";
import type {
  CreateDeepAgentParams,
  DeepAgentState,
  BackendProtocol,
  BackendFactory,
  DeepAgentEvent,
  EventCallback,
  StreamWithEventsOptions,
  ModelMessage,
  SandboxBackendProtocol,
  InterruptOnConfig,
} from "./types.ts";
import { isSandboxBackend } from "./types.ts";
import {
  BASE_PROMPT,
  TODO_SYSTEM_PROMPT,
  FILESYSTEM_SYSTEM_PROMPT,
  TASK_SYSTEM_PROMPT,
  EXECUTE_SYSTEM_PROMPT,
} from "./prompts.ts";
import { createTodosTool } from "./tools/todos.ts";
import { createFilesystemTools } from "./tools/filesystem.ts";
import { createSubagentTool } from "./tools/subagent.ts";
import { createExecuteTool } from "./tools/execute.ts";
import { StateBackend } from "./backends/state.ts";
import { patchToolCalls } from "./utils/patch-tool-calls.ts";
import { summarizeIfNeeded } from "./utils/summarization.ts";
import { applyInterruptConfig, wrapToolsWithApproval, type ApprovalCallback } from "./utils/approval.ts";
import type { SummarizationConfig } from "./types.ts";

/**
 * Build the full system prompt from components.
 */
function buildSystemPrompt(
  customPrompt?: string,
  hasSubagents?: boolean,
  hasSandbox?: boolean
): string {
  const parts = [
    customPrompt || "",
    BASE_PROMPT,
    TODO_SYSTEM_PROMPT,
    FILESYSTEM_SYSTEM_PROMPT,
  ];

  if (hasSandbox) {
    parts.push(EXECUTE_SYSTEM_PROMPT);
  }

  if (hasSubagents) {
    parts.push(TASK_SYSTEM_PROMPT);
  }

  return parts.filter(Boolean).join("\n\n");
}

/**
 * Deep Agent wrapper class that provides generate() and stream() methods.
 * Uses ToolLoopAgent from AI SDK v6 for the agent loop.
 */
export class DeepAgent {
  private model: LanguageModel;
  private systemPrompt: string;
  private userTools: ToolSet;
  private maxSteps: number;
  private backend: BackendProtocol | BackendFactory;
  private subagentOptions: {
    defaultModel: LanguageModel;
    defaultTools: ToolSet;
    subagents: CreateDeepAgentParams["subagents"];
    includeGeneralPurposeAgent: boolean;
  };
  private toolResultEvictionLimit?: number;
  private enablePromptCaching: boolean;
  private summarizationConfig?: SummarizationConfig;
  private hasSandboxBackend: boolean;
  private interruptOn?: InterruptOnConfig;

  constructor(params: CreateDeepAgentParams) {
    const {
      model,
      tools = {},
      systemPrompt,
      subagents = [],
      backend,
      maxSteps = 100,
      includeGeneralPurposeAgent = true,
      toolResultEvictionLimit,
      enablePromptCaching = false,
      summarization,
      interruptOn,
    } = params;

    this.model = model;
    this.maxSteps = maxSteps;
    this.backend =
      backend || ((state: DeepAgentState) => new StateBackend(state));
    this.toolResultEvictionLimit = toolResultEvictionLimit;
    this.enablePromptCaching = enablePromptCaching;
    this.summarizationConfig = summarization;
    this.interruptOn = interruptOn;

    // Check if backend is a sandbox (supports execute)
    // For factory functions, we can't know until runtime, so we check if it's an instance
    this.hasSandboxBackend = typeof backend !== "function" && backend !== undefined && isSandboxBackend(backend);

    // Determine if we have subagents
    const hasSubagents =
      includeGeneralPurposeAgent || (subagents && subagents.length > 0);

    this.systemPrompt = buildSystemPrompt(systemPrompt, hasSubagents, this.hasSandboxBackend);

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

    let allTools: ToolSet = {
      write_todos: todosTool,
      ...filesystemTools,
      ...this.userTools,
    };

    // Add execute tool if backend is a sandbox
    if (this.hasSandboxBackend) {
      const sandboxBackend = this.backend as SandboxBackendProtocol;
      allTools.execute = createExecuteTool({
        backend: sandboxBackend,
        onEvent,
      });
    }

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
        interruptOn: this.interruptOn,
      });
      allTools.task = subagentTool;
    }

    // Apply interruptOn configuration to tools
    allTools = applyInterruptConfig(allTools, this.interruptOn);

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
      model: this.model,
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
    let tools = this.createTools(state, onEvent);

    // Wrap tools with approval checking if interruptOn is configured and callback provided
    // This intercepts tool execution and requests approval before running
    const hasInterruptOn = !!this.interruptOn;
    const hasApprovalCallback = !!options.onApprovalRequest;
    
    if (hasInterruptOn && hasApprovalCallback) {
      tools = wrapToolsWithApproval(tools, this.interruptOn, options.onApprovalRequest);
    }

    try {
      // Build streamText options
      const streamOptions: Parameters<typeof streamText>[0] = {
        model: this.model,
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
      if (this.enablePromptCaching) {
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
 * @param params - Configuration object for the Deep Agent
 * @param params.model - **Required.** AI SDK LanguageModel instance (e.g., `anthropic('claude-sonnet-4-20250514')`, `openai('gpt-4o')`)
 * @param params.systemPrompt - Optional custom system prompt for the agent
 * @param params.tools - Optional custom tools to add to the agent (AI SDK ToolSet)
 * @param params.subagents - Optional array of specialized subagent configurations for task delegation
 * @param params.backend - Optional backend for filesystem operations (default: StateBackend for in-memory storage)
 * @param params.maxSteps - Optional maximum number of steps for the agent loop (default: 100)
 * @param params.includeGeneralPurposeAgent - Optional flag to include general-purpose subagent (default: true)
 * @param params.toolResultEvictionLimit - Optional token limit before evicting large tool results to filesystem (default: disabled)
 * @param params.enablePromptCaching - Optional flag to enable prompt caching for improved performance (Anthropic only, default: false)
 * @param params.summarization - Optional summarization configuration for automatic conversation summarization
 * @returns A configured DeepAgent instance
 *
 * @see {@link CreateDeepAgentParams} for detailed parameter types
 *
 * @example Basic usage
 * ```typescript
 * import { createDeepAgent } from 'ai-sdk-deep-agent';
 * import { anthropic } from '@ai-sdk/anthropic';
 *
 * const agent = createDeepAgent({
 *   model: anthropic('claude-sonnet-4-20250514'),
 *   systemPrompt: 'You are a research assistant...',
 * });
 *
 * const result = await agent.generate({
 *   prompt: 'Research the topic and write a report',
 * });
 * ```
 *
 * @example With custom tools
 * ```typescript
 * import { tool } from 'ai';
 * import { z } from 'zod';
 *
 * const customTool = tool({
 *   description: 'Get current time',
 *   inputSchema: z.object({}),
 *   execute: async () => new Date().toISOString(),
 * });
 *
 * const agent = createDeepAgent({
 *   model: anthropic('claude-sonnet-4-20250514'),
 *   tools: { get_time: customTool },
 * });
 * ```
 *
 * @example With subagents
 * ```typescript
 * const agent = createDeepAgent({
 *   model: anthropic('claude-sonnet-4-20250514'),
 *   subagents: [{
 *     name: 'research-agent',
 *     description: 'Specialized for research tasks',
 *     systemPrompt: 'You are a research specialist...',
 *   }],
 * });
 * ```
 *
 * @example With StateBackend (default, explicit)
 * ```typescript
 * import { StateBackend } from 'ai-sdk-deep-agent';
 *
 * const state = { todos: [], files: {} };
 * const agent = createDeepAgent({
 *   model: anthropic('claude-sonnet-4-20250514'),
 *   backend: new StateBackend(state), // Ephemeral in-memory storage
 * });
 * ```
 *
 * @example With FilesystemBackend
 * ```typescript
 * import { FilesystemBackend } from 'ai-sdk-deep-agent';
 *
 * const agent = createDeepAgent({
 *   model: anthropic('claude-sonnet-4-20250514'),
 *   backend: new FilesystemBackend({ rootDir: './workspace' }), // Persist to disk
 * });
 * ```
 *
 * @example With PersistentBackend
 * ```typescript
 * import { PersistentBackend, InMemoryStore } from 'ai-sdk-deep-agent';
 *
 * const store = new InMemoryStore();
 * const agent = createDeepAgent({
 *   model: anthropic('claude-sonnet-4-20250514'),
 *   backend: new PersistentBackend({ store, namespace: 'project-1' }), // Cross-session persistence
 * });
 * ```
 *
 * @example With CompositeBackend
 * ```typescript
 * import { CompositeBackend, FilesystemBackend, StateBackend } from 'ai-sdk-deep-agent';
 *
 * const state = { todos: [], files: {} };
 * const agent = createDeepAgent({
 *   model: anthropic('claude-sonnet-4-20250514'),
 *   backend: new CompositeBackend(
 *     new StateBackend(state),
 *     { '/persistent/': new FilesystemBackend({ rootDir: './persistent' }) }
 *   ), // Route files by path prefix
 * });
 * ```
 *
 * @example With performance optimizations
 * ```typescript
 * const agent = createDeepAgent({
 *   model: anthropic('claude-sonnet-4-20250514'),
 *   enablePromptCaching: true,
 *   toolResultEvictionLimit: 20000,
 *   summarization: {
 *     enabled: true,
 *     tokenThreshold: 170000,
 *     keepMessages: 6,
 *   },
 * });
 * ```
 */
export function createDeepAgent(params: CreateDeepAgentParams): DeepAgent {
  return new DeepAgent(params);
}

// Re-export useful AI SDK v6 primitives
export { ToolLoopAgent, stepCountIs, hasToolCall } from "ai";
