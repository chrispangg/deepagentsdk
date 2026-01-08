/**
 * Model Selection Panel - Interactive model selection with arrow keys.
 */

import React, { useState, useEffect, useMemo } from "react";
import { Box, Text, useInput } from "ink";
import { Spinner } from "@inkjs/ui";
import { colors, emoji } from "../theme";
import {
  getModelsByProvider,
  detectAvailableProviders,
  type AvailableModel,
} from "../utils/model-list";

interface ModelSelectionPanelProps {
  currentModel?: string;
  /** Callback when a model is selected */
  onModelSelect?: (modelId: string) => void;
  /** Callback to close the panel */
  onClose?: () => void;
}

interface LoadingState {
  loading: boolean;
  anthropicModels: AvailableModel[];
  openaiModels: AvailableModel[];
  errors: { provider: string; error: string }[];
}

export function ModelSelectionPanel({
  currentModel,
  onModelSelect,
  onClose,
}: ModelSelectionPanelProps): React.ReactElement {
  const providers = detectAvailableProviders();
  const hasAnyKey = providers.anthropic || providers.openai;

  const [state, setState] = useState<LoadingState>({
    loading: true,
    anthropicModels: [],
    openaiModels: [],
    errors: [],
  });

  const [selectedIndex, setSelectedIndex] = useState(0);

  // Combine all models into a flat list for navigation
  const allModels = useMemo(() => {
    const models: AvailableModel[] = [];
    if (state.anthropicModels.length > 0) {
      models.push(...state.anthropicModels);
    }
    if (state.openaiModels.length > 0) {
      models.push(...state.openaiModels);
    }
    return models;
  }, [state.anthropicModels, state.openaiModels]);

  // Find current model index to set initial selection
  useEffect(() => {
    if (allModels.length > 0 && currentModel) {
      const currentIndex = allModels.findIndex((m) => isCurrentModel(currentModel, m));
      if (currentIndex >= 0) {
        setSelectedIndex(currentIndex);
      }
    }
  }, [allModels, currentModel]);

  // Handle keyboard input
  useInput((input, key) => {
    if (state.loading) return;

    if (key.upArrow) {
      setSelectedIndex((prev) => (prev > 0 ? prev - 1 : allModels.length - 1));
    } else if (key.downArrow) {
      setSelectedIndex((prev) => (prev < allModels.length - 1 ? prev + 1 : 0));
    } else if (key.return) {
      const selectedModel = allModels[selectedIndex];
      if (selectedModel) {
        onModelSelect?.(selectedModel.id);
        onClose?.();
      }
    } else if (key.escape) {
      onClose?.();
    }
  });

  // Fetch models on mount
  useEffect(() => {
    if (!hasAnyKey) {
      setState({ loading: false, anthropicModels: [], openaiModels: [], errors: [] });
      return;
    }

    let cancelled = false;

    async function loadModels() {
      try {
        const result = await getModelsByProvider();
        if (!cancelled) {
          setState({
            loading: false,
            anthropicModels: result.anthropic || [],
            openaiModels: result.openai || [],
            errors: result.errors,
          });
        }
      } catch (error) {
        if (!cancelled) {
          setState({
            loading: false,
            anthropicModels: [],
            openaiModels: [],
            errors: [{ provider: "Unknown", error: String(error) }],
          });
        }
      }
    }

    loadModels();

    return () => {
      cancelled = true;
    };
  }, [hasAnyKey]);

  // No API keys configured
  if (!hasAnyKey) {
    return (
      <Box
        flexDirection="column"
        borderStyle="single"
        borderColor={colors.warning}
        paddingX={2}
        paddingY={1}
        marginY={1}
      >
        <Text bold color={colors.warning}>
          ⚠️ No API Keys Found
        </Text>
        <Box height={1} />
        <Text>Add an API key first to see available models.</Text>
        <Box height={1} />
        <Text color={colors.primary}>Run /apikey to add your API key</Text>
        <Box height={1} />
        <Text dimColor>Supported providers:</Text>
        <Text dimColor>  • Anthropic (Claude)</Text>
        <Text dimColor>  • OpenAI (GPT)</Text>
      </Box>
    );
  }

  // Loading state
  if (state.loading) {
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
          {emoji.model} Select Model
        </Text>
        <Box height={1} />
        <Box>
          <Spinner label="Fetching models from API..." />
        </Box>
      </Box>
    );
  }

  // Check if we have any models
  const hasModels = allModels.length > 0;

  // No models found (API errors)
  if (!hasModels && state.errors.length > 0) {
    return (
      <Box
        flexDirection="column"
        borderStyle="single"
        borderColor={colors.error}
        paddingX={2}
        paddingY={1}
        marginY={1}
      >
        <Text bold color={colors.error}>
          {emoji.error} Failed to Fetch Models
        </Text>
        <Box height={1} />
        {state.errors.map((err, i) => (
          <Text key={i} color={colors.error}>
            {err.provider}: {err.error}
          </Text>
        ))}
        <Box height={1} />
        <Text dimColor>Check your API key and try again with /apikey</Text>
      </Box>
    );
  }

  // Calculate the offset for each provider section
  let anthropicOffset = 0;
  let openaiOffset = state.anthropicModels.length;

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
        {emoji.model} Select Model
      </Text>
      <Box height={1} />

      {/* Show any errors */}
      {state.errors.length > 0 && (
        <>
          {state.errors.map((err, i) => (
            <Text key={i} color={colors.warning}>
              {emoji.warning} {err.provider}: {err.error}
            </Text>
          ))}
          <Box height={1} />
        </>
      )}

      {/* Anthropic Models */}
      {state.anthropicModels.length > 0 && (
        <>
          <Text bold color={colors.primary}>
            Anthropic Claude
          </Text>
          {state.anthropicModels.map((model, index) => {
            const globalIndex = anthropicOffset + index;
            const isSelected = globalIndex === selectedIndex;
            const isCurrent = isCurrentModel(currentModel, model);
            return (
              <ModelItem
                key={model.id}
                model={model}
                isSelected={isSelected}
                isCurrent={isCurrent}
              />
            );
          })}
          <Box height={1} />
        </>
      )}

      {/* OpenAI Models */}
      {state.openaiModels.length > 0 && (
        <>
          <Text bold color={colors.primary}>
            OpenAI GPT
          </Text>
          {state.openaiModels.map((model, index) => {
            const globalIndex = openaiOffset + index;
            const isSelected = globalIndex === selectedIndex;
            const isCurrent = isCurrentModel(currentModel, model);
            return (
              <ModelItem
                key={model.id}
                model={model}
                isSelected={isSelected}
                isCurrent={isCurrent}
              />
            );
          })}
          <Box height={1} />
        </>
      )}

      {/* Navigation hint */}
      <Text dimColor>↑/↓ Navigate • Enter Select • Esc Cancel</Text>
    </Box>
  );
}

/**
 * Check if a model matches the current model.
 */
function isCurrentModel(currentModel: string | undefined, model: AvailableModel): boolean {
  if (!currentModel) return false;
  return (
    currentModel === model.id ||
    currentModel === model.name ||
    currentModel === `${model.provider}/${model.name}` ||
    (currentModel.startsWith(`${model.provider}/`) && currentModel === model.id)
  );
}

interface ModelItemProps {
  model: AvailableModel;
  isSelected: boolean;
  isCurrent: boolean;
}

function ModelItem({ model, isSelected, isCurrent }: ModelItemProps): React.ReactElement {
  // Determine the indicator
  let indicator = "  ";
  let textColor: string | undefined = undefined;
  let isBold = false;

  if (isSelected) {
    indicator = "▸ ";
    textColor = colors.primary;
    isBold = true;
  }

  if (isCurrent) {
    indicator = isSelected ? "▸✓" : " ✓";
    textColor = isSelected ? colors.primary : colors.success;
  }

  return (
    <Box marginLeft={1}>
      <Text color={isSelected ? colors.primary : isCurrent ? colors.success : undefined}>
        {indicator}
      </Text>
      <Text color={textColor} bold={isBold}>
        {model.id}
      </Text>
      {model.description && (
        <>
          <Text dimColor> - </Text>
          <Text dimColor>{model.description}</Text>
        </>
      )}
    </Box>
  );
}
