/**
 * Utility to detect available API keys and fetch models from provider APIs.
 */

export interface AvailableModel {
  id: string;
  name: string;
  provider: "anthropic" | "openai" | "zhipu";
  description?: string;
  createdAt?: string;
}

export interface FetchModelsResult {
  models: AvailableModel[];
  error?: string;
}

// ============================================================================
// Cache Implementation
// ============================================================================

interface CacheEntry {
  models: AvailableModel[];
  timestamp: number;
  apiKeyHash: string;
}

const modelCache: {
  anthropic?: CacheEntry;
  openai?: CacheEntry;
  zhipu?: CacheEntry;
} = {};

// Cache TTL: 24 hours in milliseconds
const CACHE_TTL_MS = 24 * 60 * 60 * 1000;

/**
 * Simple hash function for API key to detect changes.
 */
function hashApiKey(key: string | undefined): string {
  if (!key) return "";
  // Just use first 10 and last 4 chars as a simple fingerprint
  return `${key.substring(0, 10)}...${key.substring(key.length - 4)}`;
}

/**
 * Check if cache is valid for a provider.
 */
function isCacheValid(provider: "anthropic" | "openai" | "zhipu"): boolean {
  const entry = modelCache[provider];
  if (!entry) return false;

  const now = Date.now();
  if (now - entry.timestamp > CACHE_TTL_MS) return false;

  // Check if API key changed
  const currentKeyHash =
    provider === "anthropic"
      ? hashApiKey(process.env.ANTHROPIC_API_KEY)
      : provider === "openai"
        ? hashApiKey(process.env.OPENAI_API_KEY)
        : hashApiKey(process.env.ZHIPU_API_KEY);

  return entry.apiKeyHash === currentKeyHash;
}

/**
 * Get cached models for a provider.
 */
function getCachedModels(provider: "anthropic" | "openai" | "zhipu"): AvailableModel[] | null {
  if (isCacheValid(provider)) {
    return modelCache[provider]!.models;
  }
  return null;
}

/**
 * Set cached models for a provider.
 */
function setCachedModels(provider: "anthropic" | "openai" | "zhipu", models: AvailableModel[]): void {
  const apiKeyHash =
    provider === "anthropic"
      ? hashApiKey(process.env.ANTHROPIC_API_KEY)
      : provider === "openai"
        ? hashApiKey(process.env.OPENAI_API_KEY)
        : hashApiKey(process.env.ZHIPU_API_KEY);

  modelCache[provider] = {
    models,
    timestamp: Date.now(),
    apiKeyHash,
  };
}

/**
 * Clear cache for a specific provider or all providers.
 */
export function clearModelCache(provider?: "anthropic" | "openai" | "zhipu"): void {
  if (provider) {
    delete modelCache[provider];
  } else {
    delete modelCache.anthropic;
    delete modelCache.openai;
    delete modelCache.zhipu;
  }
}

// ============================================================================
// Provider Detection
// ============================================================================

/**
 * Detect which API keys are available in the environment.
 */
export function detectAvailableProviders(): {
  anthropic: boolean;
  openai: boolean;
  zhipu: boolean;
} {
  return {
    anthropic: !!process.env.ANTHROPIC_API_KEY,
    openai: !!process.env.OPENAI_API_KEY,
    zhipu: !!process.env.ZHIPU_API_KEY,
  };
}

// ============================================================================
// Anthropic API
// ============================================================================

interface AnthropicModelInfo {
  id: string;
  display_name: string;
  created_at: string;
  type: string;
}

interface AnthropicModelsResponse {
  data: AnthropicModelInfo[];
  has_more: boolean;
  first_id: string;
  last_id: string;
}

/**
 * Fetch available models from Anthropic API.
 * Returns empty array if no API key is set.
 */
export async function fetchAnthropicModels(): Promise<FetchModelsResult> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return { models: [], error: "No Anthropic API key configured" };
  }

  // Check cache first
  const cached = getCachedModels("anthropic");
  if (cached) {
    return { models: cached };
  }

  try {
    const response = await fetch("https://api.anthropic.com/v1/models?limit=100", {
      method: "GET",
      headers: {
        "X-Api-Key": apiKey,
        "anthropic-version": "2023-06-01",
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      if (response.status === 401) {
        return { models: [], error: "Invalid Anthropic API key" };
      }
      return { models: [], error: `Anthropic API error: ${response.status} ${errorText}` };
    }

    const data = (await response.json()) as AnthropicModelsResponse;

    const models: AvailableModel[] = data.data.map((model) => ({
      id: `anthropic/${model.id}`,
      name: model.id,
      provider: "anthropic" as const,
      description: model.display_name,
      createdAt: model.created_at,
    }));

    // Sort by created_at descending (newest first)
    models.sort((a, b) => {
      if (!a.createdAt || !b.createdAt) return 0;
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });

    // Cache the results
    setCachedModels("anthropic", models);

    return { models };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return { models: [], error: `Failed to fetch Anthropic models: ${message}` };
  }
}

// ============================================================================
// OpenAI API
// ============================================================================

interface OpenAIModelInfo {
  id: string;
  object: string;
  created: number;
  owned_by: string;
}

interface OpenAIModelsResponse {
  object: string;
  data: OpenAIModelInfo[];
}

/**
 * Fetch available models from OpenAI API.
 * Returns empty array if no API key is set.
 */
export async function fetchOpenAIModels(): Promise<FetchModelsResult> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return { models: [], error: "No OpenAI API key configured" };
  }

  // Check cache first
  const cached = getCachedModels("openai");
  if (cached) {
    return { models: cached };
  }

  try {
    const response = await fetch("https://api.openai.com/v1/models", {
      method: "GET",
      headers: {
        Authorization: `Bearer ${apiKey}`,
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      if (response.status === 401) {
        return { models: [], error: "Invalid OpenAI API key" };
      }
      return { models: [], error: `OpenAI API error: ${response.status} ${errorText}` };
    }

    const data = (await response.json()) as OpenAIModelsResponse;

    // Filter to only include chat models (gpt-*)
    const chatModels = data.data.filter(
      (model) =>
        model.id.startsWith("gpt-") ||
        model.id.startsWith("o1") ||
        model.id.startsWith("o3") ||
        model.id.includes("chatgpt")
    );

    const models: AvailableModel[] = chatModels.map((model) => ({
      id: `openai/${model.id}`,
      name: model.id,
      provider: "openai" as const,
      description: getOpenAIModelDescription(model.id),
      createdAt: new Date(model.created * 1000).toISOString(),
    }));

    // Sort by created descending (newest first)
    models.sort((a, b) => {
      if (!a.createdAt || !b.createdAt) return 0;
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });

    // Cache the results
    setCachedModels("openai", models);

    return { models };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return { models: [], error: `Failed to fetch OpenAI models: ${message}` };
  }
}

/**
 * Generate a description for OpenAI models based on their ID.
 */
function getOpenAIModelDescription(modelId: string): string {
  if (modelId.includes("gpt-4o-mini")) return "Fast and affordable GPT-4 variant";
  if (modelId.includes("gpt-4o")) return "Latest GPT-4 optimized model";
  if (modelId.includes("gpt-4-turbo")) return "GPT-4 Turbo";
  if (modelId.includes("gpt-4")) return "GPT-4";
  if (modelId.includes("gpt-3.5-turbo")) return "Fast and affordable";
  if (modelId.startsWith("o1")) return "OpenAI o1 reasoning model";
  if (modelId.startsWith("o3")) return "OpenAI o3 reasoning model";
  return "";
}

// ============================================================================
// Zhipu AI API
// ============================================================================

/**
 * Known Zhipu GLM models with descriptions.
 * Zhipu doesn't have a public models list API, so we use a static list.
 */
const ZHIPU_MODELS: { id: string; description: string }[] = [
  { id: "glm-4.7", description: "Most capable GLM models" },
  
];

/**
 * Get available Zhipu models.
 * Returns a static list of known models since Zhipu doesn't have a models list API.
 */
export async function fetchZhipuModels(): Promise<FetchModelsResult> {
  const apiKey = process.env.ZHIPU_API_KEY;
  if (!apiKey) {
    return { models: [], error: "No Zhipu API key configured" };
  }

  // Check cache first
  const cached = getCachedModels("zhipu");
  if (cached) {
    return { models: cached };
  }

  // Return static list of known models
  const models: AvailableModel[] = ZHIPU_MODELS.map((model) => ({
    id: `zhipu/${model.id}`,
    name: model.id,
    provider: "zhipu" as const,
    description: model.description,
  }));

  // Cache the results
  setCachedModels("zhipu", models);

  return { models };
}

// ============================================================================
// Combined Functions
// ============================================================================

export interface GetModelsResult {
  models: AvailableModel[];
  errors: { provider: string; error: string }[];
  loading: boolean;
}

/**
 * Get list of available models from all configured providers.
 * Only fetches from providers that have API keys configured.
 */
export async function getAvailableModels(): Promise<GetModelsResult> {
  const providers = detectAvailableProviders();
  const allModels: AvailableModel[] = [];
  const errors: { provider: string; error: string }[] = [];

  // Fetch from all providers in parallel
  const promises: Promise<void>[] = [];

  if (providers.anthropic) {
    promises.push(
      fetchAnthropicModels().then((result) => {
        allModels.push(...result.models);
        if (result.error) {
          errors.push({ provider: "Anthropic", error: result.error });
        }
      })
    );
  }

  if (providers.openai) {
    promises.push(
      fetchOpenAIModels().then((result) => {
        allModels.push(...result.models);
        if (result.error) {
          errors.push({ provider: "OpenAI", error: result.error });
        }
      })
    );
  }

  if (providers.zhipu) {
    promises.push(
      fetchZhipuModels().then((result) => {
        allModels.push(...result.models);
        if (result.error) {
          errors.push({ provider: "Zhipu", error: result.error });
        }
      })
    );
  }

  await Promise.all(promises);

  return { models: allModels, errors, loading: false };
}

/**
 * Get models grouped by provider.
 */
export async function getModelsByProvider(): Promise<{
  anthropic?: AvailableModel[];
  openai?: AvailableModel[];
  zhipu?: AvailableModel[];
  errors: { provider: string; error: string }[];
}> {
  const result = await getAvailableModels();
  const grouped: {
    anthropic?: AvailableModel[];
    openai?: AvailableModel[];
    zhipu?: AvailableModel[];
    errors: { provider: string; error: string }[];
  } = { errors: result.errors };

  for (const model of result.models) {
    if (!grouped[model.provider]) {
      grouped[model.provider] = [];
    }
    grouped[model.provider]!.push(model);
  }

  return grouped;
}
