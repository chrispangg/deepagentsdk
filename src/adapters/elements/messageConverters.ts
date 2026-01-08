/**
 * Message conversion utilities for AI SDK Elements adapter
 *
 * Provides utilities for converting between UI message formats and model message formats.
 * The primary conversion is handled by AI SDK's `convertToModelMessages`, but these
 * utilities provide additional helpers for DeepAgent-specific needs.
 */

import {
  convertToModelMessages,
  type UIMessage,
} from "ai";
import type { ModelMessage } from "../../types";

/**
 * Re-export AI SDK's convertToModelMessages for convenience.
 *
 * This function converts UIMessage[] (from useChat) to ModelMessage[]
 * (for agent consumption), handling:
 * - Role mapping (user/assistant)
 * - Tool call/result parts
 * - Text content extraction
 *
 * @example
 * ```typescript
 * import { convertUIMessagesToModelMessages } from 'deepagentsdk/adapters/elements';
 *
 * const modelMessages = await convertUIMessagesToModelMessages(uiMessages);
 * ```
 */
export async function convertUIMessagesToModelMessages(
  messages: UIMessage[]
): Promise<ModelMessage[]> {
  return await convertToModelMessages(messages) as ModelMessage[];
}

/**
 * Extract the last user message text from a UIMessage array.
 * Useful for extracting the prompt from a conversation.
 *
 * @param messages - Array of UI messages
 * @returns The text content of the last user message, or undefined if none
 */
export function extractLastUserMessage(messages: UIMessage[]): string | undefined {
  // Find the last user message
  for (let i = messages.length - 1; i >= 0; i--) {
    const msg = messages[i];
    if (msg && msg.role === "user" && msg.parts) {
      // Extract text parts
      const textParts = msg.parts.filter(
        (p): p is { type: "text"; text: string } => p.type === "text"
      );
      if (textParts.length > 0) {
        return textParts.map(p => p.text).join("");
      }
    }
  }
  return undefined;
}

/**
 * Check if the messages contain any tool parts.
 * This is a simplified helper that checks for any tool-related parts.
 *
 * @param messages - Array of UI messages
 * @returns True if there are any tool-related parts in the messages
 */
export function hasToolParts(messages: UIMessage[]): boolean {
  for (const msg of messages) {
    if (!msg.parts) continue;
    for (const part of msg.parts) {
      // Tool parts have type starting with "tool-" or "dynamic-tool"
      if (part.type.startsWith("tool-") || part.type === "dynamic-tool") {
        return true;
      }
    }
  }
  return false;
}

/**
 * Count the number of messages by role.
 *
 * @param messages - Array of UI messages
 * @returns Object with counts by role
 */
export function countMessagesByRole(
  messages: UIMessage[]
): { user: number; assistant: number; system: number } {
  let user = 0;
  let assistant = 0;
  let system = 0;

  for (const msg of messages) {
    if (msg.role === "user") {
      user++;
    } else if (msg.role === "assistant") {
      assistant++;
    } else if (msg.role === "system") {
      system++;
    }
  }

  return { user, assistant, system };
}

/**
 * Extract all text content from a message.
 *
 * @param message - A UI message
 * @returns Combined text from all text parts
 */
export function extractTextFromMessage(message: UIMessage): string {
  if (!message.parts) return "";

  return message.parts
    .filter((p): p is { type: "text"; text: string } => p.type === "text")
    .map(p => p.text)
    .join("");
}
