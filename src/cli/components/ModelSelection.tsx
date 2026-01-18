/**
 * Model Selection Panel - Two-step interactive model selection.
 * Step 1: Select provider (Anthropic, OpenAI, Zhipu)
 * Step 2: Select model from that provider
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

type ProviderKey = "anthropic" | "openai" | "zhipu";
type Step = "select-provider" | "select-model";

interface ProviderInfo {
  key: ProviderKey;
  name: string;
  description: string;
  hasKey: boolean;
  modelCount: number;
}

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
  zhipuModels: AvailableModel[];
  errors: { provider: string; error: string }[];
}

export function ModelSelectionPanel({
  currentModel,
  onModelSelect,
  onClose,
}: ModelSelectionPanelProps): React.ReactElement {
  const detectedProviders = detectAvailableProviders();
  const hasAnyKey = detectedProviders.anthropic || detectedProviders.openai || detectedProviders.zhipu;

  const [state, setState] = useState<LoadingState>({
    loading: true,
    anthropicModels: [],
    openaiModels: [],
    zhipuModels: [],
    errors: [],
  });

  const [step, setStep] = useState<Step>("select-provider");
  const [selectedProviderIndex, setSelectedProviderIndex] = useState(0);
  const [selectedProvider, setSelectedProvider] = useState<ProviderKey | null>(null);
  const [selectedModelIndex, setSelectedModelIndex] = useState(0);

  // Build list of available providers with their info
  const availableProviders = useMemo((): ProviderInfo[] => {
    const providers: ProviderInfo[] = [];
    
    if (detectedProviders.anthropic) {
      providers.push({
        key: "anthropic",
        name: "Anthropic Claude",
        description: "Claude models",
        hasKey: true,
        modelCount: state.anthropicModels.length,
      });
    }
    
    if (detectedProviders.openai) {
      providers.push({
        key: "openai",
        name: "OpenAI GPT",
        description: "GPT models",
        hasKey: true,
        modelCount: state.openaiModels.length,
      });
    }
    
    if (detectedProviders.zhipu) {
      providers.push({
        key: "zhipu",
        name: "Zhipu GLM",
        description: "GLM models",
        hasKey: true,
        modelCount: state.zhipuModels.length,
      });
    }
    
    return providers;
  }, [detectedProviders, state.anthropicModels.length, state.openaiModels.length, state.zhipuModels.length]);

  // Get models for the selected provider
  const currentProviderModels = useMemo((): AvailableModel[] => {
    if (!selectedProvider) return [];
    
    switch (selectedProvider) {
      case "anthropic":
        return state.anthropicModels;
      case "openai":
        return state.openaiModels;
      case "zhipu":
        return state.zhipuModels;
      default:
        return [];
    }
  }, [selectedProvider, state.anthropicModels, state.openaiModels, state.zhipuModels]);

  // Detect current provider from currentModel - only on initial load
  const hasInitializedProviderIndex = React.useRef(false);
  useEffect(() => {
    if (!hasInitializedProviderIndex.current && currentModel && availableProviders.length > 0) {
      const providerFromModel = currentModel.split("/")[0] as ProviderKey;
      const providerIndex = availableProviders.findIndex(p => p.key === providerFromModel);
      if (providerIndex >= 0) {
        setSelectedProviderIndex(providerIndex);
        hasInitializedProviderIndex.current = true;
      }
    }
  }, [currentModel, availableProviders]);

  // Find current model index when entering model selection - only when step changes to select-model
  const prevStepRef = React.useRef<Step | null>(null);
  useEffect(() => {
    // Only run when transitioning TO select-model step
    if (step === "select-model" && prevStepRef.current !== "select-model" && currentProviderModels.length > 0 && currentModel) {
      const currentIndex = currentProviderModels.findIndex((m) => isCurrentModel(currentModel, m));
      if (currentIndex >= 0) {
        setSelectedModelIndex(currentIndex);
      } else {
        setSelectedModelIndex(0);
      }
    }
    prevStepRef.current = step;
  }, [step, currentProviderModels, currentModel]);

  // Store latest values in refs to avoid stale closures in useInput
  const stateRef = React.useRef(state);
  const stepRef = React.useRef(step);
  const availableProvidersRef = React.useRef(availableProviders);
  const selectedProviderIndexRef = React.useRef(selectedProviderIndex);
  const currentProviderModelsRef = React.useRef(currentProviderModels);
  const selectedModelIndexRef = React.useRef(selectedModelIndex);

  // Keep refs updated
  React.useEffect(() => {
    stateRef.current = state;
    stepRef.current = step;
    availableProvidersRef.current = availableProviders;
    selectedProviderIndexRef.current = selectedProviderIndex;
    currentProviderModelsRef.current = currentProviderModels;
    selectedModelIndexRef.current = selectedModelIndex;
  });

  // Handle keyboard input
  useInput(
    (input, key) => {
      if (stateRef.current.loading) return;

      const currentStep = stepRef.current;
      const providers = availableProvidersRef.current;
      const providerIndex = selectedProviderIndexRef.current;
      const models = currentProviderModelsRef.current;
      const modelIndex = selectedModelIndexRef.current;

      if (currentStep === "select-provider") {
        if (key.upArrow) {
          setSelectedProviderIndex((prev) => 
            prev > 0 ? prev - 1 : providers.length - 1
          );
        } else if (key.downArrow) {
          setSelectedProviderIndex((prev) => 
            prev < providers.length - 1 ? prev + 1 : 0
          );
        } else if (key.return) {
          const provider = providers[providerIndex];
          if (provider && provider.modelCount > 0) {
            setSelectedProvider(provider.key);
            setSelectedModelIndex(0);
            setStep("select-model");
          }
        } else if (key.escape) {
          onClose?.();
        }
      } else if (currentStep === "select-model") {
        if (key.upArrow) {
          setSelectedModelIndex((prev) => 
            prev > 0 ? prev - 1 : models.length - 1
          );
        } else if (key.downArrow) {
          setSelectedModelIndex((prev) => 
            prev < models.length - 1 ? prev + 1 : 0
          );
        } else if (key.return) {
          const selectedModel = models[modelIndex];
          if (selectedModel) {
            onModelSelect?.(selectedModel.id);
            onClose?.();
          }
        } else if (key.escape || key.leftArrow) {
          // Go back to provider selection
          setStep("select-provider");
          setSelectedProvider(null);
        }
      }
    },
    { isActive: !state.loading }
  );

  // Fetch models on mount
  useEffect(() => {
    if (!hasAnyKey) {
      setState({ loading: false, anthropicModels: [], openaiModels: [], zhipuModels: [], errors: [] });
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
            zhipuModels: result.zhipu || [],
            errors: result.errors,
          });
        }
      } catch (error) {
        if (!cancelled) {
          setState({
            loading: false,
            anthropicModels: [],
            openaiModels: [],
            zhipuModels: [],
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
        <Text dimColor>  • Zhipu (GLM)</Text>
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

  // No providers with models
  if (availableProviders.length === 0 || availableProviders.every(p => p.modelCount === 0)) {
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
          {emoji.error} No Models Available
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

  // Step 1: Provider Selection
  if (step === "select-provider") {
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
          {emoji.model} Select Provider
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

        {/* Provider list */}
        {availableProviders.map((provider, index) => {
          const isSelected = index === selectedProviderIndex;
          const isCurrentProvider = currentModel?.startsWith(`${provider.key}/`) ?? false;
          
          return (
            <ProviderItem
              key={provider.key}
              provider={provider}
              isSelected={isSelected}
              isCurrent={isCurrentProvider}
            />
          );
        })}

        <Box height={1} />
        <Text dimColor>↑/↓ Navigate • Enter Select • Esc Cancel</Text>
      </Box>
    );
  }

  // Step 2: Model Selection
  const selectedProviderInfo = availableProviders.find(p => p.key === selectedProvider);
  
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
        {emoji.model} Select Model - {selectedProviderInfo?.name}
      </Text>
      <Box height={1} />

      {/* Model list */}
      {currentProviderModels.map((model, index) => {
        const isSelected = index === selectedModelIndex;
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
      <Text dimColor>↑/↓ Navigate • Enter Select • ←/Esc Back</Text>
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

interface ProviderItemProps {
  provider: ProviderInfo;
  isSelected: boolean;
  isCurrent: boolean;
}

function ProviderItem({ provider, isSelected, isCurrent }: ProviderItemProps): React.ReactElement {
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

  const hasModels = provider.modelCount > 0;

  return (
    <Box marginLeft={1}>
      <Text color={isSelected ? colors.primary : isCurrent ? colors.success : undefined}>
        {indicator}
      </Text>
      <Text color={hasModels ? textColor : colors.muted} bold={isBold}>
        {provider.name}
      </Text>
      <Text dimColor>
        {" "}({provider.modelCount} model{provider.modelCount !== 1 ? "s" : ""})
      </Text>
      {!hasModels && <Text color={colors.warning}> - loading...</Text>}
    </Box>
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

  // Show just the model name without provider prefix for cleaner display
  const displayName = model.name;

  return (
    <Box marginLeft={1}>
      <Text color={isSelected ? colors.primary : isCurrent ? colors.success : undefined}>
        {indicator}
      </Text>
      <Text color={textColor} bold={isBold}>
        {displayName}
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
