/**
 * AI SDK Elements adapter for deepagentsdk
 *
 * This adapter enables deepagentsdk to work seamlessly with Vercel AI SDK Elements
 * UI components by transforming agent events to the UIMessage format expected by Elements.
 *
 * @module adapters/elements
 * @see https://ai-sdk.dev/elements
 */

export { useElementsAdapter } from "./useElementsAdapter.js";
export type { UseElementsAdapterOptions } from "./useElementsAdapter.js";

export { mapAgentStatusToUIStatus } from "./statusAdapter.js";
export {
  convertEventsToUIMessages,
  extractToolParts,
} from "./messageAdapter.js";

export type {
  UIMessage,
  UIMessagePart,
  UIStatus,
  PromptInputMessage,
  ToolUIPart,
  UseElementsAdapterReturn,
} from "./types.js";
