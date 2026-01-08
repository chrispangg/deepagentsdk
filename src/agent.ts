/**
 * Deep Agent implementation using Vercel AI SDK v6 ToolLoopAgent.
 */

import {
  ToolLoopAgent,
  stepCountIs,
  generateText,
  streamText,
  wrapLanguageModel,
  Output,
  type ToolSet,
  type StopCondition,
  type LanguageModel,
  type LanguageModelMiddleware,
  type ToolLoopAgentSettings,
} from "ai";
import type { LanguageModelV3 } from "@ai-sdk/provider";
import type { z } from "zod";
import { DEFAULT_MAX_STEPS } from "./constants/limits";
import {
  createCheckpointSavedEvent,
  createCheckpointLoadedEvent,
} from "./utils/events";
import type {
  CreateDeepAgentParams,
  DeepAgentState,
  BackendProtocol,
  BackendFactory,
  DeepAgentEvent,
  ErrorEvent as DeepAgentErrorEvent,
  CheckpointLoadedEvent,
  EventCallback,
  StreamWithEventsOptions,
  ModelMessage,
  SandboxBackendProtocol,
  InterruptOnConfig,
  PrepareStepFunction,
} from "./types";
import type { BaseCheckpointSaver, Checkpoint, InterruptData } from "./checkpointer/types";
import { isSandboxBackend } from "./types";
import {
  BASE_PROMPT,
  TODO_SYSTEM_PROMPT,
  FILESYSTEM_SYSTEM_PROMPT,
  TASK_SYSTEM_PROMPT,
  EXECUTE_SYSTEM_PROMPT,
  buildSkillsPrompt,
} from "./prompts";
import { createTodosTool } from "./tools/todos";
import { createFilesystemTools } from "./tools/filesystem";
import { createSubagentTool } from "./tools/subagent";
import { createExecuteTool } from "./tools/execute";
import { StateBackend } from "./backends/state";
import { patchToolCalls } from "./utils/patch-tool-calls";
import { summarizeIfNeeded } from "./utils/summarization";
import { applyInterruptConfig, wrapToolsWithApproval, type ApprovalCallback } from "./utils/approval";
import type { SummarizationConfig } from "./types";

/**
 * Build the full system prompt from components.
 */
function buildSystemPrompt(
  customPrompt?: string,
  hasSubagents?: boolean,
  hasSandbox?: boolean,
  skills?: Array<{ name: string; description: string; path: string }>
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

  // Add skills prompt if skills loaded
  if (skills && skills.length > 0) {
    parts.push(buildSkillsPrompt(skills));
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
  private checkpointer?: BaseCheckpointSaver;
  private skillsMetadata: Array<{ name: string; description: string; path: string }> = [];
  private outputConfig?: { schema: z.ZodType<any>; description?: string };

  // AI SDK ToolLoopAgent passthrough options
  private loopControl?: CreateDeepAgentParams["loopControl"];
  private generationOptions?: CreateDeepAgentParams["generationOptions"];
  private advancedOptions?: CreateDeepAgentParams["advancedOptions"];

  constructor(params: CreateDeepAgentParams) {
    const {
      model,
      middleware,
      tools = {},
      systemPrompt,
      subagents = [],
      backend,
      maxSteps = DEFAULT_MAX_STEPS,
      includeGeneralPurposeAgent = true,
      toolResultEvictionLimit,
      enablePromptCaching = false,
      summarization,
      interruptOn,
      checkpointer,
      skillsDir,
      agentId,
      output,
      loopControl,
      generationOptions,
      advancedOptions,
    } = params;

    // Wrap model with middleware if provided
    if (middleware) {
      const middlewares = Array.isArray(middleware)
        ? middleware
        : [middleware];

      this.model = wrapLanguageModel({
        model: model as LanguageModelV3, // Cast required since DeepAgent accepts LanguageModel
        middleware: middlewares,
      }) as LanguageModel;
    } else {
      this.model = model;
    }
    this.maxSteps = maxSteps;
    this.backend =
      backend || ((state: DeepAgentState) => new StateBackend(state));
    this.toolResultEvictionLimit = toolResultEvictionLimit;
    this.enablePromptCaching = enablePromptCaching;
    this.summarizationConfig = summarization;
    this.interruptOn = interruptOn;
    this.checkpointer = checkpointer;
    this.outputConfig = output;

    // Store AI SDK passthrough options
    this.loopControl = loopControl;
    this.generationOptions = generationOptions;
    this.advancedOptions = advancedOptions;

    // Load skills - prefer agentId over legacy skillsDir
    if (agentId) {
      // Show deprecation warning if skillsDir is also provided
      if (skillsDir) {
        console.warn(
          '[DeepAgent] agentId parameter takes precedence over skillsDir. ' +
          'skillsDir is deprecated and will be ignored.'
        );
      }

      this.loadSkills({ agentId }).catch(error => {
        console.warn('[DeepAgent] Failed to load skills:', error);
      });
    } else if (skillsDir) {
      // Legacy mode: use skillsDir
      this.loadSkills({ skillsDir }).catch(error => {
        console.warn('[DeepAgent] Failed to load skills:', error);
      });
    }

    // Check if backend is a sandbox (supports execute)
    // For factory functions, we can't know until runtime, so we check if it's an instance
    this.hasSandboxBackend = typeof backend !== "function" && backend !== undefined && isSandboxBackend(backend);

    // Determine if we have subagents
    const hasSubagents =
      includeGeneralPurposeAgent || (subagents && subagents.length > 0);

    this.systemPrompt = buildSystemPrompt(systemPrompt, hasSubagents, this.hasSandboxBackend, this.skillsMetadata);

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
   * Create core tools (todos and filesystem).
   * @private
   */
  private createCoreTools(state: DeepAgentState, onEvent?: EventCallback): ToolSet {
    const todosTool = createTodosTool(state, onEvent);
    const filesystemTools = createFilesystemTools(state, {
      backend: this.backend,
      onEvent,
      toolResultEvictionLimit: this.toolResultEvictionLimit,
    });

    return {
      write_todos: todosTool,
      ...filesystemTools,
      ...this.userTools,
    };
  }

  /**
   * Create web tools if TAVILY_API_KEY is available.
   * Uses dynamic import to avoid bundling Node.js dependencies in client builds.
   * @private
   */
  private createWebToolSet(state: DeepAgentState, onEvent?: EventCallback): ToolSet {
    // Check if TAVILY_API_KEY is present before attempting to load web tools
    if (!process.env.TAVILY_API_KEY) {
      return {};
    }

    try {
      // Dynamic import to avoid bundling Node.js-only dependencies
      // This will only load in Node.js environments (server-side)
      const webToolsModule = require("./tools/web");
      const webTools = webToolsModule.createWebTools(state, {
        backend: this.backend,
        onEvent,
        toolResultEvictionLimit: this.toolResultEvictionLimit,
      });
      return webTools;
    } catch (error) {
      // If web tools fail to load (e.g., in browser), return empty tools
      console.warn("Web tools not available in this environment:", error);
      return {};
    }
  }

  /**
   * Create execute tool if backend is a sandbox.
   * @private
   */
  private createExecuteToolSet(onEvent?: EventCallback): ToolSet {
    if (!this.hasSandboxBackend) {
      return {};
    }

    const sandboxBackend = this.backend as SandboxBackendProtocol;
    return {
      execute: createExecuteTool({
        backend: sandboxBackend,
        onEvent,
      }),
    };
  }

  /**
   * Create subagent tool if configured.
   * @private
   */
  private createSubagentToolSet(state: DeepAgentState, onEvent?: EventCallback): ToolSet {
    if (
      !this.subagentOptions.includeGeneralPurposeAgent &&
      (!this.subagentOptions.subagents || this.subagentOptions.subagents.length === 0)
    ) {
      return {};
    }

    const subagentTool = createSubagentTool(state, {
      defaultModel: this.subagentOptions.defaultModel,
      defaultTools: this.userTools,
      subagents: this.subagentOptions.subagents,
      includeGeneralPurposeAgent: this.subagentOptions.includeGeneralPurposeAgent,
      backend: this.backend,
      onEvent,
      interruptOn: this.interruptOn,
      parentGenerationOptions: this.generationOptions,
      parentAdvancedOptions: this.advancedOptions,
    });

    return { task: subagentTool };
  }

  /**
   * Create all tools for the agent, combining core, web, execute, and subagent tools.
   * @private
   */
  private createTools(state: DeepAgentState, onEvent?: EventCallback): ToolSet {
    // Start with core tools (todos, filesystem, user tools)
    let allTools = this.createCoreTools(state, onEvent);

    // Add web tools if available
    const webTools = this.createWebToolSet(state, onEvent);
    if (Object.keys(webTools).length > 0) {
      allTools = { ...allTools, ...webTools };
    }

    // Add execute tool if sandbox backend
    const executeTools = this.createExecuteToolSet(onEvent);
    if (Object.keys(executeTools).length > 0) {
      allTools = { ...allTools, ...executeTools };
    }

    // Add subagent tool if configured
    const subagentTools = this.createSubagentToolSet(state, onEvent);
    if (Object.keys(subagentTools).length > 0) {
      allTools = { ...allTools, ...subagentTools };
    }

    // Apply interruptOn configuration to tools
    allTools = applyInterruptConfig(allTools, this.interruptOn);

    return allTools;
  }

  /**
   * Build stop conditions with maxSteps safety limit.
   * Combines user-provided stop conditions with the maxSteps limit.
   */
  private buildStopConditions(maxSteps?: number): StopCondition<any>[] {
    const conditions: StopCondition<any>[] = [];

    // Always add maxSteps safety limit
    conditions.push(stepCountIs(maxSteps ?? this.maxSteps));

    // Add user-provided stop conditions
    if (this.loopControl?.stopWhen) {
      if (Array.isArray(this.loopControl.stopWhen)) {
        conditions.push(...this.loopControl.stopWhen);
      } else {
        conditions.push(this.loopControl.stopWhen);
      }
    }

    return conditions;
  }

  /**
   * Build agent settings by combining passthrough options with defaults.
   */
  private buildAgentSettings(onEvent?: EventCallback) {
    const settings: any = {
      model: this.model,
      instructions: this.systemPrompt,
      tools: undefined, // Will be set by caller
    };

    // Add generation options if provided
    if (this.generationOptions) {
      Object.assign(settings, this.generationOptions);
    }

    // Add advanced options if provided
    if (this.advancedOptions) {
      Object.assign(settings, this.advancedOptions);
    }

    // Add composed loop control callbacks if provided
    if (this.loopControl) {
      if (this.loopControl.prepareStep) {
        settings.prepareStep = this.composePrepareStep(this.loopControl.prepareStep);
      }
      if (this.loopControl.onStepFinish) {
        settings.onStepFinish = this.composeOnStepFinish(this.loopControl.onStepFinish);
      }
      if (this.loopControl.onFinish) {
        settings.onFinish = this.composeOnFinish(this.loopControl.onFinish);
      }
    }

    // Add output configuration if provided using AI SDK Output helper
    if (this.outputConfig) {
      settings.output = Output.object(this.outputConfig);
    }

    return settings;
  }

  /**
   * Create a ToolLoopAgent for a given state.
   * @param state - The shared agent state
   * @param maxSteps - Optional max steps override
   * @param onEvent - Optional callback for emitting events
   */
  private createAgent(state: DeepAgentState, maxSteps?: number, onEvent?: EventCallback) {
    const tools = this.createTools(state, onEvent);
    const settings = this.buildAgentSettings(onEvent);
    const stopConditions = this.buildStopConditions(maxSteps);

    return new ToolLoopAgent({
      ...settings,
      tools,
      stopWhen: stopConditions,
    });
  }

  /**
   * Load skills from directory asynchronously.
   * Supports both legacy skillsDir and new agentId modes.
   */
  private async loadSkills(options: { skillsDir?: string; agentId?: string }) {
    const { listSkills } = await import("./skills/load");

    const skills = await listSkills(
      options.agentId
        ? { agentId: options.agentId }
        : { projectSkillsDir: options.skillsDir }
    );

    this.skillsMetadata = skills.map(s => ({
      name: s.name,
      description: s.description,
      path: s.path,
    }));
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
    // Note: We attach state as a property to preserve getters on result
    Object.defineProperty(result, 'state', {
      value: state,
      enumerable: true,
      writable: false,
    });

    return result as typeof result & { state: DeepAgentState };
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
    // Note: We attach state as a property to preserve getters on result
    Object.defineProperty(result, 'state', {
      value: state,
      enumerable: true,
      writable: false,
    });

    return result as typeof result & { state: DeepAgentState };
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

    // Return result with state attached
    // Note: We attach state as a property to preserve getters on result
    Object.defineProperty(result, 'state', {
      value: options.state,
      enumerable: true,
      writable: false,
    });

    return result as typeof result & { state: DeepAgentState };
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

  /**
   * Compose user's onStepFinish callback with DeepAgent's internal checkpointing logic.
   * User callback executes first, errors are caught to prevent breaking checkpointing.
   */
  private composeOnStepFinish(userOnStepFinish?: ToolLoopAgentSettings['onStepFinish']) {
    return async (params: any) => {
      // Execute user callback first if provided
      if (userOnStepFinish) {
        try {
          await userOnStepFinish(params);
        } catch (error) {
          // Log error but don't let it break DeepAgent's internal logic
          console.error("[DeepAgent] User onStepFinish callback failed:", error);
        }
      }

      // TODO: Add DeepAgent's internal checkpointing logic here
      // This will be implemented when we migrate from streamText to ToolLoopAgent
    };
  }

  /**
   * Compose user's onFinish callback with DeepAgent's internal cleanup logic.
   */
  private composeOnFinish(userOnFinish?: ToolLoopAgentSettings['onFinish']) {
    return async (params: any) => {
      // Execute user callback first if provided
      if (userOnFinish) {
        try {
          await userOnFinish(params);
        } catch (error) {
          console.error("[DeepAgent] User onFinish callback failed:", error);
        }
      }

      // TODO: Add DeepAgent's internal cleanup logic here
    };
  }

  /**
   * Compose user's prepareStep callback with DeepAgent's internal step preparation.
   * Returns a function typed as `any` to avoid AI SDK's strict toolName inference.
   */
  private composePrepareStep(userPrepareStep?: PrepareStepFunction): any {
    return async (params: any) => {
      // Execute user callback first if provided
      if (userPrepareStep) {
        try {
          const result = await userPrepareStep(params);
          // Merge user's prepareStep result with DeepAgent's requirements
          return {
            ...result,
            // TODO: Add DeepAgent's internal step preparation here
          };
        } catch (error) {
          console.error("[DeepAgent] User prepareStep callback failed:", error);
          return params; // Return original params on error
        }
      }

      return params;
    };
  }

  /**
   * Build streamText options with callbacks for step tracking and checkpointing.
   *
   * @private
   */
  private buildStreamTextOptions(
    inputMessages: ModelMessage[],
    tools: ToolSet,
    options: StreamWithEventsOptions,
    state: DeepAgentState,
    baseStep: number,
    pendingInterrupt: InterruptData | undefined,
    eventQueue: DeepAgentEvent[],
    stepNumberRef: { value: number }
  ): Parameters<typeof streamText>[0] {
    const { threadId } = options;

    const streamOptions: Parameters<typeof streamText>[0] = {
      model: this.model,
      messages: inputMessages,
      tools,
      stopWhen: this.buildStopConditions(options.maxSteps),
      abortSignal: options.abortSignal,
      onStepFinish: async ({ toolCalls, toolResults }) => {
        // Call user's onStepFinish first if provided
        if (this.loopControl?.onStepFinish) {
          const composedOnStepFinish = this.composeOnStepFinish(this.loopControl.onStepFinish);
          await composedOnStepFinish({ toolCalls, toolResults });
        }

        // Then execute DeepAgent's checkpointing logic
        stepNumberRef.value++;
        const cumulativeStep = baseStep + stepNumberRef.value;

        // Emit step finish event (relative step number)
        const stepEvent: DeepAgentEvent = {
          type: "step-finish",
          stepNumber: stepNumberRef.value,
          toolCalls: toolCalls.map((tc, i) => ({
            toolName: tc.toolName,
            args: "input" in tc ? tc.input : undefined,
            result: toolResults[i] ? ("output" in toolResults[i] ? toolResults[i].output : undefined) : undefined,
          })),
        };
        eventQueue.push(stepEvent);

        // Save checkpoint if configured
        if (threadId && this.checkpointer) {
          // Get current messages state - we need to track messages as they're built
          // For now, we'll save with the input messages (will be updated after assistant response)
          const checkpoint: Checkpoint = {
            threadId,
            step: cumulativeStep, // Cumulative step number
            messages: inputMessages, // Current messages before assistant response
            state: { ...state },
            interrupt: pendingInterrupt,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          };
          await this.checkpointer.save(checkpoint);

          eventQueue.push(createCheckpointSavedEvent(threadId, cumulativeStep));
        }
      },
    };

    // Add generation options if provided
    if (this.generationOptions) {
      Object.assign(streamOptions, this.generationOptions);
    }

    // Add advanced options if provided
    if (this.advancedOptions) {
      Object.assign(streamOptions, this.advancedOptions);
    }

    // Add output configuration if provided using AI SDK Output helper
    if (this.outputConfig) {
      streamOptions.output = Output.object(this.outputConfig);
    }

    // Add composed loop control callbacks if provided
    if (this.loopControl) {
      if (this.loopControl.prepareStep) {
        streamOptions.prepareStep = this.composePrepareStep(this.loopControl.prepareStep);
      }
      if (this.loopControl.onFinish) {
        streamOptions.onFinish = this.composeOnFinish(this.loopControl.onFinish);
      }
    }

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

    return streamOptions;
  }

  /**
   * Build message array from options, handling validation and priority logic.
   * Priority: explicit messages > prompt > checkpoint history.
   *
   * @private
   */
  private async buildMessageArray(
    options: StreamWithEventsOptions,
    patchedHistory: ModelMessage[]
  ): Promise<{
    messages: ModelMessage[];
    patchedHistory: ModelMessage[];
    error?: DeepAgentErrorEvent;
    shouldReturnEmpty?: boolean;
  }> {
    const { resume } = options;

    // Validation: require either prompt, messages, resume, or threadId
    if (!options.prompt && !options.messages && !resume && !options.threadId) {
      return {
        messages: [],
        patchedHistory,
        error: {
          type: "error",
          error: new Error("Either 'prompt', 'messages', 'resume', or 'threadId' is required"),
        },
      };
    }

    // Build messages with priority: explicit messages > prompt > checkpoint
    let userMessages: ModelMessage[] = [];
    let shouldUseCheckpointHistory = true;

    if (options.messages && options.messages.length > 0) {
      // Use explicit messages array (preferred)
      userMessages = options.messages;
      shouldUseCheckpointHistory = false; // Explicit messages replace checkpoint history

      // Emit deprecation warning for prompt if also provided
      if (options.prompt && process.env.NODE_ENV !== 'production') {
        console.warn('prompt parameter is deprecated when messages are provided, using messages instead');
      }
    } else if (options.messages) {
      // Empty messages array provided - clear checkpoint history and treat as reset
      shouldUseCheckpointHistory = false;
      patchedHistory = []; // Clear checkpoint history

      // According to priority logic, even empty messages take precedence over prompt
      // This means prompt is ignored even if messages is empty
      if (options.prompt && process.env.NODE_ENV !== 'production') {
        console.warn('prompt parameter is deprecated when empty messages are provided, prompt ignored');
      }
      // Empty messages case will be handled by validation below
    } else if (options.prompt) {
      // Convert prompt to message for backward compatibility
      userMessages = [{ role: "user", content: options.prompt } as ModelMessage];

      if (process.env.NODE_ENV !== 'production') {
        console.warn('prompt parameter is deprecated, use messages instead');
      }
    }
    // If neither messages nor prompt provided, use checkpoint history only

    // Load checkpoint messages if available and not replaced by explicit messages
    if (shouldUseCheckpointHistory && patchedHistory.length > 0) {
      // Patch any dangling tool calls in the history first
      patchedHistory = patchToolCalls(patchedHistory);

      // Apply summarization if enabled and needed
      if (this.summarizationConfig?.enabled && patchedHistory.length > 0) {
        const summarizationResult = await summarizeIfNeeded(patchedHistory, {
          model: this.summarizationConfig.model || this.model,
          tokenThreshold: this.summarizationConfig.tokenThreshold,
          keepMessages: this.summarizationConfig.keepMessages,
          generationOptions: this.generationOptions,
          advancedOptions: this.advancedOptions,
        });
        patchedHistory = summarizationResult.messages;
      }
    } else if (!shouldUseCheckpointHistory) {
      // Explicit messages replace checkpoint history - clear patchedHistory
      patchedHistory = [];
    }

    // Handle empty messages case
    const hasEmptyMessages = options.messages && options.messages.length === 0;
    const hasValidInput = userMessages.length > 0 || patchedHistory.length > 0;

    // Special case: empty messages with no checkpoint history
    if (hasEmptyMessages && !hasValidInput && !resume) {
      // This is a "no-op" case - return done immediately with empty messages
      return {
        messages: [],
        patchedHistory,
        shouldReturnEmpty: true,
      };
    }

    // Check if we have valid input: either user messages or checkpoint history
    if (!hasValidInput && !resume) {
      return {
        messages: [],
        patchedHistory,
        error: {
          type: "error",
          error: new Error("No valid input: provide either non-empty messages, prompt, or threadId with existing checkpoint"),
        },
      };
    }

    const inputMessages: ModelMessage[] = [
      ...patchedHistory,
      ...userMessages,
    ];

    return { messages: inputMessages, patchedHistory };
  }

  /**
   * Load checkpoint context if threadId is provided.
   * Handles checkpoint restoration and resume from interrupt.
   *
   * @private
   */
  private async loadCheckpointContext(
    options: StreamWithEventsOptions
  ): Promise<{
    state: DeepAgentState;
    patchedHistory: ModelMessage[];
    currentStep: number;
    pendingInterrupt: InterruptData | undefined;
    checkpointEvent?: CheckpointLoadedEvent;
  }> {
    const { threadId, resume } = options;
    let state: DeepAgentState = options.state || { todos: [], files: {} };
    let patchedHistory: ModelMessage[] = [];
    let currentStep = 0;
    let pendingInterrupt: InterruptData | undefined;
    let checkpointEvent: CheckpointLoadedEvent | undefined;

    if (threadId && this.checkpointer) {
      const checkpoint = await this.checkpointer.load(threadId);
      if (checkpoint) {
        state = checkpoint.state;
        patchedHistory = checkpoint.messages;
        currentStep = checkpoint.step;
        pendingInterrupt = checkpoint.interrupt;

        checkpointEvent = createCheckpointLoadedEvent(
          threadId,
          checkpoint.step,
          checkpoint.messages.length
        );
      }
    }

    // Handle resume from interrupt
    if (resume && pendingInterrupt) {
      const decision = resume.decisions[0];
      if (decision?.type === 'approve') {
        pendingInterrupt = undefined;
      } else {
        pendingInterrupt = undefined;
      }
    }

    return { state, patchedHistory, currentStep, pendingInterrupt, checkpointEvent };
  }

  async *streamWithEvents(
    options: StreamWithEventsOptions
  ): AsyncGenerator<DeepAgentEvent, void, unknown> {
    const { threadId, resume } = options;

    // Load checkpoint context (state, history, step tracking)
    const context = await this.loadCheckpointContext(options);
    const { state, currentStep, pendingInterrupt, checkpointEvent } = context;
    let patchedHistory = context.patchedHistory; // Mutable - may be reassigned during message building

    // Yield checkpoint-loaded event if checkpoint was restored
    if (checkpointEvent) {
      yield checkpointEvent;
    }

    // Build message array with validation and priority logic
    const messageResult = await this.buildMessageArray(options, patchedHistory);

    // Handle error cases
    if (messageResult.error) {
      yield messageResult.error;
      return;
    }

    // Handle empty messages no-op case
    if (messageResult.shouldReturnEmpty) {
      yield {
        type: "done",
        text: "",
        messages: [],
        state,
      };
      return;
    }

    // Extract results
    const inputMessages = messageResult.messages;
    patchedHistory = messageResult.patchedHistory;

    // Event queue for collecting events from tool executions
    const eventQueue: DeepAgentEvent[] = [];
    const stepNumberRef = { value: 0 }; // Mutable reference for stepNumber
    const baseStep = currentStep; // Cumulative step from checkpoint

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
      // Build streamText options with callbacks
      const streamOptions = this.buildStreamTextOptions(
        inputMessages,
        tools,
        options,
        state,
        baseStep,
        pendingInterrupt,
        eventQueue,
        stepNumberRef
      );

      // Use streamText with messages array for conversation history
      const result = streamText(streamOptions);

      // Yield step start event
      yield { type: "step-start", stepNumber: 1 };

      // Stream all chunks (text, tool calls, etc.)
      for await (const chunk of result.fullStream) {
        // First, yield any queued events from tool executions
        while (eventQueue.length > 0) {
          const event = eventQueue.shift()!;
          yield event;

          // If a step finished, yield the next step start
          if (event.type === "step-finish") {
            yield { type: "step-start", stepNumber: event.stepNumber + 1 };
          }
        }

        // Handle different chunk types from fullStream
        if (chunk.type === "text-delta") {
          yield { type: "text", text: chunk.text };
        } else if (chunk.type === "tool-call") {
          // Emit tool-call event for UI
          // Note: chunk has input property (AI SDK v6), but we use args for our event type
          yield {
            type: "tool-call",
            toolName: chunk.toolName,
            toolCallId: chunk.toolCallId,
            args: chunk.input,
          } as DeepAgentEvent;
        } else if (chunk.type === "tool-result") {
          // Emit tool-result event for UI
          // Note: chunk has output property (AI SDK v6), but we use result for our event type
          yield {
            type: "tool-result",
            toolName: chunk.toolName,
            toolCallId: chunk.toolCallId,
            result: chunk.output,
            isError: false,
          } as DeepAgentEvent;
        } else if (chunk.type === "tool-error") {
          // Emit tool-result event with error flag for UI
          yield {
            type: "tool-result",
            toolName: chunk.toolName,
            toolCallId: chunk.toolCallId,
            result: chunk.error,
            isError: true,
          } as DeepAgentEvent;
        }
      }

      // Yield any remaining queued events
      while (eventQueue.length > 0) {
        yield eventQueue.shift()!;
      }

      // Get the final text
      const finalText = await result.text;

      // Build updated messages array with assistant response
      // Only include assistant message if there's actual content (avoid empty text blocks)
      const updatedMessages: ModelMessage[] = [
        ...inputMessages,
        ...(finalText ? [{ role: "assistant", content: finalText } as ModelMessage] : []),
      ];

      // Extract output if present (from ToolLoopAgent's native output parsing)
      const output = 'output' in result ? (result as { output: unknown }).output : undefined;

      // Yield done event with updated messages
      yield {
        type: "done",
        state,
        text: finalText,
        messages: updatedMessages,
        ...(output !== undefined ? { output } : {}),
      };
      
      // Save final checkpoint after done event
      if (threadId && this.checkpointer) {
        const finalCheckpoint: Checkpoint = {
          threadId,
          step: baseStep + stepNumberRef.value, // Cumulative step number
          messages: updatedMessages,
          state,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };
        await this.checkpointer.save(finalCheckpoint);

        // Emit checkpoint-saved event for final checkpoint
        yield createCheckpointSavedEvent(threadId, baseStep + stepNumberRef.value);
      }
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
 * import { createDeepAgent } from 'deepagentsdk';
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
 * import { StateBackend } from 'deepagentsdk';
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
 * import { FilesystemBackend } from 'deepagentsdk';
 *
 * const agent = createDeepAgent({
 *   model: anthropic('claude-sonnet-4-20250514'),
 *   backend: new FilesystemBackend({ rootDir: './workspace' }), // Persist to disk
 * });
 * ```
 *
 * @example With PersistentBackend
 * ```typescript
 * import { PersistentBackend, InMemoryStore } from 'deepagentsdk';
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
 * import { CompositeBackend, FilesystemBackend, StateBackend } from 'deepagentsdk';
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
 * @example With middleware for logging and caching
 * ```typescript
 * import { createDeepAgent } from 'deepagentsdk';
 * import { anthropic } from '@ai-sdk/anthropic';
 *
 * const loggingMiddleware = {
 *   wrapGenerate: async ({ doGenerate, params }) => {
 *     console.log('Model called with:', params.prompt);
 *     const result = await doGenerate();
 *     console.log('Model returned:', result.text);
 *     return result;
 *   },
 * };
 *
 * const agent = createDeepAgent({
 *   model: anthropic('claude-sonnet-4-20250514'),
 *   middleware: [loggingMiddleware],
 * });
 * ```
 *
 * @example With middleware factory for context access
 * ```typescript
 * import { FilesystemBackend } from 'deepagentsdk';
 *
 * function createContextMiddleware(backend: BackendProtocol) {
 *   return {
 *     wrapGenerate: async ({ doGenerate }) => {
 *       const state = await backend.read('state');
 *       const result = await doGenerate();
 *       await backend.write('state', { ...state, lastCall: result });
 *       return result;
 *     },
 *   };
 * }
 *
 * const backend = new FilesystemBackend({ rootDir: './workspace' });
 * const agent = createDeepAgent({
 *   model: anthropic('claude-sonnet-4-20250514'),
 *   backend,
 *   middleware: createContextMiddleware(backend),
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
