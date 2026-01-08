/**
 * AI SDK Elements adapter for deepagentsdk
 *
 * This adapter enables deepagentsdk to work seamlessly with Vercel AI SDK Elements
 * UI components by transforming agent events to the UIMessage format expected by Elements.
 *
 * @module adapters/elements
 * @see https://ai-sdk.dev/elements
 */

export { useElementsAdapter } from "./useElementsAdapter";
export type { UseElementsAdapterOptions } from "./useElementsAdapter";

export { mapAgentStatusToUIStatus } from "./statusAdapter";
export {
  convertEventsToUIMessages,
  extractToolParts,
} from "./messageAdapter";

export type {
  UIMessage,
  UIMessagePart,
  UIStatus,
  PromptInputMessage,
  ToolUIPart,
  UseElementsAdapterReturn,
} from "./types";
