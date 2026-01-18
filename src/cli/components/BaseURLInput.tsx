/**
 * BaseURLInput Component
 *
 * Interactive component for setting custom base URLs for AI providers.
 * Accessed via the /baseurl slash command in the CLI.
 */

import React, { useState } from "react";
import { Box, Text, useInput } from "ink";
import { colors, emoji } from "../theme";

type Provider = "anthropic" | "openai" | "zhipu";

interface BaseURLInputProps {
  onSubmit: (provider: Provider, baseURL: string) => void;
  onCancel: () => void;
}

type Step = "select-provider" | "enter-url" | "success";

export function BaseURLInput({ onSubmit, onCancel }: BaseURLInputProps) {
  const [step, setStep] = useState<Step>("select-provider");
  const [selectedProvider, setSelectedProvider] = useState<Provider | null>(null);
  const [baseURL, setBaseURL] = useState("");
  const [error, setError] = useState<string | null>(null);

  // Get current base URLs
  const anthropicBaseURL = process.env.ANTHROPIC_BASE_URL;
  const openaiBaseURL = process.env.OPENAI_BASE_URL;
  const zhipuBaseURL = process.env.ZHIPU_BASE_URL;

  // Handle keyboard input
  useInput((input, key) => {
    if (step === "select-provider") {
      if (input === "1" || input.toLowerCase() === "a") {
        setSelectedProvider("anthropic");
        setStep("enter-url");
        setError(null);
        // Pre-fill existing URL if available
        if (anthropicBaseURL) {
          setBaseURL(anthropicBaseURL);
        } else {
          setBaseURL("");
        }
      } else if (input === "2" || input.toLowerCase() === "o") {
        setSelectedProvider("openai");
        setStep("enter-url");
        setError(null);
        // Pre-fill existing URL if available
        if (openaiBaseURL) {
          setBaseURL(openaiBaseURL);
        } else {
          setBaseURL("");
        }
      } else if (input === "3" || input.toLowerCase() === "z") {
        setSelectedProvider("zhipu");
        setStep("enter-url");
        setError(null);
        // Pre-fill existing URL if available
        if (zhipuBaseURL) {
          setBaseURL(zhipuBaseURL);
        } else {
          setBaseURL("");
        }
      } else if (key.escape) {
        onCancel();
      }
    } else if (step === "enter-url") {
      if (key.escape) {
        // Go back to provider selection
        setStep("select-provider");
        setBaseURL("");
        setSelectedProvider(null);
        setError(null);
      } else if (key.return) {
        // Validate and save
        if (!baseURL.trim()) {
          setError("Base URL cannot be empty");
          return;
        }

        // Validate URL format
        try {
          new URL(baseURL.trim());
        } catch (err) {
          setError("Invalid URL format. Example: https://api.anthropic.com/v1");
          return;
        }

        setStep("success");
        onSubmit(selectedProvider!, baseURL.trim());

        // Auto-return to provider selection after success
        setTimeout(() => {
          setStep("select-provider");
          setBaseURL("");
          setSelectedProvider(null);
          setError(null);
        }, 1500);
      } else if (key.backspace || key.delete) {
        setBaseURL((prev) => prev.slice(0, -1));
        setError(null);
      } else if (input && !key.ctrl && !key.meta) {
        setBaseURL((prev) => prev + input);
        setError(null);
      }
    } else if (step === "success") {
      if (key.return || key.escape) {
        // Return to provider selection
        setStep("select-provider");
        setBaseURL("");
        setSelectedProvider(null);
        setError(null);
      }
    }
  });

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
        🌐 Base URL Configuration
      </Text>
      <Box height={1} />

      {/* Always show current status */}
      <Text bold>Current Base URLs:</Text>
      <Box height={1} />
      <Box marginLeft={2}>
        {anthropicBaseURL ? (
          <>
            <Text color={colors.success}>✓ </Text>
            <Text>Anthropic: </Text>
            <Text dimColor>{anthropicBaseURL}</Text>
          </>
        ) : (
          <>
            <Text dimColor>○ </Text>
            <Text>Anthropic: </Text>
            <Text dimColor>default</Text>
          </>
        )}
      </Box>
      <Box marginLeft={2}>
        {openaiBaseURL ? (
          <>
            <Text color={colors.success}>✓ </Text>
            <Text>OpenAI: </Text>
            <Text dimColor>{openaiBaseURL}</Text>
          </>
        ) : (
          <>
            <Text dimColor>○ </Text>
            <Text>OpenAI: </Text>
            <Text dimColor>default</Text>
          </>
        )}
      </Box>
      <Box marginLeft={2}>
        {zhipuBaseURL ? (
          <>
            <Text color={colors.success}>✓ </Text>
            <Text>Zhipu: </Text>
            <Text dimColor>{zhipuBaseURL}</Text>
          </>
        ) : (
          <>
            <Text dimColor>○ </Text>
            <Text>Zhipu: </Text>
            <Text dimColor>default</Text>
          </>
        )}
      </Box>
      <Box height={1} />

      {step === "select-provider" && (
        <>
          <Text bold>Set Custom Base URL:</Text>
          <Box height={1} />
          <Box marginLeft={2}>
            <Text color={colors.primary}>[1]</Text>
            <Text> Anthropic (Claude)</Text>
          </Box>
          <Box marginLeft={2}>
            <Text color={colors.primary}>[2]</Text>
            <Text> OpenAI (GPT)</Text>
          </Box>
          <Box marginLeft={2}>
            <Text color={colors.primary}>[3]</Text>
            <Text> Zhipu (GLM)</Text>
          </Box>
          <Box height={1} />
          <Text dimColor>Press 1, 2, or 3 to select, Esc to close</Text>
        </>
      )}

      {step === "enter-url" && selectedProvider && (
        <>
          <Text>
            Enter base URL for{" "}
            <Text color={colors.primary}>
              {selectedProvider === "anthropic" ? "Anthropic" : selectedProvider === "openai" ? "OpenAI" : "Zhipu"}
            </Text>
            :
          </Text>
          <Box height={1} />
          <Box>
            <Text dimColor>{">"} </Text>
            <Text>{baseURL || <Text dimColor>Type URL here...</Text>}</Text>
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
            {emoji.completed} Base URL saved for{" "}
            {selectedProvider === "anthropic" ? "Anthropic" : selectedProvider === "openai" ? "OpenAI" : "Zhipu"}!
          </Text>
          <Box height={1} />
          <Text dimColor>Press Enter or Esc to return to menu</Text>
        </>
      )}
    </Box>
  );
}
