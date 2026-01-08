/**
 * React hook adapter for AI SDK Elements
 *
 * Provides Elements-compatible interface for deepagentsdk
 */

import { useState, useCallback, useRef, useMemo } from "react";
import { createDeepAgent } from "../../agent";
import type { LanguageModel, ToolSet } from "ai";
import type {
  BackendProtocol,
  DeepAgentState,
  DeepAgentEvent,
} from "../../types";
import {
  convertEventsToUIMessages,
  extractToolParts,
} from "./messageAdapter";
import { mapAgentStatusToUIStatus } from "./statusAdapter";
import type { UseElementsAdapterReturn, PromptInputMessage } from "./types";
import type { AgentStatus, AgentEventLog } from "../../cli/hooks/useAgent";

/**
 * Options for useElementsAdapter hook
 */
export interface UseElementsAdapterOptions {
  /**
   * Language model instance from AI SDK provider
   */
  model: LanguageModel;

  /**
   * Backend for state management
   */
  backend: BackendProtocol;

  /**
   * Optional tools to provide to the agent
   */
  tools?: ToolSet;

  /**
   * Maximum number of tool loop iterations
   * @default 10
   */
  maxSteps?: number;

  /**
   * System prompt for the agent
   */
  systemPrompt?: string;
}

let eventCounter = 0;

function createEventId(): string {
  return `event-${++eventCounter}`;
}

/**
 * Hook that adapts deepagentsdk to work with AI SDK Elements UI components
 *
 * @param options - Configuration options
 * @returns Elements-compatible interface
 *
 * @example
 * ```tsx
 * import { useElementsAdapter } from 'deepagentsdk/elements';
 * import { Conversation, Message, PromptInput } from '@/components/ai-elements';
 *
 * function Chat() {
 *   const { uiMessages, sendMessage } = useElementsAdapter({
 *     model,
 *     backend
 *   });
 *
 *   return (
 *     <Conversation>
 *       {uiMessages.map(msg => <Message key={msg.id} from={msg.role} />)}
 *       <PromptInput onSubmit={sendMessage} />
 *     </Conversation>
 *   );
 * }
 * ```
 */
export function useElementsAdapter(
  options: UseElementsAdapterOptions
): UseElementsAdapterReturn {
  const { model, backend, tools, maxSteps = 10, systemPrompt } = options;

  const [status, setStatus] = useState<AgentStatus>("idle");
  const [streamingText, setStreamingText] = useState("");
  const [events, setEvents] = useState<AgentEventLog[]>([]);
  const [state, setState] = useState<DeepAgentState>({
    todos: [],
    files: {},
  });

  const abortControllerRef = useRef<AbortController | null>(null);
  const accumulatedTextRef = useRef("");

  // Create agent instance
  const agentRef = useRef(
    createDeepAgent({
      model,
      maxSteps,
      systemPrompt,
      backend,
      tools,
    })
  );

  const addEvent = useCallback(
    (event: DeepAgentEvent | { type: "text-segment"; text: string }) => {
      setEvents((prev) => [
        ...prev,
        {
          id: createEventId(),
          type: event.type,
          event,
          timestamp: new Date(),
        },
      ]);
    },
    []
  );

  // Flush accumulated text as a text-segment event
  const flushTextSegment = useCallback(() => {
    if (accumulatedTextRef.current.trim()) {
      addEvent({
        type: "text-segment",
        text: accumulatedTextRef.current,
      });
      accumulatedTextRef.current = "";
      setStreamingText("");
    }
  }, [addEvent]);

  const sendMessage = async (message: PromptInputMessage): Promise<void> => {
    if (!message.text.trim()) {
      return; // Ignore empty messages
    }

    // Reset for new generation
    setStatus("thinking");
    setStreamingText("");
    accumulatedTextRef.current = "";

    // Add user message to events
    addEvent({ type: "user-message", content: message.text });

    // Create new abort controller
    abortControllerRef.current = new AbortController();

    try {
      for await (const event of agentRef.current.streamWithEvents({
        messages: [{ role: "user", content: message.text }],
        state,
        abortSignal: abortControllerRef.current.signal,
      })) {
        switch (event.type) {
          case "text":
            setStatus("streaming");
            accumulatedTextRef.current += event.text;
            setStreamingText(accumulatedTextRef.current);
            break;

          case "step-start":
            if (event.stepNumber > 1) {
              addEvent(event);
            }
            break;

          case "tool-call":
            flushTextSegment();
            setStatus("tool-call");
            addEvent(event);
            break;

          case "tool-result":
            addEvent(event);
            break;

          case "todos-changed":
            flushTextSegment();
            setStatus("tool-call");
            setState((prev) => ({ ...prev, todos: event.todos }));
            addEvent(event);
            break;

          case "done":
            flushTextSegment();
            setStatus("done");
            setState(event.state);
            addEvent(event);
            break;

          case "error":
            flushTextSegment();
            setStatus("error");
            addEvent(event);
            break;

          default:
            addEvent(event);
            break;
        }
      }

      setStatus("idle");
    } catch (err) {
      if ((err as Error).name === "AbortError") {
        flushTextSegment();
        setStatus("idle");
      } else {
        flushTextSegment();
        setStatus("error");
      }
    } finally {
      abortControllerRef.current = null;
    }
  };

  const abort = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      setStatus("idle");
    }
  }, []);

  const clear = useCallback(() => {
    setEvents([]);
    setStreamingText("");
    setStatus("idle");
  }, []);

  // Convert agent status to UI status
  const uiStatus = useMemo(
    () => mapAgentStatusToUIStatus(status),
    [status]
  );

  // Convert events to UI messages
  const uiMessages = useMemo(
    () => convertEventsToUIMessages(events, streamingText, uiStatus),
    [events, streamingText, uiStatus]
  );

  // Extract tool parts from current message
  const toolParts = useMemo(() => extractToolParts(uiMessages), [uiMessages]);

  return {
    uiMessages,
    uiStatus,
    toolParts,
    sendMessage,
    abort,
    clear,
  };
}
