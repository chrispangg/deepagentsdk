/**
 * Collapsible tool call summary component.
 * Shows a collapsed summary of tool calls that can be expanded to see details.
 */
import React, { useState } from "react";
import { Box, Text, useInput } from "ink";
import { colors, emoji } from "../theme";
import type { ToolCallData } from "./Message";

interface ToolCallSummaryProps {
  /** Array of tool calls to display */
  toolCalls: ToolCallData[];
  /** Whether this summary is interactive (can be expanded) */
  interactive?: boolean;
  /** Initial expanded state */
  defaultExpanded?: boolean;
}

/**
 * Format a tool result for display.
 */
function formatResult(result: unknown, maxLength = 60): string {
  if (result === undefined || result === null) {
    return "done";
  }
  
  let str: string;
  if (typeof result === "string") {
    str = result;
  } else if (typeof result === "object") {
    try {
      str = JSON.stringify(result);
    } catch {
      str = String(result);
    }
  } else {
    str = String(result);
  }
  
  // Remove newlines and extra whitespace
  str = str.replace(/\s+/g, " ").trim();
  
  if (str.length > maxLength) {
    return str.slice(0, maxLength - 3) + "...";
  }
  return str;
}

/**
 * Format tool arguments for display.
 */
function formatArgs(args: unknown): string {
  if (!args) return "";
  
  if (typeof args === "object") {
    const obj = args as Record<string, unknown>;
    const keys = Object.keys(obj);
    if (keys.length === 0) return "";
    
    // Show first 2 key-value pairs
    const preview = keys.slice(0, 2).map(k => {
      const v = obj[k];
      const valueStr = typeof v === "string" 
        ? (v.length > 20 ? v.slice(0, 17) + "..." : v)
        : String(v).slice(0, 20);
      return `${k}: ${valueStr}`;
    }).join(", ");
    
    if (keys.length > 2) {
      return `(${preview}, +${keys.length - 2} more)`;
    }
    return `(${preview})`;
  }
  
  return String(args).slice(0, 30);
}

export function ToolCallSummary({
  toolCalls,
  interactive = false,
  defaultExpanded = false,
}: ToolCallSummaryProps): React.ReactElement {
  const [expanded, setExpanded] = useState(defaultExpanded);
  
  // Allow toggling with Enter key when interactive
  useInput(
    (input, key) => {
      if (key.return && interactive) {
        setExpanded((prev) => !prev);
      }
    },
    { isActive: interactive }
  );
  
  if (toolCalls.length === 0) {
    return <></>;
  }
  
  const successCount = toolCalls.filter((tc) => tc.status === "success").length;
  const errorCount = toolCalls.filter((tc) => tc.status === "error").length;
  
  // Collapsed view
  if (!expanded) {
    return (
      <Box paddingLeft={2}>
        <Text dimColor>
          {emoji.tool} {toolCalls.length} tool call{toolCalls.length !== 1 ? "s" : ""}
          {errorCount > 0 && (
            <Text color={colors.error}> ({errorCount} failed)</Text>
          )}
          {interactive && <Text dimColor> [press enter to expand]</Text>}
        </Text>
      </Box>
    );
  }
  
  // Expanded view
  return (
    <Box flexDirection="column" paddingLeft={2} marginTop={1}>
      <Box marginBottom={1}>
        <Text dimColor>
          {emoji.tool} {toolCalls.length} tool call{toolCalls.length !== 1 ? "s" : ""}
          {interactive && <Text dimColor> [press enter to collapse]</Text>}
        </Text>
      </Box>
      
      {toolCalls.map((tc, index) => (
        <Box key={index} flexDirection="column" marginBottom={1}>
          <Box>
            <Text color={tc.status === "success" ? colors.success : colors.error}>
              {tc.status === "success" ? "✓" : "✗"}
            </Text>
            <Text> </Text>
            <Text color={colors.tool} bold>
              {tc.toolName}
            </Text>
            {tc.args !== undefined && (
              <Text dimColor> {String(formatArgs(tc.args))}</Text>
            )}
          </Box>
          {tc.result !== undefined && (
            <Box paddingLeft={2}>
              <Text dimColor>→ {formatResult(tc.result)}</Text>
            </Box>
          )}
        </Box>
      ))}
    </Box>
  );
}

/**
 * Inline tool call display for showing during generation.
 */
interface InlineToolCallProps {
  toolName: string;
  args?: unknown;
  isExecuting?: boolean;
}

export function InlineToolCall({
  toolName,
  args,
  isExecuting = false,
}: InlineToolCallProps): React.ReactElement {
  return (
    <Box>
      <Text color={colors.tool}>
        {isExecuting ? "⏳" : "✓"} {toolName}
      </Text>
      {args !== undefined && <Text dimColor> {String(formatArgs(args))}</Text>}
    </Box>
  );
}

