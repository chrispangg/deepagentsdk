/**
 * Utility to parse model strings into LanguageModel instances.
 * Provides backward compatibility for CLI and other string-based model specifications.
 * Extended to support custom base URLs and API keys for providers.
 */

import { createAnthropic } from "@ai-sdk/anthropic";
import { createOpenAI } from "@ai-sdk/openai";
import { createZhipu } from "zhipu-ai-provider";
import type { LanguageModel } from "ai";

/**
 * Configuration options for a specific AI provider
 */
export interface ProviderConfig {
  /** Custom base URL for provider API */
  baseURL?: string;
  /** Custom API key (overrides environment variable) */
  apiKey?: string;
}

/**
 * Provider-specific configuration for all supported providers
 */
export interface ProvidersConfig {
  anthropic?: ProviderConfig;
  openai?: ProviderConfig;
  zhipu?: ProviderConfig;
}

/**
 * Parse options that can be passed to parseModelString
 */
export interface ParseModelStringOptions {
  /** Provider-specific configuration */
  providers?: ProvidersConfig;
}

/**
 * Global provider configuration for CLI session
 * Managed by CLI and used by parseModelString
 */
let globalProvidersConfig: ProvidersConfig = {};

/**
 * Update global provider configuration
 * Called by /baseurl slash command and CLI flag parsing
 */
export function setProvidersConfig(config: ProvidersConfig): void {
  globalProvidersConfig = {
    ...globalProvidersConfig,
    ...config,
  };
}

/**
 * Get current global provider configuration
 */
export function getProvidersConfig(): ProvidersConfig {
  return { ...globalProvidersConfig };
}

// Provider cache to avoid recreating instances with same config
const providerCache = new Map<string, any>();

/**
 * Get cache key for provider configuration
 */
function getProviderCacheKey(provider: string, config?: ProviderConfig): string {
  const baseURL = config?.baseURL ?? '';
  const apiKey = config?.apiKey ?? '';
  return `${provider}:${baseURL}:${apiKey}`;
}

/**
 * Parse a model string into a LanguageModel instance with optional provider configuration.
 *
 * Supports formats like:
 * - "anthropic/claude-sonnet-4-20250514"
 * - "openai/gpt-4o"
 * - "zhipu/glm-4-plus"
 * - "claude-sonnet-4-20250514" (defaults to Anthropic)
 *
 * @param modelString - The model string to parse
 * @param options - Parse options including provider configuration
 * @returns A LanguageModel instance
 *
 * @example
 * ```typescript
 * const model = parseModelString("anthropic/claude-sonnet-4-20250514");
 * const agent = createDeepAgent({ model });
 * ```
 *
 * @example
 * ```typescript
 * // Using Zhipu AI (Z.AI) models
 * const model = parseModelString("zhipu/glm-4-plus");
 * const agent = createDeepAgent({ model });
 * ```
 *
 * @example
 * ```typescript
 * // With custom base URL
 * const model = parseModelString("anthropic/claude-3", {
 *   providers: {
 *     anthropic: {
 *       baseURL: "https://custom-endpoint.com/v1",
 *       apiKey: "custom-key",
 *     },
 *   },
 * });
 * const agent = createDeepAgent({ model });
 * ```
 */
export function parseModelString(
  modelString: string,
  options?: ParseModelStringOptions
): LanguageModel {
  const [provider, modelName] = modelString.split("/");
  const providerName = provider || "anthropic";

  // Get provider config from options or global config
  const globalConfig = globalProvidersConfig[providerName as keyof ProvidersConfig];
  const providerConfig = options?.providers?.[providerName as keyof ProvidersConfig] ?? globalConfig;

  // Always use factory functions with explicit configuration
  if (providerName === "anthropic") {
    const cacheKey = getProviderCacheKey("anthropic", providerConfig);
    let anthropicProvider = providerCache.get(cacheKey);

    if (!anthropicProvider) {
      anthropicProvider = createAnthropic({
        baseURL: providerConfig?.baseURL,
        apiKey: providerConfig?.apiKey,
      });
      providerCache.set(cacheKey, anthropicProvider);
    }

    return anthropicProvider(modelName || "claude-sonnet-4-20250514");
  } else if (providerName === "openai") {
    const cacheKey = getProviderCacheKey("openai", providerConfig);
    let openaiProvider = providerCache.get(cacheKey);

    if (!openaiProvider) {
      openaiProvider = createOpenAI({
        baseURL: providerConfig?.baseURL,
        apiKey: providerConfig?.apiKey,
      });
      providerCache.set(cacheKey, openaiProvider);
    }

    return openaiProvider(modelName || "gpt-5-mini") as any;
  } else if (providerName === "zhipu") {
    const cacheKey = getProviderCacheKey("zhipu", providerConfig);
    let zhipuProvider = providerCache.get(cacheKey);

    if (!zhipuProvider) {
      zhipuProvider = createZhipu({
        baseURL: providerConfig?.baseURL,
        apiKey: providerConfig?.apiKey,
      });
      providerCache.set(cacheKey, zhipuProvider);
    }

    return zhipuProvider(modelName || "glm-4.7") as LanguageModel;
  }

  // Default to anthropic if no provider specified
  const cacheKey = getProviderCacheKey("anthropic", providerConfig);
  let anthropicProvider = providerCache.get(cacheKey);

  if (!anthropicProvider) {
    anthropicProvider = createAnthropic({
      baseURL: providerConfig?.baseURL,
      apiKey: providerConfig?.apiKey,
    });
    providerCache.set(cacheKey, anthropicProvider);
  }

  return anthropicProvider(modelString);
}
