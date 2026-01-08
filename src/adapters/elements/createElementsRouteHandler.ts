/**
 * Server-side route handler adapter for AI SDK Elements
 *
 * Creates a Next.js/Express-compatible route handler that runs DeepAgent
 * and returns UI Message Stream compatible responses for use with useChat.
 *
 * @example
 * ```typescript
 * // app/api/chat/route.ts (Next.js App Router)
 * import { createDeepAgent } from 'deepagentsdk';
 * import { createElementsRouteHandler } from 'deepagentsdk/adapters/elements';
 * import { anthropic } from '@ai-sdk/anthropic';
 *
 * const agent = createDeepAgent({
 *   model: anthropic('claude-sonnet-4-20250514'),
 * });
 *
 * export const POST = createElementsRouteHandler({ agent });
 * ```
 *
 * @see https://ai-sdk.dev/docs/ai-sdk-ui/stream-protocol
 */

import {
  createUIMessageStream,
  createUIMessageStreamResponse,
  convertToModelMessages,
  type UIMessage,
} from "ai";
import type { DeepAgent } from "../../agent";
import type { DeepAgentState, ModelMessage } from "../../types";

/**
 * Options for creating an Elements route handler
 */
export interface CreateElementsRouteHandlerOptions {
  /**
   * The DeepAgent instance to use for handling requests
   */
  agent: DeepAgent;

  /**
   * Optional callback before processing a request.
   * Use for authentication, logging, rate limiting, etc.
   *
   * @example
   * ```typescript
   * onRequest: async (req) => {
   *   const token = req.headers.get('Authorization');
   *   if (!validateToken(token)) {
   *     throw new Error('Unauthorized');
   *   }
   * }
   * ```
   */
  onRequest?: (req: Request) => Promise<void> | void;

  /**
   * Optional initial state to provide to the agent.
   * If not provided, uses empty state { todos: [], files: {} }
   */
  initialState?: DeepAgentState;

  /**
   * Optional thread ID for checkpointing.
   * If provided, enables conversation persistence.
   */
  threadId?: string;

  /**
   * Optional maximum number of steps for the agent loop.
   */
  maxSteps?: number;

  /**
   * Custom ID generator for message IDs.
   * Defaults to crypto.randomUUID if available.
   */
  generateId?: () => string;
}

/**
 * Creates a route handler that processes chat requests using DeepAgent
 * and returns UI Message Stream compatible responses.
 *
 * The returned handler:
 * - Accepts POST requests with { messages: UIMessage[] } body
 * - Runs DeepAgent with the conversation history
 * - Streams responses in UI Message Stream Protocol format
 * - Works with useChat hook from @ai-sdk/react
 *
 * @param options - Configuration options
 * @returns A request handler function compatible with Next.js/Express
 */
export function createElementsRouteHandler(
  options: CreateElementsRouteHandlerOptions
): (req: Request) => Promise<Response> {
  const {
    agent,
    onRequest,
    initialState = { todos: [], files: {} },
    threadId,
    maxSteps,
    generateId,
  } = options;

  return async (req: Request): Promise<Response> => {
    // Run optional request hook (auth, logging, etc.)
    if (onRequest) {
      try {
        await onRequest(req);
      } catch (error) {
        return new Response(
          JSON.stringify({
            error: error instanceof Error ? error.message : "Request rejected",
          }),
          { status: 401, headers: { "Content-Type": "application/json" } }
        );
      }
    }

    // Parse request body
    let requestBody: { messages: UIMessage[] };
    try {
      requestBody = await req.json();
    } catch {
      return new Response(
        JSON.stringify({ error: "Invalid JSON body" }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    const { messages } = requestBody;

    if (!messages || !Array.isArray(messages)) {
      return new Response(
        JSON.stringify({ error: "messages array is required" }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    // Convert UI messages to model messages using AI SDK's converter
    const modelMessages = await convertToModelMessages(messages) as ModelMessage[];

    // Track current text part ID for proper text streaming
    let currentTextId: string | null = null;
    const genId = generateId || (() => crypto.randomUUID());

    // Create the UI message stream
    const stream = createUIMessageStream({
      originalMessages: messages,
      generateId: genId,
      execute: async ({ writer }) => {
        try {
          for await (const event of agent.streamWithEvents({
            messages: modelMessages,
            state: initialState,
            threadId,
            maxSteps,
          })) {
            switch (event.type) {
              case "step-start":
                // Emit step start for UI progress tracking
                writer.write({ type: "start-step" });
                break;

              case "step-finish":
                // Emit step finish
                writer.write({ type: "finish-step" });
                break;

              case "text":
                // Handle text streaming
                if (!currentTextId) {
                  // Start a new text part
                  currentTextId = genId();
                  writer.write({
                    type: "text-start",
                    id: currentTextId,
                  });
                }
                // Stream text delta
                writer.write({
                  type: "text-delta",
                  id: currentTextId,
                  delta: event.text,
                });
                break;

              case "tool-call":
                // End any in-progress text before tool call
                if (currentTextId) {
                  writer.write({ type: "text-end", id: currentTextId });
                  currentTextId = null;
                }
                // Emit tool input available
                writer.write({
                  type: "tool-input-available",
                  toolCallId: event.toolCallId,
                  toolName: event.toolName,
                  input: event.args,
                });
                break;

              case "tool-result":
                // Emit tool output
                if (event.isError) {
                  writer.write({
                    type: "tool-output-error",
                    toolCallId: event.toolCallId,
                    errorText: String(event.result),
                  });
                } else {
                  writer.write({
                    type: "tool-output-available",
                    toolCallId: event.toolCallId,
                    output: event.result,
                  });
                }
                break;

              case "todos-changed":
                // Emit as custom data part for UI to handle
                // Note: This requires UI to handle custom data types
                writer.write({
                  type: "data" as any,
                  name: "todos-changed",
                  data: { todos: event.todos },
                } as any);
                break;

              case "error":
                // End any in-progress text
                if (currentTextId) {
                  writer.write({ type: "text-end", id: currentTextId });
                  currentTextId = null;
                }
                // Emit error
                writer.write({
                  type: "error",
                  errorText: event.error.message,
                });
                break;

              case "done":
                // End any in-progress text
                if (currentTextId) {
                  writer.write({ type: "text-end", id: currentTextId });
                  currentTextId = null;
                }
                // Done event is handled automatically by the stream
                break;

              // Other events (file operations, subagents, etc.) can be
              // emitted as custom data parts if needed by the UI
              default:
                // Optionally emit other events as data parts
                // writer.write({
                //   type: "data" as any,
                //   name: event.type,
                //   data: event,
                // } as any);
                break;
            }
          }

          // Ensure text is ended if stream completes
          if (currentTextId) {
            writer.write({ type: "text-end", id: currentTextId });
          }
        } catch (error) {
          // End any in-progress text on error
          if (currentTextId) {
            writer.write({ type: "text-end", id: currentTextId });
          }
          // Re-throw to let the stream handle the error
          throw error;
        }
      },
      onError: (error) => {
        // Return error message for the stream
        return error instanceof Error ? error.message : "Unknown error";
      },
    });

    // Return the stream response
    return createUIMessageStreamResponse({ stream });
  };
}

/**
 * Type for the request handler returned by createElementsRouteHandler
 */
export type ElementsRouteHandler = (req: Request) => Promise<Response>;
