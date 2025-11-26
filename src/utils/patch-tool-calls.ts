/**
 * Utility to patch dangling tool calls in message history.
 *
 * When an AI message contains tool_calls but subsequent messages don't include
 * the corresponding tool result responses, this utility adds synthetic
 * tool result messages saying the tool call was cancelled.
 *
 * This prevents errors when sending the conversation history to the model,
 * as models expect every tool call to have a corresponding result.
 */

import type { ModelMessage } from "ai";

/**
 * Check if a message is an assistant message with tool calls.
 */
function hasToolCalls(message: ModelMessage): boolean {
  if (message.role !== "assistant") return false;

  // Check if content contains tool calls
  const content = message.content;
  if (Array.isArray(content)) {
    return content.some(
      (part) => typeof part === "object" && part !== null && "type" in part && part.type === "tool-call"
    );
  }

  return false;
}

/**
 * Extract tool call IDs from an assistant message.
 */
function getToolCallIds(message: ModelMessage): string[] {
  if (message.role !== "assistant") return [];

  const content = message.content;
  if (!Array.isArray(content)) return [];

  const ids: string[] = [];
  for (const part of content) {
    if (
      typeof part === "object" &&
      part !== null &&
      "type" in part &&
      part.type === "tool-call" &&
      "toolCallId" in part
    ) {
      ids.push(part.toolCallId as string);
    }
  }

  return ids;
}

/**
 * Check if a message is a tool result for a specific tool call ID.
 */
function isToolResultFor(message: ModelMessage, toolCallId: string): boolean {
  if (message.role !== "tool") return false;

  // Tool messages should have a toolCallId
  if ("toolCallId" in message && message.toolCallId === toolCallId) {
    return true;
  }

  // Also check content array for tool-result parts
  const content = message.content;
  if (Array.isArray(content)) {
    return content.some(
      (part) =>
        typeof part === "object" &&
        part !== null &&
        "type" in part &&
        part.type === "tool-result" &&
        "toolCallId" in part &&
        part.toolCallId === toolCallId
    );
  }

  return false;
}

/**
 * Create a synthetic tool result message for a cancelled tool call.
 */
function createCancelledToolResult(
  toolCallId: string,
  toolName: string
): ModelMessage {
  return {
    role: "tool",
    content: [
      {
        type: "tool-result",
        toolCallId,
        toolName,
        // Use 'content' which is the correct property for tool results in AI SDK
        content: `Tool call ${toolName} with id ${toolCallId} was cancelled - another message came in before it could be completed.`,
      },
    ],
  } as unknown as ModelMessage;
}

/**
 * Get tool name from a tool call part.
 */
function getToolName(message: ModelMessage, toolCallId: string): string {
  if (message.role !== "assistant") return "unknown";

  const content = message.content;
  if (!Array.isArray(content)) return "unknown";

  for (const part of content) {
    if (
      typeof part === "object" &&
      part !== null &&
      "type" in part &&
      part.type === "tool-call" &&
      "toolCallId" in part &&
      part.toolCallId === toolCallId &&
      "toolName" in part
    ) {
      return part.toolName as string;
    }
  }

  return "unknown";
}

/**
 * Patch dangling tool calls in a message array.
 *
 * Scans for assistant messages with tool_calls that don't have corresponding
 * tool result messages, and adds synthetic "cancelled" responses.
 *
 * @param messages - Array of messages to patch
 * @returns New array with patched messages (original array is not modified)
 *
 * @example
 * ```typescript
 * const messages = [
 *   { role: "user", content: "Hello" },
 *   { role: "assistant", content: [{ type: "tool-call", toolCallId: "1", toolName: "search" }] },
 *   // Missing tool result for tool call "1"
 *   { role: "user", content: "Never mind" },
 * ];
 *
 * const patched = patchToolCalls(messages);
 * // patched now includes a synthetic tool result for the dangling call
 * ```
 */
export function patchToolCalls(messages: ModelMessage[]): ModelMessage[] {
  if (!messages || messages.length === 0) {
    return messages;
  }

  const result: ModelMessage[] = [];

  for (let i = 0; i < messages.length; i++) {
    const message = messages[i];
    if (!message) continue;
    
    result.push(message);

    // Check if this is an assistant message with tool calls
    if (hasToolCalls(message)) {
      const toolCallIds = getToolCallIds(message);

      for (const toolCallId of toolCallIds) {
        // Look for a corresponding tool result in subsequent messages
        let hasResult = false;
        for (let j = i + 1; j < messages.length; j++) {
          const subsequentMsg = messages[j];
          if (subsequentMsg && isToolResultFor(subsequentMsg, toolCallId)) {
            hasResult = true;
            break;
          }
        }

        // If no result found, add a synthetic cancelled result
        if (!hasResult) {
          const toolName = getToolName(message, toolCallId);
          result.push(createCancelledToolResult(toolCallId, toolName));
        }
      }
    }
  }

  return result;
}

/**
 * Check if messages have any dangling tool calls.
 *
 * @param messages - Array of messages to check
 * @returns True if there are dangling tool calls
 */
export function hasDanglingToolCalls(messages: ModelMessage[]): boolean {
  if (!messages || messages.length === 0) {
    return false;
  }

  for (let i = 0; i < messages.length; i++) {
    const message = messages[i];
    if (!message) continue;

    if (hasToolCalls(message)) {
      const toolCallIds = getToolCallIds(message);

      for (const toolCallId of toolCallIds) {
        let hasResult = false;
        for (let j = i + 1; j < messages.length; j++) {
          const subsequentMsg = messages[j];
          if (subsequentMsg && isToolResultFor(subsequentMsg, toolCallId)) {
            hasResult = true;
            break;
          }
        }

        if (!hasResult) {
          return true;
        }
      }
    }
  }

  return false;
}

