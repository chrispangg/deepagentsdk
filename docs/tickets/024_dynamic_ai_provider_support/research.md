---
date: 2026-01-17 15:48:43 AEDT
researcher: Claude (Opus 4.5)
git_commit: d4c7c559c85d83ab0bd53dcb8cd56f670c3968f4
branch: main
repository: deepagentsdk
topic: "Dynamic AI Provider Support - Enabling Users to Install and Use Any Vercel AI SDK Provider"
tags: [research, codebase, cli, ai-providers, dynamic-loading, plugin-system]
status: complete
last_updated: 2026-01-17
last_updated_by: Claude (Opus 4.5)
---

# Research: Dynamic AI Provider Support for CLI

## Research Question

How can we extend the deepagentsdk CLI to support dynamic installation and usage of any Vercel AI SDK provider (official and community), rather than being limited to just Anthropic and OpenAI?

## Summary

The deepagentsdk CLI currently hardcodes support for only two providers (Anthropic and OpenAI) in `src/utils/model-parser.ts`. However, the Vercel AI SDK ecosystem includes **25+ official providers** and **40+ community providers**, all following a standardized **Language Model Specification V2** interface.

**Key Findings:**

1. **All AI SDK providers share a common interface**: Every provider exports a factory function (`createProvider()`) and a default instance, making dynamic loading straightforward.

2. **Dynamic import is well-supported**: Both Node.js and Bun support `await import(packageName)` for runtime module loading, with Bun offering additional conveniences like auto-install.

3. **The pattern is already proven**: Tools like ESLint, Prettier, and the OpenAI Codex CLI successfully implement dynamic plugin/provider systems using similar approaches.

4. **Existing research (ticket 023) covers base URL customization**: The previous research focused on custom base URLs for existing providers. This research extends that to support entirely new providers.

**Recommended Approach:**

Implement a **Provider Registry** pattern that:

1. Accepts provider strings in format `provider/model` (e.g., `zhipu/glm-4-plus`, `ollama/llama3`)
2. Dynamically imports the provider package at runtime
3. Provides helpful error messages when packages aren't installed
4. Optionally offers to install missing packages

## Detailed Findings

### 1. Current CLI Limitations

**File: `src/utils/model-parser.ts:27-38`**

```typescript
export function parseModelString(modelString: string): LanguageModel {
  const [provider, modelName] = modelString.split("/");

  if (provider === "anthropic") {
    return anthropic(modelName || "claude-sonnet-4-20250514");
  } else if (provider === "openai") {
    return openai(modelName || "gpt-5-mini") as any;
  }

  // Default to anthropic if no provider specified
  return anthropic(modelString);
}
```

**Problems:**

- Only supports `anthropic` and `openai` providers
- Hardcoded imports at top of file
- No mechanism to add new providers without code changes
- Users cannot use community providers like Ollama, Zhipu, OpenRouter, etc.

---

### 2. Vercel AI SDK Provider Ecosystem

#### Official Providers (25+)

| Provider | Package Name | Key Features |
|----------|--------------|--------------|
| OpenAI | `@ai-sdk/openai` | Image Input, Image Gen, Tools |
| Anthropic | `@ai-sdk/anthropic` | Image Input, Tools |
| Google Generative AI | `@ai-sdk/google` | Image Input, Tools |
| Google Vertex AI | `@ai-sdk/google-vertex` | Image Input, Image Gen, Tools |
| xAI Grok | `@ai-sdk/xai` | Image Input, Image Gen, Tools |
| Azure OpenAI | `@ai-sdk/azure` | Image Input, Tools |
| Amazon Bedrock | `@ai-sdk/amazon-bedrock` | Image Input, Image Gen, Tools |
| Groq | `@ai-sdk/groq` | Image Input, Tools |
| Mistral AI | `@ai-sdk/mistral` | Image Input, Tools |
| Together.ai | `@ai-sdk/togetherai` | Tools |
| Cohere | `@ai-sdk/cohere` | Tools |
| Fireworks | `@ai-sdk/fireworks` | Image Gen, Tools |
| DeepSeek | `@ai-sdk/deepseek` | Tools |
| Cerebras | `@ai-sdk/cerebras` | Tools |
| DeepInfra | `@ai-sdk/deepinfra` | Image Input, Tools |
| Perplexity | `@ai-sdk/perplexity` | - |
| Hugging Face | `@ai-sdk/huggingface` | - |
| Replicate | `@ai-sdk/replicate` | - |
| Fal AI | `@ai-sdk/fal` | Image Gen |
| Luma AI | `@ai-sdk/luma` | Image Gen |
| ElevenLabs | `@ai-sdk/elevenlabs` | Speech/Audio |
| AssemblyAI | `@ai-sdk/assemblyai` | Transcription |
| Deepgram | `@ai-sdk/deepgram` | Transcription |
| Baseten | `@ai-sdk/baseten` | Tools |

#### Community Providers (40+)

| Provider | Package Name | Use Case |
|----------|--------------|----------|
| Ollama | `ollama-ai-provider-v2` | Local LLM inference |
| OpenRouter | `@openrouter/ai-sdk-provider` | Unified API for 100+ models |
| Zhipu AI | `zhipu-ai-provider` | GLM models (Chinese AI) |
| Cloudflare Workers AI | `@cloudflare/ai-sdk-provider` | Edge AI |
| Portkey | `@portkey-ai/vercel-provider` | AI gateway with observability |
| Anthropic Vertex | `anthropic-vertex-ai` | Anthropic on Google Cloud |
| llama.cpp | Community package | Local llama.cpp |
| LM Studio | Via OpenAI-compatible | Local model server |

---

### 3. Provider Interface Pattern

All AI SDK providers follow a consistent pattern:

#### Standard Provider Structure

```typescript
// Every provider exports:
// 1. A default instance (reads API key from env)
import { zhipu } from 'zhipu-ai-provider';

// 2. A factory function for custom configuration
import { createZhipu } from 'zhipu-ai-provider';

const customZhipu = createZhipu({
  baseURL: 'https://api.z.ai/api/paas/v4',
  apiKey: 'your-api-key',
});
```

#### Language Model Specification V2

All providers implement this interface:

```typescript
interface LanguageModelV2 {
  specificationVersion: 'V2';
  provider: string;
  modelId: string;
  
  doGenerate(options: LanguageModelV2CallOptions): Promise<GenerateResult>;
  doStream(options: LanguageModelV2CallOptions): Promise<StreamResult>;
}
```

#### Provider Naming Conventions

| Provider Type | Package Pattern | Example |
|--------------|-----------------|---------|
| Official | `@ai-sdk/{provider}` | `@ai-sdk/anthropic` |
| Community | `{provider}-ai-provider` | `zhipu-ai-provider` |
| Community | `@{org}/ai-sdk-provider` | `@openrouter/ai-sdk-provider` |
| Community | `ai-sdk-{provider}` | `ai-sdk-ollama` |

---

### 4. Dynamic Module Loading Patterns

#### Basic Dynamic Import

```typescript
// Works in both Node.js and Bun
async function loadProvider(packageName: string) {
  try {
    const module = await import(packageName);
    return module;
  } catch (err: any) {
    if (err.code === 'ERR_MODULE_NOT_FOUND') {
      throw new Error(`Provider package "${packageName}" is not installed. Run: bun add ${packageName}`);
    }
    throw err;
  }
}
```

#### Check if Package is Installed

```typescript
function isPackageInstalled(packageName: string): boolean {
  try {
    // Works in Node.js 20+ and Bun
    import.meta.resolve(packageName);
    return true;
  } catch {
    return false;
  }
}
```

#### Programmatic Package Installation

```typescript
async function installPackage(packageName: string): Promise<boolean> {
  const isBun = typeof Bun !== 'undefined';
  
  if (isBun) {
    const proc = Bun.spawn(['bun', 'add', packageName], { 
      stdout: 'pipe',
      stderr: 'pipe'
    });
    return (await proc.exited) === 0;
  }
  
  // Node.js fallback
  const { spawn } = await import('child_process');
  return new Promise((resolve) => {
    const proc = spawn('npm', ['install', packageName]);
    proc.on('close', (code) => resolve(code === 0));
  });
}
```

---

### 5. Provider Registry Implementation

#### Proposed Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│ CLI Input                                                        │
│ --model zhipu/glm-4-plus                                        │
│ --model ollama/llama3                                           │
│ --model openrouter/anthropic/claude-3.5-sonnet                  │
└────────────────────────┬────────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────────┐
│ Provider Registry                                                │
│ src/utils/provider-registry.ts                                   │
│                                                                  │
│ 1. Parse provider/model string                                   │
│ 2. Look up package name in registry                              │
│ 3. Check if package is installed                                 │
│ 4. Dynamic import the provider                                   │
│ 5. Return LanguageModel instance                                 │
└────────────────────────┬────────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────────┐
│ Dynamic Import                                                   │
│ await import(packageName)                                        │
└────────────────────────┬────────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────────┐
│ Provider Instance                                                │
│ provider(modelId) → LanguageModel                               │
└─────────────────────────────────────────────────────────────────┘
```

#### Provider Registry Code

```typescript
// src/utils/provider-registry.ts

import type { LanguageModel } from 'ai';

/**
 * Registry of known AI SDK providers and their package names.
 * This enables the CLI to know which package to import for each provider.
 */
export const PROVIDER_PACKAGES: Record<string, string> = {
  // Official providers
  'anthropic': '@ai-sdk/anthropic',
  'openai': '@ai-sdk/openai',
  'google': '@ai-sdk/google',
  'google-vertex': '@ai-sdk/google-vertex',
  'xai': '@ai-sdk/xai',
  'azure': '@ai-sdk/azure',
  'bedrock': '@ai-sdk/amazon-bedrock',
  'groq': '@ai-sdk/groq',
  'mistral': '@ai-sdk/mistral',
  'togetherai': '@ai-sdk/togetherai',
  'cohere': '@ai-sdk/cohere',
  'fireworks': '@ai-sdk/fireworks',
  'deepseek': '@ai-sdk/deepseek',
  'cerebras': '@ai-sdk/cerebras',
  'deepinfra': '@ai-sdk/deepinfra',
  'perplexity': '@ai-sdk/perplexity',
  'huggingface': '@ai-sdk/huggingface',
  'replicate': '@ai-sdk/replicate',
  'fal': '@ai-sdk/fal',
  'luma': '@ai-sdk/luma',
  'baseten': '@ai-sdk/baseten',
  
  // Community providers
  'ollama': 'ollama-ai-provider-v2',
  'openrouter': '@openrouter/ai-sdk-provider',
  'zhipu': 'zhipu-ai-provider',
  'cloudflare': '@cloudflare/ai-sdk-provider',
  'portkey': '@portkey-ai/vercel-provider',
};

/**
 * Environment variable names for API keys by provider.
 */
export const PROVIDER_API_KEY_ENV: Record<string, string> = {
  'anthropic': 'ANTHROPIC_API_KEY',
  'openai': 'OPENAI_API_KEY',
  'google': 'GOOGLE_GENERATIVE_AI_API_KEY',
  'xai': 'XAI_API_KEY',
  'groq': 'GROQ_API_KEY',
  'mistral': 'MISTRAL_API_KEY',
  'cohere': 'COHERE_API_KEY',
  'fireworks': 'FIREWORKS_API_KEY',
  'deepseek': 'DEEPSEEK_API_KEY',
  'openrouter': 'OPENROUTER_API_KEY',
  'zhipu': 'ZHIPU_API_KEY',
  'ollama': '', // No API key needed for local
};

export interface ProviderConfig {
  baseURL?: string;
  apiKey?: string;
  headers?: Record<string, string>;
}

export interface ParsedModel {
  provider: string;
  modelId: string;
  packageName: string;
}

/**
 * Parse a model string into provider and model components.
 * 
 * @example
 * parseModelString('anthropic/claude-sonnet-4-20250514')
 * // { provider: 'anthropic', modelId: 'claude-sonnet-4-20250514', packageName: '@ai-sdk/anthropic' }
 * 
 * parseModelString('zhipu/glm-4-plus')
 * // { provider: 'zhipu', modelId: 'glm-4-plus', packageName: 'zhipu-ai-provider' }
 */
export function parseModelString(modelString: string): ParsedModel {
  const parts = modelString.split('/');
  
  if (parts.length < 2) {
    // Default to anthropic if no provider specified
    return {
      provider: 'anthropic',
      modelId: modelString,
      packageName: '@ai-sdk/anthropic',
    };
  }
  
  const [provider, ...modelParts] = parts;
  const modelId = modelParts.join('/'); // Handle models like openrouter/anthropic/claude-3.5-sonnet
  
  // Look up package name, or construct it from provider name
  const packageName = PROVIDER_PACKAGES[provider] ?? guessPackageName(provider);
  
  return { provider, modelId, packageName };
}

/**
 * Guess the package name for an unknown provider.
 * Tries common naming conventions.
 */
function guessPackageName(provider: string): string {
  // Try official pattern first
  return `@ai-sdk/${provider}`;
}

/**
 * Check if a provider package is installed.
 */
export function isProviderInstalled(packageName: string): boolean {
  try {
    import.meta.resolve(packageName);
    return true;
  } catch {
    return false;
  }
}

/**
 * Dynamically load a provider and create a model instance.
 */
export async function loadModel(
  modelString: string,
  config?: ProviderConfig
): Promise<LanguageModel> {
  const { provider, modelId, packageName } = parseModelString(modelString);
  
  // Check if installed
  if (!isProviderInstalled(packageName)) {
    throw new ProviderNotInstalledError(provider, packageName);
  }
  
  // Dynamic import
  const module = await import(packageName);
  
  // Get the provider factory or default instance
  const createProvider = module[`create${capitalize(provider)}`] || module.createProvider;
  const defaultProvider = module[provider] || module.default;
  
  // Use factory if config provided, otherwise use default
  let providerInstance;
  if (config && createProvider) {
    providerInstance = createProvider(config);
  } else if (defaultProvider) {
    providerInstance = defaultProvider;
  } else {
    throw new Error(`Could not find provider export in ${packageName}`);
  }
  
  // Create model instance
  if (typeof providerInstance === 'function') {
    return providerInstance(modelId);
  } else if (providerInstance.languageModel) {
    return providerInstance.languageModel(modelId);
  } else if (providerInstance.chat) {
    return providerInstance.chat(modelId);
  }
  
  throw new Error(`Unknown provider interface in ${packageName}`);
}

function capitalize(str: string): string {
  return str.charAt(0).toUpperCase() + str.slice(1);
}

/**
 * Custom error for missing provider packages.
 */
export class ProviderNotInstalledError extends Error {
  constructor(
    public provider: string,
    public packageName: string
  ) {
    super(
      `Provider "${provider}" is not installed.\n\n` +
      `To use this provider, install the package:\n\n` +
      `  bun add ${packageName}\n\n` +
      `Then set the API key (if required):\n\n` +
      `  export ${PROVIDER_API_KEY_ENV[provider] || `${provider.toUpperCase()}_API_KEY`}=your-api-key`
    );
    this.name = 'ProviderNotInstalledError';
  }
}
```

---

### 6. CLI Integration

#### Updated parseArgs for Provider Configuration

```typescript
// In src/cli/index.tsx

interface CLIOptions {
  model?: string;
  // ... existing options
  
  // New provider configuration options
  providerBaseURL?: string;
  providerApiKey?: string;
  providerHeaders?: Record<string, string>;
}

function parseArgs(): CLIOptions {
  const args = process.argv.slice(2);
  const options: CLIOptions = { /* defaults */ };

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];

    if (arg === '--model' || arg === '-m') {
      options.model = args[++i];
    } else if (arg === '--base-url') {
      options.providerBaseURL = args[++i];
    } else if (arg === '--api-key') {
      options.providerApiKey = args[++i];
    }
    // ... other args
  }

  return options;
}
```

#### Updated useAgent Hook

```typescript
// In src/cli/hooks/useAgent.ts

import { loadModel, ProviderConfig } from '../../utils/provider-registry';

export interface UseAgentOptions {
  model: string;
  providerConfig?: ProviderConfig;
  // ... existing options
}

export function useAgent(options: UseAgentOptions): UseAgentReturn {
  // ...
  
  const agentRef = useRef(
    createDeepAgent({
      model: await loadModel(options.model, options.providerConfig),
      // ... other options
    })
  );
  
  // ...
}
```

---

### 7. User Experience Considerations

#### Error Messages

When a provider isn't installed:

```
Error: Provider "zhipu" is not installed.

To use this provider, install the package:

  bun add zhipu-ai-provider

Then set the API key (if required):

  export ZHIPU_API_KEY=your-api-key
```

#### Auto-Install Prompt (Optional Enhancement)

```typescript
async function promptInstall(packageName: string): Promise<boolean> {
  const readline = await import('readline');
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });
  
  return new Promise((resolve) => {
    rl.question(
      `Package "${packageName}" is not installed. Install it now? [y/N] `,
      async (answer) => {
        rl.close();
        if (answer.toLowerCase() === 'y') {
          console.log(`Installing ${packageName}...`);
          const success = await installPackage(packageName);
          resolve(success);
        } else {
          resolve(false);
        }
      }
    );
  });
}
```

#### Help Text Update

```
Usage:
  bun src/cli/index.tsx [options]

Options:
  --model, -m <provider/model>  Model to use (e.g., anthropic/claude-sonnet-4-20250514)
  --base-url <url>              Custom base URL for the provider API
  --api-key <key>               API key (overrides environment variable)

Supported Providers:
  Official: anthropic, openai, google, xai, azure, bedrock, groq, mistral,
            togetherai, cohere, fireworks, deepseek, cerebras, deepinfra,
            perplexity, huggingface, replicate, fal, luma, baseten

  Community: ollama, openrouter, zhipu, cloudflare, portkey
             (install with: bun add <package-name>)

Examples:
  bun src/cli/index.tsx --model anthropic/claude-sonnet-4-20250514
  bun src/cli/index.tsx --model ollama/llama3
  bun src/cli/index.tsx --model zhipu/glm-4-plus
  bun src/cli/index.tsx --model openrouter/anthropic/claude-3.5-sonnet
```

---

### 8. Model Selection UI Updates

The `ModelSelectionPanel` component (`src/cli/components/ModelSelection.tsx`) currently only fetches models from Anthropic and OpenAI APIs. To support dynamic providers:

#### Option A: Registry-Based Model Lists

Maintain a static list of popular models per provider:

```typescript
const POPULAR_MODELS: Record<string, string[]> = {
  'anthropic': ['claude-sonnet-4-20250514', 'claude-haiku-4-5-20251001', 'claude-opus-4-20250514'],
  'openai': ['gpt-5', 'gpt-5-mini', 'gpt-4o', 'gpt-4o-mini'],
  'ollama': ['llama3', 'llama3:70b', 'mistral', 'codellama'],
  'zhipu': ['glm-4-plus', 'glm-4', 'glm-4-flash'],
  // ...
};
```

#### Option B: Provider-Specific Model Fetching

Each provider may have a different API for listing models. Create adapters:

```typescript
interface ModelFetcher {
  fetchModels(): Promise<AvailableModel[]>;
}

const MODEL_FETCHERS: Record<string, ModelFetcher> = {
  'anthropic': new AnthropicModelFetcher(),
  'openai': new OpenAIModelFetcher(),
  'ollama': new OllamaModelFetcher(), // GET http://localhost:11434/api/tags
  // ...
};
```

#### Option C: Allow Manual Model Entry

Add a text input for manually entering model IDs when the provider doesn't support model listing.

---

## Code References

### Current Implementation

| File | Lines | Description |
|------|-------|-------------|
| `src/utils/model-parser.ts` | 1-38 | Current hardcoded model parser |
| `src/cli/index.tsx` | 82-143 | CLI argument parsing |
| `src/cli/hooks/useAgent.ts` | 206-218 | Agent creation with model |
| `src/cli/utils/model-list.ts` | 1-366 | Model fetching for Anthropic/OpenAI |
| `src/cli/components/ModelSelection.tsx` | 1-339 | Model selection UI |

### Related Research

| File | Description |
|------|-------------|
| `docs/tickets/023_custom_api_provider_support/research.md` | Custom base URL support (prerequisite) |

---

## Implementation Phases

### Phase 1: Core Provider Registry (Minimal)

1. Create `src/utils/provider-registry.ts` with:
   - Provider package mapping
   - Dynamic import function
   - Error handling for missing packages

2. Update `src/utils/model-parser.ts` to use registry

3. Update CLI help text

**Effort**: ~2-4 hours

### Phase 2: CLI Configuration (Medium)

1. Add `--base-url` and `--api-key` CLI flags
2. Support environment variables per provider
3. Update `useAgent` hook to pass config

**Effort**: ~2-3 hours

### Phase 3: Model Selection UI (Full)

1. Update `ModelSelectionPanel` to show installed providers
2. Add popular models list per provider
3. Add manual model entry option

**Effort**: ~4-6 hours

### Phase 4: Auto-Install (Optional)

1. Add interactive install prompt
2. Add `--install` flag for non-interactive install

**Effort**: ~2-3 hours

---

## Open Questions

1. **Package name discovery**: Should we try multiple package name patterns when a provider isn't in the registry? (e.g., `@ai-sdk/foo`, `foo-ai-provider`, `ai-sdk-foo`)

2. **Version compatibility**: Should we check provider package versions for AI SDK compatibility?

3. **Provider configuration persistence**: Should provider configs (base URLs, etc.) be saved to a config file?

4. **Subagent providers**: Should subagents be able to use different providers than the parent agent?

5. **Model validation**: Should we validate model IDs against known models, or just pass through to the provider?

---

## Related Documentation

- [Vercel AI SDK Providers](https://ai-sdk.dev/providers/ai-sdk-providers)
- [Community Providers](https://ai-sdk.dev/providers/community-providers)
- [Writing a Custom Provider](https://ai-sdk.dev/providers/community-providers/writing-a-custom-provider)
- [Language Model Specification](https://ai-sdk.dev/docs/ai-sdk-core/language-model-specification)
