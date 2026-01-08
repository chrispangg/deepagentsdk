/**
 * Message transformation adapter for AI SDK Elements
 *
 * Converts deepagentsdk events to Elements UIMessage format
 */

import type { AgentEventLog } from "../../cli/hooks/useAgent.js";
import type { UIMessage, UIMessagePart, UIStatus } from "./types.js";

/**
 * Converts agent event log to UIMessage format expected by Elements
 *
 * @param events - Array of agent events from useAgent hook
 * @param streamingText - Current streaming text (if any)
 * @param uiStatus - Current UI status
 * @returns Array of UIMessage objects for Elements Message component
 *
 * Conversion logic:
 * 1. Group events by role (user/assistant)
 * 2. Convert each event type to appropriate UIMessagePart
 * 3. Handle streaming text as in-progress message
 * 4. Preserve event order and tool call/result pairing
 */
export function convertEventsToUIMessages(
  events: AgentEventLog[],
  streamingText: string,
  uiStatus: UIStatus
): UIMessage[] {
  const messages: UIMessage[] = [];
  let currentAssistantParts: UIMessagePart[] = [];
  let messageIdCounter = 0;

  const generateMessageId = (): string => {
    return `msg-${Date.now()}-${++messageIdCounter}`;
  };

  for (const eventLog of events) {
    const event = eventLog.event;

    switch (event.type) {
      case "user-message":
        // Flush any pending assistant parts before user message
        if (currentAssistantParts.length > 0) {
          messages.push({
            id: generateMessageId(),
            role: "assistant",
            parts: currentAssistantParts,
            status: "ready",
          });
          currentAssistantParts = [];
        }

        // Add user message
        messages.push({
          id: eventLog.id,
          role: "user",
          parts: [{ type: "text", text: event.content }],
          status: "ready",
        });
        break;

      case "text-segment":
        // Add text segment as separate text part
        currentAssistantParts.push({
          type: "text",
          text: event.text,
        });
        break;

      case "tool-call":
        // Add tool call part
        currentAssistantParts.push({
          type: "tool-call",
          toolCallId: event.toolCallId,
          toolName: event.toolName,
          args: event.args,
        });
        break;

      case "tool-result":
        // Add tool result part
        currentAssistantParts.push({
          type: "tool-result",
          toolCallId: event.toolCallId,
          toolName: event.toolName,
          result: event.result,
          isError: event.isError,
        });
        break;

      // Ignore other event types for message rendering
      // (they're handled separately by Elements components like Task, etc.)
      default:
        break;
    }
  }

  // Add streaming text as in-progress assistant message
  if (streamingText || currentAssistantParts.length > 0) {
    if (streamingText) {
      currentAssistantParts.push({ type: "text", text: streamingText });
    }

    // Determine status for current message
    let messageStatus: UIStatus = "ready";
    if (uiStatus === "streaming") {
      messageStatus = "streaming";
    } else if (uiStatus === "submitted") {
      messageStatus = "submitted";
    } else if (uiStatus === "error") {
      messageStatus = "error";
    }

    messages.push({
      id: generateMessageId(),
      role: "assistant",
      parts: currentAssistantParts,
      status: messageStatus,
    });
  }

  return messages;
}

/**
 * Extracts tool parts from the most recent assistant message
 *
 * @param messages - UIMessage array
 * @returns Array of tool parts (tool-call and tool-result)
 */
export function extractToolParts(messages: UIMessage[]) {
  // Get last assistant message
  const lastAssistantMessage = [...messages]
    .reverse()
    .find((m) => m.role === "assistant");

  if (!lastAssistantMessage) {
    return [];
  }

  // Extract only tool-related parts
  return lastAssistantMessage.parts
    .filter(
      (part): part is Extract<UIMessagePart, { type: "tool-call" | "tool-result" }> =>
        part.type === "tool-call" || part.type === "tool-result"
    )
    .map((part) => {
      if (part.type === "tool-call") {
        return {
          type: "tool-call" as const,
          toolCallId: part.toolCallId,
          toolName: part.toolName,
          args: part.args,
        };
      } else {
        return {
          type: "tool-result" as const,
          toolCallId: part.toolCallId,
          toolName: part.toolName,
          result: part.result,
          isError: part.isError,
        };
      }
    });
}
