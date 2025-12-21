/**
 * Subagent infrastructure types.
 */

import type { ToolSet, LanguageModel } from "ai";
import type { z } from "zod";
import type { GenerationOptions, AdvancedAgentOptions } from "./core.js";

/**
 * Configuration for dynamic tool approval.
 */
export interface DynamicApprovalConfig {
  /**
   * Function to determine if approval is needed based on tool arguments.
   */
  shouldApprove?: (args: unknown) => boolean | Promise<boolean>;
}

/**
 * Configuration for human-in-the-loop tool approval.
 */
export type InterruptOnConfig = Record<string, boolean | DynamicApprovalConfig>;

/**
 * Type for builtin tool creator functions.
 */
export type BuiltinToolCreator =
  | typeof import("../tools/web.js").createWebSearchTool
  | typeof import("../tools/web.js").createHttpRequestTool
  | typeof import("../tools/web.js").createFetchUrlTool
  | typeof import("../tools/filesystem.js").createLsTool
  | typeof import("../tools/filesystem.js").createReadFileTool
  | typeof import("../tools/filesystem.js").createWriteFileTool
  | typeof import("../tools/filesystem.js").createEditFileTool
  | typeof import("../tools/filesystem.js").createGlobTool
  | typeof import("../tools/filesystem.js").createGrepTool
  | typeof import("../tools/todos.js").createTodosTool
  | typeof import("../tools/execute.js").createExecuteTool;

/**
 * Union type for subagent tool configuration.
 */
export type SubagentToolConfig = ToolSet | BuiltinToolCreator;

/**
 * SubAgent specification for task delegation.
 */
export interface SubAgent {
  /**
   * Unique name identifier for the subagent.
   */
  name: string;

  /**
   * Description shown to the main agent when deciding which subagent to use.
   */
  description: string;

  /**
   * System prompt that defines the subagent's behavior and instructions.
   */
  systemPrompt: string;

  /**
   * Optional custom tools available only to this subagent.
   */
  tools?: ToolSet | SubagentToolConfig[];

  /**
   * Optional model override for this subagent.
   */
  model?: LanguageModel;

  /**
   * Optional interrupt configuration for this subagent.
   */
  interruptOn?: InterruptOnConfig;

  /**
   * Optional structured output configuration for this subagent.
   */
  output?: {
    schema: z.ZodType<any>;
    description?: string;
  };

  /**
   * Advanced generation options for this subagent.
   */
  generationOptions?: GenerationOptions;

  /**
   * Advanced agent options for this subagent.
   */
  advancedOptions?: AdvancedAgentOptions;
}
