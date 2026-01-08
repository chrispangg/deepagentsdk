/**
 * Message display component for user and assistant messages.
 * Clean, minimal design inspired by Claude Code and OpenAI Codex.
 */
import React from "react";
import { Box, Text } from "ink";
import { colors } from "../theme";
import { ToolCallSummary } from "./ToolCallSummary";

export type MessageRole = "user" | "assistant";

/**
 * Data for a single tool call.
 */
export interface ToolCallData {
  /** Tool name that was called */
  toolName: string;
  /** Arguments passed to the tool */
  args?: unknown;
  /** Result returned by the tool */
  result?: unknown;
  /** Whether the tool call succeeded or failed */
  status: "success" | "error";
}

export interface MessageData {
  id: string;
  role: MessageRole;
  content: string;
  timestamp?: Date;
  /** Tool calls made during this message (for assistant messages) */
  toolCalls?: ToolCallData[];
}

interface MessageProps {
  message: MessageData;
}

export function Message({ message }: MessageProps): React.ReactElement {
  const isUser = message.role === "user";
  const hasToolCalls = message.toolCalls && message.toolCalls.length > 0;

  if (isUser) {
    // User message: "> message" style (like Claude Code)
    return (
      <Box marginBottom={1}>
        <Text color={colors.muted} bold>{"> "}</Text>
        <Text bold>{message.content}</Text>
      </Box>
    );
  }

  // Assistant message: "● message" style (like Claude Code)
  return (
    <Box flexDirection="column" marginBottom={1}>
      <Box>
        <Text color={colors.success}>{"● "}</Text>
        <Text>{message.content}</Text>
      </Box>
      {/* Show tool calls summary for assistant messages */}
      {hasToolCalls && (
        <Box marginLeft={2}>
          <ToolCallSummary toolCalls={message.toolCalls!} />
        </Box>
      )}
    </Box>
  );
}

interface StreamingMessageProps {
  /** Current streamed text content */
  content: string;
  /** Whether the message is still streaming */
  isStreaming?: boolean;
}

export function StreamingMessage({
  content,
  isStreaming = true,
}: StreamingMessageProps): React.ReactElement {
  return (
    <Box flexDirection="column" marginBottom={1}>
      <Box>
        <Text color={colors.success}>{"● "}</Text>
        <Text>
          {content}
          {isStreaming && <Text color={colors.muted}>▌</Text>}
        </Text>
      </Box>
    </Box>
  );
}

