#!/usr/bin/env bun
/**
 * Deep Agent CLI - Interactive terminal interface using Ink.
 *
 * Usage:
 *   ANTHROPIC_API_KEY=xxx bunx deep-agent-ink
 *   ANTHROPIC_API_KEY=xxx bun src/cli-ink/index.tsx
 *
 * Or with options:
 *   ANTHROPIC_API_KEY=xxx bunx deep-agent-ink --model anthropic/claude-sonnet-4-20250514
 */

import React, { useState, useEffect, useCallback } from "react";
import { render, useApp, useInput, Box, Text, Static } from "ink";
import { LocalSandbox } from "../backends/local-sandbox";
import {
  DEFAULT_EVICTION_TOKEN_LIMIT,
  DEFAULT_SUMMARIZATION_THRESHOLD,
  DEFAULT_KEEP_MESSAGES,
  CONTEXT_WINDOW,
} from "../constants/limits";
import { FileSaver } from "../checkpointer/file-saver";
import { useAgent, type AgentEventLog } from "./hooks/useAgent";
import {
  Welcome,
  WelcomeHint,
  Input,
  SlashMenuPanel,
  Message,
  StreamingMessage,
  TodoList,
  FilePreview,
  FileWritten,
  FileEdited,
  FileRead,
  LsResult,
  GlobResult,
  GrepResult,
  FileList,
  ToolCall,
  StepIndicator,
  ThinkingIndicator,
  DoneIndicator,
  ErrorDisplay,
  SubagentStart,
  SubagentFinish,
  StatusBar,
  ModelSelectionPanel,
  ApiKeyInputPanel,
  BaseURLInput,
  ToolApproval,
  type MessageData,
} from "./components/index";
import { parseCommand, colors, SLASH_COMMANDS } from "./theme";
import type { FileInfo } from "../types";
import { parseModelString, setProvidersConfig, getProvidersConfig, type ProvidersConfig } from "@/utils/model-parser";
import { estimateMessagesTokens } from "../utils/summarization";

// ============================================================================
// CLI Arguments
// ============================================================================

interface CLIOptions {
  model?: string;
  maxSteps?: number;
  systemPrompt?: string;
  workDir?: string;
  session?: string;
  // New feature flags
  enablePromptCaching?: boolean;
  toolResultEvictionLimit?: number;
  enableSummarization?: boolean;
  summarizationThreshold?: number;
  summarizationKeepMessages?: number;
  // Provider configuration
  anthropicBaseURL?: string;
  openaiBaseURL?: string;
  zhipuBaseURL?: string;
  anthropicApiKey?: string;
  openaiApiKey?: string;
  zhipuApiKey?: string;
}

// Default values for features (enabled by default)
const DEFAULT_PROMPT_CACHING = true;
const DEFAULT_EVICTION_LIMIT = DEFAULT_EVICTION_TOKEN_LIMIT;
const DEFAULT_SUMMARIZATION = true;
const DEFAULT_SUMMARIZATION_THRESHOLD_VALUE = DEFAULT_SUMMARIZATION_THRESHOLD;
const DEFAULT_SUMMARIZATION_KEEP = DEFAULT_KEEP_MESSAGES;

function parseArgs(): CLIOptions {
  const args = process.argv.slice(2);
  // Start with defaults enabled
  const options: CLIOptions = {
    enablePromptCaching: DEFAULT_PROMPT_CACHING,
    toolResultEvictionLimit: DEFAULT_EVICTION_LIMIT,
    enableSummarization: DEFAULT_SUMMARIZATION,
    summarizationThreshold: DEFAULT_SUMMARIZATION_THRESHOLD_VALUE,
    summarizationKeepMessages: DEFAULT_SUMMARIZATION_KEEP,
  };

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];

    if (arg === "--model" || arg === "-m") {
      options.model = args[++i];
    } else if (arg === "--max-steps" || arg === "-s") {
      const val = args[++i];
      if (val) options.maxSteps = parseInt(val, 10);
    } else if (arg === "--prompt" || arg === "-p") {
      options.systemPrompt = args[++i];
    } else if (arg === "--dir" || arg === "-d") {
      options.workDir = args[++i];
    } else if (arg === "--cache" || arg === "--prompt-caching") {
      options.enablePromptCaching = true;
    } else if (arg === "--no-cache" || arg === "--no-prompt-caching") {
      options.enablePromptCaching = false;
    } else if (arg === "--eviction-limit" || arg === "-e") {
      const val = args[++i];
      if (val) options.toolResultEvictionLimit = parseInt(val, 10);
    } else if (arg === "--no-eviction") {
      options.toolResultEvictionLimit = 0;
    } else if (arg === "--summarize" || arg === "--auto-summarize") {
      options.enableSummarization = true;
    } else if (arg === "--no-summarize" || arg === "--no-auto-summarize") {
      options.enableSummarization = false;
    } else if (arg === "--summarize-threshold") {
      const val = args[++i];
      if (val) {
        options.summarizationThreshold = parseInt(val, 10);
        options.enableSummarization = true;
      }
    } else if (arg === "--summarize-keep") {
      const val = args[++i];
      if (val) {
        options.summarizationKeepMessages = parseInt(val, 10);
        options.enableSummarization = true;
      }
    } else if (arg === "--session") {
      const val = args[++i];
      if (val) options.session = val;
    } else if (arg && arg.startsWith("--session=")) {
      const sessionVal = arg.split("=")[1];
      if (sessionVal) options.session = sessionVal;
    } else if (arg === "--anthropic-base-url") {
      options.anthropicBaseURL = args[++i];
    } else if (arg === "--openai-base-url") {
      options.openaiBaseURL = args[++i];
    } else if (arg === "--zhipu-base-url") {
      options.zhipuBaseURL = args[++i];
    } else if (arg === "--anthropic-api-key") {
      options.anthropicApiKey = args[++i];
    } else if (arg === "--openai-api-key") {
      options.openaiApiKey = args[++i];
    } else if (arg === "--zhipu-api-key") {
      options.zhipuApiKey = args[++i];
    } else if (arg === "--help" || arg === "-h") {
      printHelp();
      process.exit(0);
    }
  }

  return options;
}

const DEEP_AGENTS_ASCII = `
  █████╗  ██╗      ███████╗ ██████╗  ██╗  ██╗
 ██╔══██╗ ██║      ██╔════╝ ██╔══██╗ ██║ ██╔╝
 ███████║ ██║█████╗███████╗ ██║  ██║ █████╔╝
 ██╔══██║ ██║╚════╝╚════██║ ██║  ██║ ██╔═██╗
 ██║  ██║ ██║      ███████║ ██████╔╝ ██║  ██╗
 ╚═╝  ╚═╝ ╚═╝      ╚══════╝ ╚═════╝  ╚═╝  ╚═╝

 ██████╗  ███████╗ ███████╗ ██████╗
 ██╔══██╗ ██╔════╝ ██╔════╝ ██╔══██╗
 ██║  ██║ █████╗   █████╗   ██████╔╝
 ██║  ██║ ██╔══╝   ██╔══╝   ██╔═══╝
 ██████╔╝ ███████╗ ███████╗ ██║
 ╚═════╝  ╚══════╝ ╚══════╝ ╚═╝

  █████╗   ██████╗  ███████╗ ███╗   ██╗ ████████╗
 ██╔══██╗ ██╔════╝  ██╔════╝ ████╗  ██║ ╚══██╔══╝
 ███████║ ██║  ███╗ █████╗   ██╔██╗ ██║    ██║
 ██╔══██║ ██║   ██║ ██╔══╝   ██║╚██╗██║    ██║
 ██║  ██║ ╚██████╔╝ ███████╗ ██║ ╚████║    ██║
 ╚═╝  ╚═╝  ╚═════╝  ╚══════╝ ╚═╝  ╚═══╝    ╚═╝
`;


function printHelp(): void {
  console.log(`
${DEEP_AGENTS_ASCII}

Usage:
  bun src/cli-ink/index.tsx [options]

Options:
  --model, -m <model>       Model to use (default: anthropic/claude-haiku-4-5-20251001)
  --max-steps, -s <number>  Maximum steps per generation (default: 100)
  --prompt, -p <prompt>     Custom system prompt
  --dir, -d <directory>     Working directory for file operations (default: current dir)
  --help, -h                Show this help

Provider Configuration:
  --anthropic-base-url <url>  Custom base URL for Anthropic API
  --openai-base-url <url>     Custom base URL for OpenAI API
  --zhipu-base-url <url>      Custom base URL for Zhipu API
  --anthropic-api-key <key>   Anthropic API key (overrides environment variable)
  --openai-api-key <key>      OpenAI API key (overrides environment variable)
  --zhipu-api-key <key>       Zhipu AI API key (overrides environment variable)

Performance & Memory (all enabled by default):
  --no-cache                Disable prompt caching (enabled by default for Anthropic)
  --no-eviction             Disable tool result eviction (enabled by default: 20k tokens)
  --eviction-limit, -e <n>  Set custom eviction token limit
  --no-summarize            Disable auto-summarization (enabled by default)
  --summarize-threshold <n> Token threshold to trigger summarization (default: 170000)
  --summarize-keep <n>      Number of recent messages to keep intact (default: 6)

Runtime Commands:
  /cache on|off             Toggle prompt caching
  /eviction on|off          Toggle tool result eviction
  /summarize on|off         Toggle auto-summarization
  /features                 Show current feature status

API Keys:
  The CLI automatically loads API keys from:
  1. Environment variables (ANTHROPIC_API_KEY, OPENAI_API_KEY, ZHIPU_API_KEY, TAVILY_API_KEY)
  2. .env or .env.local file in the working directory

  Example .env file:
    ANTHROPIC_API_KEY=sk-ant-...
    OPENAI_API_KEY=sk-...
    ZHIPU_API_KEY=...
    ANTHROPIC_BASE_URL=https://custom-endpoint.com/v1
    OPENAI_BASE_URL=https://custom-openai-endpoint.com/v1
    ZHIPU_BASE_URL=https://api.z.ai/api/coding/paas/v4
    TAVILY_API_KEY=tvly-...  # For web_search tool

Examples:
  bun src/cli-ink/index.tsx                                    # uses .env file
  bun src/cli-ink/index.tsx --dir ./my-project                 # loads .env from ./my-project
  ANTHROPIC_API_KEY=xxx bun src/cli-ink/index.tsx              # env var takes precedence
  bun src/cli-ink/index.tsx --model anthropic/claude-sonnet-4-20250514

  # Use Zhipu with custom base URL
  bun src/cli-ink/index.tsx --model zhipu/glm-4-plus --zhipu-base-url https://api.z.ai/api/coding/paas/v4

  # Use Anthropic with custom API key
  bun src/cli-ink/index.tsx --model anthropic/claude-3.5-sonnet --anthropic-api-key sk-custom-...
`);
}

// ============================================================================
// Main App Component
// ============================================================================

interface AppProps {
  options: CLIOptions;
  backend: LocalSandbox;
}

type PanelView = "none" | "help" | "todos" | "files" | "file-content" | "apikey-input" | "baseurl-input" | "features" | "tokens" | "models";

interface PanelState {
  view: PanelView;
  fileContent?: string;
  filePath?: string;
  files?: FileInfo[];
  tokenCount?: number;
}

function App({ options, backend }: AppProps): React.ReactElement {
  const { exit } = useApp();

  // Build summarization config if enabled
  const summarizationConfig = options.enableSummarization
    ? {
        enabled: true,
        tokenThreshold: options.summarizationThreshold ?? DEFAULT_SUMMARIZATION_THRESHOLD,
        keepMessages: options.summarizationKeepMessages ?? DEFAULT_KEEP_MESSAGES,
      }
    : undefined;

  // Create checkpointer if session is provided
  const checkpointer = options.session
    ? new FileSaver({ dir: "./.checkpoints" })
    : undefined;

  // Agent hook with new feature options
  const agent = useAgent({
    model: options.model || "anthropic/claude-haiku-4-5-20251001",
    maxSteps: options.maxSteps || 100,
    systemPrompt: options.systemPrompt,
    backend,
    enablePromptCaching: options.enablePromptCaching,
    toolResultEvictionLimit: options.toolResultEvictionLimit,
    summarization: summarizationConfig,
    sessionId: options.session,
    checkpointer,
    // Default interruptOn config for CLI - safe defaults
    interruptOn: {
      execute: true,
      write_file: true,
      edit_file: true,
    },
  });

  // UI state
  const [messages, setMessages] = useState<MessageData[]>([]);
  const [showWelcome, setShowWelcome] = useState(true);
  const [panel, setPanel] = useState<PanelState>({ view: "none" });

  // Handle Ctrl+C to abort generation
  useInput((input, key) => {
    if (key.ctrl && input === "c") {
      if (agent.status !== "idle") {
        agent.abort();
      } else {
        exit();
      }
    }
    if (key.ctrl && input === "d") {
      exit();
    }
  });

  // Handle input submission
  const handleSubmit = useCallback(
    async (input: string) => {
      const trimmed = input.trim();
      if (!trimmed) return;

      // Hide welcome on first input
      if (showWelcome) {
        setShowWelcome(false);
      }

      // Check for commands
      const { isCommand, command, args } = parseCommand(trimmed);

      if (isCommand) {
        await handleCommand(command, args);
        return;
      }

      // Clear any panel
      setPanel({ view: "none" });

      // Send to agent - user message is added to events by useAgent hook
      // Events serve as the conversation history with proper formatting
      await agent.sendPrompt(trimmed);
    },
    [showWelcome, agent]
  );

  // Handle slash commands
  const handleCommand = async (command?: string, args?: string) => {
    // Show slash menu if just "/"
    if (!command || command === "") {
      setPanel({ view: "help" });
      return;
    }

    switch (command) {
      case "todos":
      case "todo":
      case "t":
        setPanel({ view: "todos" });
        break;

      case "files":
      case "file":
      case "f":
        try {
          const files = await backend.lsInfo(".");
          setPanel({ view: "files", files });
        } catch (err) {
          // Handle error
        }
        break;

      case "read":
      case "r":
        if (!args) {
          // Show usage
          return;
        }
        try {
          const content = await backend.read(args);
          setPanel({ view: "file-content", filePath: args, fileContent: content });
        } catch (err) {
          // Handle error
        }
        break;

      case "apikey":
      case "key":
      case "api":
        // Always show interactive API key panel
        setPanel({ view: "apikey-input" });
        break;

      case "baseurl":
      case "base-url":
        // Show base URL configuration panel
        setPanel({ view: "baseurl-input" });
        break;

      case "model":
        if (args) {
          agent.setModel(args.trim());
        } else {
          // Show available models if no args provided
          setPanel({ view: "models" });
        }
        break;

      case "features":
      case "feat":
        setPanel({ view: "features" });
        break;

      case "tokens":
      case "tok":
        const tokenCount = estimateMessagesTokens(agent.messages);
        setPanel({ view: "tokens", tokenCount });
        break;

      case "sessions":
      case "session-list":
        if (checkpointer) {
          const sessions = await checkpointer.list();
          if (sessions.length > 0) {
            // Show sessions list
            const sessionList = sessions.map(s => `  - ${s}`).join('\n');
            setMessages((prev) => [
              ...prev,
              {
                id: `session-list-${Date.now()}`,
                role: "assistant",
                content: `Saved sessions:\n${sessionList}`,
                timestamp: new Date(),
              },
            ]);
          } else {
            setMessages((prev) => [
              ...prev,
              {
                id: `session-list-empty-${Date.now()}`,
                role: "assistant",
                content: "No saved sessions",
                timestamp: new Date(),
              },
            ]);
          }
        } else {
          setMessages((prev) => [
            ...prev,
            {
              id: `session-error-${Date.now()}`,
              role: "assistant",
              content: "Checkpointing not enabled. Use --session to enable.",
              timestamp: new Date(),
            },
          ]);
        }
        break;

      case "session":
        if (!args) {
          setMessages((prev) => [
            ...prev,
            {
              id: `session-usage-${Date.now()}`,
              role: "assistant",
              content: "Usage: /session clear",
              timestamp: new Date(),
            },
          ]);
          return;
        }
        if (args.trim() === "clear" && options.session && checkpointer) {
          await checkpointer.delete(options.session);
          setMessages([]);
          agent.clear();
          setShowWelcome(true);
          setPanel({ view: "none" });
          setMessages((prev) => [
            ...prev,
            {
              id: `session-cleared-${Date.now()}`,
              role: "assistant",
              content: "Session cleared.",
              timestamp: new Date(),
            },
          ]);
        }
        break;

      case "clear":
      case "c":
        setMessages([]);
        agent.clear();
        setShowWelcome(true);
        setPanel({ view: "none" });
        break;

      case "cache":
        if (args === "on" || args === "true" || args === "1") {
          agent.setPromptCaching(true);
        } else if (args === "off" || args === "false" || args === "0") {
          agent.setPromptCaching(false);
        } else {
          // Toggle if no arg
          agent.setPromptCaching(!agent.features.promptCaching);
        }
        setPanel({ view: "features" });
        break;

      case "eviction":
      case "evict":
        if (args === "on" || args === "true" || args === "1") {
          agent.setEviction(true);
        } else if (args === "off" || args === "false" || args === "0") {
          agent.setEviction(false);
        } else {
          // Toggle if no arg
          agent.setEviction(!agent.features.eviction);
        }
        setPanel({ view: "features" });
        break;

      case "summarize":
      case "sum":
        if (args === "on" || args === "true" || args === "1") {
          agent.setSummarization(true);
        } else if (args === "off" || args === "false" || args === "0") {
          agent.setSummarization(false);
        } else {
          // Toggle if no arg
          agent.setSummarization(!agent.features.summarization);
        }
        setPanel({ view: "features" });
        break;

      case "approve":
        const newValue = !agent.autoApproveEnabled;
        agent.setAutoApprove(newValue);
        // Show a brief message (could be improved with a toast/notification)
        return;

      case "help":
      case "h":
      case "?":
        setPanel({ view: "help" });
        break;

      case "quit":
      case "exit":
      case "q":
        exit();
        break;

      case "state":
        // Debug command
        console.log(JSON.stringify(agent.state, null, 2));
        break;
    }
  };

  const isGenerating = agent.status !== "idle" && agent.status !== "done" && agent.status !== "error";
  
  // Disable input when in interactive panels that capture keyboard input
  const isInteractivePanel = panel.view === "apikey-input" || panel.view === "baseurl-input" || panel.view === "models";
  const isInputDisabled = isGenerating || isInteractivePanel;

  return (
    <Box flexDirection="column" padding={1}>
      {/* Welcome banner */}
      {showWelcome && (
        <>
          <Welcome model={agent.currentModel} workDir={options.workDir || process.cwd()} />
          <WelcomeHint />
        </>
      )}

      {/* Panel views */}
      {panel.view === "help" && <SlashMenuPanel />}
      {panel.view === "todos" && <TodoList todos={agent.state.todos} />}
      {panel.view === "files" && panel.files && <FileList files={panel.files} />}
      {panel.view === "file-content" && panel.filePath && panel.fileContent && (
        <FilePreview path={panel.filePath} content={panel.fileContent} />
      )}
      {panel.view === "apikey-input" && (
        <ApiKeyInputPanel
          onKeySaved={() => {
            // Key saved, returns to provider selection automatically
          }}
          onClose={() => setPanel({ view: "none" })}
        />
      )}
      {panel.view === "baseurl-input" && (
        <BaseURLInput
          onSubmit={(provider, baseURL) => {
            // Update global provider configuration
            const config = getProvidersConfig();
            const providerConfig = config[provider] || {};

            setProvidersConfig({
              [provider]: {
                ...providerConfig,
                baseURL,
              },
            });

            // Update environment for consistency
            const envVar = `${provider.toUpperCase()}_BASE_URL`;
            process.env[envVar] = baseURL;

            // Show success message
            console.log(`\x1b[32m✓\x1b[0m Set ${provider} base URL: ${baseURL}`);
          }}
          onCancel={() => setPanel({ view: "none" })}
        />
      )}
      {panel.view === "features" && <FeaturesPanel features={agent.features} options={options} />}
      {panel.view === "tokens" && <TokensPanel tokenCount={panel.tokenCount || 0} messageCount={agent.messages.length} />}
      {panel.view === "models" && (
        <ModelSelectionPanel
          currentModel={agent.currentModel}
          onModelSelect={(modelId) => {
            agent.setModel(modelId);
          }}
          onClose={() => setPanel({ view: "none" })}
        />
      )}

      {/* Agent events in chronological order (includes text-segments) */}
      {/* Always show events - they persist after generation completes */}
      {agent.events.length > 0 && (
        <Box flexDirection="column">
          {agent.events.map((event) => (
            <EventRenderer key={event.id} event={event} />
          ))}
        </Box>
      )}

      {/* Current generation indicators */}
      {isGenerating && (
        <Box flexDirection="column">
          {/* Currently streaming text (not yet flushed to a text-segment) */}
          {agent.streamingText && (
            <Box marginY={1}>
              <Box>
                <Text color={colors.success}>{"● "}</Text>
                <Text>
                  {agent.streamingText}
                  <Text color={colors.muted}>▌</Text>
                </Text>
              </Box>
            </Box>
          )}

          {/* Loading indicator when thinking or executing tools */}
          {(agent.status === "thinking" || agent.status === "tool-call") && !agent.streamingText && (
            <Box marginY={1}>
              <ThinkingIndicator />
            </Box>
          )}
        </Box>
      )}

      {/* Error display */}
      {agent.error && <ErrorDisplay error={agent.error} />}

      {/* Approval UI - show when pending and not in auto-approve mode */}
      {agent.pendingApproval && !agent.autoApproveEnabled && (
        <ToolApproval
          toolName={agent.pendingApproval.toolName}
          args={agent.pendingApproval.args}
          onApprove={() => agent.respondToApproval(true)}
          onDeny={() => agent.respondToApproval(false)}
          onApproveAll={() => {
            agent.setAutoApprove(true);
            agent.respondToApproval(true);
          }}
        />
      )}

      {/* Input - hidden when interactive panels are active */}
      {!isInteractivePanel && (
        <Box marginTop={1}>
          <Input onSubmit={handleSubmit} disabled={isGenerating} />
        </Box>
      )}

      {/* Compact status bar at bottom */}
      <StatusBar
        workDir={options.workDir || process.cwd()}
        model={agent.currentModel}
        status={agent.status}
        features={agent.features}
        autoApproveEnabled={agent.autoApproveEnabled}
        sessionId={options.session}
      />
    </Box>
  );
}

// ============================================================================
// Event Renderer
// ============================================================================

interface EventRendererProps {
  event: AgentEventLog;
}

// Tools that have their own specific events - don't show generic tool-call for these
const TOOLS_WITH_SPECIFIC_EVENTS = new Set([
  "read_file",
  "ls",
  "glob",
  "grep",
  "write_file",
  "edit_file",
  "write_todos",
  "web_search",
  "http_request",
  "fetch_url",
]);

function EventRenderer({ event }: EventRendererProps): React.ReactElement | null {
  const e = event.event;

  switch (e.type) {
    case "user-message":
      // Render user message in history
      return (
        <Box marginBottom={1}>
          <Text color={colors.muted} bold>{"> "}</Text>
          <Text bold>{e.content}</Text>
        </Box>
      );

    case "text-segment":
      // Render accumulated text segment
      if (!e.text.trim()) return null;
      return (
        <Box marginY={1}>
          <Box>
            <Text color={colors.success}>{"● "}</Text>
            <Text>{e.text}</Text>
          </Box>
        </Box>
      );

    case "step-start":
      return (
        <Box marginTop={1}>
          <Text color={colors.muted}>─── step {e.stepNumber} ───</Text>
        </Box>
      );

    case "tool-call":
      // Skip generic tool-call display for tools that have specific events
      if (TOOLS_WITH_SPECIFIC_EVENTS.has(e.toolName)) {
        return null;
      }
      return <ToolCall toolName={e.toolName} isExecuting={true} />;

    case "todos-changed":
      return (
        <Box>
          <Text color={colors.info}>📋 Todos: </Text>
          <Text dimColor>
            {e.todos.filter((t) => t.status === "completed").length}/{e.todos.length} completed
          </Text>
        </Box>
      );

    case "file-write-start":
      return <FilePreview path={e.path} content={e.content} isWrite={true} maxLines={10} />;

    case "file-written":
      return <FileWritten path={e.path} />;

    case "file-edited":
      return <FileEdited path={e.path} occurrences={e.occurrences} />;

    case "file-read":
      return <FileRead path={e.path} lines={e.lines} />;

    case "ls":
      return <LsResult path={e.path} count={e.count} />;

    case "glob":
      return <GlobResult pattern={e.pattern} count={e.count} />;

    case "grep":
      return <GrepResult pattern={e.pattern} count={e.count} />;

    case "web-search-start":
      return (
        <Box>
          <Text color={colors.info}>🔍 </Text>
          <Text>Searching web: </Text>
          <Text color={colors.muted}>{e.query}</Text>
        </Box>
      );

    case "web-search-finish":
      return (
        <Box>
          <Text color={colors.success}>✓ </Text>
          <Text>Found </Text>
          <Text color={colors.info}>{e.resultCount}</Text>
          <Text> results</Text>
        </Box>
      );

    case "http-request-start":
      return (
        <Box>
          <Text color={colors.info}>🌐 </Text>
          <Text>{e.method} </Text>
          <Text color={colors.muted}>{e.url}</Text>
        </Box>
      );

    case "http-request-finish":
      return (
        <Box>
          <Text color={e.statusCode >= 200 && e.statusCode < 300 ? colors.success : colors.error}>
            {e.statusCode >= 200 && e.statusCode < 300 ? "✓" : "✗"}{" "}
          </Text>
          <Text>Status: </Text>
          <Text color={e.statusCode >= 200 && e.statusCode < 300 ? colors.success : colors.error}>
            {e.statusCode}
          </Text>
        </Box>
      );

    case "fetch-url-start":
      return (
        <Box>
          <Text color={colors.info}>📄 </Text>
          <Text>Fetching: </Text>
          <Text color={colors.muted}>{e.url}</Text>
        </Box>
      );

    case "fetch-url-finish":
      return (
        <Box>
          <Text color={e.success ? colors.success : colors.error}>
            {e.success ? "✓" : "✗"}{" "}
          </Text>
          <Text>{e.success ? "Content fetched" : "Failed to fetch"}</Text>
        </Box>
      );

    case "subagent-start":
      return <SubagentStart name={e.name} task={e.task} />;

    case "subagent-finish":
      return <SubagentFinish name={e.name} />;

    case "done":
      return (
        <DoneIndicator
          todosCompleted={e.state.todos.filter((t) => t.status === "completed").length}
          todosTotal={e.state.todos.length}
          filesCount={Object.keys(e.state.files).length}
        />
      );

    case "error":
      return <ErrorDisplay error={e.error} />;

    default:
      return null;
  }
}

// ============================================================================
// Features Panel
// ============================================================================

interface FeaturesPanelProps {
  features: {
    promptCaching: boolean;
    eviction: boolean;
    summarization: boolean;
  };
  options: CLIOptions;
}

function FeaturesPanel({ features, options }: FeaturesPanelProps): React.ReactElement {
  return (
    <Box
      flexDirection="column"
      borderStyle="single"
      borderColor={colors.muted}
      paddingX={2}
      paddingY={1}
      marginY={1}
    >
      <Text bold color={colors.info}>
        ⚙️ Feature Status
      </Text>
      <Box height={1} />
      <Box>
        {features.promptCaching ? (
          <>
            <Text color={colors.success}>✓ </Text>
            <Text>Prompt Caching: </Text>
            <Text color={colors.success}>enabled</Text>
          </>
        ) : (
          <>
            <Text dimColor>✗ </Text>
            <Text>Prompt Caching: </Text>
            <Text dimColor>disabled</Text>
          </>
        )}
      </Box>
      <Box>
        {features.eviction ? (
          <>
            <Text color={colors.success}>✓ </Text>
            <Text>Tool Eviction: </Text>
            <Text color={colors.success}>enabled ({options.toolResultEvictionLimit} tokens)</Text>
          </>
        ) : (
          <>
            <Text dimColor>✗ </Text>
            <Text>Tool Eviction: </Text>
            <Text dimColor>disabled</Text>
          </>
        )}
      </Box>
      <Box>
        {features.summarization ? (
          <>
            <Text color={colors.success}>✓ </Text>
            <Text>Auto-Summarization: </Text>
            <Text color={colors.success}>
              enabled ({options.summarizationThreshold || DEFAULT_SUMMARIZATION_THRESHOLD} tokens, keep {options.summarizationKeepMessages || DEFAULT_KEEP_MESSAGES} msgs)
            </Text>
          </>
        ) : (
          <>
            <Text dimColor>✗ </Text>
            <Text>Auto-Summarization: </Text>
            <Text dimColor>disabled</Text>
          </>
        )}
      </Box>
      <Box height={1} />
      <Text dimColor>Enable with: --cache --eviction-limit {DEFAULT_EVICTION_LIMIT} --summarize</Text>
    </Box>
  );
}

// ============================================================================
// Tokens Panel
// ============================================================================

interface TokensPanelProps {
  tokenCount: number;
  messageCount: number;
}

function TokensPanel({ tokenCount, messageCount }: TokensPanelProps): React.ReactElement {
  const formatNumber = (n: number) => n.toLocaleString();

  // Estimate percentage of typical context window
  const percentage = Math.round((tokenCount / CONTEXT_WINDOW) * 100);
  
  // Color based on usage
  let usageColor: string = colors.success;
  if (percentage > 80) {
    usageColor = colors.error;
  } else if (percentage > 50) {
    usageColor = colors.warning;
  }

  return (
    <Box
      flexDirection="column"
      borderStyle="single"
      borderColor={colors.muted}
      paddingX={2}
      paddingY={1}
      marginY={1}
    >
      <Text bold color={colors.info}>
        📊 Token Usage
      </Text>
      <Box height={1} />
      <Box>
        <Text>Messages: </Text>
        <Text color={colors.primary}>{messageCount}</Text>
      </Box>
      <Box>
        <Text>Estimated Tokens: </Text>
        <Text color={usageColor}>{formatNumber(tokenCount)}</Text>
      </Box>
      <Box>
        <Text>Context Usage: </Text>
        <Text color={usageColor}>{percentage}%</Text>
        <Text dimColor> (of ~200k)</Text>
      </Box>
      <Box height={1} />
      {percentage > 50 && (
        <Text color={colors.warning}>
          ⚠️ Consider enabling --summarize to manage context
        </Text>
      )}
    </Box>
  );
}

// ============================================================================
// Environment Variable Loading
// ============================================================================

interface EnvLoadResult {
  loaded: boolean;
  path?: string;
  keysFound: string[];
  providerConfig?: ProvidersConfig;
}

/**
 * Load environment variables from .env file in the working directory.
 * Bun automatically loads .env from cwd, but we want to also check the
 * specified working directory if different.
 */
async function loadEnvFile(workDir: string): Promise<EnvLoadResult> {
  const envPaths = [
    `${workDir}/.env`,
    `${workDir}/.env.local`,
  ];
  
  const keysToCheck = [
    'ANTHROPIC_API_KEY', 'OPENAI_API_KEY', 'ZHIPU_API_KEY',
    'ANTHROPIC_BASE_URL', 'OPENAI_BASE_URL', 'ZHIPU_BASE_URL'
  ];
  const result: EnvLoadResult = { loaded: false, keysFound: [] };
  
  for (const envPath of envPaths) {
    try {
      const file = Bun.file(envPath);
      const exists = await file.exists();
      
      if (exists) {
        const content = await file.text();
        const lines = content.split('\n');
        
        for (const line of lines) {
          const trimmed = line.trim();
          // Skip comments and empty lines
          if (!trimmed || trimmed.startsWith('#')) continue;
          
          // Parse KEY=VALUE format
          const match = trimmed.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/);
          if (match) {
            const key = match[1];
            const rawValue = match[2];
            if (!key || rawValue === undefined) continue;
            
            // Remove quotes if present
            let value = rawValue.trim();
            if ((value.startsWith('"') && value.endsWith('"')) ||
                (value.startsWith("'") && value.endsWith("'"))) {
              value = value.slice(1, -1);
            }
            
            // Only set if not already set (env vars take precedence)
            if (!process.env[key] && value) {
              process.env[key] = value;
              if (keysToCheck.includes(key)) {
                result.keysFound.push(key);
              }
            }
          }
        }
        
        result.loaded = true;
        result.path = envPath;
        break; // Stop after first .env file found
      }
    } catch {
      // File doesn't exist or can't be read, continue
    }
  }
  
  // Check which keys are now available (from env or .env file)
  for (const key of keysToCheck) {
    if (process.env[key] && !result.keysFound.includes(key)) {
      // Key was already in environment
    }
  }
  
  return result;
}

// ============================================================================
// Main Entry Point
// ============================================================================

async function main() {
  const options = parseArgs();
  const workDir = options.workDir || process.cwd();

  // Load .env file from working directory
  const envResult = await loadEnvFile(workDir);
  
  // Show env loading info
  if (envResult.loaded && envResult.keysFound.length > 0) {
    console.log(`\x1b[32m✓\x1b[0m Loaded API keys from ${envResult.path}: ${envResult.keysFound.join(', ')}`);
  }
  
  // Warn if no API keys found
  if (!process.env.ANTHROPIC_API_KEY && !process.env.OPENAI_API_KEY && !process.env.ZHIPU_API_KEY) {
    console.log(`\x1b[33m⚠\x1b[0m No API keys found. Set ANTHROPIC_API_KEY, OPENAI_API_KEY, or ZHIPU_API_KEY in environment or .env file.`);
  }

  // Initialize provider configuration from environment variables
  const providerConfig: ProvidersConfig = {};

  if (process.env.ANTHROPIC_BASE_URL || process.env.ANTHROPIC_API_KEY) {
    providerConfig.anthropic = {
      baseURL: process.env.ANTHROPIC_BASE_URL,
      apiKey: process.env.ANTHROPIC_API_KEY,
    };
  }

  if (process.env.OPENAI_BASE_URL || process.env.OPENAI_API_KEY) {
    providerConfig.openai = {
      baseURL: process.env.OPENAI_BASE_URL,
      apiKey: process.env.OPENAI_API_KEY,
    };
  }

  if (process.env.ZHIPU_BASE_URL || process.env.ZHIPU_API_KEY) {
    providerConfig.zhipu = {
      baseURL: process.env.ZHIPU_BASE_URL,
      apiKey: process.env.ZHIPU_API_KEY,
    };
  }

  // Set global provider configuration from environment
  setProvidersConfig(providerConfig);

  // Show loaded base URLs from environment
  const loadedBaseUrls = Object.entries(providerConfig)
    .filter(([_, config]) => config?.baseURL)
    .map(([provider]) => provider);
  if (loadedBaseUrls.length > 0) {
    console.log(`\x1b[32m✓\x1b[0m Loaded custom base URLs: ${loadedBaseUrls.join(', ')}`);
  }

  // Override with CLI flags (highest priority)
  const cliConfig: ProvidersConfig = {};

  if (options.anthropicBaseURL || options.anthropicApiKey) {
    cliConfig.anthropic = {
      baseURL: options.anthropicBaseURL,
      apiKey: options.anthropicApiKey,
    };
  }

  if (options.openaiBaseURL || options.openaiApiKey) {
    cliConfig.openai = {
      baseURL: options.openaiBaseURL,
      apiKey: options.openaiApiKey,
    };
  }

  if (options.zhipuBaseURL || options.zhipuApiKey) {
    cliConfig.zhipu = {
      baseURL: options.zhipuBaseURL,
      apiKey: options.zhipuApiKey,
    };
  }

  // Apply CLI overrides
  if (Object.keys(cliConfig).length > 0) {
    setProvidersConfig(cliConfig);
    const overriddenProviders = Object.keys(cliConfig).join(', ');
    console.log(`\x1b[32m✓\x1b[0m Applied CLI overrides for: ${overriddenProviders}`);
  }

  const backend = new LocalSandbox({
    cwd: workDir,
  });

  render(<App options={options} backend={backend} />);
}

main();

