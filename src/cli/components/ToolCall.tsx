/**
 * Tool call display component with spinner.
 * Clean, minimal design.
 */
import React from "react";
import { Box, Text } from "ink";
import { Spinner, StatusMessage } from "@inkjs/ui";
import { colors } from "../theme";

interface ToolCallProps {
  /** Tool name being called */
  toolName: string;
  /** Whether the tool is currently executing */
  isExecuting?: boolean;
  /** Tool arguments (optional, for display) */
  args?: unknown;
}

export function ToolCall({
  toolName,
  isExecuting = true,
}: ToolCallProps): React.ReactElement {
  if (isExecuting) {
    return (
      <Box>
        <Spinner label={toolName} />
      </Box>
    );
  }

  return (
    <Box>
      <Text color={colors.success}>✓</Text>
      <Text> {toolName}</Text>
    </Box>
  );
}

/**
 * Tool result display.
 */
interface ToolResultProps {
  toolName: string;
  result: unknown;
  maxLength?: number;
}

export function ToolResult({
  toolName,
  result,
  maxLength = 100,
}: ToolResultProps): React.ReactElement {
  let resultStr = String(result);
  if (resultStr.length > maxLength) {
    resultStr = resultStr.substring(0, maxLength) + "...";
  }

  return (
    <Box>
      <Text color={colors.success}>✓ </Text>
      <Text color={colors.tool}>{toolName}</Text>
      <Text dimColor> → {resultStr}</Text>
    </Box>
  );
}

/**
 * Step indicator for multi-step operations.
 */
interface StepIndicatorProps {
  stepNumber: number;
}

export function StepIndicator({
  stepNumber,
}: StepIndicatorProps): React.ReactElement {
  return (
    <Box>
      <Text dimColor>step {stepNumber}</Text>
    </Box>
  );
}

/**
 * Thinking indicator with animated spinner.
 */
export function ThinkingIndicator(): React.ReactElement {
  return (
    <Box>
      <Text color={colors.warning}>● </Text>
      <Spinner label="" />
    </Box>
  );
}

/**
 * Done indicator.
 */
interface DoneIndicatorProps {
  todosCompleted: number;
  todosTotal: number;
  filesCount: number;
}

export function DoneIndicator({
  todosCompleted,
  todosTotal,
  filesCount,
}: DoneIndicatorProps): React.ReactElement {
  const hasTodos = todosTotal > 0;
  const hasFiles = filesCount > 0;
  
  if (!hasTodos && !hasFiles) {
    return <></>;
  }

  return (
    <Box>
      <Text dimColor>
        {hasTodos && `${todosCompleted}/${todosTotal} tasks`}
        {hasTodos && hasFiles && " · "}
        {hasFiles && `${filesCount} files`}
      </Text>
    </Box>
  );
}

/**
 * Error display.
 */
interface ErrorDisplayProps {
  error: Error | string;
}

export function ErrorDisplay({ error }: ErrorDisplayProps): React.ReactElement {
  const message = error instanceof Error ? error.message : error;

  return (
    <Box>
      <Text color={colors.error}>✗ {message}</Text>
    </Box>
  );
}

