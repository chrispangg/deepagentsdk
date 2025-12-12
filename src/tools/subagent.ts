/**
 * Subagent tool for task delegation using AI SDK v6 ToolLoopAgent.
 */

import { tool, ToolLoopAgent, stepCountIs, type ToolSet, type LanguageModel } from "ai";
import { z } from "zod";
import type {
  SubAgent,
  DeepAgentState,
  BackendProtocol,
  BackendFactory,
  EventCallback,
  InterruptOnConfig,
} from "../types.ts";
import { applyInterruptConfig } from "../utils/approval.ts";
import {
  getTaskToolDescription,
  DEFAULT_GENERAL_PURPOSE_DESCRIPTION,
  DEFAULT_SUBAGENT_PROMPT,
  TODO_SYSTEM_PROMPT,
  FILESYSTEM_SYSTEM_PROMPT,
  BASE_PROMPT,
} from "../prompts.ts";
import { createTodosTool } from "./todos.ts";
import { createFilesystemTools } from "./filesystem.ts";

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
  } = options;

  // Build subagent registry
  const subagentRegistry: Record<
    string,
    { systemPrompt: string; tools: ToolSet; model: LanguageModel }
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

      // Find the subagent spec to get its interruptOn config
      const subagentSpec = subagents.find((sa) => sa.name === subagent_type);
      const subagentInterruptOn = subagentSpec?.interruptOn ?? interruptOn;

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
        const subagentAgent = new ToolLoopAgent({
          model: subagentConfig.model,
          instructions: subagentConfig.systemPrompt,
          tools: allTools,
          stopWhen: stepCountIs(50), // Allow substantial work
        });

        const result = await subagentAgent.generate({ prompt: description });

        // Merge any file changes back to parent state
        state.files = { ...state.files, ...subagentState.files };

        const resultText = result.text || "Task completed successfully.";

        // Emit subagent finish event
        if (onEvent) {
          onEvent({
            type: "subagent-finish",
            name: subagent_type,
            result: resultText,
          });
        }

        return resultText;
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
