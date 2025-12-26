---
title: Provider Options Passthrough Implementation Research
date: 2025-12-21 17:30:00 AEDT
researcher: Claude (Sonnet 4.5)
git_commit: 3299adb7a6f9df9dc63a32ef4686252fcd22e1c8
branch: main
repository: ai-sdk-deep-agent
topic: "Provider Options Passthrough Implementation Research"
tags: [research, provider-options, ai-sdk, anthropic, openai, passthrough]
status: complete
last_updated: 2025-12-21
last_updated_by: Claude (Sonnet 4.5)
---

## Research Question

How to implement provider-specific options passthrough in ai-sdk-deep-agent to enable Anthropic thinking mode, OpenAI reasoning effort, and other provider features. Investigation areas:

1. How AI SDK v6 LanguageModel instances accept provider options
2. Current implementation of generationOptions and loopControl passthrough in our codebase
3. Where to add providerOptions parameter in CreateDeepAgentParams interface
4. How to thread provider options through to ToolLoopAgent creation
5. Example provider-specific options from AI SDK documentation for Anthropic, OpenAI, and other providers

## Summary

AI SDK v6 implements provider-specific options through a **pass-through architecture** where options are accepted as `Record<string, JSONObject>` at the SDK level and routed to the appropriate provider. The codebase already has infrastructure for passing provider options via `advancedOptions.providerOptions`, which uses `Object.assign()` to merge options into ToolLoopAgent settings.

**Key Finding**: The `providerOptions` parameter is **already implemented** in ai-sdk-deep-agent through `AdvancedAgentOptions.providerOptions` (src/types.ts:266-276). However, PROJECT-STATE.md lists "Provider Options Passthrough" as unimplemented, suggesting either:

- The existing implementation needs better documentation/exposure
- Additional work is needed beyond the current `advancedOptions` approach
- The feature request is for a more direct/ergonomic API

## Detailed Findings

### 1. AI SDK v6 Provider Options Architecture

**Core Type Definition** ([@ai-sdk/provider/dist/index.d.ts:60](file:///Users/chris_pang/Developer/repositories/ai-sdk-deep-agent/node_modules/@ai-sdk/provider/dist/index.d.ts#L60)):

```typescript
/**
 * Additional provider-specific options.
 * They are passed through to the provider from the AI SDK.
 */
type SharedV3ProviderOptions = Record<string, JSONObject>;
```

**Integration with ToolLoopAgent** ([ai/dist/index.d.ts](file:///Users/chris_pang/Developer/repositories/ai-sdk-deep-agent/node_modules/ai/dist/index.d.ts)):

```typescript
type ToolLoopAgentSettings<...> = {
  model: LanguageModel;
  tools?: TOOLS;
  providerOptions?: ProviderOptions;  // ← Pass-through field
  // ... other options
};
```

**Key Insight**: Provider options use a **namespace pattern** where each provider has its own key:

```typescript
providerOptions: {
  anthropic: { cacheControl: { type: 'ephemeral' }, thinking: { type: 'enabled' } },
  openai: { reasoningEffort: 'high', textVerbosity: 'medium' }
}
```

---

### 2. Current Implementation in ai-sdk-deep-agent

#### Type Definitions

**AdvancedAgentOptions Interface** ([src/types.ts:255-307](file:///Users/chris_pang/Developer/repositories/ai-sdk-deep-agent/src/types.ts#L255-L307)):

```typescript
export interface AdvancedAgentOptions {
  /**
   * OpenTelemetry configuration for observability.
   */
  experimental_telemetry?: ToolLoopAgentSettings['experimental_telemetry'];

  /**
   * Provider-specific options passed through to the model provider.
   *
   * @example Anthropic prompt caching
   * ```typescript
   * providerOptions: {
   *   anthropic: { cacheControl: { type: 'ephemeral' } }
   * }
   * ```
   */
  providerOptions?: ToolLoopAgentSettings['providerOptions'];

  /**
   * Experimental context for advanced use cases.
   */
  experimental_context?: ToolLoopAgentSettings['experimental_context'];

  /**
   * Tool choice configuration (which tool to use).
   */
  toolChoice?: DeepAgentToolChoice;

  /**
   * Active tools to include (tool names array).
   */
  activeTools?: ToolLoopAgentSettings['activeTools'];
}
```

**CreateDeepAgentParams Interface** ([src/types.ts:882-894](file:///Users/chris_pang/Developer/repositories/ai-sdk-deep-agent/src/types.ts#L882-L894)):

```typescript
export interface CreateDeepAgentParams {
  // ... other params

  loopControl?: LoopControlOptions;      // Lines 882
  generationOptions?: GenerationOptions;  // Lines 888
  advancedOptions?: AdvancedAgentOptions; // Lines 894 ← Contains providerOptions
}
```

#### Implementation Flow

**Constructor Storage** ([src/agent.ts:111-165](file:///Users/chris_pang/Developer/repositories/ai-sdk-deep-agent/src/agent.ts#L111-L165)):

```typescript
// Private field declarations
private loopControl?: CreateDeepAgentParams["loopControl"];
private generationOptions?: CreateDeepAgentParams["generationOptions"];
private advancedOptions?: CreateDeepAgentParams["advancedOptions"];

constructor(params: CreateDeepAgentParams) {
  const {
    loopControl,
    generationOptions,
    advancedOptions,
  } = params;

  // Store AI SDK passthrough options
  this.loopControl = loopControl;
  this.generationOptions = generationOptions;
  this.advancedOptions = advancedOptions;
}
```

**Settings Composition** ([src/agent.ts:300-336](file:///Users/chris_pang/Developer/repositories/ai-sdk-deep-agent/src/agent.ts#L300-L336)):

```typescript
private buildAgentSettings(onEvent?: EventCallback) {
  const settings: any = {
    model: this.model,
    instructions: this.systemPrompt,
    tools: undefined,
  };

  // Add generation options if provided
  if (this.generationOptions) {
    Object.assign(settings, this.generationOptions);
  }

  // Add advanced options if provided (includes providerOptions)
  if (this.advancedOptions) {
    Object.assign(settings, this.advancedOptions);
  }

  // Add composed loop control callbacks
  if (this.loopControl) {
    if (this.loopControl.prepareStep) {
      settings.prepareStep = this.composePrepareStep(this.loopControl.prepareStep);
    }
    // ... other callbacks
  }

  return settings;
}
```

**ToolLoopAgent Creation** ([src/agent.ts:344-354](file:///Users/chris_pang/Developer/repositories/ai-sdk-deep-agent/src/agent.ts#L344-L354)):

```typescript
private createAgent(state: DeepAgentState, maxSteps?: number, onEvent?: EventCallback) {
  const tools = this.createTools(state, onEvent);
  const settings = this.buildAgentSettings(onEvent);
  const stopConditions = this.buildStopConditions(maxSteps);

  return new ToolLoopAgent({
    ...settings,      // Contains providerOptions via advancedOptions
    tools,
    stopWhen: stopConditions,
  });
}
```

---

### 3. Anthropic Provider-Specific Options

**Source**: [@ai-sdk/anthropic v3.0.0-beta.83](file:///Users/chris_pang/Developer/repositories/ai-sdk-deep-agent/node_modules/@ai-sdk/anthropic/dist/index.d.ts)

**Available Options**:

| Option | Type | Description | Use Case |
|--------|------|-------------|----------|
| `thinking` | `{ type: "enabled"\|"disabled", budgetTokens?: number }` | Extended thinking mode | Deep reasoning tasks |
| `effort` | `"low"\|"medium"\|"high"` | Reasoning effort level | Control computation cost |
| `cacheControl` | `{ type: "ephemeral", ttl?: "5m"\|"1h" }` | Prompt caching | Cost reduction |
| `sendReasoning` | `boolean` | Send reasoning content back | Debugging/analysis |
| `structuredOutputMode` | `"outputFormat"\|"jsonTool"\|"auto"` | Structured output method | JSON generation |
| `disableParallelToolUse` | `boolean` | Disable parallel tools | Sequential execution |
| `toolStreaming` | `boolean` | Stream tool results | Real-time updates |
| `contextManagement` | `{ edits: [...] }` | Context optimization | Window management |
| `mcpServers` | `Array<{ type, name, url, ... }>` | MCP server config | Tool integration |
| `container` | `{ id?, skills? }` | Code execution | Sandbox environments |

**Example Usage**:

```typescript
const agent = createDeepAgent({
  model: anthropic("claude-sonnet-4-5-20250929"),
  advancedOptions: {
    providerOptions: {
      anthropic: {
        thinking: { type: "enabled", budgetTokens: 10000 },
        effort: "high",
        cacheControl: { type: "ephemeral", ttl: "1h" }
      }
    }
  }
});
```

**Documentation Links**:

- Anthropic API: <https://docs.anthropic.com/en/api/messages>
- Extended Thinking: <https://docs.anthropic.com/en/docs/build-with-claude/extended-thinking>
- Prompt Caching: <https://docs.anthropic.com/en/docs/build-with-claude/prompt-caching>

---

### 4. OpenAI Provider-Specific Options

**Source**: [@ai-sdk/openai v3.0.0-beta.96](file:///Users/chris_pang/Developer/repositories/ai-sdk-deep-agent/node_modules/@ai-sdk/openai/dist/index.d.ts)

**Available Options**:

| Option | Type | Description | Use Case |
|--------|------|-------------|----------|
| `reasoningEffort` | `"none"\|"minimal"\|"low"\|"medium"\|"high"\|"xhigh"` | O1/O3 reasoning depth | Control reasoning cost |
| `textVerbosity` | `"low"\|"medium"\|"high"` | Response verbosity | Output length control |
| `promptCacheKey` | `string` | Cache key | Cost reduction |
| `promptCacheRetention` | `"in_memory"\|"24h"` | Cache duration | Cache management |
| `serviceTier` | `"default"\|"auto"\|"flex"\|"priority"` | Request priority | Rate limit control |
| `logitBias` | `Record<number, number>` | Token probability bias | Output control |
| `logprobs` | `number\|boolean` | Log probabilities | Debugging/analysis |
| `parallelToolCalls` | `boolean` | Parallel tool execution | Performance |
| `maxCompletionTokens` | `number` | Max output tokens | Length control |
| `strictJsonSchema` | `boolean` | Strict JSON validation | Schema enforcement |
| `store` | `boolean` | Store conversation | Training data |
| `metadata` | `Record<string, string>` | Request metadata | Tracking |
| `user` | `string` | User identifier | Abuse monitoring |
| `safetyIdentifier` | `string` | Safety categorization | Moderation |

**Example Usage**:

```typescript
const agent = createDeepAgent({
  model: openai("o1-mini"),
  advancedOptions: {
    providerOptions: {
      openai: {
        reasoningEffort: "high",
        textVerbosity: "low",
        promptCacheKey: "my-system-prompt-v1",
        promptCacheRetention: "24h"
      }
    }
  }
});
```

**Documentation Links**:

- OpenAI API: <https://platform.openai.com/docs/api-reference/chat>
- O1 Reasoning: <https://platform.openai.com/docs/guides/reasoning>
- Prompt Caching: <https://platform.openai.com/docs/guides/prompt-caching>

---

### 5. Existing Passthrough Pattern

ai-sdk-deep-agent already implements a clean passthrough pattern for three option categories:

#### Pattern Comparison

| Option Category | Storage Field | Merge Strategy | Composition |
|----------------|---------------|----------------|-------------|
| `generationOptions` | `this.generationOptions` | `Object.assign()` (flat merge) | **None** - direct passthrough |
| `advancedOptions` | `this.advancedOptions` | `Object.assign()` (flat merge) | **None** - direct passthrough |
| `loopControl` | `this.loopControl` | Selective extraction | **Wrapped** - callbacks composed |

**Key Observations**:

1. **Generation Options** (temperature, topP, etc.) - Direct passthrough via Object.assign
2. **Advanced Options** (includes `providerOptions`) - Direct passthrough via Object.assign
3. **Loop Control** - Callbacks are **composed** to preserve DeepAgent's internal logic

**Code Reference** ([src/agent.ts:300-336](file:///Users/chris_pang/Developer/repositories/ai-sdk-deep-agent/src/agent.ts#L300-L336)):

```typescript
private buildAgentSettings(onEvent?: EventCallback) {
  const settings: any = {
    model: this.model,
    instructions: this.systemPrompt,
    tools: undefined,
  };

  // PASSTHROUGH PATTERN 1: Flat merge for generation options
  if (this.generationOptions) {
    Object.assign(settings, this.generationOptions);
  }

  // PASSTHROUGH PATTERN 2: Flat merge for advanced options (includes providerOptions)
  if (this.advancedOptions) {
    Object.assign(settings, this.advancedOptions);
  }

  // COMPOSITION PATTERN: Wrap callbacks to preserve internal logic
  if (this.loopControl) {
    if (this.loopControl.prepareStep) {
      settings.prepareStep = this.composePrepareStep(this.loopControl.prepareStep);
    }
    if (this.loopControl.onStepFinish) {
      settings.onStepFinish = this.composeOnStepFinish(this.loopControl.onStepFinish);
    }
    if (this.loopControl.onFinish) {
      settings.onFinish = this.composeOnFinish(this.loopControl.onFinish);
    }
  }

  return settings;
}
```

---

### 6. Subagent Passthrough

Subagents inherit parent's provider options with override capability:

**Subagent Options Merging** ([src/tools/subagent.ts:312-321](file:///Users/chris_pang/Developer/repositories/ai-sdk-deep-agent/src/tools/subagent.ts#L312-L321)):

```typescript
// Merge options: subagent-specific options override parent options
const mergedGenerationOptions = {
  ...parentGenerationOptions,
  ...subagentSpec?.generationOptions,
};

const mergedAdvancedOptions = {
  ...parentAdvancedOptions,
  ...subagentSpec?.advancedOptions,  // Includes providerOptions
};
```

**Subagent Settings Application** ([src/tools/subagent.ts:371-380](file:///Users/chris_pang/Developer/repositories/ai-sdk-deep-agent/src/tools/subagent.ts#L371-L380)):

```typescript
// Add merged generation options
if (Object.keys(mergedGenerationOptions).length > 0) {
  Object.assign(subagentSettings, mergedGenerationOptions);
}

// Add merged advanced options (excluding toolChoice and activeTools)
if (mergedAdvancedOptions) {
  const { toolChoice, activeTools, ...safeAdvancedOptions } = mergedAdvancedOptions;
  Object.assign(subagentSettings, safeAdvancedOptions);
}
```

**Key Behavior**:

- Subagents **inherit** parent's `providerOptions` by default
- Subagent-specific `providerOptions` **override** parent's options (shallow merge)
- `toolChoice` and `activeTools` are **excluded** from subagent options (parent can't control child tools)

---

### 7. Message-Level Provider Options

Provider options can also be set on **individual messages**:

**Type Definition** ([@ai-sdk/provider/dist/index.d.ts:970-976](file:///Users/chris_pang/Developer/repositories/ai-sdk-deep-agent/node_modules/@ai-sdk/provider/dist/index.d.ts#L970-L976)):

```typescript
type LanguageModelV3Message = ({
  role: 'system';
  content: string;
} | {
  role: 'user';
  // ...
} | {
  role: 'assistant';
  // ...
}) & {
  providerOptions?: SharedV3ProviderOptions;
};
```

**Usage in ai-sdk-deep-agent** ([src/agent.ts:764-768](file:///Users/chris_pang/Developer/repositories/ai-sdk-deep-agent/src/agent.ts#L764-L768)):

```typescript
{
  role: "system",
  content: this.systemPrompt,
  providerOptions: {
    anthropic: { cacheControl: { type: "ephemeral" } },
  },
} as ModelMessage
```

**Use Case**: Apply prompt caching to system message while using different options for the call.

---

### 8. Test Coverage

**Existing Test** ([test/passthrough/passthrough.test.ts:72-92](file:///Users/chris_pang/Developer/repositories/ai-sdk-deep-agent/test/passthrough/passthrough.test.ts#L72-L92)):

```typescript
test("should accept and store advanced options", () => {
  const advancedOptions: AdvancedAgentOptions = {
    experimental_telemetry: {
      isEnabled: true,
      functionId: "test-agent",
    },
    providerOptions: {
      anthropic: {
        cacheControl: { type: "ephemeral" },
      },
    },
  };

  const agent = createDeepAgent({
    model: mockModel as any,
    advancedOptions,
  });

  // Assertions verify options are stored
});
```

**Coverage Status**: Basic providerOptions passthrough is tested for storage, but not for actual ToolLoopAgent integration or runtime behavior.

---

## Code References

### Key Implementation Files

- [src/types.ts:255-307](file:///Users/chris_pang/Developer/repositories/ai-sdk-deep-agent/src/types.ts#L255-L307) - `AdvancedAgentOptions` interface definition
- [src/types.ts:882-894](file:///Users/chris_pang/Developer/repositories/ai-sdk-deep-agent/src/types.ts#L882-L894) - `CreateDeepAgentParams` interface
- [src/agent.ts:111-165](file:///Users/chris_pang/Developer/repositories/ai-sdk-deep-agent/src/agent.ts#L111-L165) - Constructor storage
- [src/agent.ts:300-336](file:///Users/chris_pang/Developer/repositories/ai-sdk-deep-agent/src/agent.ts#L300-L336) - Settings composition (`buildAgentSettings`)
- [src/agent.ts:344-354](file:///Users/chris_pang/Developer/repositories/ai-sdk-deep-agent/src/agent.ts#L344-L354) - ToolLoopAgent creation
- [src/tools/subagent.ts:312-380](file:///Users/chris_pang/Developer/repositories/ai-sdk-deep-agent/src/tools/subagent.ts#L312-L380) - Subagent option merging

### AI SDK Type Definitions

- [@ai-sdk/provider/dist/index.d.ts:60](file:///Users/chris_pang/Developer/repositories/ai-sdk-deep-agent/node_modules/@ai-sdk/provider/dist/index.d.ts#L60) - `SharedV3ProviderOptions` type
- [@ai-sdk/anthropic/dist/index.d.ts:98-166](file:///Users/chris_pang/Developer/repositories/ai-sdk-deep-agent/node_modules/@ai-sdk/anthropic/dist/index.d.ts#L98-L166) - Anthropic provider options schema
- [@ai-sdk/openai/dist/index.d.ts:7-24](file:///Users/chris_pang/Developer/repositories/ai-sdk-deep-agent/node_modules/@ai-sdk/openai/dist/index.d.ts#L7-L24) - OpenAI chat options schema

---

## Architecture Documentation

### Current Passthrough Architecture

```
User Input (CreateDeepAgentParams)
  ├─ generationOptions?: GenerationOptions
  ├─ loopControl?: LoopControlOptions
  └─ advancedOptions?: AdvancedAgentOptions
      └─ providerOptions?: Record<string, JSONObject>
              ↓
DeepAgent Constructor
  ├─ Store in private fields
  │  ├─ this.generationOptions
  │  ├─ this.loopControl
  │  └─ this.advancedOptions (contains providerOptions)
              ↓
buildAgentSettings()
  ├─ Object.assign(settings, generationOptions)
  ├─ Object.assign(settings, advancedOptions)  ← Includes providerOptions
  └─ Compose loopControl callbacks
              ↓
createAgent() → new ToolLoopAgent({
  ...settings,     ← Contains providerOptions from advancedOptions
  tools,
  stopWhen
})
              ↓
AI SDK ToolLoopAgent
  └─ Routes providerOptions to appropriate provider
      ├─ anthropic: { thinking, effort, cacheControl, ... }
      └─ openai: { reasoningEffort, textVerbosity, ... }
```

### Design Patterns

**1. Pass-Through Pattern**

- Accept options without validation
- Use `Object.assign()` for flat merging
- Let AI SDK handle provider-specific validation

**2. Composition Pattern** (for callbacks only)

- Wrap user callbacks to preserve DeepAgent's internal logic
- User code executes first, then DeepAgent's logic
- Error handling prevents breaking internal operations

**3. Inheritance with Override** (for subagents)

- Child inherits parent's options by default
- Child-specific options override parent (shallow merge)
- Safety filters prevent parent control over child tools

---

## Historical Context

### Related Research Documents

- [docs/tickets/008_tool_loop_agent_passthrough/research.md](file:///Users/chris_pang/Developer/repositories/ai-sdk-deep-agent/docs/tickets/008_tool_loop_agent_passthrough/research.md) - ToolLoopAgent passthrough implementation
- [docs/tickets/007_structured_output/research.md](file:///Users/chris_pang/Developer/repositories/ai-sdk-deep-agent/docs/tickets/007_structured_output/research.md) - Structured output implementation

### PROJECT-STATE.md Context

The PROJECT-STATE.md lists "Provider Options Passthrough" under "Critical - To Implement" (lines 61-65):

```markdown
- [ ] **Provider Options Passthrough** - Support AI SDK provider-specific options
  - **Why**: Enable provider-specific features (e.g., Anthropic's thinking mode, OpenAI's reasoning effort, etc.) without hardcoding in DeepAgent
  - **Impact**: Better flexibility for advanced users, maintains compatibility with AI SDK provider features
  - **Effort**: 1 day, add `providerOptions` parameter to `CreateDeepAgentParams` and pass through to ToolLoopAgent
  - **Note**: Should work alongside existing `generationOptions` and `loopControl` passthrough
```

**Discrepancy Analysis**:

The feature is marked as unimplemented, yet the codebase shows:

- ✅ `providerOptions` exists in `AdvancedAgentOptions.providerOptions`
- ✅ Passthrough to ToolLoopAgent via `Object.assign(settings, this.advancedOptions)`
- ✅ Test coverage for `providerOptions` storage
- ✅ Documentation in TypeScript comments with example

**Possible Interpretations**:

1. **Documentation Gap**: The feature exists but isn't well-documented or exposed
2. **API Design**: Current approach via `advancedOptions` may be considered too nested
3. **Missing Features**: Perhaps top-level `providerOptions` parameter is desired
4. **Incomplete Testing**: Runtime integration may not be fully tested

---

## Open Questions

1. **Should `providerOptions` be a top-level parameter in `CreateDeepAgentParams`?**
   - Current: `advancedOptions.providerOptions`
   - Proposed: `providerOptions` (sibling to `generationOptions` and `loopControl`)
   - Trade-off: Ergonomics vs. logical grouping

2. **Should provider options support per-subagent override syntax?**
   - Current: Subagents inherit parent options with shallow merge override
   - Possible enhancement: Deep merge or per-provider merge strategies

3. **Should there be validation/type-safety for provider-specific options?**
   - Current: No validation, relies on AI SDK
   - Possible: Import provider schemas and validate at DeepAgent level
   - Trade-off: Type safety vs. flexibility (new provider options work without DeepAgent updates)

4. **Should message-level provider options be exposed in DeepAgent API?**
   - Current: Only used internally for system message caching
   - Possible: Allow users to set provider options per-message in conversation history

5. **What does "Provider Options Passthrough" mean in PROJECT-STATE.md?**
   - Is it requesting a different API surface?
   - Is it about better documentation?
   - Is it about additional features beyond current implementation?

---

## Recommendations for Next Steps

1. **Clarify Feature Request**: Determine if PROJECT-STATE.md refers to:
   - Better documentation/examples for existing `advancedOptions.providerOptions`
   - A new top-level `providerOptions` parameter
   - Enhanced type safety or validation
   - Additional features not yet implemented

2. **Document Current Implementation**: If existing implementation is sufficient:
   - Add comprehensive documentation in docs/
   - Create examples/ file demonstrating provider options
   - Update PROJECT-STATE.md to mark as implemented

3. **Design API Enhancement**: If top-level parameter is desired:
   - Design top-level `providerOptions` parameter in `CreateDeepAgentParams`
   - Decide on merge behavior with `advancedOptions.providerOptions` (if both exist)
   - Update type definitions and implementation

4. **Enhance Type Safety**: Consider importing provider schemas:
   - Import Anthropic/OpenAI option types from AI SDK
   - Provide typed helper functions for common provider options
   - Maintain flexibility for new providers/options

5. **Expand Test Coverage**:
   - Test runtime integration with actual ToolLoopAgent calls
   - Test provider option routing to Anthropic/OpenAI providers
   - Test subagent inheritance and override behavior
   - Test message-level provider options

6. **Create Examples**:
   - Example using Anthropic thinking mode
   - Example using OpenAI reasoning effort
   - Example combining multiple provider options
   - Example with subagent override

---

## Related Resources

### Official Documentation

- **AI SDK v6**: <https://sdk.vercel.ai/docs/ai-sdk-core/provider-options>
- **Anthropic Extended Thinking**: <https://docs.anthropic.com/en/docs/build-with-claude/extended-thinking>
- **OpenAI O1 Reasoning**: <https://platform.openai.com/docs/guides/reasoning>

### Provider Packages

- **@ai-sdk/anthropic**: v3.0.0-beta.83
- **@ai-sdk/openai**: v3.0.0-beta.96
- **ai**: v6.0.0-beta.150

### Implementation Files

- **Type definitions**: src/types.ts
- **Main agent**: src/agent.ts
- **Subagent tool**: src/tools/subagent.ts
- **Tests**: test/passthrough/passthrough.test.ts

---

## Implementation Notes

### Pattern to Follow (Based on Existing Code)

If implementing as a top-level parameter, follow the existing pattern:

**1. Add to Types** (src/types.ts):

```typescript
export interface CreateDeepAgentParams {
  // ... existing params
  providerOptions?: ToolLoopAgentSettings['providerOptions'];
}
```

**2. Store in Constructor** (src/agent.ts):

```typescript
private providerOptions?: CreateDeepAgentParams["providerOptions"];

constructor(params: CreateDeepAgentParams) {
  const { providerOptions } = params;
  this.providerOptions = providerOptions;
}
```

**3. Merge in buildAgentSettings** (src/agent.ts):

```typescript
private buildAgentSettings(onEvent?: EventCallback) {
  // ... existing code

  if (this.providerOptions) {
    if (!settings.providerOptions) {
      settings.providerOptions = {};
    }
    // Deep merge provider options to preserve existing namespaces
    Object.keys(this.providerOptions).forEach(provider => {
      settings.providerOptions[provider] = {
        ...settings.providerOptions[provider],
        ...this.providerOptions[provider]
      };
    });
  }
}
```

**4. Handle Subagent Inheritance** (src/tools/subagent.ts):

```typescript
const mergedProviderOptions = {
  ...parentProviderOptions,
  ...subagentSpec?.providerOptions,
};
```

### Merge Strategy Considerations

**Shallow Merge** (current approach for generationOptions):

```typescript
Object.assign(settings, this.providerOptions);  // ❌ Would overwrite entire providerOptions
```

**Namespace Merge** (recommended for providerOptions):

```typescript
// ✅ Preserve existing namespaces, merge per-provider
Object.keys(providerOptions).forEach(provider => {
  settings.providerOptions[provider] = {
    ...settings.providerOptions[provider],
    ...providerOptions[provider]
  };
});
```

**Deep Merge** (overkill for current use case):

```typescript
settings.providerOptions = deepMerge(settings.providerOptions, providerOptions);
```
