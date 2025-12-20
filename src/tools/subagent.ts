/**
 * Subagent tool for task delegation using AI SDK v6 ToolLoopAgent.
 */

import { tool, ToolLoopAgent, stepCountIs, Output, type ToolSet, type LanguageModel } from "ai";
import { z } from "zod";
import type {
  SubAgent,
  DeepAgentState,
  BackendProtocol,
  BackendFactory,
  EventCallback,
  InterruptOnConfig,
  CreateDeepAgentParams,
  BuiltinToolCreator,
  SubagentToolConfig,
} from "../types";
import { applyInterruptConfig } from "../utils/approval";
import {
  getTaskToolDescription,
  DEFAULT_GENERAL_PURPOSE_DESCRIPTION,
  DEFAULT_SUBAGENT_PROMPT,
  TODO_SYSTEM_PROMPT,
  FILESYSTEM_SYSTEM_PROMPT,
  BASE_PROMPT,
} from "../prompts";
import { createTodosTool } from "./todos";
import { createFilesystemTools } from "./filesystem";
import {
  createWebSearchTool,
  createHttpRequestTool,
  createFetchUrlTool,
} from "./web";
import {
  createLsTool,
  createReadFileTool,
  createWriteFileTool,
  createEditFileTool,
  createGlobTool,
  createGrepTool,
} from "./filesystem";
import { createExecuteTool } from "./execute";

// ============================================================================
// Helper Functions for Builtin Tool Instantiation
// ============================================================================

/**
 * Check if a value is a builtin tool creator function.
 */
function isBuiltinToolCreator(value: any): value is BuiltinToolCreator {
  return typeof value === "function" && (
    value === createWebSearchTool ||
    value === createHttpRequestTool ||
    value === createFetchUrlTool ||
    value === createLsTool ||
    value === createReadFileTool ||
    value === createWriteFileTool ||
    value === createEditFileTool ||
    value === createGlobTool ||
    value === createGrepTool ||
    value === createTodosTool ||
    value === createExecuteTool
  );
}

/**
 * Instantiate a builtin tool creator with the given context.
 */
function instantiateBuiltinTool(
  creator: BuiltinToolCreator,
  state: DeepAgentState,
  options: {
    backend?: BackendProtocol | BackendFactory;
    onEvent?: EventCallback;
    toolResultEvictionLimit?: number;
  }
): ToolSet {
  const { backend, onEvent, toolResultEvictionLimit } = options;

  // Web tools - require API key and timeout defaults
  const tavilyApiKey = process.env.TAVILY_API_KEY || "";
  const defaultTimeout = 30;

  if (creator === createWebSearchTool) {
    if (!tavilyApiKey) {
      console.warn("web_search tool requested but TAVILY_API_KEY not set");
      return {};
    }
    return {
      web_search: createWebSearchTool(state, { backend, onEvent, toolResultEvictionLimit, tavilyApiKey }),
    };
  }
  if (creator === createHttpRequestTool) {
    return {
      http_request: createHttpRequestTool(state, { backend, onEvent, toolResultEvictionLimit, defaultTimeout }),
    };
  }
  if (creator === createFetchUrlTool) {
    return {
      fetch_url: createFetchUrlTool(state, { backend, onEvent, toolResultEvictionLimit, defaultTimeout }),
    };
  }

  // Filesystem tools
  if (creator === createLsTool) {
    return {
      ls: createLsTool(state, backend!, onEvent),
    };
  }
  if (creator === createReadFileTool) {
    return {
      read_file: createReadFileTool(state, backend!, toolResultEvictionLimit, onEvent),
    };
  }
  if (creator === createWriteFileTool) {
    return {
      write_file: createWriteFileTool(state, backend!, onEvent),
    };
  }
  if (creator === createEditFileTool) {
    return {
      edit_file: createEditFileTool(state, backend!, onEvent),
    };
  }
  if (creator === createGlobTool) {
    return {
      glob: createGlobTool(state, backend!, onEvent),
    };
  }
  if (creator === createGrepTool) {
    return {
      grep: createGrepTool(state, backend!, toolResultEvictionLimit, onEvent),
    };
  }

  // Utility tools
  if (creator === createTodosTool) {
    return {
      write_todos: createTodosTool(state, onEvent),
    };
  }
  if (creator === createExecuteTool) {
    // Execute tool requires special handling - needs a sandbox backend
    throw new Error("execute tool cannot be used via selective tools - it requires a SandboxBackendProtocol");
  }

  throw new Error(`Unknown builtin tool creator: ${creator}`);
}

/**
 * Process subagent tool configuration (array or ToolSet) into a ToolSet.
 */
function processSubagentTools(
  toolConfig: ToolSet | SubagentToolConfig[] | undefined,
  state: DeepAgentState,
  options: {
    backend?: BackendProtocol | BackendFactory;
    onEvent?: EventCallback;
    toolResultEvictionLimit?: number;
  }
): ToolSet {
  if (!toolConfig) {
    return {};
  }

  // If it's already a ToolSet object, return as-is
  if (!Array.isArray(toolConfig)) {
    return toolConfig;
  }

  // Process array of SubagentToolConfig items
  let result: ToolSet = {};
  for (const item of toolConfig) {
    if (isBuiltinToolCreator(item)) {
      // Instantiate builtin tool creator
      const instantiated = instantiateBuiltinTool(item, state, options);
      result = { ...result, ...instantiated };
    } else if (typeof item === "object" && item !== null) {
      // Assume it's a ToolSet object
      result = { ...result, ...item };
    }
    // Silently skip invalid items
  }

  return result;
}

/**
 * Options for creating the subagent tool.
 */
export interface CreateSubagentToolOptions {
  /** Default model for subagents (AI SDK LanguageModel instance) */
  defaultModel: LanguageModel;
  /** Default tools available to all subagents */
  defaultTools?: ToolSet;
  /** List of custom subagent specifications */
  subagents?: SubAgent[];
  /** Whether to include the general-purpose agent */
  includeGeneralPurposeAgent?: boolean;
  /** Backend for filesystem operations */
  backend?: BackendProtocol | BackendFactory;
  /** Custom description for the task tool */
  taskDescription?: string | null;
  /** Optional callback for emitting events */
  onEvent?: EventCallback;
  /** Interrupt config to pass to subagents */
  interruptOn?: InterruptOnConfig;
  /** Parent agent options to pass through to subagents */
  parentGenerationOptions?: CreateDeepAgentParams["generationOptions"];
  parentAdvancedOptions?: CreateDeepAgentParams["advancedOptions"];
}

/**
 * Build the system prompt for a subagent.
 */
function buildSubagentSystemPrompt(customPrompt: string): string {
  return `${customPrompt}

${BASE_PROMPT}

${TODO_SYSTEM_PROMPT}

${FILESYSTEM_SYSTEM_PROMPT}`;
}

/**
 * Create the task tool for spawning subagents using ToolLoopAgent.
 */
export function createSubagentTool(
  state: DeepAgentState,
  options: CreateSubagentToolOptions
) {
  const {
    defaultModel,
    defaultTools = {},
    subagents = [],
    includeGeneralPurposeAgent = true,
    backend,
    taskDescription = null,
    onEvent,
    interruptOn,
    parentGenerationOptions,
    parentAdvancedOptions,
  } = options;

  // Build subagent registry (store raw tool config, process during execution)
  const subagentRegistry: Record<
    string,
    {
      systemPrompt: string;
      toolConfig: ToolSet | SubagentToolConfig[] | undefined;
      model: LanguageModel;
      output?: { schema: z.ZodType<any>; description?: string };
    }
  > = {};
  const subagentDescriptions: string[] = [];

  // Add general-purpose agent if enabled
  if (includeGeneralPurposeAgent) {
    subagentRegistry["general-purpose"] = {
      systemPrompt: buildSubagentSystemPrompt(DEFAULT_SUBAGENT_PROMPT),
      toolConfig: defaultTools,
      model: defaultModel,
    };
    subagentDescriptions.push(
      `- general-purpose: ${DEFAULT_GENERAL_PURPOSE_DESCRIPTION}`
    );
  }

  // Add custom subagents (store raw tool config)
  for (const subagent of subagents) {
    subagentRegistry[subagent.name] = {
      systemPrompt: buildSubagentSystemPrompt(subagent.systemPrompt),
      toolConfig: subagent.tools || defaultTools,
      model: subagent.model || defaultModel,
      output: subagent.output,
    };
    subagentDescriptions.push(`- ${subagent.name}: ${subagent.description}`);
  }

  const finalTaskDescription =
    taskDescription || getTaskToolDescription(subagentDescriptions);

  return tool({
    description: finalTaskDescription,
    inputSchema: z.object({
      description: z
        .string()
        .describe("The task to execute with the selected agent"),
      subagent_type: z
        .string()
        .describe(
          `Name of the agent to use. Available: ${Object.keys(subagentRegistry).join(", ")}`
        ),
    }),
    execute: async ({ description, subagent_type }) => {
      // Validate subagent type
      if (!(subagent_type in subagentRegistry)) {
        const allowedTypes = Object.keys(subagentRegistry)
          .map((k) => `\`${k}\``)
          .join(", ");
        return `Error: invoked agent of type ${subagent_type}, the only allowed types are ${allowedTypes}`;
      }

      const subagentConfig = subagentRegistry[subagent_type]!;

      // Find the subagent spec to get its specific options
      const subagentSpec = subagents.find((sa) => sa.name === subagent_type);
      const subagentInterruptOn = subagentSpec?.interruptOn ?? interruptOn;

      // Merge options: subagent-specific options override parent options
      const mergedGenerationOptions = {
        ...parentGenerationOptions,
        ...subagentSpec?.generationOptions,
      };

      const mergedAdvancedOptions = {
        ...parentAdvancedOptions,
        ...subagentSpec?.advancedOptions,
      };

      // Emit subagent start event
      if (onEvent) {
        onEvent({
          type: "subagent-start",
          name: subagent_type,
          task: description,
        });
      }

      // Create a fresh state for the subagent (shares files but have own todos)
      const subagentState: DeepAgentState = {
        todos: [],
        files: state.files, // Share files with parent
      };

      // Process subagent tool configuration (handles both arrays and ToolSet objects)
      const customTools = processSubagentTools(
        subagentConfig.toolConfig,
        subagentState,
        { backend, onEvent }
      );

      // Build default tools (todos + filesystem) that all subagents get
      const todosTool = createTodosTool(subagentState, onEvent);
      const filesystemTools = createFilesystemTools(subagentState, backend, onEvent);

      // Combine default tools with custom tools
      // Custom tools come last so they can override defaults if needed
      let allTools: ToolSet = {
        write_todos: todosTool,
        ...filesystemTools,
        ...customTools,
      };

      // Apply interruptOn config - use subagent's own config if provided, otherwise parent's
      allTools = applyInterruptConfig(allTools, subagentInterruptOn);

      try {
        // Create and run a ToolLoopAgent for the subagent
        const subagentSettings: any = {
          model: subagentConfig.model,
          instructions: subagentConfig.systemPrompt,
          tools: allTools,
          stopWhen: stepCountIs(50), // Enforce 50-step limit for subagents
          // Pass output configuration if subagent has one using AI SDK Output helper
          ...(subagentConfig.output ? { output: Output.object(subagentConfig.output) } : {}),
        };

        // Add merged generation options
        if (Object.keys(mergedGenerationOptions).length > 0) {
          Object.assign(subagentSettings, mergedGenerationOptions);
        }

        // Add merged advanced options (excluding toolChoice and activeTools as per plan)
        if (mergedAdvancedOptions) {
          const { toolChoice, activeTools, ...safeAdvancedOptions } = mergedAdvancedOptions;
          Object.assign(subagentSettings, safeAdvancedOptions);
        }

        // Track subagent step count for events
        let subagentStepCount = 0;

        // Add onStepFinish callback to settings to capture steps
        subagentSettings.onStepFinish = async ({ toolCalls, toolResults }: { toolCalls: any[]; toolResults: any[] }) => {
          // Emit subagent step event with tool calls
          if (onEvent && toolCalls && toolCalls.length > 0) {
            // Map tool calls with their results
            const toolCallsWithResults = toolCalls.map((tc: any, index: number) => ({
              toolName: tc.toolName,
              args: tc.args,
              result: toolResults[index],
            }));

            onEvent({
              type: "subagent-step",
              stepIndex: subagentStepCount++,
              toolCalls: toolCallsWithResults,
            });
          }
        };

        const subagentAgent = new ToolLoopAgent(subagentSettings);

        const result = await subagentAgent.generate({
          prompt: description,
        });

        // Merge any file changes back to parent state
        state.files = { ...state.files, ...subagentState.files };

        const resultText = result.text || "Task completed successfully.";

        // Format output for parent agent
        let formattedResult = resultText;

        // If subagent has structured output, include it in the response
        if (subagentConfig.output && 'output' in result && result.output) {
          formattedResult = `${resultText}\n\n[Structured Output]\n${JSON.stringify(result.output, null, 2)}`;
        }

        // Emit subagent finish event
        if (onEvent) {
          onEvent({
            type: "subagent-finish",
            name: subagent_type,
            result: formattedResult,
          });
        }

        return formattedResult;
      } catch (error: unknown) {
        const err = error as Error;
        const errorMessage = `Error executing subagent: ${err.message}`;

        // Emit subagent finish event with error
        if (onEvent) {
          onEvent({
            type: "subagent-finish",
            name: subagent_type,
            result: errorMessage,
          });
        }

        return errorMessage;
      }
    },
  });
}
