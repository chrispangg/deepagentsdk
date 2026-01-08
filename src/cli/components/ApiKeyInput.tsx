/**
 * API Key Input Panel - Interactive provider selection and key input.
 * Shows current status and allows adding/updating keys.
 */

import React, { useState } from "react";
import { Box, Text, useInput } from "ink";
import { colors, emoji } from "../theme";

type Provider = "anthropic" | "openai";

interface ApiKeyInputPanelProps {
  /** Callback when API key is saved */
  onKeySaved?: (provider: Provider, key: string) => void;
  /** Callback to close the panel */
  onClose?: () => void;
}

type Step = "select-provider" | "enter-key" | "success";

export function ApiKeyInputPanel({
  onKeySaved,
  onClose,
}: ApiKeyInputPanelProps): React.ReactElement {
  const [step, setStep] = useState<Step>("select-provider");
  const [selectedProvider, setSelectedProvider] = useState<Provider | null>(null);
  const [apiKey, setApiKey] = useState("");
  const [error, setError] = useState<string | null>(null);

  // Get current API keys
  const anthropicKey = process.env.ANTHROPIC_API_KEY;
  const openaiKey = process.env.OPENAI_API_KEY;

  const maskKey = (key: string | undefined) => {
    if (!key) return null;
    if (key.length <= 8) return "•".repeat(key.length);
    return key.substring(0, 10) + "..." + key.substring(key.length - 4);
  };

  // Handle keyboard input
  useInput((input, key) => {
    if (step === "select-provider") {
      if (input === "1" || input.toLowerCase() === "a") {
        setSelectedProvider("anthropic");
        setStep("enter-key");
        setError(null);
        // Pre-fill existing key if available
        if (anthropicKey) {
          setApiKey(anthropicKey);
        }
      } else if (input === "2" || input.toLowerCase() === "o") {
        setSelectedProvider("openai");
        setStep("enter-key");
        setError(null);
        // Pre-fill existing key if available
        if (openaiKey) {
          setApiKey(openaiKey);
        }
      } else if (key.escape) {
        onClose?.();
      }
    } else if (step === "enter-key") {
      if (key.escape) {
        // Go back to provider selection
        setStep("select-provider");
        setApiKey("");
        setSelectedProvider(null);
        setError(null);
      } else if (key.return) {
        // Validate and save
        if (!apiKey.trim()) {
          setError("API key cannot be empty");
          return;
        }

        // Basic validation
        if (selectedProvider === "anthropic" && !apiKey.startsWith("sk-ant-")) {
          setError("Anthropic API keys typically start with 'sk-ant-'");
          return;
        }
        if (selectedProvider === "openai" && !apiKey.startsWith("sk-")) {
          setError("OpenAI API keys typically start with 'sk-'");
          return;
        }

        // Save to environment
        if (selectedProvider === "anthropic") {
          process.env.ANTHROPIC_API_KEY = apiKey.trim();
        } else if (selectedProvider === "openai") {
          process.env.OPENAI_API_KEY = apiKey.trim();
        }

        setStep("success");
        onKeySaved?.(selectedProvider!, apiKey.trim());

        // Auto-return to provider selection after success
        setTimeout(() => {
          setStep("select-provider");
          setApiKey("");
          setSelectedProvider(null);
        }, 1500);
      } else if (key.backspace || key.delete) {
        setApiKey((prev) => prev.slice(0, -1));
        setError(null);
      } else if (input && !key.ctrl && !key.meta) {
        setApiKey((prev) => prev + input);
        setError(null);
      }
    } else if (step === "success") {
      if (key.return || key.escape) {
        // Return to provider selection
        setStep("select-provider");
        setApiKey("");
        setSelectedProvider(null);
      }
    }
  });

  const maskKeyForInput = (key: string): string => {
    if (key.length <= 8) return "•".repeat(key.length);
    return key.substring(0, 7) + "•".repeat(Math.min(key.length - 11, 20)) + key.substring(key.length - 4);
  };

  return (
    <Box
      flexDirection="column"
      borderStyle="single"
      borderColor={colors.primary}
      paddingX={2}
      paddingY={1}
      marginY={1}
    >
      <Text bold color={colors.info}>
        {emoji.key} API Key Management
      </Text>
      <Box height={1} />

      {/* Always show current status */}
      <Text bold>Current Status:</Text>
      <Box height={1} />
      <Box marginLeft={2}>
        {anthropicKey ? (
          <>
            <Text color={colors.success}>✓ </Text>
            <Text>Anthropic: </Text>
            <Text dimColor>{maskKey(anthropicKey)}</Text>
          </>
        ) : (
          <>
            <Text color={colors.warning}>✗ </Text>
            <Text>Anthropic: </Text>
            <Text dimColor>not set</Text>
          </>
        )}
      </Box>
      <Box marginLeft={2}>
        {openaiKey ? (
          <>
            <Text color={colors.success}>✓ </Text>
            <Text>OpenAI: </Text>
            <Text dimColor>{maskKey(openaiKey)}</Text>
          </>
        ) : (
          <>
            <Text color={colors.warning}>✗ </Text>
            <Text>OpenAI: </Text>
            <Text dimColor>not set</Text>
          </>
        )}
      </Box>
      <Box height={1} />

      {step === "select-provider" && (
        <>
          <Text bold>Add or Update Key:</Text>
          <Box height={1} />
          <Box marginLeft={2}>
            <Text color={colors.primary}>[1]</Text>
            <Text> Anthropic (Claude)</Text>
            {anthropicKey && <Text dimColor> (overwrite)</Text>}
          </Box>
          <Box marginLeft={2}>
            <Text color={colors.primary}>[2]</Text>
            <Text> OpenAI (GPT)</Text>
            {openaiKey && <Text dimColor> (overwrite)</Text>}
          </Box>
          <Box height={1} />
          <Text dimColor>Press 1 or 2 to select, Esc to close</Text>
        </>
      )}

      {step === "enter-key" && selectedProvider && (
        <>
          <Text>
            Enter your{" "}
            <Text color={colors.primary}>
              {selectedProvider === "anthropic" ? "Anthropic" : "OpenAI"}
            </Text>{" "}
            API key:
            {selectedProvider === "anthropic" && anthropicKey && (
              <Text dimColor> (current: {maskKey(anthropicKey)})</Text>
            )}
            {selectedProvider === "openai" && openaiKey && (
              <Text dimColor> (current: {maskKey(openaiKey)})</Text>
            )}
          </Text>
          <Box height={1} />
          <Box>
            <Text dimColor>{">"} </Text>
            <Text>{apiKey ? maskKeyForInput(apiKey) : <Text dimColor>Paste your API key here...</Text>}</Text>
            <Text color={colors.primary}>█</Text>
          </Box>
          {error && (
            <>
              <Box height={1} />
              <Text color={colors.error}>{emoji.warning} {error}</Text>
            </>
          )}
          <Box height={1} />
          <Text dimColor>Press Enter to save, Esc to go back</Text>
        </>
      )}

      {step === "success" && selectedProvider && (
        <>
          <Text color={colors.success}>
            {emoji.completed} API key saved for{" "}
            {selectedProvider === "anthropic" ? "Anthropic" : "OpenAI"}!
          </Text>
          <Box height={1} />
          <Text dimColor>Press Enter or Esc to return to menu</Text>
        </>
      )}
    </Box>
  );
}

/**
 * Simple API Key Status display (read-only).
 */
export function ApiKeyStatus(): React.ReactElement {
  const anthropicKey = process.env.ANTHROPIC_API_KEY;
  const openaiKey = process.env.OPENAI_API_KEY;

  const maskKey = (key: string | undefined) => {
    if (!key) return null;
    return key.substring(0, 10) + "..." + key.substring(key.length - 4);
  };

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
        {emoji.key} API Keys
      </Text>
      <Box height={1} />
      <Box>
        {anthropicKey ? (
          <>
            <Text color={colors.success}>✓ </Text>
            <Text>Anthropic: </Text>
            <Text dimColor>{maskKey(anthropicKey)}</Text>
          </>
        ) : (
          <>
            <Text color={colors.warning}>✗ </Text>
            <Text>Anthropic: </Text>
            <Text dimColor>not set</Text>
          </>
        )}
      </Box>
      <Box>
        {openaiKey ? (
          <>
            <Text color={colors.success}>✓ </Text>
            <Text>OpenAI: </Text>
            <Text dimColor>{maskKey(openaiKey)}</Text>
          </>
        ) : (
          <>
            <Text color={colors.warning}>✗ </Text>
            <Text>OpenAI: </Text>
            <Text dimColor>not set</Text>
          </>
        )}
      </Box>
      <Box height={1} />
      <Text dimColor>Use /apikey set to add or update keys</Text>
    </Box>
  );
}



