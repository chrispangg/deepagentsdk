/**
 * Subagent status display components.
 */
import React from "react";
import { Box, Text } from "ink";
import { Spinner, StatusMessage } from "@inkjs/ui";
import { emoji, colors } from "../theme.js";

interface SubagentStartProps {
  /** Subagent name */
  name: string;
  /** Task description */
  task: string;
  /** Maximum task length to display */
  maxTaskLength?: number;
}

export function SubagentStart({
  name,
  task,
  maxTaskLength = 60,
}: SubagentStartProps): React.ReactElement {
  const shortTask =
    task.length > maxTaskLength
      ? task.substring(0, maxTaskLength) + "..."
      : task;

  return (
    <Box flexDirection="column" marginY={1}>
      <Box>
        <Spinner
          label={`${emoji.subagent} Starting subagent: ${name}`}
        />
      </Box>
      <Box paddingLeft={4}>
        <Text dimColor>└─ {shortTask}</Text>
      </Box>
    </Box>
  );
}

interface SubagentFinishProps {
  /** Subagent name */
  name: string;
}

export function SubagentFinish({
  name,
}: SubagentFinishProps): React.ReactElement {
  return (
    <Box marginY={1}>
      <StatusMessage variant="success">
        {emoji.subagent} Subagent {name} completed
      </StatusMessage>
    </Box>
  );
}

/**
 * Subagent running indicator (for when a subagent is actively working).
 */
interface SubagentRunningProps {
  name: string;
  task: string;
}

export function SubagentRunning({
  name,
  task,
}: SubagentRunningProps): React.ReactElement {
  const shortTask = task.length > 50 ? task.substring(0, 50) + "..." : task;

  return (
    <Box
      flexDirection="column"
      borderStyle="single"
      borderColor={colors.secondary}
      paddingX={2}
      paddingY={1}
      marginY={1}
    >
      <Box>
        <Spinner label={`${emoji.subagent} ${name}`} />
      </Box>
      <Box paddingLeft={2}>
        <Text dimColor>{shortTask}</Text>
      </Box>
    </Box>
  );
}

