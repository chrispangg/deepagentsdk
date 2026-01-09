/**
 * AI SDK Elements server-side adapter for deepagentsdk
 *
 * This adapter enables deepagentsdk to work with Vercel AI SDK Elements
 * UI components by providing a server-side route handler that streams
 * agent responses in UI Message Stream Protocol format.
 *
 * Usage:
 * 1. Create a route handler using createElementsRouteHandler
 * 2. Use useChat hook from @ai-sdk/react on the client
 * 3. Render responses with AI Elements components
 *
 * @example
 * ```typescript
 * // Server: app/api/chat/route.ts
 * import { createDeepAgent } from 'deepagentsdk';
 * import { createElementsRouteHandler } from 'deepagentsdk/adapters/elements';
 * import { anthropic } from '@ai-sdk/anthropic';
 *
 * const agent = createDeepAgent({
 *   model: anthropic('claude-sonnet-4-20250514'),
 * });
 *
 * export const POST = createElementsRouteHandler({ agent });
 *
 * // Client: app/page.tsx
 * import { useChat } from '@ai-sdk/react';
 * import { Message } from '@/components/ai-elements';
 *
 * export default function Chat() {
 *   const { messages, handleSubmit, input, setInput } = useChat();
 *   return (
 *     <div>
 *       {messages.map(m => <Message key={m.id} {...m} />)}
 *       <form onSubmit={handleSubmit}>
 *         <input value={input} onChange={e => setInput(e.target.value)} />
 *       </form>
 *     </div>
 *   );
 * }
 * ```
 *
 * @module adapters/elements
 * @see https://ai-sdk.dev/elements
 * @see https://ai-sdk.dev/docs/ai-sdk-ui/stream-protocol
 */

// Server-side route handler
export { createElementsRouteHandler, mapEventToProtocol } from "./createElementsRouteHandler";
export type {
  CreateElementsRouteHandlerOptions,
  ElementsRouteHandler,
} from "./createElementsRouteHandler";

// Message conversion utilities
export {
  convertUIMessagesToModelMessages,
  extractLastUserMessage,
  hasToolParts,
  countMessagesByRole,
  extractTextFromMessage,
} from "./messageConverters";

// Re-export UI message types from AI SDK for convenience
export type { UIMessage, UIMessagePart } from "ai";
