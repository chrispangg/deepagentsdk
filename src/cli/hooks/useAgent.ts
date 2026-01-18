/**
 * Hook for managing agent streaming and events.
 */
import { useState, useCallback, useRef } from "react";
import type {
  DeepAgentState,
  DeepAgentEvent,
  TodoItem,
  ModelMessage,
  SummarizationConfig,
  InterruptOnConfig,
} from "../../types";
import type { BaseCheckpointSaver } from "../../checkpointer/types";
import { createDeepAgent } from "../../agent";
import { parseModelString } from "../../utils/model-parser";
import type { SandboxBackendProtocol } from "../../types";
import type { ToolCallData } from "../components/Message";
import { useEffect } from "react";
import { DEFAULT_SUMMARIZATION_THRESHOLD, DEFAULT_KEEP_MESSAGES } from "../../constants/limits";

export type AgentStatus =
  | "idle"
  | "thinking"
  | "streaming"
  | "tool-call"
  | "subagent"
  | "done"
  | "error";

export interface AgentEventLog {
  id: string;
  type: DeepAgentEvent["type"] | "text-segment";
  event: DeepAgentEvent | { type: "text-segment"; text: string };
  timestamp: Date;
}

export interface UseAgentOptions {
  model: string;
  maxSteps: number;
  systemPrompt?: string;
  backend: SandboxBackendProtocol;
  /** Enable Anthropic prompt caching */
  enablePromptCaching?: boolean;
  /** Token limit before evicting large tool results */
  toolResultEvictionLimit?: number;
  /** Summarization configuration */
  summarization?: SummarizationConfig;
  /** 
   * Default interruptOn config for CLI.
   * Default: { execute: true, write_file: true, edit_file: true }
   */
  interruptOn?: InterruptOnConfig;
  /** Session ID for checkpoint persistence */
  sessionId?: string;
  /** Checkpoint saver for session persistence */
  checkpointer?: BaseCheckpointSaver;
}

export interface UseAgentReturn {
  /** Current agent status */
  status: AgentStatus;
  /** Current streaming text */
  streamingText: string;
  /** Final text from the last completed generation */
  lastCompletedText: string;
  /** Event log for rendering */
  events: AgentEventLog[];
  /** Current state (todos, files) */
  state: DeepAgentState;
  /** Conversation history */
  messages: ModelMessage[];
  /** Tool calls from the current/last generation */
  toolCalls: ToolCallData[];
  /** Current error if any */
  error: Error | null;
  /** Send a prompt to the agent, returns the final text and tool calls */
  sendPrompt: (prompt: string) => Promise<{ text: string; toolCalls: ToolCallData[] }>;
  /** Abort current generation */
  abort: () => void;
  /** Clear events, messages, and reset */
  clear: () => void;
  /** Clear only the streaming text (after saving to messages) */
  clearStreamingText: () => void;
  /** Clear only the events (after saving to messages) */
  clearEvents: () => void;
  /** Update model */
  setModel: (model: string) => void;
  /** Current model */
  currentModel: string;
  /** Feature flags */
  features: {
    promptCaching: boolean;
    eviction: boolean;
    summarization: boolean;
  };
  /** Toggle prompt caching */
  setPromptCaching: (enabled: boolean) => void;
  /** Toggle eviction */
  setEviction: (enabled: boolean) => void;
  /** Toggle summarization */
  setSummarization: (enabled: boolean) => void;
  /** Current approval request if any */
  pendingApproval: {
    approvalId: string;
    toolName: string;
    args: unknown;
  } | null;
  /** Respond to approval request */
  respondToApproval: (approved: boolean) => void;
  /** Whether auto-approve mode is enabled */
  autoApproveEnabled: boolean;
  /** Toggle auto-approve mode */
  setAutoApprove: (enabled: boolean) => void;
}

let eventCounter = 0;

function createEventId(): string {
  return `event-${++eventCounter}`;
}

// Default interruptOn config for CLI - safe defaults
// Based on LangChain DeepAgents approval pattern
const DEFAULT_CLI_INTERRUPT_ON: InterruptOnConfig = {
  execute: true,
  write_file: true,
  edit_file: true,
  web_search: true,
  fetch_url: true,
  // Note: http_request does NOT require approval per LangChain pattern
};

export function useAgent(options: UseAgentOptions): UseAgentReturn {
  const [status, setStatus] = useState<AgentStatus>("idle");
  const [streamingText, setStreamingText] = useState("");
  const [lastCompletedText, setLastCompletedText] = useState("");
  const [events, setEvents] = useState<AgentEventLog[]>([]);
  const [state, setState] = useState<DeepAgentState>({
    todos: [],
    files: {},
  });
  const [messages, setMessages] = useState<ModelMessage[]>([]);
  const [toolCalls, setToolCalls] = useState<ToolCallData[]>([]);
  const [error, setError] = useState<Error | null>(null);
  const [currentModel, setCurrentModel] = useState(options.model);
  
  // Load session on mount if sessionId and checkpointer are provided
  useEffect(() => {
    const loadSession = async () => {
      if (!options.sessionId || !options.checkpointer) return;
      
      const checkpoint = await options.checkpointer.load(options.sessionId);
      if (checkpoint) {
        setState(checkpoint.state);
        setMessages(checkpoint.messages);
        messagesRef.current = checkpoint.messages;
        // Show restore message via addEvent
        addEvent({
          type: "checkpoint-loaded",
          threadId: options.sessionId,
          step: checkpoint.step,
          messagesCount: checkpoint.messages.length,
        });
      }
    };
    
    loadSession().catch(console.error);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [options.sessionId]);
  
  // Feature flag states (can be toggled at runtime)
  const [promptCachingEnabled, setPromptCachingEnabled] = useState(options.enablePromptCaching ?? false);
  const [evictionLimit, setEvictionLimit] = useState(options.toolResultEvictionLimit ?? 0);
  const [summarizationEnabled, setSummarizationEnabled] = useState(options.summarization?.enabled ?? false);
  const [summarizationConfig, setSummarizationConfig] = useState(options.summarization);
  
  // Auto-approve mode state
  const [autoApproveEnabled, setAutoApproveEnabled] = useState(false);
  
  // Pending approval state
  const [pendingApproval, setPendingApproval] = useState<{
    approvalId: string;
    toolName: string;
    args: unknown;
  } | null>(null);
  const approvalResolverRef = useRef<((approved: boolean) => void) | null>(null);

  const abortControllerRef = useRef<AbortController | null>(null);
  // Use a ref to track accumulated text during streaming (current segment, gets flushed)
  const accumulatedTextRef = useRef("");
  // Use a ref to track total text for return value (never reset mid-generation)
  const totalTextRef = useRef("");
  // Use a ref to track messages during streaming (to pass to agent)
  const messagesRef = useRef<ModelMessage[]>([]);
  // Use a ref to track tool calls during streaming
  const toolCallsRef = useRef<ToolCallData[]>([]);
  // Map to track pending tool calls by ID
  const pendingToolCallsRef = useRef<Map<string, ToolCallData>>(new Map());
  
  // Track feature flags (derived from state)
  const features = {
    promptCaching: promptCachingEnabled,
    eviction: evictionLimit > 0,
    summarization: summarizationEnabled,
  };
  
  const agentRef = useRef(
    createDeepAgent({
      model: parseModelString(currentModel),
      maxSteps: options.maxSteps,
      systemPrompt: options.systemPrompt,
      backend: options.backend,
      enablePromptCaching: promptCachingEnabled,
      toolResultEvictionLimit: evictionLimit,
      summarization: summarizationConfig,
      interruptOn: autoApproveEnabled ? undefined : (options.interruptOn ?? DEFAULT_CLI_INTERRUPT_ON),
      checkpointer: options.checkpointer,
    })
  );

  const addEvent = useCallback((event: DeepAgentEvent | { type: "text-segment"; text: string }) => {
    setEvents((prev) => [
      ...prev,
      {
        id: createEventId(),
        type: event.type,
        event,
        timestamp: new Date(),
      },
    ]);
  }, []);

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

  // ============================================================================
  // Event Handler Context
  // ============================================================================

  /**
   * Context object shared by all event handlers.
   * Contains all refs and setters needed for event processing.
   */
  interface EventHandlerContext {
    setStatus: (status: AgentStatus) => void;
    setState: React.Dispatch<React.SetStateAction<DeepAgentState>>;
    setMessages: React.Dispatch<React.SetStateAction<ModelMessage[]>>;
    setToolCalls: React.Dispatch<React.SetStateAction<ToolCallData[]>>;
    setError: React.Dispatch<React.SetStateAction<Error | null>>;
    addEvent: (event: DeepAgentEvent | { type: "text-segment"; text: string }) => void;
    flushTextSegment: () => void;
    accumulatedTextRef: React.MutableRefObject<string>;
    totalTextRef: React.MutableRefObject<string>;
    toolCallsRef: React.MutableRefObject<ToolCallData[]>;
    pendingToolCallsRef: React.MutableRefObject<Map<string, ToolCallData>>;
    messagesRef: React.MutableRefObject<ModelMessage[]>;
  }

  // ============================================================================
  // Helper Functions for Common Patterns
  // ============================================================================

  /**
   * Common pattern: flush text, set status to "tool-call", add event
   */
  const handleToolEvent = (
    event: DeepAgentEvent,
    ctx: EventHandlerContext
  ) => {
    ctx.flushTextSegment();
    ctx.setStatus("tool-call");
    ctx.addEvent(event);
  };

  // ============================================================================
  // Event Handlers
  // ============================================================================

  /**
   * Handle text streaming events.
   * Accumulates text and updates streaming display.
   */
  const handleTextEvent = (
    event: DeepAgentEvent,
    ctx: EventHandlerContext
  ) => {
    if (event.type !== "text") return;
    ctx.setStatus("streaming");
    ctx.accumulatedTextRef.current += event.text;
    ctx.totalTextRef.current += event.text;
    setStreamingText(ctx.accumulatedTextRef.current);
  };

  /**
   * Handle step-start events.
   * Marks beginning of a new reasoning step.
   */
  const handleStepStartEvent = (
    event: DeepAgentEvent,
    ctx: EventHandlerContext
  ) => {
    if (event.type !== "step-start") return;
    // Don't flush here - steps are just markers, text comes after tool results
    if (event.stepNumber > 1) {
      ctx.addEvent(event);
    }
  };

  /**
   * Handle tool-call events.
   * Tracks pending tool calls until results arrive.
   */
  const handleToolCallEvent = (
    event: DeepAgentEvent,
    ctx: EventHandlerContext
  ) => {
    if (event.type !== "tool-call") return;
    ctx.flushTextSegment();
    ctx.setStatus("tool-call");
    const pendingToolCall: ToolCallData = {
      toolName: event.toolName,
      args: event.args,
      status: "success", // Will be updated on result
    };
    ctx.pendingToolCallsRef.current.set(event.toolCallId, pendingToolCall);
    ctx.addEvent(event);
  };

  /**
   * Handle tool-result events.
   * Updates pending tool call with result and moves to completed list.
   */
  const handleToolResultEvent = (
    event: DeepAgentEvent,
    ctx: EventHandlerContext
  ) => {
    if (event.type !== "tool-result") return;
    const completedToolCall = ctx.pendingToolCallsRef.current.get(
      event.toolCallId
    );
    if (completedToolCall) {
      completedToolCall.result = event.result;
      // Move from pending to completed
      ctx.toolCallsRef.current.push(completedToolCall);
      ctx.setToolCalls([...ctx.toolCallsRef.current]);
      ctx.pendingToolCallsRef.current.delete(event.toolCallId);
    }
    ctx.addEvent(event);
  };

  /**
   * Handle todos-changed events.
   * Updates the todos list in state.
   */
  const handleTodosChangedEvent = (
    event: DeepAgentEvent,
    ctx: EventHandlerContext
  ) => {
    if (event.type !== "todos-changed") return;
    ctx.flushTextSegment();
    ctx.setStatus("tool-call");
    ctx.setState((prev) => ({ ...prev, todos: event.todos }));
    ctx.addEvent(event);
  };

  /**
   * Handle file-write-start events.
   */
  const handleFileWriteStartEvent = (
    event: DeepAgentEvent,
    ctx: EventHandlerContext
  ) => {
    if (event.type !== "file-write-start") return;
    handleToolEvent(event, ctx);
  };

  /**
   * Handle file-written events.
   */
  const handleFileWrittenEvent = (
    event: DeepAgentEvent,
    ctx: EventHandlerContext
  ) => {
    if (event.type !== "file-written") return;
    ctx.setStatus("tool-call");
    ctx.addEvent(event);
  };

  /**
   * Handle file-edited events.
   */
  const handleFileEditedEvent = (
    event: DeepAgentEvent,
    ctx: EventHandlerContext
  ) => {
    if (event.type !== "file-edited") return;
    ctx.setStatus("tool-call");
    ctx.addEvent(event);
  };

  /**
   * Handle file-read events.
   */
  const handleFileReadEvent = (
    event: DeepAgentEvent,
    ctx: EventHandlerContext
  ) => {
    if (event.type !== "file-read") return;
    handleToolEvent(event, ctx);
  };

  /**
   * Handle ls events.
   */
  const handleLsEvent = (event: DeepAgentEvent, ctx: EventHandlerContext) => {
    if (event.type !== "ls") return;
    handleToolEvent(event, ctx);
  };

  /**
   * Handle glob events.
   */
  const handleGlobEvent = (
    event: DeepAgentEvent,
    ctx: EventHandlerContext
  ) => {
    if (event.type !== "glob") return;
    handleToolEvent(event, ctx);
  };

  /**
   * Handle grep events.
   */
  const handleGrepEvent = (
    event: DeepAgentEvent,
    ctx: EventHandlerContext
  ) => {
    if (event.type !== "grep") return;
    handleToolEvent(event, ctx);
  };

  /**
   * Handle web-search-start events.
   */
  const handleWebSearchStartEvent = (
    event: DeepAgentEvent,
    ctx: EventHandlerContext
  ) => {
    if (event.type !== "web-search-start") return;
    handleToolEvent(event, ctx);
  };

  /**
   * Handle web-search-finish events.
   */
  const handleWebSearchFinishEvent = (
    event: DeepAgentEvent,
    ctx: EventHandlerContext
  ) => {
    if (event.type !== "web-search-finish") return;
    ctx.setStatus("tool-call");
    ctx.addEvent(event);
  };

  /**
   * Handle http-request-start events.
   */
  const handleHttpRequestStartEvent = (
    event: DeepAgentEvent,
    ctx: EventHandlerContext
  ) => {
    if (event.type !== "http-request-start") return;
    handleToolEvent(event, ctx);
  };

  /**
   * Handle http-request-finish events.
   */
  const handleHttpRequestFinishEvent = (
    event: DeepAgentEvent,
    ctx: EventHandlerContext
  ) => {
    if (event.type !== "http-request-finish") return;
    ctx.setStatus("tool-call");
    ctx.addEvent(event);
  };

  /**
   * Handle fetch-url-start events.
   */
  const handleFetchUrlStartEvent = (
    event: DeepAgentEvent,
    ctx: EventHandlerContext
  ) => {
    if (event.type !== "fetch-url-start") return;
    handleToolEvent(event, ctx);
  };

  /**
   * Handle fetch-url-finish events.
   */
  const handleFetchUrlFinishEvent = (
    event: DeepAgentEvent,
    ctx: EventHandlerContext
  ) => {
    if (event.type !== "fetch-url-finish") return;
    ctx.setStatus("tool-call");
    ctx.addEvent(event);
  };

  /**
   * Handle subagent-start events.
   */
  const handleSubagentStartEvent = (
    event: DeepAgentEvent,
    ctx: EventHandlerContext
  ) => {
    if (event.type !== "subagent-start") return;
    ctx.setStatus("subagent");
    ctx.addEvent(event);
  };

  /**
   * Handle subagent-finish events.
   */
  const handleSubagentFinishEvent = (
    event: DeepAgentEvent,
    ctx: EventHandlerContext
  ) => {
    if (event.type !== "subagent-finish") return;
    ctx.addEvent(event);
  };

  /**
   * Handle approval-requested events.
   * Already handled in onApprovalRequest callback, so no-op here.
   */
  const handleApprovalRequestedEvent = (
    event: DeepAgentEvent,
    ctx: EventHandlerContext
  ) => {
    // Approval request is handled in onApprovalRequest callback
    // Event is already emitted there, no need to duplicate
  };

  /**
   * Handle approval-response events.
   * Already handled in respondToApproval callback, so no-op here.
   */
  const handleApprovalResponseEvent = (
    event: DeepAgentEvent,
    ctx: EventHandlerContext
  ) => {
    // Approval response is handled in respondToApproval callback
    // Event is already emitted there, no need to duplicate
  };

  /**
   * Handle done events.
   * Flushes remaining text and updates final state.
   */
  const handleDoneEvent = (
    event: DeepAgentEvent,
    ctx: EventHandlerContext
  ) => {
    if (event.type !== "done") return;
    // Flush any remaining text as a final text-segment
    ctx.flushTextSegment();
    ctx.setStatus("done");
    ctx.setState(event.state);
    // Update messages with the new conversation history
    if (event.messages) {
      ctx.setMessages(event.messages);
      ctx.messagesRef.current = event.messages;
    }
    ctx.addEvent(event);
  };

  /**
   * Handle error events.
   * Flushes remaining text and marks pending tool calls as failed.
   */
  const handleErrorEvent = (
    event: DeepAgentEvent,
    ctx: EventHandlerContext
  ) => {
    if (event.type !== "error") return;
    // Flush any remaining text before showing error
    ctx.flushTextSegment();
    ctx.setStatus("error");
    ctx.setError(event.error);
    // Mark any pending tool calls as failed
    for (const [id, tc] of ctx.pendingToolCallsRef.current) {
      tc.status = "error";
      ctx.toolCallsRef.current.push(tc);
    }
    ctx.pendingToolCallsRef.current.clear();
    ctx.setToolCalls([...ctx.toolCallsRef.current]);
    ctx.addEvent(event);
  };

  /**
   * Type-safe event handler function.
   */
  type EventHandler = (event: DeepAgentEvent, ctx: EventHandlerContext) => void;

  /**
   * Event handler map.
   * Maps event types to their handler functions.
   */
  const EVENT_HANDLERS: Record<string, EventHandler> = {
    "text": handleTextEvent,
    "step-start": handleStepStartEvent,
    "tool-call": handleToolCallEvent,
    "tool-result": handleToolResultEvent,
    "todos-changed": handleTodosChangedEvent,
    "file-write-start": handleFileWriteStartEvent,
    "file-written": handleFileWrittenEvent,
    "file-edited": handleFileEditedEvent,
    "file-read": handleFileReadEvent,
    "ls": handleLsEvent,
    "glob": handleGlobEvent,
    "grep": handleGrepEvent,
    "web-search-start": handleWebSearchStartEvent,
    "web-search-finish": handleWebSearchFinishEvent,
    "http-request-start": handleHttpRequestStartEvent,
    "http-request-finish": handleHttpRequestFinishEvent,
    "fetch-url-start": handleFetchUrlStartEvent,
    "fetch-url-finish": handleFetchUrlFinishEvent,
    "subagent-start": handleSubagentStartEvent,
    "subagent-finish": handleSubagentFinishEvent,
    "approval-requested": handleApprovalRequestedEvent,
    "approval-response": handleApprovalResponseEvent,
    "done": handleDoneEvent,
    "error": handleErrorEvent,
  };

  // ============================================================================
  // Main sendPrompt Function
  // ============================================================================

  const sendPrompt = useCallback(
    async (prompt: string): Promise<{ text: string; toolCalls: ToolCallData[] }> => {
      // Reset for new generation - but keep events for history
      setStatus("thinking");
      setStreamingText("");
      // Don't clear events - they serve as conversation history
      setToolCalls([]);
      setError(null);
      accumulatedTextRef.current = "";
      totalTextRef.current = "";
      toolCallsRef.current = [];
      pendingToolCallsRef.current.clear();

      // Add user message to events for history
      addEvent({ type: "user-message", content: prompt });

      // Sync messages ref with current state
      messagesRef.current = messages;

      // Create new abort controller
      abortControllerRef.current = new AbortController();

      // Build the input messages array for streamWithEvents
      // Append the new prompt to the conversation history (if any exists)
      const inputMessages = messagesRef.current.length > 0
        ? [
            ...messagesRef.current,
            { role: "user", content: prompt } as ModelMessage,
          ]
        : [{ role: "user", content: prompt } as ModelMessage]; // First message: just the prompt

      try {
        for await (const event of agentRef.current.streamWithEvents({
          messages: inputMessages, // Always use messages parameter (built with or without history)
          state,
          threadId: options.sessionId,
          abortSignal: abortControllerRef.current.signal,
          // Approval callback - auto-approve or prompt user
          onApprovalRequest: async (request) => {
            // If auto-approve is enabled, immediately approve
            if (autoApproveEnabled) {
              addEvent({ 
                type: "approval-requested", 
                ...request,
              });
              addEvent({ 
                type: "approval-response", 
                approvalId: request.approvalId, 
                approved: true 
              });
              return true;
            }
            
            // Otherwise, show approval UI and wait for user response
            setPendingApproval({
              approvalId: request.approvalId,
              toolName: request.toolName,
              args: request.args,
            });
            addEvent({ type: "approval-requested", ...request });
            
            // Return a promise that resolves when user responds
            return new Promise<boolean>((resolve) => {
              approvalResolverRef.current = resolve;
            });
          },
        })) {
          // Create event handler context
          const eventHandlerContext: EventHandlerContext = {
            setStatus,
            setState,
            setMessages,
            setToolCalls,
            setError,
            addEvent,
            flushTextSegment,
            accumulatedTextRef,
            totalTextRef,
            toolCallsRef,
            pendingToolCallsRef,
            messagesRef,
          };

          // Get the handler for this event type
          const handler = EVENT_HANDLERS[event.type];
          if (handler) {
            handler(event, eventHandlerContext);
          }
        }

        // Save the final text and tool calls before resetting
        const finalText = totalTextRef.current;
        const finalToolCalls = [...toolCallsRef.current];
        setLastCompletedText(finalText);
        setStatus("idle");
        return { text: finalText, toolCalls: finalToolCalls };
      } catch (err) {
        if ((err as Error).name === "AbortError") {
          // Flush remaining text before aborting
          flushTextSegment();
          setStatus("idle");
          return { text: totalTextRef.current, toolCalls: toolCallsRef.current };
        } else {
          // Flush remaining text before showing error
          flushTextSegment();
          setStatus("error");
          setError(err as Error);
          return { text: "", toolCalls: [] };
        }
      } finally {
        abortControllerRef.current = null;
      }
        },
    [state, messages, addEvent, flushTextSegment, autoApproveEnabled]
  );


  const abort = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      setStatus("idle");
    }
  }, []);

  const clear = useCallback(() => {
    setEvents([]);
    setStreamingText("");
    setLastCompletedText("");
    setMessages([]);
    setToolCalls([]);
    messagesRef.current = [];
    toolCallsRef.current = [];
    pendingToolCallsRef.current.clear();
    setError(null);
    setStatus("idle");
  }, []);

  const clearStreamingText = useCallback(() => {
    setStreamingText("");
    setEvents([]);
  }, []);

  const clearEvents = useCallback(() => {
    setEvents([]);
  }, []);

  // Helper to recreate the agent with current settings
  const recreateAgent = useCallback(
    (overrides: {
      model?: string;
      promptCaching?: boolean;
      evictionLimit?: number;
      summarization?: SummarizationConfig;
      interruptOn?: InterruptOnConfig | null; // null means explicitly no interruptOn (auto-approve)
    } = {}) => {
      const newModel = overrides.model ?? currentModel;
      const newPromptCaching = overrides.promptCaching ?? promptCachingEnabled;
      const newEvictionLimit = overrides.evictionLimit ?? evictionLimit;
      const newSummarization = overrides.summarization ?? summarizationConfig;
      
      // Handle interruptOn: null = explicit no approval, undefined = use current state
      let newInterruptOn: InterruptOnConfig | undefined;
      if (overrides.interruptOn === null) {
        // Explicitly disable approval (auto-approve mode)
        newInterruptOn = undefined;
      } else if (overrides.interruptOn !== undefined) {
        // Use the provided config
        newInterruptOn = overrides.interruptOn;
      } else {
        // Use current state to determine
        newInterruptOn = autoApproveEnabled ? undefined : (options.interruptOn ?? DEFAULT_CLI_INTERRUPT_ON);
      }

      agentRef.current = createDeepAgent({
        model: parseModelString(newModel),
        maxSteps: options.maxSteps,
        systemPrompt: options.systemPrompt,
        backend: options.backend,
        enablePromptCaching: newPromptCaching,
        toolResultEvictionLimit: newEvictionLimit,
        summarization: newSummarization,
        interruptOn: newInterruptOn,
      });
    },
    [currentModel, promptCachingEnabled, evictionLimit, summarizationConfig, autoApproveEnabled, options.maxSteps, options.systemPrompt, options.backend, options.interruptOn]
  );

  const setModel = useCallback(
    (model: string) => {
      setCurrentModel(model);
      recreateAgent({ model });
    },
    [recreateAgent]
  );

  const setPromptCaching = useCallback(
    (enabled: boolean) => {
      setPromptCachingEnabled(enabled);
      recreateAgent({ promptCaching: enabled });
    },
    [recreateAgent]
  );

  const setEviction = useCallback(
    (enabled: boolean) => {
      const newLimit = enabled ? (options.toolResultEvictionLimit || 20000) : 0;
      setEvictionLimit(newLimit);
      recreateAgent({ evictionLimit: newLimit });
    },
    [recreateAgent, options.toolResultEvictionLimit]
  );

  const setSummarization = useCallback(
    (enabled: boolean) => {
      setSummarizationEnabled(enabled);
      const newConfig = enabled
        ? {
            enabled: true,
            tokenThreshold: options.summarization?.tokenThreshold ?? DEFAULT_SUMMARIZATION_THRESHOLD,
            keepMessages: options.summarization?.keepMessages ?? DEFAULT_KEEP_MESSAGES,
          }
        : undefined;
      setSummarizationConfig(newConfig);
      recreateAgent({ summarization: newConfig });
    },
    [recreateAgent, options.summarization]
  );

  // Respond to approval request
  const respondToApproval = useCallback((approved: boolean) => {
    if (approvalResolverRef.current) {
      approvalResolverRef.current(approved);
      approvalResolverRef.current = null;
      const currentApproval = pendingApproval;
      setPendingApproval(null);
      if (currentApproval) {
        addEvent({ 
          type: "approval-response", 
          approvalId: currentApproval.approvalId, 
          approved 
        });
      }
    }
  }, [addEvent]);

  // Toggle auto-approve and recreate agent
  const setAutoApprove = useCallback((enabled: boolean) => {
    setAutoApproveEnabled(enabled);
    
    // When enabling auto-approve, immediately approve any pending request
    if (enabled && approvalResolverRef.current) {
      respondToApproval(true);
    }
    
    // Recreate agent with/without interruptOn config
    // Use null to explicitly disable approval, or the config to enable it
    recreateAgent({ 
      interruptOn: enabled ? null : (options.interruptOn ?? DEFAULT_CLI_INTERRUPT_ON)
    });
  }, [recreateAgent, options.interruptOn, respondToApproval]);

  return {
    status,
    streamingText,
    lastCompletedText,
    events,
    state,
    messages,
    toolCalls,
    error,
    sendPrompt,
    abort,
    clear,
    clearStreamingText,
    clearEvents,
    setModel,
    currentModel,
    features,
    setPromptCaching,
    setEviction,
    setSummarization,
    pendingApproval,
    respondToApproval,
    autoApproveEnabled,
    setAutoApprove,
  };
}

