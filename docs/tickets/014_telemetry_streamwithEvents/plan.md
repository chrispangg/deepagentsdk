---
title: Comprehensive Telemetry Passthrough Implementation Plan
description: Documentation
---

## Overview

Implement complete telemetry and options passthrough across all DeepAgent methods to ensure consistent behavior between `generate()` and `streamWithEvents()`, and extend telemetry coverage to summarization utilities. This comprehensive fix addresses all identified gaps in the current implementation.

**Problem Summary**:

- `streamWithEvents()` lacks passthrough of `generationOptions`, `advancedOptions` (including telemetry), and `outputConfig`
- `loopControl` callbacks are not composed in streaming mode
- `summarizeIfNeeded()` utility doesn't receive telemetry options

**Impact**: Users experience inconsistent behavior and missing telemetry traces when using streaming operations or when conversation summarization is triggered.

## Current State Analysis

### Working Implementation: `generate()`

- ✅ Uses `ToolLoopAgent` via `createAgent()`
- ✅ All passthrough options work (generationOptions, advancedOptions, loopControl, output)
- ✅ Telemetry traces generated correctly

### Broken Implementations

1. **`streamWithEvents()`** (Primary Issue)
   - ❌ Missing 15 passthrough options
   - ❌ `loopControl` callbacks not composed
   - ❌ No telemetry traces

2. **`summarizeIfNeeded()`** (Secondary Issue)
   - ❌ Called from `streamWithEvents()` at line 752
   - ❌ `generateText()` call lacks telemetry options
   - ❌ Summarization traces missing

## Desired End State

After implementation:

1. **Complete Telemetry Coverage**: All AI SDK calls (`ToolLoopAgent`, `streamText`, `generateText`) receive telemetry options
2. **Consistent Behavior**: Identical options passthrough for all methods
3. **Full Callback Support**: All `loopControl` callbacks work in streaming mode
4. **No Regressions**: Existing functionality preserved

## What We're NOT Doing

- **Not merging code paths**: Keeping the architectural split between `ToolLoopAgent` and direct AI SDK calls
- **Not changing `generate()`**: It already works correctly
- **Not modifying subagent implementation**: Already handles options correctly
- **Not adding new features**: Only fixing missing passthrough functionality

## Implementation Strategy

**Approach**: Incrementally fix each gap while maintaining backward compatibility:

1. **Phase 1**: Fix core passthrough options in `buildStreamTextOptions()`
2. **Phase 2**: Implement `loopControl` callback composition for streaming
3. **Phase 3**: Add telemetry support to `summarizeIfNeeded()`

---

## Phase 1: Core Passthrough Options for streamWithEvents()

### Overview

Add the missing 15 passthrough options to `buildStreamTextOptions()` to match `buildAgentSettings()`.

### Changes Required

#### 1. Update `buildStreamTextOptions()` Method

**File**: `src/agent.ts`
**Location**: After line 659, before system prompt handling

```typescript
    };  // Line 659 - End of streamOptions object

    // Add generation options if provided
    if (this.generationOptions) {
      Object.assign(streamOptions, this.generationOptions);
    }

    // Add advanced options if provided
    if (this.advancedOptions) {
      Object.assign(streamOptions, this.advancedOptions);
    }

    // Add output configuration if provided using AI SDK Output helper
    if (this.outputConfig) {
      streamOptions.output = Output.object(this.outputConfig);
    }

    // Add system prompt with optional caching for Anthropic models
    if (this.enablePromptCaching) {  // Line 662
```

**Options Being Added**:

- `generationOptions`: temperature, topP, topK, maxOutputTokens, presencePenalty, frequencyPenalty, seed, stopSequences, maxRetries (9 fields)
- `advancedOptions`: experimental_telemetry, providerOptions, experimental_context, toolChoice, activeTools (5 fields)
- `outputConfig`: structured output schema (1 field)

### Success Criteria

**Automated**:

- [x] Type checking passes: `bun run typecheck`
- [ ] Existing tests pass: `bun test`
- [x] New telemetry tests pass: `bun test test/telemetry-stream.test.ts`

**Manual**:

- [x] `streamingWithTelemetryExample()` sends traces to Langfuse
- [x] Provider options (e.g., Anthropic cache control) work in streaming
- [x] Generation options (temperature, etc.) apply to streaming

---

## Phase 2: loopControl Callback Composition for Streaming

### Overview

Implement proper composition of `loopControl` callbacks in `streamWithEvents()` to match `buildAgentSettings()` behavior.

### Changes Required

#### 1. Add `prepareStep` Passthrough

**Location**: After outputConfig addition in `buildStreamTextOptions()`

```typescript
    // Add composed loop control callbacks if provided
    if (this.loopControl) {
      if (this.loopControl.prepareStep) {
        streamOptions.prepareStep = this.composePrepareStep(this.loopControl.prepareStep);
      }
    }
```

#### 2. Compose `onStepFinish` with Custom Logic

**Current**: Custom implementation replaces user callback entirely
**Fix**: Call user callback before executing checkpointing logic

```typescript
onStepFinish: async ({ toolCalls, toolResults }) => {
  // Call user's onStepFinish first if provided
  if (this.loopControl?.onStepFinish) {
    const composedOnStepFinish = this.composeOnStepFinish(this.loopControl.onStepFinish);
    await composedOnStepFinish({ toolCalls, toolResults });
  }

  // Then execute DeepAgent's checkpointing logic
  stepNumberRef.value++;
  const cumulativeStep = baseStep + stepNumberRef.value;
  // ... existing checkpointing code ...
}
```

#### 3. Add `onFinish` Passthrough

```typescript
    if (this.loopControl?.onFinish) {
      streamOptions.onFinish = this.composeOnFinish(this.loopControl.onFinish);
    }
```

#### 4. Fix `stopWhen` to Include User Conditions

**Current**: Only uses `stepCountIs(maxSteps)`
**Fix**: Use existing `buildStopConditions()` method

```typescript
    const streamOptions: Parameters<typeof streamText>[0] = {
      // ... other options ...
      stopWhen: this.buildStopConditions(options.maxSteps),  // Instead of hardcoded stepCountIs
    };
```

### Success Criteria

**Automated**:

- [x] LoopControl tests pass: `bun test test/loopcontrol-stream.test.ts`

**Manual**:

- [x] User's `onStepFinish` callback is called during streaming
- [x] Custom `stopWhen` conditions work in streaming
- [x] `prepareStep` and `onFinish` callbacks execute

---

## Phase 3: Telemetry for Summarization

### Overview

Pass telemetry options to `summarizeIfNeeded()` so that `generateText()` calls during summarization are traced.

### Changes Required

#### 1. Update `summarizeIfNeeded()` Function Signature

**File**: `src/utils/summarization.ts`

```typescript
export interface SummarizationOptions {
  /** Model to use for summarization */
  model: LanguageModel;
  /** Token threshold to trigger summarization */
  tokenThreshold?: number;
  /** Number of recent messages to keep intact */
  keepMessages?: number;
  /** Generation options to pass through */
  generationOptions?: any;  // TODO: Import proper type
  /** Advanced options to pass through */
  advancedOptions?: any;    // TODO: Import proper type
}
```

#### 2. Pass Telemetry Options to `generateText`

**Function**: `generateSummary` (lines 117-137)

```typescript
async function generateSummary(
  messages: ModelMessage[],
  model: LanguageModel,
  generationOptions?: any,
  advancedOptions?: any
): Promise<string> {
  const conversationText = formatMessagesForSummary(messages);

  const generateTextOptions: any = {
    model,
    system: `You are a conversation summarizer...`,
    prompt: `Please summarize the following conversation:\n\n${conversationText}`,
  };

  // Add passthrough options
  if (generationOptions) {
    Object.assign(generateTextOptions, generationOptions);
  }
  if (advancedOptions) {
    Object.assign(generateTextOptions, advancedOptions);
  }

  const result = await generateText(generateTextOptions);
  return result.text;
}
```

#### 3. Update Call Site in Agent

**File**: `src/agent.ts` (line 752)

```typescript
if (this.summarizationConfig?.enabled && patchedHistory.length > 0) {
  const summarizationResult = await summarizeIfNeeded(patchedHistory, {
    model: this.summarizationConfig.model || this.model,
    tokenThreshold: this.summarizationConfig.tokenThreshold,
    keepMessages: this.summarizationConfig.keepMessages,
    generationOptions: this.generationOptions,
    advancedOptions: this.advancedOptions,
  });
  patchedHistory = summarizationResult.messages;
}
```

#### 4. Update Type Export

**File**: `src/types/core.ts`

```typescript
export interface SummarizationConfig {
  /** Whether summarization is enabled */
  enabled: boolean;
  /** Model to use for summarization */
  model?: LanguageModel;
  /** Token threshold to trigger summarization */
  tokenThreshold?: number;
  /** Number of recent messages to keep intact */
  keepMessages?: number;
}
```

### Success Criteria

**Automated**:

- [x] Summarization tests pass: `bun test test/summarization-telemetry.test.ts`

**Manual**:

- [x] Summarization calls appear in Langfuse traces
- [x] Provider options work during summarization
- [x] Generation options apply to summarization

---

## Testing Strategy

### Phase 1 Tests

**Unit Tests** (`test/telemetry-stream.test.ts`):

```typescript
test("passes experimental_telemetry", async () => { /* ... */ });
test("passes all generationOptions", async () => { /* ... */ });
test("passes all advancedOptions", async () => { /* ... */ });
test("passes output configuration", async () => { /* ... */ });
test("handles undefined options gracefully", async () => { /* ... */ });
test("merges multiple options correctly", async () => { /* ... */ });
```

### Phase 2 Tests

**Unit Tests** (`test/loopcontrol-stream.test.ts`):

```typescript
test("calls user's onStepFinish callback", async () => { /* ... */ });
test("applies custom stopWhen conditions", async () => { /* ... */ });
test("executes prepareStep before each step", async () => { /* ... */ });
test("calls onFinish after completion", async () => { /* ... */ });
test("preserves checkpointing with user callbacks", async () => { /* ... */ });
```

### Phase 3 Tests

**Unit Tests** (`test/summarization-telemetry.test.ts`):

```typescript
test("passes telemetry to summarization", async () => { /* ... */ });
test("includes provider options in summarization", async () => { /* ... */ });
test("applies generation options to summarization", async () => { /* ... */ });
test("works without telemetry options", async () => { /* ... */ });
```

### Integration Tests

**Full Telemetry Flow**:

1. Set up Langfuse with test credentials
2. Run `examples/with-langfuse.ts`
3. Verify traces for:
   - `streamWithEvents()` operations
   - `summarizeIfNeeded()` calls (when triggered)
   - All callback executions

### Manual Testing Steps

1. **Telemetry Verification**:

```bash
export LANGFUSE_SECRET_KEY=...
export LANGFUSE_PUBLIC_KEY=...
export LANGFUSE_BASEURL=...
bun examples/with-langfuse.ts
# Check Langfuse dashboard for complete trace coverage
```

2. **loopControl Verification**:

```typescript
const agent = createDeepAgent({
  model: anthropic("claude-sonnet"),
  loopControl: {
    onStepFinish: async () => console.log("Step finished!"),
    stopWhen: ({ step }) => step >= 3,
  },
});
// Verify callback executes and stop condition works
```

3. **Summarization Verification**:

```typescript
const agent = createDeepAgent({
  model: anthropic("claude-sonnet"),
  summarization: { enabled: true, tokenThreshold: 1000 },
  advancedOptions: { experimental_telemetry: { isEnabled: true } },
});
// Send long conversation to trigger summarization
```

## Performance Considerations

- **Minimal Impact**: Only adding `Object.assign()` operations (O(n) where n is small)
- **No Additional Overhead**: Options are stored as references, not copied
- **Callback Composition**: Negligible overhead from function wrapping
- **Summarization**: No performance change, just passing existing options

## Migration Notes

### Breaking Changes: None

- All changes are additive and restore expected behavior
- Existing code continues to work unchanged
- No API modifications, only internal implementation

### Backward Compatibility: Fully Compatible

- Options were always accepted but silently ignored in streaming
- Now they work as users would expect
- No deprecations needed

## Risk Assessment

### Low Risk

- Following existing patterns from `buildAgentSettings()`
- All changes are internal to implementation
- Clear separation of concerns maintained

### Mitigations

- Comprehensive test coverage for all phases
- Manual verification with Langfuse integration
- Phase-based approach allows rollback if issues arise

## Implementation Dependencies

- **Phase 1**: No dependencies
- **Phase 2**: Depends on Phase 1 (builds on same structure)
- **Phase 3**: Independent, can be done in parallel

## Related Work

- Already implemented in `buildAgentSettings()` (lines 345-381)
- Callback composition methods already exist
- Subagent implementation shows correct merging pattern

## Success Metrics

1. **Telemetry Coverage**: 100% of AI SDK calls receive telemetry options
2. **API Consistency**: Identical behavior between `generate()` and `streamWithEvents()`
3. **User Satisfaction**: No bug reports about missing options
4. **Test Coverage**: >95% coverage for all new code paths

## Rollback Plan

If issues arise:

1. Each phase can be reverted independently
2. Changes are localized to specific methods
3. No external API changes to maintain
4. Feature flags can be added if needed

## Timeline Estimate

- **Phase 1**: 2-3 days (implementation + tests)
- **Phase 2**: 3-4 days (callback composition is complex)
- **Phase 3**: 2 days (straightforward passthrough)
- **Total**: 7-9 days with testing
