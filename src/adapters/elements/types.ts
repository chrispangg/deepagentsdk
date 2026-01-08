/**
 * Types for AI SDK Elements adapter
 *
 * These types align with Vercel AI SDK Elements UI component expectations.
 * @see https://ai-sdk.dev/elements
 */

/**
 * UI message part types that Elements components expect
 */
export type UIMessagePart =
  | {
      type: "text";
      text: string;
    }
  | {
      type: "tool-call";
      toolCallId: string;
      toolName: string;
      args: unknown;
    }
  | {
      type: "tool-result";
      toolCallId: string;
      toolName: string;
      result: unknown;
      isError?: boolean;
    };

/**
 * UI message format expected by Elements Message component
 */
export interface UIMessage {
  id: string;
  role: "user" | "assistant";
  parts: UIMessagePart[];
  status: "submitted" | "streaming" | "ready" | "error";
}

/**
 * UI status that Elements components use
 */
export type UIStatus = "submitted" | "streaming" | "ready" | "error";

/**
 * PromptInput component message format
 */
export interface PromptInputMessage {
  text: string;
}

/**
 * Tool parts extracted from current message for Tool component
 */
export interface ToolUIPart {
  type: "tool-call" | "tool-result";
  toolCallId: string;
  toolName: string;
  args?: unknown;
  result?: unknown;
  isError?: boolean;
}

/**
 * Return type for useElementsAdapter hook
 */
export interface UseElementsAdapterReturn {
  /**
   * Messages formatted for Elements Message component
   */
  uiMessages: UIMessage[];

  /**
   * Current UI status for Elements components
   */
  uiStatus: UIStatus;

  /**
   * Tool parts from current message for Tool component
   */
  toolParts: ToolUIPart[];

  /**
   * Send a message (compatible with PromptInput onSubmit)
   */
  sendMessage: (message: PromptInputMessage) => Promise<void>;

  /**
   * Abort current streaming
   */
  abort: () => void;

  /**
   * Clear all messages
   */
  clear: () => void;
}
