/**
 * Compact status bar component.
 * Clean, minimal design inspired by Claude Code and OpenAI Codex.
 */
import React from "react";
import { Box, Text } from "ink";
import { colors } from "../theme.js";

interface FeatureFlags {
  promptCaching: boolean;
  eviction: boolean;
  summarization: boolean;
}

interface StatusBarProps {
  /** Current working directory */
  workDir: string;
  /** Current model name */
  model: string;
  /** Optional status indicator (idle, generating, etc.) */
  status?: "idle" | "thinking" | "streaming" | "tool-call" | "subagent" | "done" | "error";
  /** Feature flags to display */
  features?: FeatureFlags;
  /** Whether auto-approve mode is enabled */
  autoApproveEnabled?: boolean;
}

export function StatusBar({
  workDir,
  model,
  status = "idle",
  features,
  autoApproveEnabled = false,
}: StatusBarProps): React.ReactElement {
  // Get short model name
  const shortModel = model.split("/").pop() || model;
  
  // Status indicator - minimal
  const getStatusDisplay = () => {
    switch (status) {
      case "thinking":
        return <Text color={colors.warning}>●</Text>;
      case "streaming":
        return <Text color={colors.success}>●</Text>;
      case "tool-call":
        return <Text color={colors.tool}>●</Text>;
      case "subagent":
        return <Text color={colors.secondary}>●</Text>;
      case "error":
        return <Text color={colors.error}>●</Text>;
      case "done":
        return <Text color={colors.success}>●</Text>;
      default:
        return <Text dimColor>○</Text>;
    }
  };

  // Feature badges - compact
  const featureBadges: string[] = [];
  if (features?.promptCaching) featureBadges.push("⚡");
  if (features?.eviction) featureBadges.push("📦");
  if (features?.summarization) featureBadges.push("📝");

  return (
    <Box marginTop={1}>
      <Text dimColor>
        {getStatusDisplay()} {shortModel}
        {featureBadges.length > 0 && ` ${featureBadges.join(" ")}`}
        {" · "}
        {autoApproveEnabled ? (
          <Text color={colors.success}>🟢 Auto-approve</Text>
        ) : (
          <Text color={colors.warning}>🔴 Safe mode</Text>
        )}
        {" · "}? for shortcuts
      </Text>
    </Box>
  );
}

