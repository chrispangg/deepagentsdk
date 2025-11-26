/**
 * Welcome banner component for the CLI.
 * Clean, minimal design inspired by Claude Code and OpenAI Codex.
 */
import React from "react";
import { Box, Text } from "ink";
import { colors } from "../theme.js";

interface WelcomeProps {
  /** Model name to display */
  model?: string;
  /** Working directory */
  workDir?: string;
}

export function Welcome({ model, workDir }: WelcomeProps): React.ReactElement {
  const displayDir = workDir 
    ? workDir.replace(process.env.HOME || "", "~")
    : process.cwd().replace(process.env.HOME || "", "~");
  
  return (
    <Box
      flexDirection="column"
      borderStyle="single"
      borderColor={colors.muted}
      paddingX={2}
      paddingY={1}
      marginBottom={1}
    >
      <Box>
        <Text bold color={colors.primary}>{">"}_</Text>
        <Text bold> Deep Agent</Text>
      </Box>
      <Box height={1} />
      <Box>
        <Text dimColor>model:</Text>
        <Text>     {model || "anthropic/claude-haiku-4-5-20251001"}</Text>
        <Text dimColor>  /model to change</Text>
      </Box>
      <Box>
        <Text dimColor>directory:</Text>
        <Text> {displayDir}</Text>
      </Box>
    </Box>
  );
}

/**
 * Compact help text shown below the welcome banner.
 */
export function WelcomeHint(): React.ReactElement {
  return (
    <Box flexDirection="column" marginBottom={1}>
      <Text dimColor>
        To get started, describe a task or try one of these commands:
      </Text>
      <Box height={1} />
      <Box flexDirection="column">
        <Text>
          <Text color={colors.info}>/help</Text>
          <Text dimColor> - show available commands</Text>
        </Text>
        <Text>
          <Text color={colors.info}>/features</Text>
          <Text dimColor> - show enabled features</Text>
        </Text>
        <Text>
          <Text color={colors.info}>/model</Text>
          <Text dimColor> - change the model</Text>
        </Text>
      </Box>
    </Box>
  );
}

