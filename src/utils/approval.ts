/**
 * Utilities for applying tool approval configuration.
 */

import type { ToolSet } from "ai";
import type { InterruptOnConfig, DynamicApprovalConfig } from "../types.ts";

/**
 * Convert interruptOn config to needsApproval function for a tool.
 */
function configToNeedsApproval(
  config: boolean | DynamicApprovalConfig
): boolean | ((args: unknown) => boolean | Promise<boolean>) {
  if (typeof config === "boolean") {
    return config;
  }
  
  if (config.shouldApprove) {
    return config.shouldApprove;
  }
  
  return true;
}

/**
 * Apply interruptOn configuration to a toolset.
 * 
 * This adds the `needsApproval` property to tools based on the config.
 * 
 * @param tools - The original toolset
 * @param interruptOn - Configuration mapping tool names to approval settings
 * @returns New toolset with needsApproval applied
 * 
 * @example
 * ```typescript
 * const approvedTools = applyInterruptConfig(tools, {
 *   write_file: true,
 *   execute: { shouldApprove: (args) => args.command.includes('rm') },
 * });
 * ```
 */
export function applyInterruptConfig(
  tools: ToolSet,
  interruptOn?: InterruptOnConfig
): ToolSet {
  if (!interruptOn) {
    return tools;
  }

  const result: ToolSet = {};

  for (const [name, tool] of Object.entries(tools)) {
    const config = interruptOn[name];
    
    if (config === undefined || config === false) {
      // No approval needed - use tool as-is
      result[name] = tool;
    } else {
      // Apply needsApproval
      result[name] = {
        ...tool,
        needsApproval: configToNeedsApproval(config),
      };
    }
  }

  return result;
}

/**
 * Check if a toolset has any tools requiring approval.
 */
export function hasApprovalTools(interruptOn?: InterruptOnConfig): boolean {
  if (!interruptOn) return false;
  return Object.values(interruptOn).some((v) => v !== false);
}
