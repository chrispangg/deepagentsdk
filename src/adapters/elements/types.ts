/**
 * Types for AI SDK Elements server-side adapter
 *
 * This module re-exports relevant types from AI SDK and provides
 * additional types for the server-side route handler.
 *
 * @see https://ai-sdk.dev/elements
 */

// Re-export UI message types from AI SDK for convenience
export type { UIMessage, UIMessagePart } from "ai";

// Re-export the route handler types from the implementation
export type {
  CreateElementsRouteHandlerOptions,
  ElementsRouteHandler,
} from "./createElementsRouteHandler";
