---
title: ToolLoopAgent Passthrough Implementation Plan
description: Documentation
---

## Overview

Implement a type-safe passthrough mechanism for AI SDK v6's `ToolLoopAgent` constructor options, enabling advanced users to access AI SDK features while preserving DeepAgent's opinionated defaults and internal loop control.

## Current State Analysis

### What Exists

1. **ToolLoopAgent instantiation** in two locations:
   - `src/agent.ts:266-273` - Main agent creation
   - `src/tools/subagent.ts:175-182` - Subagent spawning

2. **Currently exposed options** (5 of 22+):
   - `model` - Via `CreateDeepAgentParams.model` with middleware support
   - `instructions` - Built via `buildSystemPrompt()`
   - `tools` - Built via `createTools()` merging built-in + user tools
   - `stopWhen` - Hardcoded to `stepCountIs(maxSteps)`
   - `output` - Via `CreateDeepAgentParams.output`

3. **`as any` casts** requiring elimination:
   - `src/agent.ts:135` - `wrapLanguageModel` type mismatch
   - `src/agent.ts:273` - ToolLoopAgent constructor
   - `src/tools/subagent.ts:182` - Subagent ToolLoopAgent constructor
   - `src/agent.ts:610` - Output property access

### Key Constraints

1. DeepAgent uses `onStepFinish` internally for checkpointing and event emission
2. `stopWhen` must always include `stepCountIs(maxSteps)` as safety limit
3. Subagents have fixed 50-step limit and independent iteration control
4. Type safety required - no `as any` casts allowed

## Desired End State

### User-Facing API

```typescript
const agent = createDeepAgent({
  model: anthropic('claude-sonnet-4-20250514'),
  systemPrompt: 'You are helpful.',
  maxSteps: 100,

  // NEW: Loop control callbacks (user's run first, then DeepAgent's)
  loopControl: {
    prepareStep: async ({ stepNumber, steps }) => {
      // Dynamic per-step adjustments
      return { toolChoice: stepNumber === 0 ? { type: 'tool', toolName: 'write_todos' } : 'auto' };
    },
    onStepFinish: async (stepResult) => {
      console.log('Step completed:', stepResult.toolCalls.length, 'tool calls');
    },
    onFinish: async (event) => {
      console.log('Total usage:', event.totalUsage);
    },
    stopWhen: hasToolCall('final_answer'), // Composed with maxSteps
  },

  // NEW: Sampling & generation parameters
  generationOptions: {
    temperature: 0.7,
    maxOutputTokens: 4096,
    maxRetries: 5,
  },

  // NEW: Advanced options
  advancedOptions: {
    experimental_telemetry: { isEnabled: true },
    providerOptions: { anthropic: { cacheControl: { type: 'ephemeral' } } },
  },
});
```

### Subagent Support

```typescript
const agent = createDeepAgent({
  model: anthropic('claude-sonnet-4-20250514'),
  subagents: [{
    name: 'research-agent',
    description: 'Research specialist',
    systemPrompt: 'You conduct thorough research...',
    // NEW: Subagents can have generation and advanced options
    generationOptions: {
      temperature: 0.3, // More focused for research
    },
    advancedOptions: {
      experimental_telemetry: { isEnabled: true },
    },
    // Loop control NOT allowed - parent owns iteration
  }],
});
```

### Verification Criteria

1. All `as any` casts eliminated from codebase
2. TypeScript compiles without errors
3. All existing tests pass
4. New tests cover passthrough functionality
5. User callbacks execute before internal logic
6. Stop conditions compose correctly with maxSteps

## What We're NOT Doing

1. **Not exposing** `experimental_repairToolCall` - Could break DeepAgent's tool system
2. **Not exposing** `experimental_download` - Conflicts with backend file abstraction
3. **Not exposing** `id` - Use `agentId` param instead
4. **Not allowing** loop control in subagents - Parent owns iteration control
5. **Not removing** maxSteps safety limit - Always included in stop conditions

## Implementation Approach

### Parameter Grouping Strategy

Based on AI SDK v6's [loop control documentation](https://v6.ai-sdk.dev/docs/agents/loop-control), we group options by purpose:

| Group | Options | Rationale |
|-------|---------|-----------|
| **Loop Control** | `prepareStep`, `onStepFinish`, `onFinish`, `stopWhen` | Control iteration behavior, require callback composition |
| **Generation** | `temperature`, `topP`, `topK`, `maxOutputTokens`, `presencePenalty`, `frequencyPenalty`, `seed`, `stopSequences`, `maxRetries` | Sampling parameters, safe for direct passthrough |
| **Advanced** | `experimental_telemetry`, `providerOptions`, `experimental_context`, `toolChoice`, `activeTools` | Advanced features, selectively exposed |
| **Excluded** | `model`, `instructions`, `tools`, `output`, `id`, `experimental_repairToolCall`, `experimental_download` | Core to DeepAgent or potentially dangerous |

---

## Phase 1: Type Definitions

### Overview

Define type-safe interfaces for passthrough options without using `as any`.

### Changes Required

#### 1. Create New Type Definitions

**File**: `src/types.ts`

Add the following type definitions after the existing imports:

```typescript
import type {
  ToolSet,
  ModelMessage,
  LanguageModel,
  LanguageModelMiddleware,
  ToolLoopAgent,
  StopCondition,
} from "ai";

// ============================================================================
// ToolLoopAgent Passthrough Types
// ============================================================================

/**
 * Extract ToolLoopAgent constructor settings type.
 * This avoids duplicating AI SDK types and stays in sync with updates.
 */
type ToolLoopAgentSettings = ConstructorParameters<typeof ToolLoopAgent>[0];

/**
 * Loop control callbacks for agent iteration.
 *
 * These callbacks allow customization of agent behavior during execution.
 * User callbacks execute BEFORE DeepAgent's internal logic (checkpointing, events).
 *
 * @see https://v6.ai-sdk.dev/docs/agents/loop-control
 */
export interface LoopControlOptions {
  /**
   * Called before each step to dynamically adjust settings.
   *
   * Use cases:
   * - Dynamic model switching based on step complexity
   * - Tool availability control at different phases
   * - Message transformation before sending to model
   *
   * @example Force planning tool on first step
   * ```typescript
   * prepareStep: ({ stepNumber }) => {
   *   if (stepNumber === 0) {
   *     return { toolChoice: { type: 'tool', toolName: 'write_todos' } };
   *   }
   *   return {}; // Use defaults
   * }
   * ```
   */
  prepareStep?: ToolLoopAgentSettings['prepareStep'];

  /**
   * Called after each step finishes.
   *
   * Your callback runs BEFORE DeepAgent's internal checkpointing and event emission.
   * Errors in your callback are caught and logged, but don't break checkpointing.
   *
   * @example Log step progress
   * ```typescript
   * onStepFinish: (stepResult) => {
   *   console.log(`Step completed with ${stepResult.toolCalls.length} tool calls`);
   * }
   * ```
   */
  onStepFinish?: ToolLoopAgentSettings['onStepFinish'];

  /**
   * Called when all steps are finished.
   *
   * Receives aggregated information about the entire run including all steps
   * and total token usage.
   *
   * @example Log total usage
   * ```typescript
   * onFinish: (event) => {
   *   console.log(`Completed in ${event.steps.length} steps`);
   *   console.log(`Total tokens: ${event.totalUsage.totalTokens}`);
   * }
   * ```
   */
  onFinish?: ToolLoopAgentSettings['onFinish'];

  /**
   * Custom stop conditions (composed with maxSteps safety limit).
   *
   * When provided, agent stops if ANY condition is met (OR logic):
   * - Your custom condition(s) return true, OR
   * - maxSteps limit is reached
   *
   * @example Stop when specific tool is called
   * ```typescript
   * import { hasToolCall } from 'ai';
   *
   * stopWhen: hasToolCall('submit_final_answer')
   * ```
   *
   * @example Multiple conditions
   * ```typescript
   * stopWhen: [
   *   hasToolCall('done'),
   *   ({ steps }) => steps.some(s => s.text.includes('[COMPLETE]'))
   * ]
   * ```
   */
  stopWhen?: StopCondition<ToolSet> | StopCondition<ToolSet>[];
}

/**
 * Sampling and generation parameters for model calls.
 *
 * These are passed directly to the ToolLoopAgent and affect how the model
 * generates responses. Safe for direct passthrough with no conflicts.
 */
export interface GenerationOptions {
  /**
   * Sampling temperature (0-2). Higher = more creative, lower = more focused.
   * Recommended to set either temperature or topP, not both.
   */
  temperature?: number;

  /**
   * Nucleus sampling (0-1). Only tokens with cumulative probability <= topP are considered.
   * Recommended to set either temperature or topP, not both.
   */
  topP?: number;

  /**
   * Top-K sampling. Only the top K tokens are considered for each step.
   */
  topK?: number;

  /**
   * Maximum number of tokens to generate per response.
   */
  maxOutputTokens?: number;

  /**
   * Presence penalty (-1 to 1). Positive values reduce repetition of topics.
   */
  presencePenalty?: number;

  /**
   * Frequency penalty (-1 to 1). Positive values reduce repetition of exact phrases.
   */
  frequencyPenalty?: number;

  /**
   * Random seed for deterministic generation (if supported by model).
   */
  seed?: number;

  /**
   * Sequences that stop generation when encountered.
   */
  stopSequences?: string[];

  /**
   * Maximum number of retries for failed API calls (default: 2).
   */
  maxRetries?: number;
}

/**
 * Advanced options for power users.
 *
 * These options provide access to experimental and provider-specific features.
 * Use with caution - some may affect DeepAgent's behavior.
 */
export interface AdvancedAgentOptions {
  /**
   * OpenTelemetry configuration for observability.
   *
   * @example Enable telemetry
   * ```typescript
   * experimental_telemetry: { isEnabled: true }
   * ```
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
   * Custom context passed to tool executions.
   *
   * WARNING: Experimental - may change in patch releases.
   */
  experimental_context?: ToolLoopAgentSettings['experimental_context'];

  /**
   * Control which tool the model should call.
   *
   * Options:
   * - 'auto' (default): Model decides
   * - 'none': No tool calls
   * - 'required': Must call a tool
   * - { type: 'tool', toolName: string }: Must call specific tool
   */
  toolChoice?: ToolLoopAgentSettings['toolChoice'];

  /**
   * Limit which tools are available for the model to call.
   *
   * @example Only allow read operations
   * ```typescript
   * activeTools: ['read_file', 'ls', 'grep', 'glob']
   * ```
   */
  activeTools?: string[];
}

/**
 * Combined passthrough options for subagents.
 *
 * Subagents can have generation and advanced options, but NOT loop control.
 * Loop control (prepareStep, onStepFinish, onFinish, stopWhen) is owned by
 * the parent DeepAgent to maintain consistent iteration behavior.
 */
export interface SubAgentPassthroughOptions {
  /**
   * Sampling and generation parameters for this subagent.
   */
  generationOptions?: GenerationOptions;

  /**
   * Advanced options for this subagent.
   *
   * Note: `experimental_telemetry` is inherited from parent if not specified.
   */
  advancedOptions?: Omit<AdvancedAgentOptions, 'toolChoice' | 'activeTools'>;
}
```

#### 2. Update CreateDeepAgentParams Interface

**File**: `src/types.ts`

Add the new options to `CreateDeepAgentParams`:

```typescript
export interface CreateDeepAgentParams {
  // ... existing params remain unchanged ...

  /**
   * Loop control callbacks for customizing agent iteration.
   *
   * User callbacks execute BEFORE DeepAgent's internal logic.
   *
   * @see https://v6.ai-sdk.dev/docs/agents/loop-control
   *
   * @example
   * ```typescript
   * loopControl: {
   *   prepareStep: ({ stepNumber }) => {
   *     if (stepNumber === 0) return { toolChoice: { type: 'tool', toolName: 'write_todos' } };
   *     return {};
   *   },
   *   onStepFinish: (step) => console.log('Step done:', step.toolCalls.length),
   *   stopWhen: hasToolCall('done'),
   * }
   * ```
   */
  loopControl?: LoopControlOptions;

  /**
   * Sampling and generation parameters for model calls.
   *
   * @example
   * ```typescript
   * generationOptions: {
   *   temperature: 0.7,
   *   maxOutputTokens: 4096,
   *   maxRetries: 5,
   * }
   * ```
   */
  generationOptions?: GenerationOptions;

  /**
   * Advanced options for power users.
   *
   * @example
   * ```typescript
   * advancedOptions: {
   *   experimental_telemetry: { isEnabled: true },
   *   providerOptions: { anthropic: { cacheControl: { type: 'ephemeral' } } },
   * }
   * ```
   */
  advancedOptions?: AdvancedAgentOptions;
}
```

#### 3. Update SubAgent Interface

**File**: `src/types.ts`

Extend the `SubAgent` interface:

```typescript
export interface SubAgent {
  // ... existing properties remain unchanged ...

  /**
   * Sampling and generation parameters for this subagent.
   * Overrides parent agent's settings for this subagent only.
   *
   * @example
   * ```typescript
   * generationOptions: {
   *   temperature: 0.3, // More focused for research
   *   maxRetries: 3,
   * }
   * ```
   */
  generationOptions?: GenerationOptions;

  /**
   * Advanced options for this subagent.
   *
   * Note: Loop control (prepareStep, onStepFinish, etc.) is NOT available
   * for subagents - iteration is controlled by the parent agent.
   *
   * @example
   * ```typescript
   * advancedOptions: {
   *   experimental_telemetry: { isEnabled: true },
   * }
   * ```
   */
  advancedOptions?: Omit<AdvancedAgentOptions, 'toolChoice' | 'activeTools'>;
}
```

### Success Criteria

#### Automated Verification

- [ ] `bun run typecheck` passes with no errors
- [ ] No `as any` casts in type definitions

#### Manual Verification

- [ ] New types are properly exported from `src/types.ts`
- [ ] JSDoc examples compile without errors
- [ ] IntelliSense shows correct type hints in IDE

---

## Phase 2: DeepAgent Constructor Updates

### Overview

Store passthrough options in DeepAgent class and eliminate middleware `as any` cast.

### Changes Required

#### 1. Add Private Fields to DeepAgent Class

**File**: `src/agent.ts`

Add new private fields after existing ones (around line 88):

```typescript
export class DeepAgent {
  // ... existing fields ...

  // Passthrough options
  private loopControl?: LoopControlOptions;
  private generationOptions?: GenerationOptions;
  private advancedOptions?: AdvancedAgentOptions;
```

#### 2. Update Constructor to Store Options

**File**: `src/agent.ts`

Update the constructor to accept and store the new options:

```typescript
constructor({
  model,
  middleware,
  // ... existing params ...
  loopControl,
  generationOptions,
  advancedOptions,
}: CreateDeepAgentParams) {
  // ... existing initialization ...

  // Store passthrough options
  this.loopControl = loopControl;
  this.generationOptions = generationOptions;
  this.advancedOptions = advancedOptions;
}
```

#### 3. Fix Middleware Type Cast

**File**: `src/agent.ts`

Replace the `as any` cast on line 135 with proper typing:

```typescript
// Before (line 134-137)
this.model = wrapLanguageModel({
  model: model as any, // Cast required since wrapLanguageModel expects LanguageModelV3
  middleware: middlewares,
}) as LanguageModel;

// After - use type assertion that matches AI SDK expectations
import type { LanguageModelV2 } from '@ai-sdk/provider';

this.model = wrapLanguageModel({
  model: model as LanguageModelV2,
  middleware: middlewares,
});
```

**Note**: If `LanguageModelV2` doesn't resolve the type issue, we may need to check the exact type expected by `wrapLanguageModel` in AI SDK v6 and use the appropriate import.

### Success Criteria

#### Automated Verification

- [ ] `bun run typecheck` passes
- [ ] `bun test` passes (existing tests)

#### Manual Verification

- [ ] Constructor accepts new options without errors
- [ ] Options are stored correctly (can verify with debugger)

---

## Phase 3: ToolLoopAgent Instantiation Updates

### Overview

Update `createAgent` method to use passthrough options with proper typing, eliminating `as any` cast.

### Changes Required

#### 1. Create Helper for Building Stop Conditions

**File**: `src/agent.ts`

Add a private method to compose stop conditions:

```typescript
/**
 * Build stop conditions array, always including maxSteps safety limit.
 */
private buildStopConditions(maxSteps: number): StopCondition<ToolSet>[] {
  const conditions: StopCondition<ToolSet>[] = [];

  // Add user-provided stop conditions
  if (this.loopControl?.stopWhen) {
    if (Array.isArray(this.loopControl.stopWhen)) {
      conditions.push(...this.loopControl.stopWhen);
    } else {
      conditions.push(this.loopControl.stopWhen);
    }
  }

  // Always include maxSteps as safety limit
  conditions.push(stepCountIs(maxSteps));

  return conditions;
}
```

#### 2. Create Helper for Building Agent Settings

**File**: `src/agent.ts`

Add a private method to build type-safe ToolLoopAgent settings:

```typescript
import type { ToolLoopAgentSettings } from './types';

/**
 * Build ToolLoopAgent settings with proper typing.
 */
private buildAgentSettings(
  tools: ToolSet,
  maxSteps: number,
): ToolLoopAgentSettings {
  // Base settings (always required)
  const settings: ToolLoopAgentSettings = {
    model: this.model,
    instructions: this.systemPrompt,
    tools,
    stopWhen: this.buildStopConditions(maxSteps),
  };

  // Add output configuration if provided
  if (this.outputConfig) {
    settings.output = Output.object(this.outputConfig);
  }

  // Add generation options
  if (this.generationOptions) {
    Object.assign(settings, {
      temperature: this.generationOptions.temperature,
      topP: this.generationOptions.topP,
      topK: this.generationOptions.topK,
      maxOutputTokens: this.generationOptions.maxOutputTokens,
      presencePenalty: this.generationOptions.presencePenalty,
      frequencyPenalty: this.generationOptions.frequencyPenalty,
      seed: this.generationOptions.seed,
      stopSequences: this.generationOptions.stopSequences,
      maxRetries: this.generationOptions.maxRetries,
    });
  }

  // Add advanced options
  if (this.advancedOptions) {
    Object.assign(settings, {
      experimental_telemetry: this.advancedOptions.experimental_telemetry,
      providerOptions: this.advancedOptions.providerOptions,
      experimental_context: this.advancedOptions.experimental_context,
      toolChoice: this.advancedOptions.toolChoice,
      activeTools: this.advancedOptions.activeTools,
    });
  }

  // Add prepareStep if provided
  if (this.loopControl?.prepareStep) {
    settings.prepareStep = this.loopControl.prepareStep;
  }

  return settings;
}
```

#### 3. Update createAgent Method

**File**: `src/agent.ts`

Replace the existing `createAgent` method (lines 263-274):

```typescript
private createAgent(state: DeepAgentState, maxSteps?: number, onEvent?: EventCallback) {
  const tools = this.createTools(state, onEvent);
  const effectiveMaxSteps = maxSteps ?? this.maxSteps;
  const settings = this.buildAgentSettings(tools, effectiveMaxSteps);

  return new ToolLoopAgent(settings);
}
```

### Success Criteria

#### Automated Verification

- [ ] `bun run typecheck` passes
- [ ] `bun test` passes
- [ ] No `as any` cast in `createAgent`

#### Manual Verification

- [ ] Agent creates successfully with default options
- [ ] Agent creates successfully with all passthrough options
- [ ] Generation options affect model behavior (test with temperature)

---

## Phase 4: Callback Composition in streamWithEvents

### Overview

Update `streamWithEvents` to merge user callbacks with internal checkpointing/event logic.

### Changes Required

#### 1. Create Callback Composition Helpers

**File**: `src/agent.ts`

Add helper functions for safe callback composition:

```typescript
/**
 * Compose user onStepFinish callback with internal logic.
 * User callback runs first, errors are caught and logged.
 */
private composeOnStepFinish(
  userCallback: LoopControlOptions['onStepFinish'] | undefined,
  internalCallback: (stepResult: StepResult<ToolSet>) => Promise<void>,
): (stepResult: StepResult<ToolSet>) => Promise<void> {
  return async (stepResult) => {
    // 1. Run user callback first (protected)
    if (userCallback) {
      try {
        await userCallback(stepResult);
      } catch (error) {
        console.error('[DeepAgent] User onStepFinish callback error:', error);
        // Continue with internal logic - don't break checkpointing
      }
    }

    // 2. Run internal logic (always)
    await internalCallback(stepResult);
  };
}

/**
 * Compose user onFinish callback with internal logic.
 * User callback runs first, errors are caught and logged.
 */
private composeOnFinish(
  userCallback: LoopControlOptions['onFinish'] | undefined,
  internalCallback?: (event: ToolLoopAgentFinishEvent) => Promise<void>,
): ((event: ToolLoopAgentFinishEvent) => Promise<void>) | undefined {
  if (!userCallback && !internalCallback) {
    return undefined;
  }

  return async (event) => {
    // 1. Run user callback first (protected)
    if (userCallback) {
      try {
        await userCallback(event);
      } catch (error) {
        console.error('[DeepAgent] User onFinish callback error:', error);
      }
    }

    // 2. Run internal logic if any
    if (internalCallback) {
      await internalCallback(event);
    }
  };
}
```

#### 2. Update streamWithEvents Method

**File**: `src/agent.ts`

Update the `streamText` call in `streamWithEvents` (around line 504-571) to use composed callbacks:

```typescript
// Build internal onStepFinish logic
const internalOnStepFinish = async ({ toolCalls, toolResults }: StepResult<ToolSet>) => {
  stepNumber++;
  const cumulativeStep = baseStep + stepNumber;

  // Emit step finish event
  const stepEvent: DeepAgentEvent = {
    type: "step-finish",
    stepNumber,
    toolCalls: toolCalls.map((tc, i) => ({
      toolName: tc.toolName,
      args: "input" in tc ? tc.input : undefined,
      result: toolResults[i] ? ("output" in toolResults[i] ? toolResults[i].output : undefined) : undefined,
    })),
  };
  eventQueue.push(stepEvent);

  // Save checkpoint if configured
  if (threadId && this.checkpointer) {
    const checkpoint: Checkpoint = {
      threadId,
      step: cumulativeStep,
      messages: inputMessages,
      state: { ...state },
      interrupt: pendingInterrupt,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    await this.checkpointer.save(checkpoint);

    eventQueue.push({
      type: "checkpoint-saved",
      threadId,
      step: cumulativeStep,
    });
  }
};

// Build streamText options with composed callbacks
const streamOptions: Parameters<typeof streamText>[0] = {
  model: this.model,
  messages: inputMessages,
  tools,
  stopWhen: this.buildStopConditions(options.maxSteps ?? this.maxSteps),
  abortSignal: options.abortSignal,

  // Composed callbacks
  onStepFinish: this.composeOnStepFinish(
    this.loopControl?.onStepFinish,
    internalOnStepFinish,
  ),
  onFinish: this.composeOnFinish(this.loopControl?.onFinish),

  // Passthrough generation options
  ...this.generationOptions,

  // Passthrough advanced options (excluding callbacks and managed options)
  experimental_telemetry: this.advancedOptions?.experimental_telemetry,
  providerOptions: this.advancedOptions?.providerOptions,
  experimental_context: this.advancedOptions?.experimental_context,

  // Add prepareStep if provided
  ...(this.loopControl?.prepareStep && { prepareStep: this.loopControl.prepareStep }),
};
```

#### 3. Fix Output Property Access

**File**: `src/agent.ts`

Replace the `as any` cast on line 610:

```typescript
// Before
const output = 'output' in result ? (result as any).output : undefined;

// After - use type guard
const output = 'output' in result ? (result as { output: unknown }).output : undefined;
```

### Success Criteria

#### Automated Verification

- [ ] `bun run typecheck` passes
- [ ] `bun test` passes
- [ ] No `as any` casts in `streamWithEvents`

#### Manual Verification

- [ ] User callbacks execute before internal logic
- [ ] Errors in user callbacks don't break checkpointing
- [ ] Internal checkpointing still works correctly
- [ ] Events are emitted in correct order

---

## Phase 5: Subagent Passthrough Support

### Overview

Update subagent tool to support generation and advanced options, while keeping loop control with parent.

### Changes Required

#### 1. Update Subagent Registry Type

**File**: `src/tools/subagent.ts`

Update the internal registry type to include passthrough options:

```typescript
interface SubagentRegistryEntry {
  model: LanguageModel;
  systemPrompt: string;
  tools?: ToolSet;
  output?: SubAgent['output'];
  interruptOn?: InterruptOnConfig;
  generationOptions?: GenerationOptions;
  advancedOptions?: SubAgent['advancedOptions'];
}
```

#### 2. Update Registry Population

**File**: `src/tools/subagent.ts`

Update where subagents are registered (around line 106-109):

```typescript
subagentRegistry[subagent.name] = {
  model: subagent.model || defaultModel,
  systemPrompt: buildSubagentSystemPrompt(subagent.systemPrompt),
  tools: subagent.tools,
  output: subagent.output,
  interruptOn: subagent.interruptOn,
  generationOptions: subagent.generationOptions,
  advancedOptions: subagent.advancedOptions,
};
```

#### 3. Update Subagent ToolLoopAgent Creation

**File**: `src/tools/subagent.ts`

Replace the ToolLoopAgent instantiation (lines 175-182):

```typescript
// Build subagent settings
const subagentSettings: ToolLoopAgentSettings = {
  model: subagentConfig.model,
  instructions: subagentConfig.systemPrompt,
  tools: allTools,
  stopWhen: stepCountIs(50), // Fixed limit for subagents

  // Add output if configured
  ...(subagentConfig.output && { output: Output.object(subagentConfig.output) }),

  // Passthrough generation options
  ...(subagentConfig.generationOptions && {
    temperature: subagentConfig.generationOptions.temperature,
    topP: subagentConfig.generationOptions.topP,
    topK: subagentConfig.generationOptions.topK,
    maxOutputTokens: subagentConfig.generationOptions.maxOutputTokens,
    presencePenalty: subagentConfig.generationOptions.presencePenalty,
    frequencyPenalty: subagentConfig.generationOptions.frequencyPenalty,
    seed: subagentConfig.generationOptions.seed,
    stopSequences: subagentConfig.generationOptions.stopSequences,
    maxRetries: subagentConfig.generationOptions.maxRetries,
  }),

  // Passthrough advanced options (inherit telemetry from parent if not specified)
  experimental_telemetry: subagentConfig.advancedOptions?.experimental_telemetry
    ?? parentAdvancedOptions?.experimental_telemetry,
  providerOptions: subagentConfig.advancedOptions?.providerOptions,
  experimental_context: subagentConfig.advancedOptions?.experimental_context,
};

const subagentAgent = new ToolLoopAgent(subagentSettings);
```

#### 4. Pass Parent Options to Subagent Tool Factory

**File**: `src/tools/subagent.ts`

Update `createSubagentTool` to accept parent options for inheritance:

```typescript
export function createSubagentTool(
  subagents: SubAgent[],
  defaultModel: LanguageModel,
  defaultTools: ToolSet,
  state: DeepAgentState,
  interruptOn?: InterruptOnConfig,
  onEvent?: EventCallback,
  parentAdvancedOptions?: AdvancedAgentOptions, // NEW: for telemetry inheritance
): Tool {
  // ... rest of implementation
}
```

#### 5. Update createTools to Pass Parent Options

**File**: `src/agent.ts`

Update the `createTools` method to pass advanced options to subagent tool:

```typescript
// In createTools method, where task tool is created
if (this.subagentOptions) {
  const taskTool = createSubagentTool(
    this.subagentOptions.subagents || [],
    this.subagentOptions.defaultModel,
    { ...filesystemTools, write_todos: todosTool, ...userTools },
    state,
    this.interruptOn,
    onEvent,
    this.advancedOptions, // Pass for inheritance
  );
  tools.task = applyInterruptConfig({ task: taskTool }, this.interruptOn).task;
}
```

### Success Criteria

#### Automated Verification

- [ ] `bun run typecheck` passes
- [ ] `bun test` passes
- [ ] No `as any` cast in subagent.ts

#### Manual Verification

- [ ] Subagents receive generation options
- [ ] Subagents inherit telemetry from parent
- [ ] Subagents cannot override loop control
- [ ] Subagent 50-step limit still enforced

---

## Phase 6: Testing

### Overview

Add comprehensive tests for passthrough functionality.

### Changes Required

#### 1. Create Passthrough Test File

**File**: `src/passthrough.test.ts`

```typescript
import { test, expect, describe, mock } from "bun:test";
import { createDeepAgent } from "./agent";
import { StateBackend } from "./backends/state";
import { hasToolCall, stepCountIs } from "ai";

// Mock model for testing
const mockModel = {
  // ... mock implementation
};

describe("ToolLoopAgent Passthrough", () => {
  describe("Loop Control", () => {
    test("user onStepFinish callback executes before internal logic", async () => {
      const executionOrder: string[] = [];

      const agent = createDeepAgent({
        model: mockModel,
        loopControl: {
          onStepFinish: async () => {
            executionOrder.push("user");
          },
        },
        checkpointer: {
          save: async () => {
            executionOrder.push("internal");
          },
          // ... other methods
        },
      });

      // Run agent and verify order
      // ... test implementation

      expect(executionOrder).toEqual(["user", "internal"]);
    });

    test("user callback errors don't break checkpointing", async () => {
      const checkpointSaved = { value: false };

      const agent = createDeepAgent({
        model: mockModel,
        loopControl: {
          onStepFinish: async () => {
            throw new Error("User callback error");
          },
        },
        checkpointer: {
          save: async () => {
            checkpointSaved.value = true;
          },
        },
      });

      // Run agent
      // ... test implementation

      expect(checkpointSaved.value).toBe(true);
    });

    test("custom stopWhen composes with maxSteps", async () => {
      const agent = createDeepAgent({
        model: mockModel,
        maxSteps: 100,
        loopControl: {
          stopWhen: hasToolCall("done"),
        },
      });

      // Verify both conditions are checked
      // ... test implementation
    });

    test("prepareStep callback is invoked before each step", async () => {
      const stepNumbers: number[] = [];

      const agent = createDeepAgent({
        model: mockModel,
        loopControl: {
          prepareStep: ({ stepNumber }) => {
            stepNumbers.push(stepNumber);
            return {};
          },
        },
      });

      // Run agent for multiple steps
      // ... test implementation

      expect(stepNumbers).toEqual([0, 1, 2]); // Example
    });
  });

  describe("Generation Options", () => {
    test("temperature is passed to ToolLoopAgent", async () => {
      const agent = createDeepAgent({
        model: mockModel,
        generationOptions: {
          temperature: 0.5,
        },
      });

      // Verify temperature is set
      // ... test implementation
    });

    test("maxRetries affects retry behavior", async () => {
      // ... test implementation
    });
  });

  describe("Advanced Options", () => {
    test("experimental_telemetry is passed through", async () => {
      const agent = createDeepAgent({
        model: mockModel,
        advancedOptions: {
          experimental_telemetry: { isEnabled: true },
        },
      });

      // Verify telemetry is configured
      // ... test implementation
    });

    test("providerOptions are passed through", async () => {
      // ... test implementation
    });
  });

  describe("Subagent Options", () => {
    test("subagent inherits telemetry from parent", async () => {
      const agent = createDeepAgent({
        model: mockModel,
        advancedOptions: {
          experimental_telemetry: { isEnabled: true },
        },
        subagents: [{
          name: "test-agent",
          description: "Test agent",
          systemPrompt: "You are a test agent",
          // No advancedOptions - should inherit
        }],
      });

      // Verify subagent has telemetry
      // ... test implementation
    });

    test("subagent can override temperature", async () => {
      const agent = createDeepAgent({
        model: mockModel,
        generationOptions: { temperature: 0.7 },
        subagents: [{
          name: "test-agent",
          description: "Test agent",
          systemPrompt: "You are a test agent",
          generationOptions: { temperature: 0.3 },
        }],
      });

      // Verify subagent has different temperature
      // ... test implementation
    });

    test("subagent cannot set loop control", async () => {
      // TypeScript should prevent this, but verify at runtime
      // ... test implementation
    });
  });
});
```

#### 2. Update Existing Tests

Verify existing tests still pass and update any that depend on internal implementation details.

### Success Criteria

#### Automated Verification

- [ ] `bun test` passes with all new tests
- [ ] Code coverage for new functionality > 80%

#### Manual Verification

- [ ] Tests cover all documented use cases
- [ ] Tests verify error handling behavior
- [ ] Tests verify callback execution order

---

## Phase 7: Documentation

### Overview

Update documentation to reflect new passthrough options.

### Changes Required

#### 1. Update README.md

Add section on advanced configuration:

```markdown
### Advanced Configuration

DeepAgent exposes advanced AI SDK v6 options through three parameter groups:

#### Loop Control

Control agent iteration behavior with callbacks:

\`\`\`typescript
const agent = createDeepAgent({
  model: anthropic('claude-sonnet-4-20250514'),
  loopControl: {
    // Called before each step for dynamic adjustments
    prepareStep: ({ stepNumber }) => {
      if (stepNumber === 0) {
        return { toolChoice: { type: 'tool', toolName: 'write_todos' } };
      }
      return {};
    },
    // Called after each step (your callback runs first)
    onStepFinish: (step) => {
      console.log(\`Step \${step.stepNumber} completed\`);
    },
    // Custom stop conditions (composed with maxSteps)
    stopWhen: hasToolCall('done'),
  },
});
\`\`\`

#### Generation Options

Fine-tune model generation behavior:

\`\`\`typescript
const agent = createDeepAgent({
  model: anthropic('claude-sonnet-4-20250514'),
  generationOptions: {
    temperature: 0.7,
    maxOutputTokens: 4096,
    maxRetries: 5,
  },
});
\`\`\`

#### Advanced Options

Access experimental and provider-specific features:

\`\`\`typescript
const agent = createDeepAgent({
  model: anthropic('claude-sonnet-4-20250514'),
  advancedOptions: {
    experimental_telemetry: { isEnabled: true },
    providerOptions: {
      anthropic: { cacheControl: { type: 'ephemeral' } },
    },
  },
});
\`\`\`
```

#### 2. Add Example File

**File**: `examples/with-passthrough.ts`

```typescript
/**
 * Example: Using ToolLoopAgent passthrough options
 *
 * This example demonstrates how to use advanced AI SDK v6 features
 * through DeepAgent's passthrough options.
 */

import { createDeepAgent } from "deepagentsdk";
import { anthropic } from "@ai-sdk/anthropic";
import { hasToolCall } from "ai";

async function main() {
  const agent = createDeepAgent({
    model: anthropic("claude-sonnet-4-20250514"),

    // Loop control: customize iteration behavior
    loopControl: {
      // Force planning on first step
      prepareStep: ({ stepNumber }) => {
        if (stepNumber === 0) {
          console.log("Step 0: Forcing planning tool");
          return { toolChoice: { type: "tool", toolName: "write_todos" } };
        }
        return {};
      },

      // Log each step
      onStepFinish: (step) => {
        console.log(`Step completed: ${step.toolCalls.length} tool calls`);
      },

      // Log completion
      onFinish: (event) => {
        console.log(`Completed in ${event.steps.length} steps`);
        console.log(`Total tokens: ${event.totalUsage.totalTokens}`);
      },

      // Stop when 'submit_result' tool is called
      stopWhen: hasToolCall("submit_result"),
    },

    // Generation: fine-tune model behavior
    generationOptions: {
      temperature: 0.7,
      maxOutputTokens: 4096,
      maxRetries: 3,
    },

    // Advanced: enable telemetry
    advancedOptions: {
      experimental_telemetry: { isEnabled: true },
    },

    // Subagent with different settings
    subagents: [
      {
        name: "research-agent",
        description: "Focused research agent",
        systemPrompt: "You conduct focused, thorough research.",
        generationOptions: {
          temperature: 0.3, // More deterministic
        },
      },
    ],
  });

  // Run the agent
  for await (const event of agent.streamWithEvents({
    prompt: "Research the latest TypeScript features and create a summary",
  })) {
    if (event.type === "text") {
      process.stdout.write(event.text);
    }
  }
}

main().catch(console.error);
```

#### 3. Update AGENTS.md

Add brief mention of passthrough options in the quick reference.

### Success Criteria

#### Automated Verification

- [ ] Example file compiles without errors
- [ ] `bun examples/with-passthrough.ts` runs successfully

#### Manual Verification

- [ ] Documentation is clear and comprehensive
- [ ] Examples demonstrate key use cases
- [ ] Migration path from current API is clear

---

## Testing Strategy

### Unit Tests

- Callback composition functions
- Stop condition building
- Settings builder functions
- Type safety (compile-time)

### Integration Tests

- Full agent run with all passthrough options
- Subagent inheritance behavior
- Error handling in user callbacks
- Checkpoint persistence with callbacks

### Manual Testing Steps

1. Create agent with all passthrough options
2. Verify `prepareStep` is called before each step
3. Verify user `onStepFinish` runs before checkpointing
4. Verify `stopWhen` composes with `maxSteps`
5. Verify subagent inherits telemetry
6. Verify subagent respects its own generation options
7. Test error in user callback doesn't break agent

---

## Performance Considerations

1. **Callback Composition**: Minimal overhead (one try-catch per step)
2. **Settings Building**: Single-operation at construction time
3. **Stop Condition Array**: Evaluated lazily per step
4. **No Breaking Changes**: Existing code paths unchanged when options not provided

---

## Migration Notes

### For Existing Users

No changes required. All new options are optional and default to current behavior.

### For Users Adopting Passthrough

1. Import new types if using TypeScript:

   ```typescript
   import type { LoopControlOptions, GenerationOptions, AdvancedAgentOptions } from 'deepagentsdk';
   ```

2. Group options by purpose:
   - Iteration behavior → `loopControl`
   - Model sampling → `generationOptions`
   - Experimental features → `advancedOptions`

3. Remember callback execution order:
   - User callbacks run FIRST
   - DeepAgent internal logic runs AFTER
   - Errors in user callbacks are logged but don't break internal logic
