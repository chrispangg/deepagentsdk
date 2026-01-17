# Research: Dynamic Plugin/Provider Systems in CLI Tools

**Date**: 2026-01-17  
**Researcher**: Claude (Opus 4.5)  
**Topic**: How popular CLI tools implement dynamic plugin/provider systems  
**Purpose**: Inform deepagentsdk CLI design for custom model provider support

---

## Executive Summary

This research examines how popular CLI tools (Prettier, ESLint, lint-staged, oclif, OpenAI Codex CLI, and Vercel AI SDK) implement dynamic plugin/provider systems. The goal is to identify patterns and best practices for extending the deepagentsdk CLI to support third-party model providers.

**Key Findings**:
1. **Convention-based discovery** is the dominant pattern (naming conventions like `eslint-plugin-*`, `prettier-plugin-*`)
2. **Configuration-first** approach preferred over auto-discovery for production use
3. **Graceful degradation** with helpful error messages when plugins missing
4. **Factory pattern** for creating configured provider instances
5. **Environment variables + CLI flags + config files** form a layered configuration system

**Recommended Approach for deepagentsdk**: A **hybrid configuration-based system** combining:
- Environment variables for API keys and base URLs
- CLI flags for runtime overrides
- Optional config file (`.deepagentrc` or `deepagent.config.js`) for complex setups
- Factory pattern for provider instantiation (already supported by AI SDK)

---

## Tool-by-Tool Analysis

### 1. Prettier Plugin System

**Architecture**: Prettier uses a well-defined plugin API where plugins export specific objects (`languages`, `parsers`, `printers`, `options`).

**Discovery Mechanisms**:
1. **Explicit configuration** - `plugins: [...]` in config files (`.prettierrc`, `prettier.config.js`)
2. **CLI flags** - `--plugin=prettier-plugin-foo`
3. **API options** - `plugins` field in `prettier.format()` options
4. **Auto-discovery** - Scans `node_modules` for packages matching `prettier-plugin-*` or `@prettier/plugin-*`

**Plugin Loading**:
```javascript
// Resolution via Node's import()/require()
// Supports: module names, relative paths, absolute paths
plugins: [
  "prettier-plugin-tailwindcss",           // npm package
  "./my-local-plugin.js",                   // relative path
  require("./custom-plugin")                // direct require
]
```

**Validation**:
- Checks plugin exports required API shape (`languages`, `parsers`, `printers`)
- Merges plugin exports with core Prettier support
- Conflicts handled by override precedence (plugin vs core)

**Error Handling**:
- Clear error messages when plugins not found
- Continues with available plugins if some fail to load
- Caches filesystem lookups for performance

**Limitations**:
- Auto-discovery issues with pnpm/Yarn PnP (symlink structures)
- Global plugin installation unreliable
- `pluginSearchDirs` deprecated in favor of explicit configuration

**Key Pattern**: **Explicit > Auto-discovery** - Prettier moved away from auto-discovery due to reliability issues with different package managers.

---

### 2. ESLint Plugin System

**Architecture**: Plugins are npm packages exporting `rules`, `configs`, `processors`, and `meta`.

**Discovery Mechanisms**:
1. **Legacy `.eslintrc.*`** - `plugins: ["pluginName"]` (short name, prefix auto-added)
2. **Flat config (`eslint.config.js`)** - Direct imports, plugin objects in `plugins` mapping
3. **CLI** - No direct plugin flag, uses config file

**Plugin Resolution**:
```javascript
// Legacy format - short names
{
  "plugins": ["@typescript-eslint"],  // resolves to @typescript-eslint/eslint-plugin
  "extends": ["plugin:@typescript-eslint/recommended"]
}

// Flat config - explicit imports
import tseslint from '@typescript-eslint/eslint-plugin';
export default [{
  plugins: { '@typescript-eslint': tseslint }
}];
```

**Resolution Path Changes**:
- **Pre-v7**: Resolved relative to current working directory
- **v7+**: Resolved relative to config file directory
- **`--resolve-plugins-relative-to`** flag for monorepo support

**Error Handling**:
```
ESLint couldn't find the plugin "${pluginName}".
(The package "${pluginName}" was not found...)
```

**Key Pattern**: **Config-relative resolution** - Plugins resolved from config file location, not CWD.

---

### 3. lint-staged Configuration Loading

**Architecture**: Not a plugin system per se, but demonstrates excellent config discovery patterns.

**Configuration Sources** (in order of precedence):
1. CLI `--config` flag (explicit path)
2. `lint-staged` object in `package.json`
3. `.lintstagedrc` (JSON/YAML)
4. `.lintstagedrc.js`, `.lintstagedrc.cjs`, `.lintstagedrc.mjs`
5. `lint-staged.config.js`

**Monorepo Support**:
- Searches upward from each staged file's directory
- Uses "closest" config file found
- Different packages can have different configs

**Key Pattern**: **Cosmiconfig-style discovery** - Multiple config formats, hierarchical search.

---

### 4. oclif Plugin System (Powers Salesforce CLI, Heroku CLI)

**Architecture**: Most sophisticated plugin system, designed for extensible CLIs.

**Plugin Types**:
1. **Core plugins** - Essential, declared in `package.json` under `oclif.plugins`
2. **User plugins** - Installed by users to extend CLI
3. **Dev plugins** - Only loaded in development (`oclif.devPlugins`)

**Discovery Strategies**:
| Strategy | Description | Use Case |
|----------|-------------|----------|
| `pattern` (default) | Scans filesystem globs for command files | Standard file layout |
| `explicit` | Commands exported from specific file | Bundling, dynamic commands |
| `single` | CLI has exactly one command | Simple wrapper tools |

**Plugin Loading Order**:
1. User plugins (highest priority)
2. Dev plugins (development only)
3. Core plugins (lowest priority)

**Manifest System**:
```json
// oclif.manifest.json - caches command metadata
{
  "commands": {
    "deploy": {
      "description": "Deploy the app",
      "flags": {...}
    }
  }
}
```
- Generated via `oclif manifest`
- Dramatically improves startup time
- Avoids requiring every command module on startup

**Hooks/Lifecycle**:
```javascript
// Defined in package.json
{
  "oclif": {
    "hooks": {
      "init": "./dist/hooks/init",
      "prerun": "./dist/hooks/prerun",
      "postrun": "./dist/hooks/postrun"
    }
  }
}
```

**Key Pattern**: **Manifest caching + lifecycle hooks** - Performance optimization through pre-computed metadata.

---

### 5. OpenAI Codex CLI Provider System

**Architecture**: Model provider abstraction with configuration-based discovery.

**Provider Configuration** (`~/.codex/config.toml`):
```toml
[model_providers.custom]
base_url = "https://my-endpoint.com/v1"
wire_api = "responses"  # or "chat_completions"
api_key_env = "MY_API_KEY"

[model_providers.custom.headers]
X-Custom-Header = "value"
```

**Provider Info Structure**:
```typescript
interface ModelProviderInfo {
  base_url: string;           // API endpoint
  wire_api: "responses" | "chat_completions";
  api_key?: string;           // Direct key or...
  api_key_env?: string;       // Environment variable name
  headers?: Record<string, string>;
  // Network tuning
  timeout_ms?: number;
  retry_config?: RetryConfig;
}
```

**Built-in Providers**:
- `openai` - OpenAI API (default)
- `oss` - Local inference servers (Ollama, etc.)
- `azure` - Azure OpenAI

**Key Pattern**: **Wire protocol abstraction** - Same CLI works with different API formats.

---

### 6. Vercel AI SDK Provider Pattern

**Architecture**: Factory functions create configured provider instances.

**Provider Factory Pattern**:
```typescript
import { createAnthropic } from '@ai-sdk/anthropic';
import { createOpenAI } from '@ai-sdk/openai';

// Custom Anthropic-compatible endpoint
const anthropic = createAnthropic({
  baseURL: 'https://my-proxy.com/v1',
  apiKey: process.env.MY_API_KEY,
  headers: { 'X-Custom': 'value' }
});

// Custom OpenAI-compatible endpoint
const openai = createOpenAI({
  baseURL: 'https://local-llm:8080/v1',
  apiKey: 'not-needed-for-local'
});

// Use with AI SDK
const model = anthropic('claude-sonnet-4-20250514');
await generateText({ model, prompt: '...' });
```

**Provider Settings Interface**:
```typescript
interface ProviderSettings {
  baseURL?: string;           // Custom endpoint
  apiKey?: string;            // Override env var
  headers?: Record<string, string>;
  fetch?: FetchFunction;      // Custom fetch for testing/middleware
  name?: string;              // Custom provider name for logging
}
```

**Key Pattern**: **Factory function with settings object** - Clean API for configuration.

---

## Common Patterns Across Tools

### 1. Discovery Mechanisms

| Mechanism | Tools Using It | Pros | Cons |
|-----------|---------------|------|------|
| **Naming convention** | Prettier, ESLint | Zero config for standard plugins | Package manager issues |
| **Explicit config** | All tools | Reliable, explicit | More verbose |
| **CLI flags** | Prettier, oclif | Runtime flexibility | Repetitive for common setups |
| **Environment variables** | Codex CLI, AI SDK | Secure for secrets | Limited for complex config |
| **Config files** | All tools | Shareable, version-controlled | Another file to maintain |

### 2. Configuration Precedence (Most Common)

```
CLI flags > Environment variables > Config file > Defaults
```

### 3. Error Handling Patterns

**Good Error Messages Include**:
1. What was expected (plugin name, format)
2. Where it was searched (paths, node_modules)
3. How to fix (install command, config example)

**Example (ESLint)**:
```
ESLint couldn't find the plugin "eslint-plugin-react".

To fix this:
  npm install --save-dev eslint-plugin-react

Or if using yarn:
  yarn add --dev eslint-plugin-react
```

### 4. Validation Approaches

| Approach | Description | When to Use |
|----------|-------------|-------------|
| **Schema validation** | Check plugin exports required shape | Plugin APIs |
| **Format hints** | Warn about unusual formats, don't block | API keys |
| **Defer to endpoint** | Let API reject invalid config | Flexible compatibility |
| **Version constraints** | Check semver compatibility | Breaking changes |

### 5. Performance Optimizations

1. **Manifest caching** (oclif) - Pre-compute metadata
2. **Lazy loading** - Only load plugins when needed
3. **Config caching** (Prettier) - Cache filesystem lookups
4. **Factory memoization** - Reuse provider instances

---

## Recommended Pattern for deepagentsdk CLI

Based on this research, here's the recommended approach for extending deepagentsdk:

### Configuration Hierarchy

```
CLI flags > Environment variables > Config file > Defaults
```

### 1. Environment Variables (Secrets & Simple Config)

```bash
# Standard keys
ANTHROPIC_API_KEY=sk-ant-...
OPENAI_API_KEY=sk-...

# Custom endpoints
ANTHROPIC_BASE_URL=https://my-proxy.com/v1
OPENAI_BASE_URL=https://local-llm:8080/v1

# Additional providers (future)
DEEPAGENT_PROVIDER_GROQ_API_KEY=gsk_...
DEEPAGENT_PROVIDER_GROQ_BASE_URL=https://api.groq.com/openai/v1
```

### 2. CLI Flags (Runtime Overrides)

```bash
# Current
deep-agent --model anthropic/claude-sonnet-4-20250514

# Proposed additions
deep-agent --model anthropic/claude-sonnet-4-20250514 \
  --anthropic-base-url https://my-proxy.com/v1 \
  --anthropic-api-key $MY_KEY

# Or with provider prefix
deep-agent --model custom/my-model \
  --provider custom \
  --base-url https://my-endpoint.com/v1 \
  --api-key $MY_KEY
```

### 3. Config File (Complex Setups)

**Option A: JSON (`.deepagentrc`)**
```json
{
  "providers": {
    "anthropic": {
      "baseURL": "https://my-proxy.com/v1"
    },
    "openai": {
      "baseURL": "https://local-llm:8080/v1"
    },
    "groq": {
      "type": "openai-compatible",
      "baseURL": "https://api.groq.com/openai/v1",
      "apiKeyEnv": "GROQ_API_KEY",
      "models": ["llama-3.3-70b-versatile", "mixtral-8x7b-32768"]
    }
  },
  "defaultProvider": "anthropic",
  "defaultModel": "claude-sonnet-4-20250514"
}
```

**Option B: JavaScript (`deepagent.config.js`)**
```javascript
import { createOpenAI } from '@ai-sdk/openai';

export default {
  providers: {
    // Use factory function for full control
    groq: createOpenAI({
      baseURL: 'https://api.groq.com/openai/v1',
      apiKey: process.env.GROQ_API_KEY,
    }),
    // Or use declarative config
    local: {
      type: 'openai-compatible',
      baseURL: 'http://localhost:11434/v1',
    }
  }
};
```

### 4. Provider Resolution Flow

```
┌─────────────────────────────────────────────────────────────────┐
│ User Input: --model groq/llama-3.3-70b-versatile                │
└────────────────────────┬────────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────────┐
│ 1. Parse model string: provider="groq", model="llama-3.3-70b"   │
└────────────────────────┬────────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────────┐
│ 2. Check CLI flags for provider config                          │
│    --groq-base-url, --groq-api-key                              │
└────────────────────────┬────────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────────┐
│ 3. Check environment variables                                   │
│    GROQ_BASE_URL, GROQ_API_KEY                                  │
└────────────────────────┬────────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────────┐
│ 4. Check config file (.deepagentrc, deepagent.config.js)        │
│    providers.groq.baseURL, providers.groq.apiKey                │
└────────────────────────┬────────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────────┐
│ 5. Create provider instance                                      │
│    - Built-in (anthropic, openai): Use @ai-sdk/* factory        │
│    - Custom: Use createOpenAI with baseURL (OpenAI-compatible)  │
│    - Or createAnthropic with baseURL (Anthropic-compatible)     │
└────────────────────────┬────────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────────┐
│ 6. Return LanguageModel instance for use with DeepAgent         │
└─────────────────────────────────────────────────────────────────┘
```

### 5. Error Handling

```typescript
// When provider not found
throw new Error(`
Provider "groq" not configured.

To use this provider, either:

1. Set environment variables:
   GROQ_API_KEY=your-api-key
   GROQ_BASE_URL=https://api.groq.com/openai/v1

2. Add to .deepagentrc:
   {
     "providers": {
       "groq": {
         "type": "openai-compatible",
         "baseURL": "https://api.groq.com/openai/v1"
       }
     }
   }

3. Use CLI flags:
   --groq-base-url https://api.groq.com/openai/v1 --groq-api-key $KEY
`);
```

### 6. Implementation Phases

**Phase 1: Environment Variables + CLI Flags** (Minimal)
- Add `ANTHROPIC_BASE_URL`, `OPENAI_BASE_URL` support
- Add `--anthropic-base-url`, `--openai-base-url` flags
- Modify `parseModelString()` to accept config

**Phase 2: Generic Provider Support** (Medium)
- Add `--provider`, `--base-url`, `--api-key` generic flags
- Support `provider/model` format for any provider
- Auto-detect OpenAI-compatible vs Anthropic-compatible

**Phase 3: Config File Support** (Full)
- Add `.deepagentrc` JSON config support
- Add `deepagent.config.js` for programmatic config
- Support provider factory functions in config

---

## Example Configuration Formats

### Minimal (.env)
```bash
ANTHROPIC_API_KEY=sk-ant-...
ANTHROPIC_BASE_URL=https://my-proxy.com/v1
```

### Simple JSON (.deepagentrc)
```json
{
  "providers": {
    "anthropic": {
      "baseURL": "https://my-proxy.com/v1"
    }
  }
}
```

### Full JSON (.deepagentrc)
```json
{
  "$schema": "https://deepagentsdk.dev/schema/config.json",
  "providers": {
    "anthropic": {
      "baseURL": "https://api.anthropic.com/v1",
      "headers": {
        "X-Custom-Header": "value"
      }
    },
    "openai": {
      "baseURL": "https://api.openai.com/v1"
    },
    "groq": {
      "type": "openai-compatible",
      "baseURL": "https://api.groq.com/openai/v1",
      "apiKeyEnv": "GROQ_API_KEY"
    },
    "ollama": {
      "type": "openai-compatible",
      "baseURL": "http://localhost:11434/v1",
      "apiKey": "ollama"
    }
  },
  "defaultProvider": "anthropic",
  "defaultModel": "claude-sonnet-4-20250514"
}
```

### JavaScript (deepagent.config.js)
```javascript
import { createAnthropic } from '@ai-sdk/anthropic';
import { createOpenAI } from '@ai-sdk/openai';

export default {
  providers: {
    // Direct factory usage
    anthropic: createAnthropic({
      baseURL: process.env.ANTHROPIC_BASE_URL,
    }),
    
    // Declarative config (resolved at runtime)
    groq: {
      type: 'openai-compatible',
      baseURL: 'https://api.groq.com/openai/v1',
      apiKey: process.env.GROQ_API_KEY,
    },
    
    // Dynamic provider based on environment
    ...(process.env.USE_LOCAL && {
      local: createOpenAI({
        baseURL: 'http://localhost:11434/v1',
        apiKey: 'ollama',
      }),
    }),
  },
};
```

---

## Conclusion

The research reveals that modern CLI tools have converged on similar patterns:

1. **Explicit configuration over auto-discovery** - More reliable across package managers
2. **Layered configuration** - CLI > env vars > config file > defaults
3. **Factory pattern** - Clean API for creating configured instances
4. **Helpful error messages** - Guide users to fix issues
5. **Performance optimization** - Caching, lazy loading, manifests

For deepagentsdk, the AI SDK already provides the foundation (factory functions with settings). The CLI just needs to:
1. Accept configuration through multiple channels
2. Resolve configuration with proper precedence
3. Create configured provider instances
4. Provide helpful errors when configuration is missing

The recommended phased approach allows incremental implementation while maintaining backward compatibility.
