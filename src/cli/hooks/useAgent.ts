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
} from "../../types.js";
import { createDeepAgent } from "../../agent.js";
import { parseModelString } from "../../utils/model-parser.js";
import type { FilesystemBackend } from "../../backends/filesystem.js";
import type { ToolCallData } from "../components/Message.js";

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
  backend: FilesystemBackend;
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
const DEFAULT_CLI_INTERRUPT_ON: InterruptOnConfig = {
  execute: true,
  write_file: true,
  edit_file: true,
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

      try {
        for await (const event of agentRef.current.streamWithEvents({
          prompt,
          state,
          messages: messagesRef.current,
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
          // Handle different event types
          switch (event.type) {
            case "text":
              setStatus("streaming");
              accumulatedTextRef.current += event.text;
              totalTextRef.current += event.text;
              setStreamingText(accumulatedTextRef.current);
              break;

            case "step-start":
              // Don't flush here - steps are just markers, text comes after tool results
              if (event.stepNumber > 1) {
                addEvent(event);
              }
              break;

            case "tool-call":
              // Flush text before tool call event
              flushTextSegment();
              setStatus("tool-call");
              // Track the pending tool call
              const pendingToolCall: ToolCallData = {
                toolName: event.toolName,
                args: event.args,
                status: "success", // Will be updated on result
              };
              pendingToolCallsRef.current.set(event.toolCallId, pendingToolCall);
              addEvent(event);
              break;

            case "tool-result":
              // Update the pending tool call with result
              const completedToolCall = pendingToolCallsRef.current.get(event.toolCallId);
              if (completedToolCall) {
                completedToolCall.result = event.result;
                // Move from pending to completed
                toolCallsRef.current.push(completedToolCall);
                setToolCalls([...toolCallsRef.current]);
                pendingToolCallsRef.current.delete(event.toolCallId);
              }
              addEvent(event);
              break;

            case "todos-changed":
              // Flush text before tool-related events
              flushTextSegment();
              setStatus("tool-call");
              setState((prev) => ({ ...prev, todos: event.todos }));
              addEvent(event);
              break;

            case "file-write-start":
              // Flush text before tool-related events
              flushTextSegment();
              setStatus("tool-call");
              addEvent(event);
              break;

            case "file-written":
              setStatus("tool-call");
              addEvent(event);
              break;

            case "file-edited":
              setStatus("tool-call");
              addEvent(event);
              break;

            case "file-read":
              // Flush text before tool-related events
              flushTextSegment();
              setStatus("tool-call");
              addEvent(event);
              break;

            case "ls":
              // Flush text before tool-related events
              flushTextSegment();
              setStatus("tool-call");
              addEvent(event);
              break;

            case "glob":
              // Flush text before tool-related events
              flushTextSegment();
              setStatus("tool-call");
              addEvent(event);
              break;

            case "grep":
              // Flush text before tool-related events
              flushTextSegment();
              setStatus("tool-call");
              addEvent(event);
              break;

            case "subagent-start":
              setStatus("subagent");
              addEvent(event);
              break;

            case "subagent-finish":
              addEvent(event);
              break;

            case "approval-requested":
              // Approval request is handled in onApprovalRequest callback
              // Event is already emitted there, no need to duplicate
              break;

            case "approval-response":
              // Approval response is handled in respondToApproval callback
              // Event is already emitted there, no need to duplicate
              break;

            case "done":
              // Flush any remaining text as a final text-segment
              // This captures the last part of the response that was being streamed
              flushTextSegment();
              setStatus("done");
              setState(event.state);
              // Update messages with the new conversation history
              if (event.messages) {
                setMessages(event.messages);
                messagesRef.current = event.messages;
              }
              addEvent(event);
              break;

            case "error":
              // Flush any remaining text before showing error
              flushTextSegment();
              setStatus("error");
              setError(event.error);
              // Mark any pending tool calls as failed
              for (const [id, tc] of pendingToolCallsRef.current) {
                tc.status = "error";
                toolCallsRef.current.push(tc);
              }
              pendingToolCallsRef.current.clear();
              setToolCalls([...toolCallsRef.current]);
              addEvent(event);
              break;
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
      interruptOn?: InterruptOnConfig | undefined;
    } = {}) => {
      const newModel = overrides.model ?? currentModel;
      const newPromptCaching = overrides.promptCaching ?? promptCachingEnabled;
      const newEvictionLimit = overrides.evictionLimit ?? evictionLimit;
      const newSummarization = overrides.summarization ?? summarizationConfig;
      const newInterruptOn = overrides.interruptOn !== undefined 
        ? overrides.interruptOn 
        : (autoApproveEnabled ? undefined : (options.interruptOn ?? DEFAULT_CLI_INTERRUPT_ON));

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
        ? { enabled: true, tokenThreshold: options.summarization?.tokenThreshold, keepMessages: options.summarization?.keepMessages }
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
    recreateAgent({ 
      interruptOn: enabled ? undefined : (options.interruptOn ?? DEFAULT_CLI_INTERRUPT_ON)
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

