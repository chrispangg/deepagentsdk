/**
 * Utility to parse model strings into LanguageModel instances.
 * Provides backward compatibility for CLI and other string-based model specifications.
 */

import { anthropic } from "@ai-sdk/anthropic";
import { openai } from "@ai-sdk/openai";
import type { LanguageModel } from "ai";

/**
 * Parse a model string into a LanguageModel instance.
 *
 * Supports formats like:
 * - "anthropic/claude-sonnet-4-20250514"
 * - "openai/gpt-4o"
 * - "claude-sonnet-4-20250514" (defaults to Anthropic)
 *
 * @param modelString - The model string to parse
 * @returns A LanguageModel instance
 *
 * @example
 * ```typescript
 * const model = parseModelString("anthropic/claude-sonnet-4-20250514");
 * const agent = createDeepAgent({ model });
 * ```
 */
export function parseModelString(modelString: string): LanguageModel {
  const [provider, modelName] = modelString.split("/");

  if (provider === "anthropic") {
    return anthropic(modelName || "claude-sonnet-4-20250514");
  } else if (provider === "openai") {
    return openai(modelName || "gpt-5-mini") as any;
  }

  // Default to anthropic if no provider specified
  return anthropic(modelString);
}
