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

  // Build subagent registry
  const subagentRegistry: Record<
    string,
    {
      systemPrompt: string;
      tools: ToolSet;
      model: LanguageModel;
      output?: { schema: z.ZodType<any>; description?: string };
    }
  > = {};
  const subagentDescriptions: string[] = [];

  // Add general-purpose agent if enabled
  if (includeGeneralPurposeAgent) {
    subagentRegistry["general-purpose"] = {
      systemPrompt: buildSubagentSystemPrompt(DEFAULT_SUBAGENT_PROMPT),
      tools: defaultTools,
      model: defaultModel,
    };
    subagentDescriptions.push(
      `- general-purpose: ${DEFAULT_GENERAL_PURPOSE_DESCRIPTION}`
    );
  }

  // Add custom subagents
  for (const subagent of subagents) {
    subagentRegistry[subagent.name] = {
      systemPrompt: buildSubagentSystemPrompt(subagent.systemPrompt),
      tools: subagent.tools || defaultTools,
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

      // Build tools for subagent (pass event callback for file events)
      const todosTool = createTodosTool(subagentState, onEvent);
      const filesystemTools = createFilesystemTools(subagentState, backend, onEvent);

      let allTools: ToolSet = {
        write_todos: todosTool,
        ...filesystemTools,
        ...subagentConfig.tools,
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

        const subagentAgent = new ToolLoopAgent(subagentSettings);

        const result = await subagentAgent.generate({ prompt: description });

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
