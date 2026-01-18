---
date: 2026-01-18 14:22:30 AEDT
researcher: Claude (Sonnet 4.5)
git_commit: 4157004a7e80436b0fafdc439528431117b91c72
branch: main
repository: deepagentsdk
topic: "Review AI Provider Configuration in DeepAgent CLI for User-Friendly Custom Base URL Support"
tags: [research, codebase, cli, ai-providers, base-url-configuration]
status: complete
last_updated: 2026-01-18
last_updated_by: Claude (Sonnet 4.5)
---

# Research: AI Provider Configuration in DeepAgent CLI

## Research Question

Review how AI provider works in the DeepAgent CLI to provide a user-friendly way to allow users to customize the provider base URL. Example:

```typescript
const zhipu = createZhipu({
  baseURL: 'https://api.z.ai/api/coding/paas/v4',
  apiKey: process.env.ZHIPU_API_KEY,
});
```

## Summary

The DeepAgent CLI uses a **string-based model specification system** that converts CLI arguments (e.g., `--model anthropic/claude-sonnet-4-20250514`) into Vercel AI SDK `LanguageModel` instances. The current implementation in `src/utils/model-parser.ts` only supports simple provider/model format parsing and uses default provider instances without custom configuration options.

**Key Finding**: Vercel AI SDK providers **already support custom base URLs** through factory functions (`createAnthropic`, `createOpenAI`, `createZhipu`). The CLI's `parseModelString()` function currently uses default instances instead of configured instances, preventing users from specifying custom endpoints through the CLI interface.

**Existing Patterns**: The codebase has examples of provider factories with custom base URLs in test files and integration tests, and the `advancedOptions.providerOptions` mechanism already supports provider-specific configuration.

## Detailed Findings

### 1. Current Model Provider Configuration Flow

The CLI follows a three-stage pipeline for model configuration:

```
CLI Argument → Model String → Provider Factory Call → LanguageModel Instance
```

**Stage 1: CLI Argument Parsing** ([`src/cli/index.tsx:82-143`](src/cli/index.tsx:82-143))

The `parseArgs()` function extracts the `--model` or `-m` argument:

```typescript
if (arg === "--model" || arg === "-m") {
  options.model = args[++i];  // Line 96-97
}
```

- Supports both `--model` and `-m` flags
- Default: `"anthropic/claude-haiku-4-5-20251001"` applied in App component ([`src/cli/index.tsx:253`](src/cli/index.tsx:253))

**Stage 2: Model String Parsing** ([`src/utils/model-parser.ts:36-49`](src/utils/model-parser.ts:36-49))

The `parseModelString()` function converts strings to `LanguageModel` instances:

```typescript
export function parseModelString(modelString: string): LanguageModel {
  const [provider, modelName] = modelString.split("/");  // Line 37

  if (provider === "anthropic") {
    return anthropic(modelName || "claude-sonnet-4-20250514");  // Line 40
  } else if (provider === "openai") {
    return openai(modelName || "gpt-5-mini") as any;  // Line 42
  } else if (provider === "zhipu") {
    return zhipu(modelName || "glm-4.7") as LanguageModel;  // Line 44
  }

  // Default to anthropic if no provider specified
  return anthropic(modelString);  // Line 48
}
```

**Supported Model String Formats:**

| Format | Provider | Example | Default Model |
|---------|-----------|----------|----------------|
| `anthropic/{model}` | Anthropic | `anthropic/claude-sonnet-4-20250514` | `claude-sonnet-4-20250514` |
| `openai/{model}` | OpenAI | `openai/gpt-4o` | `gpt-5-mini` |
| `zhipu/{model}` | Zhipu AI | `zhipu/glm-4-plus` | `glm-4.7` |
| `{model}` (no provider) | Anthropic | `claude-sonnet-4-20250514` | None |

**Critical Limitation**: The provider factory calls use **default instances** with no configuration:

- `anthropic(modelName)` - uses default Anthropic provider
- `openai(modelName)` - uses default OpenAI provider
- `zhipu(modelName)` - uses default Zhipu provider

These default instances:

- Use standard base URLs (e.g., `https://api.anthropic.com/v1`)
- Read API keys from environment variables only
- Do NOT support custom base URLs or API keys

**Stage 3: Agent Creation** ([`src/cli/hooks/useAgent.ts:206-218`](src/cli/hooks/useAgent.ts:206-218))

The `useAgent` hook passes the parsed model to `createDeepAgent`:

```typescript
const agentRef = useRef(
  createDeepAgent({
    model: parseModelString(currentModel),  // Line 208
    maxSteps: options.maxSteps,
    // ... other options
  })
);
```

### 2. Vercel AI SDK Provider Configuration Capabilities

**Critical Insight**: All Vercel AI SDK providers follow a consistent factory pattern that accepts configuration objects.

**Standard Provider Factory Pattern:**

```typescript
// Import the factory function
import { createAnthropic } from '@ai-sdk/anthropic';
import { createOpenAI } from '@ai-sdk/openai';
import { createZhipu } from 'zhipu-ai-provider';

// Create configured provider instance
const anthropic = createAnthropic({
  baseURL?: string,      // Custom API endpoint
  apiKey?: string,       // Override environment variable
  headers?: Record<string, string>,
  fetch?: Function,
});

// Use configured provider
const model = anthropic('claude-sonnet-4-20250514');
```

**Supported Configuration Options:**

| Provider | baseURL | apiKey | headers | fetch | Other Options |
|----------|----------|----------|----------|--------|---------------|
| Anthropic | ✅ | ✅ | ✅ | ✅ | name, generateId |
| OpenAI | ✅ | ✅ | ✅ | ✅ | organization, project, name |
| Zhipu | ✅ | ✅ | ✅ | - | - |

**Real-World Examples from AI SDK:**

**Custom Anthropic Endpoint:**

```typescript
import { createAnthropic } from '@ai-sdk/anthropic';

const anthropic = createAnthropic({
  baseURL: 'https://custom.anthropic-proxy.com/v1',
  apiKey: 'your-api-key',
  headers: {
    'anthropic-dangerous-direct-browser-access': 'true',
  },
});
```

**Custom Zhipu Endpoint:**

```typescript
import { createZhipu } from 'zhipu-ai-provider';

const zhipu = createZhipu({
  baseURL: 'https://api.z.ai/api/coding/paas/v4',
  apiKey: process.env.ZHIPU_API_KEY,
});

const model = zhipu('glm-4-plus');
```

**OpenAI-Compatible Providers:**

```typescript
import { createOpenAICompatible } from '@ai-sdk/openai-compatible';

const custom = createOpenAICompatible({
  name: 'provider-name',
  apiKey: process.env.CUSTOM_API_KEY,
  baseURL: 'https://api.custom.com/v1',
});
```

### 3. Existing Custom Configuration Patterns in Codebase

The codebase already demonstrates custom provider configuration in several contexts:

#### Pattern 1: Provider Factory with Configuration (Test Files)

**Found in**: [`test-integration/middleware.test.ts:6-8`](test-integration/middleware.test.ts:6-8), [`test-integration/structured-output.test.ts:21-23`](test-integration/structured-output.test.ts:21-23), [`examples/with-provider-options.ts:22-37`](examples/with-provider-options.ts:22-37)

```typescript
import { createAnthropic } from '@ai-sdk/anthropic';

const anthropic = createAnthropic({
  baseURL: 'https://api.anthropic.com/v1',
});

const agent = createDeepAgent({
  model: anthropic(process.env.ANTHROPIC_MODEL || "claude-haiku-4-5-20251001"),
  // ...
});
```

**Usage Context**: Test setup and advanced usage examples

#### Pattern 2: Provider Options Through Advanced Options

**Found in**: [`src/types/core.ts:148-159`](src/types/core.ts:148-159), [`src/agent.ts:364-400`](src/agent.ts:364-400)

```typescript
// Type definition
export interface AdvancedAgentOptions {
  providerOptions?: ToolLoopAgentSettings["providerOptions"];
  // ...
}

// Implementation in buildAgentSettings
if (this.advancedOptions) {
  Object.assign(settings, this.advancedOptions);
}

// Usage example
const agent = createDeepAgent({
  model: anthropic("claude-sonnet-4-5-20250929"),
  advancedOptions: {
    providerOptions: {
      anthropic: {
        thinking: {
          type: "enabled",
          budgetTokens: 5000,
        },
      },
    },
  },
});
```

**Usage Context**: Provider-specific options (e.g., Anthropic extended thinking)

**Note**: This mechanism supports `providerOptions` but not provider instance configuration (baseURL, apiKey).

#### Pattern 3: Environment Variable with Fallback

**Found in**: Multiple backend files (e.g., [`src/backends/e2b.ts:230`](src/backends/e2b.ts:230), [`src/backends/runloop.ts:95`](src/backends/runloop.ts:95), [`src/tools/web.ts:531`](src/tools/web.ts:531))

```typescript
const apiKey = options.apiKey ?? process.env.E2B_API_KEY;
```

**Usage Context**: Backend and tool configuration

**Pattern**: Options parameter takes precedence, falls back to environment variable

#### Pattern 4: Interactive API Key Management

**Found in**: [`src/cli/components/ApiKeyInput.tsx:31-107`](src/cli/components/ApiKeyInput.tsx:31-107)

The CLI provides an interactive panel for setting API keys:

```typescript
// Save to environment (in-memory only)
if (selectedProvider === "anthropic") {
  process.env.ANTHROPIC_API_KEY = apiKey.trim();
} else if (selectedProvider === "openai") {
  process.env.OPENAI_API_KEY = apiKey.trim();
} else if (selectedProvider === "zhipu") {
  process.env.ZHIPU_API_KEY = apiKey.trim();
}
```

**Key behaviors**:

- In-memory only (does not persist to `.env` files)
- Advisory format validation (warnings, not hard errors)
- Auto-pre-fills existing keys for updates

**Issue**: Format validation (checks for `sk-ant-`, `sk-`) may prevent compatible APIs with different key formats

#### Pattern 5: Environment Variable Loading

**Found in**: [`src/cli/index.tsx:971-1035`](src/cli/index.tsx:971-1035)

The CLI loads API keys from `.env` and `.env.local` files with precedence:

1. **System environment variables** (highest priority - never overwritten)
2. **`.env` file** in working directory
3. **`.env.local` file** (checked after `.env`)

```typescript
if (!process.env[key] && value) {
  process.env[key] = value;  // Only set if env var doesn't exist
  keysFound.push(key);
}
```

**Supported keys**:

- `ANTHROPIC_API_KEY` - Anthropic API key
- `OPENAI_API_KEY` - OpenAI API key
- `ZHIPU_API_KEY` - Zhipu API key
- Additional providers: `E2B_API_KEY`, `RUNLOOP_API_KEY`, `DAYTONA_API_KEY`, `TAVILY_API_KEY`

**Note**: `.env` file includes `ANTHROPIC_BASE_URL` example but it's not currently used by the CLI

### 4. Configuration Interface and Extension Points

**Current CLI Options** ([`src/cli/index.tsx:61-73`](src/cli/index.tsx:61-73)):

```typescript
interface CLIOptions {
  model?: string;
  maxSteps?: number;
  systemPrompt?: string;
  workDir?: string;
  session?: string;
  // Feature flags
  enablePromptCaching?: boolean;
  toolResultEvictionLimit?: number;
  enableSummarization?: boolean;
  summarizationThreshold?: number;
  summarizationKeepMessages?: number;
}
```

**Extension Pattern** for adding provider configuration:

1. **Add to `CLIOptions` interface**:

```typescript
interface CLIOptions {
  // ... existing options
  anthropicBaseURL?: string;
  openaiBaseURL?: string;
  zhipuBaseURL?: string;
  anthropicApiKey?: string;
  openaiApiKey?: string;
  zhipuApiKey?: string;
}
```

1. **Add argument parsing in `parseArgs()`**:

```typescript
} else if (arg === "--anthropic-base-url") {
  options.anthropicBaseURL = args[++i];
} else if (arg === "--openai-base-url") {
  options.openaiBaseURL = args[++i];
} else if (arg === "--zhipu-base-url") {
  options.zhipuBaseURL = args[++i];
} else if (arg === "--anthropic-api-key") {
  options.anthropicApiKey = args[++i];
}
```

1. **Pass to `useAgent` hook**:

```typescript
const agent = useAgent({
  model: options.model || "anthropic/claude-haiku-4-5-20251001",
  anthropicBaseURL: options.anthropicBaseURL,
  openaiBaseURL: options.openaiBaseURL,
  zhipuBaseURL: options.zhipuBaseURL,
  anthropicApiKey: options.anthropicApiKey,
  openaiApiKey: options.openaiApiKey,
  zhipuApiKey: options.zhipuApiKey,
  // ... other options
});
```

1. **Extend `UseAgentOptions` interface** ([`src/cli/hooks/useAgent.ts:36-56`](src/cli/hooks/useAgent.ts:36-56)):

```typescript
export interface UseAgentOptions {
  model: string;
  // ... existing options
  anthropicBaseURL?: string;
  openaiBaseURL?: string;
  zhipuBaseURL?: string;
  anthropicApiKey?: string;
  openaiApiKey?: string;
  zhipuApiKey?: string;
}
```

1. **Modify `parseModelString()` to accept configuration**:

```typescript
export function parseModelString(
  modelString: string,
  config?: {
    anthropicBaseURL?: string;
    openaiBaseURL?: string;
    zhipuBaseURL?: string;
    anthropicApiKey?: string;
    openaiApiKey?: string;
    zhipuApiKey?: string;
  }
): LanguageModel {
  const [provider, modelName] = modelString.split("/");

  if (provider === "anthropic") {
    if (config?.anthropicBaseURL || config?.anthropicApiKey) {
      const anthropicProvider = createAnthropic({
        baseURL: config.anthropicBaseURL,
        apiKey: config.anthropicApiKey,
      });
      return anthropicProvider(modelName || "claude-sonnet-4-20250514");
    }
    return anthropic(modelName || "claude-sonnet-4-20250514");
  } else if (provider === "openai") {
    if (config?.openaiBaseURL || config?.openaiApiKey) {
      const openaiProvider = createOpenAI({
        baseURL: config.openaiBaseURL,
        apiKey: config.openaiApiKey,
      });
      return openaiProvider(modelName || "gpt-5-mini") as any;
    }
    return openai(modelName || "gpt-5-mini") as any;
  } else if (provider === "zhipu") {
    if (config?.zhipuBaseURL || config?.zhipuApiKey) {
      const zhipuProvider = createZhipu({
        baseURL: config.zhipuBaseURL,
        apiKey: config.zhipuApiKey,
      });
      return zhipuProvider(modelName || "glm-4.7") as LanguageModel;
    }
    return zhipu(modelName || "glm-4.7") as LanguageModel;
  }

  // Default to anthropic if no provider specified
  return anthropic(modelString);
}
```

### 5. Environment Variable Alternative

Instead of CLI flags, could support environment variables:

```typescript
// Environment variable names
ANTHROPIC_BASE_URL     // Custom Anthropic endpoint
OPENAI_BASE_URL        // Custom OpenAI endpoint
ZHIPU_BASE_URL         // Custom Zhipu endpoint
ANTHROPIC_API_KEY       // Already supported
OPENAI_API_KEY         // Already supported
ZHIPU_API_KEY          // Already supported
```

**Configuration Loading Pattern**:

```typescript
async function loadEnvFile(workDir: string): Promise<EnvLoadResult> {
  const envPaths = [`${workDir}/.env`, `${workDir}/.env.local`];
  const keysToCheck = [
    'ANTHROPIC_API_KEY', 'OPENAI_API_KEY', 'ZHIPU_API_KEY',
    'ANTHROPIC_BASE_URL', 'OPENAI_BASE_URL', 'ZHIPU_BASE_URL'
  ];
  // ... existing loading logic
}
```

**Priority**:

1. CLI flags (highest)
2. Environment variables
3. `.env` file (lowest)

## Architecture Documentation

### Current Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│ CLI Input                                                        │
│ --model anthropic/claude-haiku-4-5-20251001                  │
└────────────────────────┬────────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────────┐
│ CLI Argument Parser (parseArgs)                                  │
│ src/cli/index.tsx:82-143                                         │
│ Extracts model string from CLI arguments                         │
└────────────────────────┬────────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────────┐
│ Agent Hook (useAgent)                                            │
│ src/cli/hooks/useAgent.ts:132-218                                │
│ Receives model string as parameter                               │
└────────────────────────┬────────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────────┐
│ Model String Parser (parseModelString)                           │
│ src/utils/model-parser.ts:36-49                                  │
│ Converts string to LanguageModel instance                        │
└────────────────────────┬────────────────────────────────────────┘
                         │
          ┌──────────────┴──────────────┐
          │                             │
          ▼                             ▼
┌─────────────────────┐       ┌─────────────────────┐
│ @ai-sdk/anthropic │       │ @ai-sdk/openai      │
│ Default instance    │       │ Default instance    │
│ anthropic(modelId) │       │ openai(modelId)     │
│ (no config)       │       │ (no config)       │
└─────────────────────┘       └─────────────────────┘
          │                             │
          └────────────┬───────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────────────┐
│ DeepAgent                                                        │
│ src/agent.ts                                                     │
│ Receives LanguageModel instance                                  │
└────────────────────────┬────────────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────────────┐
│ Vercel AI SDK v6 (streamText)                                    │
│ Passes model to AI SDK                                           │
└────────────────────────┬────────────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────────────┐
│ API Provider Endpoint                                           │
│ https://api.anthropic.com/v1 (default)                          │
│ https://api.openai.com/v1 (default)                             │
│ https://open.bigmodel.cn/api/paas/v4 (default Zhipu)               │
└─────────────────────────────────────────────────────────────────┘
```

### Proposed Architecture for Custom Base URLs

```
┌─────────────────────────────────────────────────────────────────┐
│ CLI Input                                                        │
│ --model anthropic/claude-haiku                                   │
│ --anthropic-base-url https://custom-endpoint.com/v1                 │
│ --anthropic-api-key custom-key-123                                 │
└────────────────────────┬────────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────────┐
│ CLI Argument Parser (parseArgs)                                  │
│ Extracts model string + provider config                          │
└────────────────────────┬────────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────────┐
│ Agent Hook (useAgent)                                            │
│ Passes provider config to model parser                           │
└────────────────────────┬────────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────────┐
│ Model String Parser (parseModelString)                           │
│ Creates configured provider instances:                           │
│   - createAnthropic({ baseURL, apiKey })                        │
│   - createOpenAI({ baseURL, apiKey })                           │
│   - createZhipu({ baseURL, apiKey })                           │
└────────────────────────┬────────────────────────────────────────┘
                         │
          ┌──────────────┴──────────────┐
          │                             │
          ▼                             ▼
┌─────────────────────┐       ┌─────────────────────┐
│ Custom Anthropic    │       │ Custom OpenAI       │
│ createAnthropic({   │       │ createOpenAI({      │
│   baseURL,          │       │   baseURL,          │
│   apiKey            │       │   apiKey            │
│ })                  │       │ })                  │
└─────────────────────┘       └─────────────────────┘
          │                             │
          └────────────┬───────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────────────┐
│ DeepAgent (with configured LanguageModel)                        │
└────────────────────────┬────────────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────────────┐
│ Vercel AI SDK v6 (streamText)                                    │
│ Uses configured provider with custom endpoint                    │
└────────────────────────┬────────────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────────────┐
│ Custom API Provider Endpoint                                    │
│ https://custom-endpoint.com/v1                                  │
└─────────────────────────────────────────────────────────────────┘
```

## Code References

### Current Implementation Files

| File | Lines | Description |
|------|-------|-------------|
| [`src/utils/model-parser.ts`](src/utils/model-parser.ts) | 1-50 | Model string to LanguageModel parser (no custom config) |
| [`src/cli/index.tsx`](src/cli/index.tsx) | 82-143 | CLI argument parser |
| [`src/cli/index.tsx`](src/cli/index.tsx) | 971-1035 | Environment file loader |
| [`src/cli/index.tsx`](src/cli/index.tsx) | 169-213 | Help text display |
| [`src/cli/hooks/useAgent.ts`](src/cli/hooks/useAgent.ts) | 132-218 | Agent hook initialization |
| [`src/cli/hooks/useAgent.ts`](src/cli/hooks/useAgent.ts) | 206-218 | Agent creation with model |
| [`src/cli/hooks/useAgent.ts`](src/cli/hooks/useAgent.ts) | 837-843 | Runtime model switching |
| [`src/cli/components/ApiKeyInput.tsx`](src/cli/components/ApiKeyInput.tsx) | 31-107 | Interactive API key input panel |
| [`src/types/core.ts`](src/types/core.ts) | 148-159 | AdvancedAgentOptions interface |
| [`src/agent.ts`](src/agent.ts) | 364-400 | buildAgentSettings with advancedOptions |

### Test and Example Files

| File | Lines | Description |
|------|-------|-------------|
| [`test-integration/middleware.test.ts`](test-integration/middleware.test.ts) | - | Example of createAnthropic with baseURL |
| [`test-integration/structured-output.test.ts`](test-integration/structured-output.test.ts) | - | Example of createAnthropic with baseURL |
| [`examples/with-provider-options.ts`](examples/with-provider-options.ts) | - | Example of advanced provider options |
| [`.env`](.env) | - | Development environment configuration (includes ANTHROPIC_BASE_URL example) |

## Historical Context

### Related Research Documents

| Ticket | Date | Topic | Overlap |
|--------|------|--------|----------|
| [023_custom_api_provider_support](023_custom_api_provider_support/research.md) | 2026-01-15 | Custom base URL support for Anthropic/OpenAI |
| [024_dynamic_ai_provider_support](024_dynamic_ai_provider_support/research.md) | 2026-01-17 | Dynamic loading of any AI SDK provider |

**Relationship to Current Research**:

- Ticket 023 covers custom base URL support for existing providers (Anthropic, OpenAI)
- Ticket 024 extends to dynamic loading of any AI SDK provider
- This research focuses on the **Zhipu provider example** specifically, and synthesizes current codebase state
- This document provides updated findings based on current codebase state (commit 4157004)

### Key Insights from Previous Research

**From Ticket 023**:

- AI SDK v6 providers natively support custom base URLs
- The CLI bridge pattern (`parseModelString`) is the key extension point
- Delegation over validation (let API endpoint reject invalid keys)
- API key format validation should be advisory, not blocking

**From Ticket 024**:

- All AI SDK providers share a common factory pattern
- Dynamic import is well-supported (Node.js and Bun)
- Provider registry pattern can support any provider
- Need helpful error messages when packages aren't installed

## Open Questions

1. **Configuration Interface**: Should custom base URLs be configured via:
   - CLI flags only (e.g., `--anthropic-base-url`)
   - Environment variables only (e.g., `ANTHROPIC_BASE_URL`)
   - Both CLI flags and environment variables (with precedence)
   - Configuration files (JSON/YAML)

2. **API Key Validation**: Should CLI's API key format validation in [`ApiKeyInput.tsx:76-84`](src/cli/components/ApiKeyInput.tsx:76-84) be:
   - Removed entirely for maximum flexibility
   - Made optional with a flag
   - Kept as advisory warnings only (current behavior)
   - Extended to detect compatible API patterns

3. **Zhipu Provider Integration**: The current `parseModelString` already includes Zhipu support ([`src/utils/model-parser.ts:43-44`](src/utils/model-parser.ts:43-44)), but:
   - Should we add Zhipu-specific CLI flags?
   - What about other community providers (Ollama, OpenRouter, etc.)?
   - Should we support dynamic loading (as in ticket 024) alongside base URL configuration?

4. **Model Fetching**: How should model fetching ([`src/cli/utils/model-list.ts:141-194`](src/cli/utils/model-list.ts:141-194), [`src/cli/utils/model-list.ts:216-277`](src/cli/utils/model-list.ts:216-277)) work with custom base URLs?
   - Use configured base URL when fetching models
   - Keep hardcoded for official APIs only
   - Allow users to disable model fetching for incompatible endpoints

5. **Provider Factory Caching**: Should configured provider instances be:
   - Cached based on configuration hash (baseURL + apiKey)
   - Recreated on each parse (simpler, potential performance impact)
   - Hybrid approach with TTL

6. **Default Instances**: Should default instances still be used when no custom configuration is provided, or should the CLI always create explicit instances for consistency?

## Key Insights

★ Insight ─────────────────────────────────────

1. **AI SDK v6 is Already Flexible**: Vercel AI SDK v6 providers natively support custom base URLs and API keys through their factory functions. The infrastructure already exists—no custom adapters or proxies are needed.

2. **CLI Bridge Pattern is Key**: The `parseModelString()` function is the critical bridge between CLI convenience (string-based model IDs) and AI SDK requirements (`LanguageModel` instances). This is where custom provider configuration must be injected.

3. **Multiple Extension Points Exist**: The codebase has demonstrated patterns for:
   - Provider factory with custom configuration (test files)
   - Provider options through `advancedOptions`
   - Environment variable loading with precedence
   - Interactive configuration panels

4. **Zhipu Already Supported**: The current `parseModelString` function already includes Zhipu provider support (line 43-44), but uses the default instance without custom configuration. The user's example `createZhipu({ baseURL, apiKey })` pattern is already demonstrated in the codebase.

5. **Environment Variable Pattern Already Exists**: The `.env` file includes `ANTHROPIC_BASE_URL` example (line 3), but it's not currently parsed or used. Extending the existing environment loading pattern would be the most user-friendly approach.

─────────────────────────────────────────────────
