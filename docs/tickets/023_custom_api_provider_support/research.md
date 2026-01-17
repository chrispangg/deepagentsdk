---
date: 2026-01-15 09:44:10 AEDT
researcher: Claude (Sonnet 4.5)
git_commit: d4c7c559c85d83ab0bd53dcb8cd56f670c3968f4
branch: main
repository: deepagentsdk
topic: "CLI Support for Anthropic/OpenAI Compatible APIs with Custom Base URLs and Flexible API Key Handling"
tags: [research, codebase, cli, api-providers, ai-sdk-v6]
status: complete
last_updated: 2026-01-15
last_updated_by: Claude (Sonnet 4.5)
---

# Research: CLI Support for Compatible API Providers

## Research Question

The user wants to extend the deepagentsdk CLI to support Anthropic and OpenAI compatible APIs. This means:

- The CLI can still use the standard `anthropic` and `openai` AI SDK extensions
- Allow users to specify custom base URLs for each provider
- Do not enforce API key structure when users want to use a compatible API with different key formats

## Summary

The deepagentsdk CLI currently implements a **string-based model parsing system** that bridges CLI convenience with Vercel AI SDK v6's `LanguageModel` instances. The CLI parses model strings (e.g., `"anthropic/claude-haiku-4-5-20251001"`), calls provider factory functions from `@ai-sdk/anthropic` and `@ai-sdk/openai`, and these providers read API keys from environment variables.

**Key Finding**: Vercel AI SDK v6 providers **already support custom base URLs** through their configuration APIs. Both `createAnthropic()` and `createOpenAI()` accept `baseURL` and `apiKey` parameters in their settings objects, enabling use with compatible APIs without modifications to the underlying SDK.

**Current Limitation**: The CLI's `parseModelString()` function uses the default provider instances (`anthropic`, `openai`) instead of configured instances with custom base URLs. This means users cannot currently specify custom endpoints through the CLI interface.

**Path Forward**: Extend the CLI configuration system to:

1. Accept custom base URL parameters (via CLI flags or environment variables)
2. Create configured provider instances using `createAnthropic()` and `createOpenAI()` factory functions
3. Modify `parseModelString()` to use configured providers instead of default instances
4. Relax API key format validation to support compatible APIs

## Detailed Findings

### 1. Current Model Provider Configuration

**File: [`src/utils/model-parser.ts:27-38`](https://github.com/chrispangma/deepagentsdk/blob/d4c7c55/src/utils/model-parser.ts#L27-L38)**

The `parseModelString()` function is the core bridge between CLI model strings and AI SDK providers:

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

**Current Implementation:**

- **Line 28**: Splits model string by "/" separator
- **Line 31**: Calls `anthropic()` factory from `@ai-sdk/anthropic` (imported at line 6)
- **Line 33**: Calls `openai()` factory from `@ai-sdk/openai` (imported at line 7)
- **Line 37**: Defaults to Anthropic if no provider specified

**Key Issue**: These factory calls use the **default provider instances**, which means they always use:

- Default base URLs (`https://api.anthropic.com/v1`, `https://api.openai.com/v1`)
- Environment variables for API keys (`ANTHROPIC_API_KEY`, `OPENAI_API_KEY`)

**Flow from CLI to Agent:**

1. User runs: `bun src/cli/index.tsx --model anthropic/claude-haiku-4-5-20251001`
2. [`parseArgs()`](https://github.com/chrispangma/deepagentsdk/blob/d4c7c55/src/cli/index.tsx#L97) extracts model string
3. [`useAgent()`](https://github.com/chrispangma/deepagentsdk/blob/d4c7c55/src/cli/hooks/useAgent.ts#L208) hook calls `parseModelString(currentModel)`
4. Returns `LanguageModel` instance passed to `createDeepAgent()`
5. Agent uses model with Vercel AI SDK's `streamText()`

---

### 2. API Key Handling and Validation

**Environment Variable Loading** ([`src/cli/index.tsx:971-1035`](https://github.com/chrispangma/deepagentsdk/blob/d4c7c55/src/cli/index.tsx#L971-L1035))

The CLI loads API keys from `.env` files with the following precedence:

1. **System environment variables** (highest priority - never overwritten)
2. **`.env` file** in working directory
3. **`.env.local` file** (checked after `.env`)

**Key parsing behavior (line 1009):**

```typescript
if (!process.env[key] && value) {
  process.env[key] = value;
  keysFound.push(key);
}
```

**API key sources:**

- `ANTHROPIC_API_KEY` - Anthropic API key
- `OPENAI_API_KEY` - OpenAI API key
- Additional provider keys: `E2B_API_KEY`, `RUNLOOP_API_KEY`, `DAYTONA_API_KEY`, `TAVILY_API_KEY`

**Validation at startup** ([`src/cli/index.tsx:1054-1056`](https://github.com/chrispangma/deepagentsdk/blob/d4c7c55/src/cli/index.tsx#L1054-L1056)):

```typescript
if (!process.env.ANTHROPIC_API_KEY && !process.env.OPENAI_API_KEY) {
  console.log(`\x1b[33m⚠\x1b[0m No API keys found. Set ANTHROPIC_API_KEY or OPENAI_API_KEY in environment or .env file.`);
}
```

**Key characteristics:**

- **Soft validation only**: Warning displayed, but CLI continues
- **No hard errors**: Missing keys don't stop execution
- **Delegation**: Actual validation happens at AI SDK level during API calls

**Interactive API Key Input** ([`src/cli/components/ApiKeyInput.tsx:76-84`](https://github.com/chrispangma/deepagentsdk/blob/d4c7c55/src/cli/components/ApiKeyInput.tsx#L76-L84))

The API key input panel includes **advisory format validation**:

```typescript
// Basic validation
if (selectedProvider === "anthropic" && !apiKey.startsWith("sk-ant-")) {
  setError("Anthropic API keys typically start with 'sk-ant-'");
  return;
}
if (selectedProvider === "openai" && !apiKey.startsWith("sk-")) {
  setError("OpenAI API keys typically start with 'sk-'");
  return;
}
```

**Key behaviors:**

- **Format hints**: Shows warnings for non-standard key formats
- **Non-blocking**: Users can potentially bypass with Escape key
- **In-memory only**: Keys saved to `process.env`, not to `.env` files
- **No persistence**: Interactive input doesn't update files

**Issue**: This format validation (`sk-ant-`, `sk-`) would prevent users from using compatible APIs with different key formats.

---

### 3. Vercel AI SDK v6 Provider Capabilities

**Critical Finding**: Vercel AI SDK v6 providers **already support custom base URLs** through their factory functions.

**Anthropic Provider API** ([`node_modules/@ai-sdk/anthropic/dist/index.d.ts:709-735`](https://github.com/chrispangma/deepagentsdk/blob/d4c7c55/node_modules/@ai-sdk/anthropic/dist/index.d.ts#L709-L735)):

```typescript
interface AnthropicProviderSettings {
  /**
   * Use a different URL prefix for API calls, e.g. to use proxy servers.
   * The default prefix is `https://api.anthropic.com/v1`.
   */
  baseURL?: string;

  /**
   * API key that is being send using the `x-api-key` header.
   * It defaults to the `ANTHROPIC_API_KEY` environment variable.
   */
  apiKey?: string;

  /**
   * Custom headers to include in the requests.
   */
  headers?: Record<string, string>;

  /**
   * Custom fetch implementation. You can use it as a middleware to intercept requests,
   * or to provide a custom fetch implementation for e.g. testing.
   */
  fetch?: FetchFunction;

  generateId?: () => string;

  /**
   * Custom provider name
   * Defaults to 'anthropic.messages'
   */
  name?: string;
}
```

**OpenAI Provider API** ([`node_modules/@ai-sdk/openai/dist/index.d.ts:522-556`](https://github.com/chrispangma/deepagentsdk/blob/d4c7c55/node_modules/@ai-sdk/openai/dist/index.d.ts#L522-L556)):

```typescript
interface OpenAIProviderSettings {
  /**
   * Base URL for the OpenAI API calls.
   */
  baseURL?: string;

  /**
   * API key for authenticating requests.
   */
  apiKey?: string;

  /**
   * OpenAI Organization.
   */
  organization?: string;

  /**
   * OpenAI project.
   */
  project?: string;

  /**
   * Custom headers to include in the requests.
   */
  headers?: Record<string, string>;

  /**
   * Provider name. Overrides the `openai` default name for 3rd party providers.
   */
  name?: string;

  /**
   * Custom fetch implementation. You can use it as a middleware to intercept requests,
   * or to provide a custom fetch implementation for e.g. testing.
   */
  fetch?: FetchFunction;
}
```

**Usage Examples from Codebase:**

**Example 1: Custom Anthropic-compatible endpoint** ([`test-integration/middleware.test.ts`](https://github.com/chrispangma/deepagentsdk/blob/d4c7c55/test-integration/middleware.test.ts)):

```typescript
import { createAnthropic } from '@ai-sdk/anthropic';

const anthropic = createAnthropic({
  baseURL: 'https://api.anthropic.com/v1',
});

const agent = createDeepAgent({
  model: anthropic('claude-sonnet-4-20250514'),
});
```

**Example 2: Custom OpenAI-compatible endpoint:**

```typescript
import { createOpenAI } from '@ai-sdk/openai';

const openai = createOpenAI({
  baseURL: 'https://your-custom-endpoint.com/v1',
  apiKey: 'your-api-key',
});

const agent = createDeepAgent({
  model: openai('gpt-4o'),
});
```

**Key Capabilities:**

1. ✅ **Custom base URLs**: Both providers accept `baseURL` parameter
2. ✅ **Flexible API keys**: `apiKey` parameter overrides environment variable
3. ✅ **No format validation**: Providers do NOT validate API key format (validation happens at API endpoint)
4. ✅ **Custom headers**: Can add additional headers for authentication
5. ✅ **Compatible APIs**: Designed to work with any API-compatible endpoint

**Real-world use cases supported:**

- OpenAI-compatible proxies (e.g., LiteLLM, local LLM servers)
- Azure OpenAI (with compatible endpoint)
- Custom API gateways
- Development/testing proxies
- Region-specific endpoints

**Package versions** ([`package.json:59-61`](https://github.com/chrispangma/deepagentsdk/blob/d4c7c55/package.json#L59-L61)):

```json
"@ai-sdk/anthropic": "^3.0.9",
"@ai-sdk/openai": "^3.0.7",
"ai": "^6.0.19"
```

---

### 4. CLI Configuration Interface and Extension Points

**Current CLI Options** ([`src/cli/index.tsx:61-73`](https://github.com/chrispangma/deepagentsdk/blob/d4c7c55/src/cli/index.tsx#L61-L73)):

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

**Supported command-line flags** ([`src/cli/index.tsx:82-143`](https://github.com/chrispangma/deepagentsdk/blob/d4c7c55/src/cli/index.tsx#L82-L143)):

- `--model, -m <model>` - Model selector
- `--max-steps, -s <number>` - Maximum steps per generation
- `--prompt, -p <prompt>` - Custom system prompt
- `--dir, -d <directory>` - Working directory
- `--session <id>` - Session ID for checkpoints
- Performance flags: `--cache`, `--no-cache`, `--summarize`, etc.

**Extension Pattern for Adding New Configuration Options:**

To add new configuration options (e.g., custom base URLs), follow this pattern:

1. **Add to `CLIOptions` interface** (line 61):

```typescript
interface CLIOptions {
  // ... existing options
  anthropicBaseURL?: string;
  openaiBaseURL?: string;
  anthropicApiKey?: string;
  openaiApiKey?: string;
}
```

1. **Add argument parsing in `parseArgs()`** (after line 140):

```typescript
} else if (arg === "--anthropic-base-url") {
  options.anthropicBaseURL = args[++i];
} else if (arg === "--openai-base-url") {
  options.openaiBaseURL = args[++i];
```

1. **Update help text** ([`printHelp()`](https://github.com/chrispangma/deepagentsdk/blob/d4c7c55/src/cli/index.tsx#L177-L200)):

```typescript
  --anthropic-base-url <url>  Custom base URL for Anthropic API
  --openai-base-url <url>     Custom base URL for OpenAI API
```

1. **Pass to `useAgent` hook** ([`src/cli/index.tsx:252-268`](https://github.com/chrispangma/deepagentsdk/blob/d4c7c55/src/cli/index.tsx#L252-L268)):

```typescript
const agent = useAgent({
  model: options.model || "anthropic/claude-haiku-4-5-20251001",
  anthropicBaseURL: options.anthropicBaseURL,
  openaiBaseURL: options.openaiBaseURL,
  // ... other options
});
```

1. **Extend `UseAgentOptions` interface** ([`src/cli/hooks/useAgent.ts:36-56`](https://github.com/chrispangma/deepagentsdk/blob/d4c7c55/src/cli/hooks/useAgent.ts#L36-L56)):

```typescript
export interface UseAgentOptions {
  model: string;
  // ... existing options
  anthropicBaseURL?: string;
  openaiBaseURL?: string;
}
```

1. **Modify `parseModelString()` to accept configuration:**

```typescript
export function parseModelString(
  modelString: string,
  config?: {
    anthropicBaseURL?: string;
    openaiBaseURL?: string;
    anthropicApiKey?: string;
    openaiApiKey?: string;
  }
): LanguageModel {
  const [provider, modelName] = modelString.split("/");

  if (provider === "anthropic") {
    const anthropicProvider = config?.anthropicBaseURL || config?.anthropicApiKey
      ? createAnthropic({
          baseURL: config.anthropicBaseURL,
          apiKey: config.anthropicApiKey,
        })
      : anthropic; // Use default instance
    return anthropicProvider(modelName || "claude-sonnet-4-20250514");
  } else if (provider === "openai") {
    const openaiProvider = config?.openaiBaseURL || config?.openaiApiKey
      ? createOpenAI({
          baseURL: config.openaiBaseURL,
          apiKey: config.openaiApiKey,
        })
      : openai; // Use default instance
    return openaiProvider(modelName || "gpt-5-mini") as any;
  }

  // Default to anthropic if no provider specified
  return anthropic(modelString);
}
```

**Environment Variable Alternative:**

Instead of CLI flags, could also support environment variables:

- `ANTHROPIC_BASE_URL` - Custom Anthropic endpoint
- `OPENAI_BASE_URL` - Custom OpenAI endpoint
- `ANTHROPIC_API_KEY` - Already supported
- `OPENAI_API_KEY` - Already supported

**Configuration File Support:**

Currently only `.env` files are supported (KEY=VALUE format). Could extend to support:

- JSON configuration files (e.g., `.deep-agent.json`)
- YAML configuration files
- RC files (e.g., `.deepagentrc`)

**Model Selection UI** ([`src/cli/components/ModelSelection.tsx`](https://github.com/chrispangma/deepagentsdk/blob/d4c7c55/src/cli/components/ModelSelection.tsx)):

The interactive model selection UI fetches available models from provider APIs:

- **Anthropic** ([`src/cli/utils/model-list.ts:141-194`](https://github.com/chrispangma/deepagentsdk/blob/d4c7c55/src/cli/utils/model-list.ts#L141-L194)): Fetches from `https://api.anthropic.com/v1/models`
- **OpenAI** ([`src/cli/utils/model-list.ts:216-277`](https://github.com/chrispangma/deepagentsdk/blob/d4c7c55/src/cli/utils/model-list.ts#L216-L277)): Fetches from `https://api.openai.com/v1/models`

**Issue**: These URLs are hardcoded and would need to use custom base URLs when configured.

---

## Architecture Documentation

### Current Architecture Pattern

```
┌─────────────────────────────────────────────────────────────────┐
│ CLI Input                                                        │
│ --model anthropic/claude-haiku-4-5-20251001                      │
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
│ src/utils/model-parser.ts:27-38                                  │
│ Converts string to LanguageModel instance                        │
└────────────────────────┬────────────────────────────────────────┘
                         │
         ┌───────────────┴───────────────┐
         │                               │
         ▼                               ▼
┌─────────────────────┐         ┌─────────────────────┐
│ @ai-sdk/anthropic   │         │ @ai-sdk/openai      │
│ Default instance    │         │ Default instance    │
│ anthropic(modelId)  │         │ openai(modelId)     │
└─────────────────────┘         └─────────────────────┘
         │                               │
         └───────────────┬───────────────┘
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
└─────────────────────────────────────────────────────────────────┘
```

### Proposed Architecture for Custom Providers

```
┌─────────────────────────────────────────────────────────────────┐
│ CLI Input                                                        │
│ --model anthropic/claude-haiku                                   │
│ --anthropic-base-url https://custom-endpoint.com/v1             │
│ --anthropic-api-key custom-key-123                               │
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
└────────────────────────┬────────────────────────────────────────┘
                         │
         ┌───────────────┴───────────────┐
         │                               │
         ▼                               ▼
┌─────────────────────┐         ┌─────────────────────┐
│ Custom Anthropic    │         │ Custom OpenAI       │
│ createAnthropic({   │         │ createOpenAI({      │
│   baseURL,          │         │   baseURL,          │
│   apiKey            │         │   apiKey            │
│ })                  │         │ })                  │
└─────────────────────┘         └─────────────────────┘
         │                               │
         └───────────────┬───────────────┘
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

---

## Code References

### Current Implementation Files

| File | Lines | Description |
|------|-------|-------------|
| [`src/utils/model-parser.ts`](https://github.com/chrispangma/deepagentsdk/blob/d4c7c55/src/utils/model-parser.ts) | 27-38 | Model string to LanguageModel parser |
| [`src/cli/index.tsx`](https://github.com/chrispangma/deepagentsdk/blob/d4c7c55/src/cli/index.tsx) | 82-143 | CLI argument parser |
| [`src/cli/index.tsx`](https://github.com/chrispangma/deepagentsdk/blob/d4c7c55/src/cli/index.tsx) | 971-1035 | Environment file loader |
| [`src/cli/index.tsx`](https://github.com/chrispangma/deepagentsdk/blob/d4c7c55/src/cli/index.tsx) | 177-200 | Help text display |
| [`src/cli/hooks/useAgent.ts`](https://github.com/chrispangma/deepagentsdk/blob/d4c7c55/src/cli/hooks/useAgent.ts) | 132-218 | Agent hook initialization |
| [`src/cli/hooks/useAgent.ts`](https://github.com/chrispangma/deepagentsdk/blob/d4c7c55/src/cli/hooks/useAgent.ts) | 206-218 | Agent creation with model |
| [`src/cli/hooks/useAgent.ts`](https://github.com/chrispangma/deepagentsdk/blob/d4c7c55/src/cli/hooks/useAgent.ts) | 837-843 | Runtime model switching |
| [`src/cli/components/ApiKeyInput.tsx`](https://github.com/chrispangma/deepagentsdk/blob/d4c7c55/src/cli/components/ApiKeyInput.tsx) | 76-84 | API key format validation |
| [`src/cli/utils/model-list.ts`](https://github.com/chrispangma/deepagentsdk/blob/d4c7c55/src/cli/utils/model-list.ts) | 141-194 | Anthropic model fetching |
| [`src/cli/utils/model-list.ts`](https://github.com/chrispangma/deepagentsdk/blob/d4c7c55/src/cli/utils/model-list.ts) | 216-277 | OpenAI model fetching |

### AI SDK Type Definitions

| File | Lines | Description |
|------|-------|-------------|
| [`node_modules/@ai-sdk/anthropic/dist/index.d.ts`](https://github.com/chrispangma/deepagentsdk/blob/d4c7c55/node_modules/@ai-sdk/anthropic/dist/index.d.ts) | 709-735 | AnthropicProviderSettings interface |
| [`node_modules/@ai-sdk/openai/dist/index.d.ts`](https://github.com/chrispangma/deepagentsdk/blob/d4c7c55/node_modules/@ai-sdk/openai/dist/index.d.ts) | 522-556 | OpenAIProviderSettings interface |

### Test Examples

| File | Lines | Description |
|------|-------|-------------|
| [`test-integration/middleware.test.ts`](https://github.com/chrispangma/deepagentsdk/blob/d4c7c55/test-integration/middleware.test.ts) | - | Example of createAnthropic with baseURL |

---

## Historical Context

No existing research documents or tickets directly address custom API provider support. This is a new feature request.

**Related Tickets:**

- `docs/tickets/018_ai_sdk_elements_integration/` - Integration of AI SDK elements (may have relevant patterns)
- `docs/tickets/020_sandbox_providers_integration/` - Similar provider configuration pattern for cloud sandboxes

**Related Documentation:**

- [`AGENTS.md`](https://github.com/chrispangma/deepagentsdk/blob/d4c7c55/AGENTS.md) - Project overview and conventions
- [`docs/PROJECT-STATE.md`](https://github.com/chrispangma/deepagentsdk/blob/d4c7c55/docs/PROJECT-STATE.md) - Feature tracking

---

## Open Questions

1. **Configuration Interface**: Should custom base URLs be configured via:
   - CLI flags only (e.g., `--anthropic-base-url`)
   - Environment variables only (e.g., `ANTHROPIC_BASE_URL`)
   - Both CLI flags and environment variables (with precedence)
   - Configuration files (JSON/YAML)

2. **API Key Validation**: Should the CLI's API key format validation in [`ApiKeyInput.tsx:76-84`](https://github.com/chrispangma/deepagentsdk/blob/d4c7c55/src/cli/components/ApiKeyInput.tsx#L76-L84) be:
   - Removed entirely for maximum flexibility
   - Made optional with a flag
   - Kept as advisory warnings only (current behavior is already advisory)
   - Extended to detect compatible API patterns

3. **Model Fetching**: How should model fetching ([`fetchAnthropicModels`](https://github.com/chrispangma/deepagentsdk/blob/d4c7c55/src/cli/utils/model-list.ts#L141-L194), [`fetchOpenAIModels`](https://github.com/chrispangma/deepagentsdk/blob/d4c7c55/src/cli/utils/model-list.ts#L216-L277)) work with custom base URLs?
   - Use configured base URL when fetching models
   - Keep hardcoded for official APIs only
   - Allow users to disable model fetching for incompatible endpoints

4. **Provider Factory Caching**: Should configured provider instances be cached or recreated on each model parsing?
   - Cache based on configuration hash (baseURL + apiKey)
   - Recreate on each parse (simpler, potential performance impact)
   - Hybrid approach with TTL

5. **Default Instances**: Should the default `anthropic` and `openai` instances from AI SDK packages still be used when no custom configuration is provided, or should the CLI always create explicit instances for consistency?

---

## Implementation Considerations

### Backward Compatibility

- ✅ **Model string format unchanged**: Users can still use `"anthropic/claude-haiku-4-5-20251001"`
- ✅ **Environment variables still work**: `ANTHROPIC_API_KEY`, `OPENAI_API_KEY` still supported
- ✅ **Default behavior unchanged**: Without custom base URL, uses official API endpoints
- ✅ **Interactive input unchanged**: `/apikey` command still works

### Breaking Changes

None expected if implemented as extensions to existing configuration system.

### Dependencies

- ✅ **No new dependencies**: Uses existing `@ai-sdk/anthropic` and `@ai-sdk/openai` packages
- ✅ **Already installed**: Both packages are in [`package.json:59-61`](https://github.com/chrispangma/deepagentsdk/blob/d4c7c55/package.json#L59-L61)
- ✅ **Factory functions available**: `createAnthropic` and `createOpenAI` already exported

### Testing Considerations

1. **Unit tests needed**:
   - Test `parseModelString()` with custom configuration
   - Test provider instance creation with baseURL
   - Test API key validation changes (if any)

2. **Integration tests needed**:
   - Test with actual custom endpoints (e.g., local LLM server)
   - Test model fetching with custom base URLs
   - Test CLI flag parsing for new options

3. **Edge cases**:
   - Empty base URL string
   - Invalid URL format
   - Mixed configuration (some providers custom, some default)
   - Environment variable vs CLI flag precedence

### Documentation Requirements

1. **User-facing**:
   - CLI help text updates
   - Examples of using with compatible APIs
   - Environment variable documentation
   - Example `.env` files

2. **Developer-facing**:
   - Update AGENTS.md with new configuration options
   - Document provider factory pattern
   - API reference for parseModelString extensions

---

## Key Insights

`★ Insight ─────────────────────────────────────`

1. **AI SDK v6 is Already Flexible**: The Vercel AI SDK v6 providers natively support custom base URLs and API keys through their factory functions (`createAnthropic`, `createOpenAI`). No custom adapters or proxies are needed—the infrastructure already exists.

2. **CLI Bridge Pattern is Key**: The current `parseModelString()` function is the critical bridge between CLI convenience (string-based model IDs) and AI SDK requirements (LanguageModel instances). This is where custom provider configuration must be injected.

3. **Delegation over Validation**: The CLI currently delegates all API key validation to the AI SDK providers (soft validation only). For compatible APIs, this approach should be maintained—let the API endpoint reject invalid keys, don't preemptively validate formats.
`─────────────────────────────────────────────────`
