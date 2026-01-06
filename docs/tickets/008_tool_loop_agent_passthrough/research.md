---
title: "ToolLoopAgent Constructor Passthrough: Complete Technical Specification"
date: 2025-12-20 17:10:00 AEDT
researcher: AI Assistant
git_commit: 3026f4b2935df92b7d71fadf9e1c0dafb2015a68
branch: main
repository: deepagentsdk
topic: "ToolLoopAgent Constructor Passthrough: Complete Technical Specification"
tags: [research, codebase, ai-sdk-v6, tool-loop-agent, passthrough, configuration, callbacks, types]
status: complete
last_updated: 2025-12-20
last_updated_by: AI Assistant
---

## Research Question

Design a complete passthrough mechanism for AI SDK v6's `ToolLoopAgent` constructor options in DeepAgent that:

1. Exposes advanced AI SDK features (telemetry, custom callbacks, retry logic) to DeepAgent users
2. Preserves DeepAgent's core functionality (checkpointing, events, state management)
3. Provides type-safe implementation with backwards compatibility
4. Includes concrete code examples and migration guidance

## Summary

DeepAgent currently wraps AI SDK v6's `ToolLoopAgent` but exposes only **5 of 22+ available constructor options**. This research provides a complete technical specification for implementing passthrough support, including:

- **Complete inventory** of all 22+ ToolLoopAgent parameters with types
- **Classification matrix** categorizing each option as Safe/Special Handling/Excluded
- **Type extraction strategy** using `ConstructorParameters<typeof ToolLoopAgent>[0]`
- **Callback merging patterns** for `onStepFinish`, `onFinish`, and `stopWhen`
- **Implementation design** with code examples

**Key finding**: DeepAgent should expose **14 parameters** for immediate passthrough, handle **3 parameters** with callback merging, and exclude **5 parameters** that are core to DeepAgent's functionality.

## Detailed Findings

### 1. Complete ToolLoopAgent Constructor Options Inventory

**Source**: `node_modules/ai/dist/index.d.ts:2808-2897`
**AI SDK Version**: `6.0.0-beta.150`

The `ToolLoopAgentSettings` type includes options inherited from `CallSettings` plus agent-specific options:

#### 1.1 Core Agent Parameters

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `model` | `LanguageModel` | **Yes** | N/A | Language model instance |
| `instructions` | `string \| SystemModelMessage \| SystemModelMessage[]` | No | undefined | System prompt |
| `tools` | `TOOLS` (ToolSet) | No | undefined | Tool definitions |
| `output` | `OUTPUT` (Output) | No | undefined | Structured output specification |
| `stopWhen` | `StopCondition \| StopCondition[]` | No | `stepCountIs(20)` | Termination conditions |
| `id` | `string` | No | undefined | Agent identifier |

#### 1.2 Advanced Agent Parameters

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `toolChoice` | `ToolChoice<TOOLS>` | No | 'auto' | Force specific tool usage |
| `activeTools` | `Array<keyof TOOLS>` | No | undefined | Limit available tools per call |
| `prepareStep` | `PrepareStepFunction<TOOLS>` | No | undefined | Per-step customization |
| `experimental_telemetry` | `TelemetrySettings` | No | undefined | OpenTelemetry integration |
| `experimental_context` | `unknown` | No | undefined | Context passed to tools |
| `experimental_repairToolCall` | `ToolCallRepairFunction<TOOLS>` | No | undefined | Repair malformed tool calls |
| `experimental_download` | `DownloadFunction` | No | undefined | Custom URL download function |
| `providerOptions` | `ProviderOptions` | No | undefined | Provider-specific options |

#### 1.3 Callback Parameters

| Parameter | Type | Description |
|-----------|------|-------------|
| `onStepFinish` | `(stepResult: StepResult<TOOLS>) => Promise<void> \| void` | Called after each step |
| `onFinish` | `(event: StepResult & { steps, totalUsage }) => Promise<void> \| void` | Called when all steps complete |

#### 1.4 CallSettings Inheritance (via `Omit<CallSettings, 'abortSignal'>`)

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `maxOutputTokens` | `number` | undefined | Max tokens to generate |
| `temperature` | `number` | undefined | Sampling temperature |
| `topP` | `number` | undefined | Nucleus sampling |
| `topK` | `number` | undefined | Top-K sampling |
| `presencePenalty` | `number` | undefined | Repeat penalty (presence) |
| `frequencyPenalty` | `number` | undefined | Repeat penalty (frequency) |
| `stopSequences` | `string[]` | undefined | Stop generation sequences |
| `seed` | `number` | undefined | Deterministic sampling |
| `maxRetries` | `number` | 2 | Retry count for failures |
| `headers` | `Record<string, string>` | undefined | Custom HTTP headers |

#### 1.5 Advanced Call Parameters

| Parameter | Type | Description |
|-----------|------|-------------|
| `callOptionsSchema` | `FlexibleSchema<CALL_OPTIONS>` | Schema for call-time options |
| `prepareCall` | `(options) => settings` | Prepare call parameters |

### 2. Current DeepAgent Implementation Analysis

#### 2.1 Instantiation Sites

**Site 1: Main Agent** ([src/agent.ts:266-273](https://github.com/chrispangg/deepagentsdk/blob/3026f4b2935df92b7d71fadf9e1c0dafb2015a68/src/agent.ts#L266-L273))

```typescript
private createAgent(state: DeepAgentState, maxSteps?: number, onEvent?: EventCallback) {
  const tools = this.createTools(state, onEvent);

  return new ToolLoopAgent({
    model: this.model,
    instructions: this.systemPrompt,
    tools,
    stopWhen: stepCountIs(maxSteps ?? this.maxSteps),
    ...(this.outputConfig ? { output: Output.object(this.outputConfig) } : {}),
  } as any);
}
```

**Site 2: Subagent** ([src/tools/subagent.ts:175-182](https://github.com/chrispangg/deepagentsdk/blob/3026f4b2935df92b7d71fadf9e1c0dafb2015a68/src/tools/subagent.ts#L175-L182))

```typescript
const subagentAgent = new ToolLoopAgent({
  model: subagentConfig.model,
  instructions: subagentConfig.systemPrompt,
  tools: allTools,
  stopWhen: stepCountIs(50), // Fixed 50-step limit
  ...(subagentConfig.output ? { output: Output.object(subagentConfig.output) } : {}),
} as any);
```

#### 2.2 Parameters Currently Exposed vs Blocked

| Parameter | Status | How Exposed |
|-----------|--------|-------------|
| `model` | Exposed | `CreateDeepAgentParams.model` + middleware wrapping |
| `instructions` | Built dynamically | `buildSystemPrompt()` from multiple components |
| `tools` | Built dynamically | `createTools()` merges built-in + user tools |
| `stopWhen` | Hardcoded | `stepCountIs(maxSteps)` only |
| `output` | Exposed | `CreateDeepAgentParams.output` |
| `maxRetries` | **Blocked** | Uses AI SDK default (2) |
| `temperature` | **Blocked** | Uses model default |
| `experimental_telemetry` | **Blocked** | No exposure |
| `onStepFinish` | Used internally | Checkpointing + events |
| `onFinish` | **Blocked** | Not used |
| `prepareStep` | **Blocked** | No exposure |
| All other options | **Blocked** | Not exposed |

#### 2.3 Type Workarounds

Both instantiation sites use `as any` cast due to TypeScript inference issues with conditional spread operator for `output` parameter.

### 3. Classification Matrix

Based on analysis of DeepAgent internals and AI SDK requirements:

#### 3.1 Safe for Immediate Passthrough (14 options)

These options have no conflicts with DeepAgent's internal logic:

| Option | Use Case | Priority |
|--------|----------|----------|
| `experimental_telemetry` | Production observability | High |
| `maxRetries` | Reliability for flaky APIs | High |
| `providerOptions` | Provider-specific features (caching, etc.) | High |
| `temperature` | Control output randomness | Medium |
| `topP` | Nucleus sampling | Medium |
| `topK` | Top-K sampling | Medium |
| `maxOutputTokens` | Limit response length | Medium |
| `presencePenalty` | Reduce repetition | Medium |
| `frequencyPenalty` | Reduce word reuse | Medium |
| `stopSequences` | Early termination | Medium |
| `seed` | Deterministic outputs | Medium |
| `headers` | Custom request headers | Low |
| `experimental_context` | Pass data to tools | Low |
| `experimental_download` | Custom file handling | Low |

#### 3.2 Requires Special Handling (3 options)

These options need merging/composition with DeepAgent internals:

| Option | Challenge | Solution |
|--------|-----------|----------|
| `onStepFinish` | DeepAgent uses for checkpointing + events | Chain user callback before internal logic |
| `onFinish` | May want internal final processing | Chain user callback before any future internal logic |
| `stopWhen` | DeepAgent uses `stepCountIs(maxSteps)` | Compose user conditions with max steps (OR logic) |

#### 3.3 Must Exclude from Passthrough (5 options)

These options are core to DeepAgent functionality:

| Option | Reason | Alternative |
|--------|--------|-------------|
| `model` | Managed with middleware support | Use `CreateDeepAgentParams.model` + `middleware` |
| `instructions` | Built via `buildSystemPrompt()` | Use `CreateDeepAgentParams.systemPrompt` |
| `tools` | Merged with built-in tools | Use `CreateDeepAgentParams.tools` |
| `output` | Already exposed | Use `CreateDeepAgentParams.output` |
| `id` | Could conflict with DeepAgent.agentId | Use `CreateDeepAgentParams.agentId` |

### 4. Type Extraction Strategy

#### 4.1 Problem

`ToolLoopAgentSettings` is not directly exported from the `ai` package.

#### 4.2 Solution: ConstructorParameters

```typescript
import { ToolLoopAgent, type ToolSet } from 'ai';

// Extract constructor parameter type
type ToolLoopAgentOptions<TOOLS extends ToolSet = {}> =
  ConstructorParameters<typeof ToolLoopAgent<never, TOOLS, never>>[0];

// Create passthrough type with exclusions
type AgentPassthroughOptions<TOOLS extends ToolSet = {}> = Partial<Omit<
  ToolLoopAgentOptions<TOOLS>,
  // Excluded: Core DeepAgent management
  | 'model'
  | 'instructions'
  | 'tools'
  | 'output'
  | 'id'
  // Excluded: Internal callback usage (will merge separately)
  | 'onStepFinish'
  | 'onFinish'
  | 'stopWhen'
>>;
```

#### 4.3 Enhanced Interface

```typescript
export interface CreateDeepAgentParams {
  // ... existing params ...

  /**
   * Advanced AI SDK ToolLoopAgent options passthrough.
   * Enables access to experimental features not yet wrapped by DeepAgent.
   *
   * @example
   * ```typescript
   * agentOptions: {
   *   experimental_telemetry: { isEnabled: true },
   *   maxRetries: 5,
   *   temperature: 0.7,
   *   providerOptions: { anthropic: { cacheControl: true } },
   * }
   * ```
   */
  agentOptions?: AgentPassthroughOptions;

  /**
   * Custom stop conditions (composed with maxSteps limit).
   * When array, agent stops if ANY condition is met (OR logic).
   *
   * @example
   * ```typescript
   * customStopConditions: [
   *   hasToolCall('final_answer'),
   *   ({ steps }) => steps.some(s => s.text.includes('[DONE]'))
   * ]
   * ```
   */
  customStopConditions?: StopCondition | StopCondition[];

  /**
   * Callback called after each step finishes.
   * Runs BEFORE DeepAgent's internal checkpointing logic.
   *
   * @example
   * ```typescript
   * onStepFinish: async (stepResult) => {
   *   console.log('Step completed:', stepResult.toolCalls);
   * }
   * ```
   */
  onStepFinish?: ToolLoopAgentOnStepFinishCallback;

  /**
   * Callback called when all steps are finished.
   * Receives aggregated information about the entire run.
   */
  onFinish?: ToolLoopAgentOnFinishCallback;
}
```

### 5. Callback Merging Patterns

#### 5.1 onStepFinish Merging

**Current internal usage** ([src/agent.ts:512-549](https://github.com/chrispangg/deepagentsdk/blob/3026f4b2935df92b7d71fadf9e1c0dafb2015a68/src/agent.ts#L512-L549)):

```typescript
onStepFinish: async ({ toolCalls, toolResults }) => {
  stepNumber++;
  const cumulativeStep = baseStep + stepNumber;

  // Emit step finish event
  eventQueue.push({
    type: "step-finish",
    stepNumber,
    toolCalls: toolCalls.map((tc, i) => ({
      toolName: tc.toolName,
      args: "input" in tc ? tc.input : undefined,
      result: toolResults[i] ? ("output" in toolResults[i] ? toolResults[i].output : undefined) : undefined,
    })),
  });

  // Save checkpoint if configured
  if (threadId && this.checkpointer) {
    const checkpoint: Checkpoint = { /* ... */ };
    await this.checkpointer.save(checkpoint);
    eventQueue.push({ type: "checkpoint-saved", threadId, step: cumulativeStep });
  }
}
```

**Proposed merged callback**:

```typescript
onStepFinish: async (stepResult) => {
  // 1. Run user callback first (wrapped in try-catch)
  if (this.userOnStepFinish) {
    try {
      await this.userOnStepFinish(stepResult);
    } catch (error) {
      console.error('[DeepAgent] User onStepFinish error:', error);
      // Continue with internal logic - don't break checkpointing
    }
  }

  // 2. DeepAgent internal logic (always runs)
  const { toolCalls, toolResults } = stepResult;
  stepNumber++;
  const cumulativeStep = baseStep + stepNumber;

  eventQueue.push({
    type: "step-finish",
    stepNumber,
    toolCalls: /* ... */,
  });

  if (threadId && this.checkpointer) {
    await this.checkpointer.save(/* ... */);
  }
}
```

#### 5.2 stopWhen Composition

**Current**: Only `stepCountIs(maxSteps)` is used.

**Proposed**: Compose user conditions with max steps limit:

```typescript
private buildStopConditions(maxSteps: number): StopCondition[] {
  const conditions: StopCondition[] = [];

  // Add user-provided conditions
  if (this.customStopConditions) {
    if (Array.isArray(this.customStopConditions)) {
      conditions.push(...this.customStopConditions);
    } else {
      conditions.push(this.customStopConditions);
    }
  }

  // Always include max steps as safety limit
  conditions.push(stepCountIs(maxSteps));

  return conditions;
}

// In createAgent:
stopWhen: this.buildStopConditions(maxSteps ?? this.maxSteps)
```

**Behavior**: Agent stops when ANY condition returns `true` (OR logic).

### 6. Implementation Design

#### 6.1 Updated CreateDeepAgentParams

```typescript
import { ToolLoopAgent, type ToolSet, type StopCondition } from 'ai';

// Type extraction
type ToolLoopAgentOptions<TOOLS extends ToolSet = {}> =
  ConstructorParameters<typeof ToolLoopAgent<never, TOOLS, never>>[0];

type ToolLoopAgentOnStepFinishCallback = ToolLoopAgentOptions['onStepFinish'];
type ToolLoopAgentOnFinishCallback = ToolLoopAgentOptions['onFinish'];

// Passthrough type (excludes managed options)
type AgentPassthroughOptions = Partial<Omit<
  ToolLoopAgentOptions,
  | 'model' | 'instructions' | 'tools' | 'output' | 'id'
  | 'onStepFinish' | 'onFinish' | 'stopWhen'
>>;

export interface CreateDeepAgentParams {
  // ... existing required params ...
  model: LanguageModel;

  // ... existing optional params ...
  systemPrompt?: string;
  tools?: Record<string, Tool>;
  maxSteps?: number;
  output?: z.ZodTypeAny;
  middleware?: LanguageModelMiddleware | LanguageModelMiddleware[];

  // NEW: Passthrough options
  agentOptions?: AgentPassthroughOptions;
  customStopConditions?: StopCondition | StopCondition[];
  onStepFinish?: ToolLoopAgentOnStepFinishCallback;
  onFinish?: ToolLoopAgentOnFinishCallback;
}
```

#### 6.2 Updated DeepAgent Constructor

```typescript
export class DeepAgent {
  // ... existing fields ...
  private passthroughOptions?: AgentPassthroughOptions;
  private customStopConditions?: StopCondition | StopCondition[];
  private userOnStepFinish?: ToolLoopAgentOnStepFinishCallback;
  private userOnFinish?: ToolLoopAgentOnFinishCallback;

  constructor(params: CreateDeepAgentParams) {
    // ... existing initialization ...

    // Store passthrough options
    this.passthroughOptions = params.agentOptions;
    this.customStopConditions = params.customStopConditions;
    this.userOnStepFinish = params.onStepFinish;
    this.userOnFinish = params.onFinish;
  }
}
```

#### 6.3 Updated createAgent Method

```typescript
private createAgent(state: DeepAgentState, maxSteps?: number, onEvent?: EventCallback) {
  const tools = this.createTools(state, onEvent);
  const effectiveMaxSteps = maxSteps ?? this.maxSteps;

  return new ToolLoopAgent({
    // Passthrough options first (can be overridden by managed options)
    ...this.passthroughOptions,

    // DeepAgent-managed options (take precedence)
    model: this.model,
    instructions: this.systemPrompt,
    tools,
    stopWhen: this.buildStopConditions(effectiveMaxSteps),
    ...(this.outputConfig ? { output: Output.object(this.outputConfig) } : {}),
  });
}
```

#### 6.4 Updated streamWithEvents Callback Handling

```typescript
private async *streamWithEvents(options: StreamWithEventsOptions) {
  // ... existing setup ...

  const streamOptions = {
    model: this.model,
    messages: inputMessages,
    tools,
    stopWhen: this.buildStopConditions(options.maxSteps ?? this.maxSteps),
    abortSignal: options.abortSignal,

    // Passthrough safe options
    ...this.passthroughOptions,

    // Merged onStepFinish callback
    onStepFinish: async (stepResult) => {
      // 1. User callback (protected)
      if (this.userOnStepFinish) {
        try {
          await this.userOnStepFinish(stepResult);
        } catch (error) {
          console.error('[DeepAgent] User onStepFinish callback error:', error);
        }
      }

      // 2. Internal logic (always runs)
      const { toolCalls, toolResults } = stepResult;
      stepNumber++;
      // ... rest of existing logic ...
    },

    // Merged onFinish callback
    onFinish: async (event) => {
      if (this.userOnFinish) {
        try {
          await this.userOnFinish(event);
        } catch (error) {
          console.error('[DeepAgent] User onFinish callback error:', error);
        }
      }
      // Add internal onFinish logic if needed in future
    },
  };

  // ... rest of method ...
}
```

### 7. Subagent Inheritance Strategy

#### 7.1 Current State

Subagents have **independent configuration** with no inheritance from parent:

- Fixed 50-step limit (not configurable)
- No passthrough options support
- Own model (falls back to parent's default)

#### 7.2 Recommended Strategy

| Option | Inherit? | Rationale |
|--------|----------|-----------|
| `experimental_telemetry` | Yes | Consistent observability across agent tree |
| `maxRetries` | Yes | Consistent reliability settings |
| `providerOptions` | Yes | Provider features should propagate |
| `temperature`, `topP`, etc. | No | Subagents may need different creativity levels |
| `onStepFinish`, `onFinish` | No | Parent owns event stream |
| `customStopConditions` | No | Subagents have fixed 50-step limit |

#### 7.3 Implementation

```typescript
// In createSubagentTool
const inheritedOptions: Partial<AgentPassthroughOptions> = {
  experimental_telemetry: parentPassthroughOptions?.experimental_telemetry,
  maxRetries: parentPassthroughOptions?.maxRetries,
  providerOptions: parentPassthroughOptions?.providerOptions,
};

const subagentAgent = new ToolLoopAgent({
  ...inheritedOptions,
  model: subagentConfig.model,
  instructions: subagentConfig.systemPrompt,
  tools: allTools,
  stopWhen: stepCountIs(50),
  ...(subagentConfig.output ? { output: Output.object(subagentConfig.output) } : {}),
});
```

### 8. Backwards Compatibility

#### 8.1 No Breaking Changes

All new parameters are optional with undefined defaults:

- Existing code continues to work unchanged
- `agentOptions`, `customStopConditions`, `onStepFinish`, `onFinish` all optional

#### 8.2 Migration Path

**Before** (current API):

```typescript
const agent = createDeepAgent({
  model: anthropic('claude-sonnet-4-20250514'),
  systemPrompt: 'You are helpful.',
  maxSteps: 100,
});
```

**After** (with passthrough):

```typescript
const agent = createDeepAgent({
  model: anthropic('claude-sonnet-4-20250514'),
  systemPrompt: 'You are helpful.',
  maxSteps: 100,

  // New: Advanced options
  agentOptions: {
    experimental_telemetry: { isEnabled: true },
    maxRetries: 5,
    temperature: 0.7,
  },
  customStopConditions: hasToolCall('done'),
  onStepFinish: (step) => console.log('Step:', step.toolCalls),
});
```

## Code References

### Core Implementation Files

- [`src/agent.ts:266-273`](https://github.com/chrispangg/deepagentsdk/blob/3026f4b2935df92b7d71fadf9e1c0dafb2015a68/src/agent.ts#L266-L273) - Main `createAgent` method
- [`src/agent.ts:198-255`](https://github.com/chrispangg/deepagentsdk/blob/3026f4b2935df92b7d71fadf9e1c0dafb2015a68/src/agent.ts#L198-L255) - `createTools` dynamic tool building
- [`src/agent.ts:512-549`](https://github.com/chrispangg/deepagentsdk/blob/3026f4b2935df92b7d71fadf9e1c0dafb2015a68/src/agent.ts#L512-L549) - Internal `onStepFinish` usage
- [`src/types.ts:317-567`](https://github.com/chrispangg/deepagentsdk/blob/3026f4b2935df92b7d71fadf9e1c0dafb2015a68/src/types.ts#L317-L567) - `CreateDeepAgentParams` interface

### Subagent Implementation

- [`src/tools/subagent.ts:175-182`](https://github.com/chrispangg/deepagentsdk/blob/3026f4b2935df92b7d71fadf9e1c0dafb2015a68/src/tools/subagent.ts#L175-L182) - Subagent ToolLoopAgent instantiation

### AI SDK Type Definitions

- `node_modules/ai/dist/index.d.ts:2808-2897` - `ToolLoopAgentSettings` type
- `node_modules/ai/dist/index.d.ts:2910-2931` - `ToolLoopAgent` class declaration
- `node_modules/ai/dist/index.d.ts:1174-1178` - `StopCondition` type
- `node_modules/ai/dist/index.d.ts:2803` - `ToolLoopAgentOnStepFinishCallback` type

## Architecture Documentation

### Current Wrapper Pattern

```
CreateDeepAgentParams
    ↓
DeepAgent.constructor (stores configuration)
    ↓
Configuration Flags (hasSubagents, hasSandboxBackend)
    ↓
System Prompt ← buildSystemPrompt()
    ↓
Tool Creation ← createTools()
    ↓
ToolLoopAgent ← createAgent()
```

### Proposed Enhanced Pattern

```
CreateDeepAgentParams (+ agentOptions, customStopConditions, callbacks)
    ↓
DeepAgent.constructor
    ├── Store passthrough options
    ├── Store user callbacks
    └── Store custom stop conditions
    ↓
createAgent() / streamWithEvents()
    ├── Spread passthrough options
    ├── Build stop conditions (user + maxSteps)
    ├── Merge callbacks (user + internal)
    └── Apply DeepAgent-managed options (override passthrough)
    ↓
ToolLoopAgent (fully configured)
```

## Historical Context

- `docs/tickets/004_middleware_architecture/plan.md` - Established middleware pattern for model-level extensions
- `docs/research/middleware-architecture-research.md` - Validated hybrid approach (middleware + tool-centric)
- `docs/PROJECT-STATE.md` - Tracks this feature as `[in_progress]`

## Open Questions

### Resolved

1. **Callback Merging**: ✅ Chain user callbacks before internal logic with try-catch protection
2. **Stop Condition Composition**: ✅ Use array with OR logic, always include maxSteps as safety
3. **Type Extraction**: ✅ Use `ConstructorParameters<typeof ToolLoopAgent>[0]`
4. **Backwards Compatibility**: ✅ All new params optional, no breaking changes

### Remaining

1. **Subagent maxSteps Override**: Should subagents have configurable step limits (currently hardcoded to 50)?
2. **Error Propagation**: Should user callback errors be exposed via event stream rather than console.error?
3. **prepareStep Passthrough**: Should `prepareStep` be exposed? Potential conflicts with dynamic tool creation.
4. **activeTools Integration**: How should `activeTools` interact with DeepAgent's dynamic tool building?

## Related Research

- [`docs/tickets/004_middleware_architecture/`](docs/tickets/004_middleware_architecture/) - Model-level extension patterns
- [`docs/tickets/007_structured_output/`](docs/tickets/007_structured_output/) - Output configuration implementation
- [`docs/patterns.md`](docs/patterns.md) - Common usage patterns
- [`docs/checkpointers.md`](docs/checkpointers.md) - Session persistence patterns

## Implementation Considerations

### Testing Strategy

1. **Unit Tests**: Verify passthrough options reach ToolLoopAgent constructor
2. **Callback Tests**: Verify user callbacks execute and errors are caught
3. **Stop Condition Tests**: Verify composition with maxSteps
4. **Inheritance Tests**: Verify subagent option inheritance
5. **Integration Tests**: End-to-end with telemetry and custom conditions

### Documentation Updates

1. Update `README.md` with passthrough examples
2. Add `examples/with-passthrough.ts` example
3. Update `docs/patterns.md` with advanced configuration patterns
4. Update `docs/architecture.md` with new configuration flow

### Performance Considerations

- Callback merging adds minimal overhead (one try-catch per step)
- Stop condition composition is evaluated lazily per step
- Passthrough options spread is single-operation at construction
