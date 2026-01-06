---
title: 014 Telemetry StreamwithEvents
date: 2025-12-22 08:27:51 AEDT
researcher: Claude Code
git_commit: 706dba5bc7b0b985a52ac9e06d2f7a5e8a257d07
branch: main
repository: deepagentsdk
topic: Telemetry not sent to Langfuse when using streamWithEvents
tags: [research, telemetry, streamWithEvents, langfuse, observability, validation]
status: validated
last_updated: 2025-12-22
last_updated_by: Claude Code
last_updated_note: "Added validation review confirming research accuracy and identifying additional gaps"
---

## Research Question

Telemetry is sent to Langfuse when using `agent.generate()`, but not when using `agent.streamWithEvents()`. The user suspects that `experimental_telemetry: { isEnabled: true }` is not being passed to the stream function when using `streamWithEvents`.

## Summary

The investigation confirms the user's suspicion. The issue is that `buildStreamTextOptions()` method (used by `streamWithEvents()`) does not include `advancedOptions` (which contains `experimental_telemetry`), while `buildAgentSettings()` method (used by `generate()`) does include them.

**Root Cause**:

- `generate()` method uses `createAgent()` → `buildAgentSettings()` which includes `advancedOptions` (lines 358-360 in `src/agent.ts`)
- `streamWithEvents()` method calls `buildStreamTextOptions()` directly, which does NOT include `advancedOptions` or `generationOptions`

**Impact**: Telemetry options configured via `advancedOptions.experimental_telemetry` are not passed to `streamText()` when using `streamWithEvents()`, causing Langfuse traces to not be generated for streaming operations.

## Detailed Findings

### 1. How `generate()` Passes Telemetry Options

**Implementation Flow** (`src/agent.ts:424-443`):

```typescript
  async generate(options: { prompt: string; maxSteps?: number }) {
    // Create fresh state for this invocation
    const state: DeepAgentState = {
      todos: [],
      files: {},
    };

    const agent = this.createAgent(state, options.maxSteps);
    const result = await agent.generate({ prompt: options.prompt });

    // Return result with state attached
    // Note: We attach state as a property to preserve getters on result
    Object.defineProperty(result, 'state', {
      value: state,
      enumerable: true,
      writable: false,
    });

    return result as typeof result & { state: DeepAgentState };
  }
```

**Key Steps**:

1. `generate()` calls `this.createAgent(state, options.maxSteps)` (line 431)
2. `createAgent()` calls `buildAgentSettings()` (line 391)
3. `buildAgentSettings()` includes `advancedOptions` via `Object.assign(settings, this.advancedOptions)` (lines 358-360)

**buildAgentSettings() Implementation** (`src/agent.ts:345-381`):

```typescript
  private buildAgentSettings(onEvent?: EventCallback) {
    const settings: any = {
      model: this.model,
      instructions: this.systemPrompt,
      tools: undefined, // Will be set by caller
    };

    // Add generation options if provided
    if (this.generationOptions) {
      Object.assign(settings, this.generationOptions);
    }

    // Add advanced options if provided
    if (this.advancedOptions) {
      Object.assign(settings, this.advancedOptions);
    }

    // Add composed loop control callbacks if provided
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

    // Add output configuration if provided using AI SDK Output helper
    if (this.outputConfig) {
      settings.output = Output.object(this.outputConfig);
    }

    return settings;
  }
```

**createAgent() Implementation** (`src/agent.ts:389-399`):

```typescript
  private createAgent(state: DeepAgentState, maxSteps?: number, onEvent?: EventCallback) {
    const tools = this.createTools(state, onEvent);
    const settings = this.buildAgentSettings(onEvent);
    const stopConditions = this.buildStopConditions(maxSteps);

    return new ToolLoopAgent({
      ...settings,
      tools,
      stopWhen: stopConditions,
    });
  }
```

**Result**: When `agent.generate()` is called, the `ToolLoopAgent` instance receives `experimental_telemetry` from `advancedOptions`, enabling telemetry collection.

### 2. How `streamWithEvents()` Handles Telemetry Options

**Implementation Flow** (`src/agent.ts:850-1001`):

```typescript
  async *streamWithEvents(
    options: StreamWithEventsOptions
  ): AsyncGenerator<DeepAgentEvent, void, unknown> {
    const { threadId, resume } = options;

    // Load checkpoint context (state, history, step tracking)
    const context = await this.loadCheckpointContext(options);
    const { state, currentStep, pendingInterrupt, checkpointEvent } = context;
    let patchedHistory = context.patchedHistory; // Mutable - may be reassigned during message building

    // Yield checkpoint-loaded event if checkpoint was restored
    if (checkpointEvent) {
      yield checkpointEvent;
    }

    // Build message array with validation and priority logic
    const messageResult = await this.buildMessageArray(options, patchedHistory);

    // Handle error cases
    if (messageResult.error) {
      yield messageResult.error;
      return;
    }

    // Handle empty messages no-op case
    if (messageResult.shouldReturnEmpty) {
      yield {
        type: "done",
        text: "",
        messages: [],
        state,
      };
      return;
    }

    // Extract results
    const inputMessages = messageResult.messages;
    patchedHistory = messageResult.patchedHistory;

    // Event queue for collecting events from tool executions
    const eventQueue: DeepAgentEvent[] = [];
    const stepNumberRef = { value: 0 }; // Mutable reference for stepNumber
    const baseStep = currentStep; // Cumulative step from checkpoint

    // Event callback that tools will use to emit events
    const onEvent: EventCallback = (event) => {
      eventQueue.push(event);
    };

    // Create tools with event callback
    let tools = this.createTools(state, onEvent);

    // Wrap tools with approval checking if interruptOn is configured and callback provided
    // This intercepts tool execution and requests approval before running
    const hasInterruptOn = !!this.interruptOn;
    const hasApprovalCallback = !!options.onApprovalRequest;

    if (hasInterruptOn && hasApprovalCallback) {
      tools = wrapToolsWithApproval(tools, this.interruptOn, options.onApprovalRequest);
    }

    try {
      // Build streamText options with callbacks
      const streamOptions = this.buildStreamTextOptions(
        inputMessages,
        tools,
        options,
        state,
        baseStep,
        pendingInterrupt,
        eventQueue,
        stepNumberRef
      );

      // Use streamText with messages array for conversation history
      const result = streamText(streamOptions);
```

**Key Steps**:

1. `streamWithEvents()` calls `this.buildStreamTextOptions()` directly (line 913)
2. `buildStreamTextOptions()` does NOT include `advancedOptions` or `generationOptions`
3. The resulting `streamOptions` are passed to `streamText()` (line 925)

**buildStreamTextOptions() Implementation** (`src/agent.ts:603-680`):

```typescript
  private buildStreamTextOptions(
    inputMessages: ModelMessage[],
    tools: ToolSet,
    options: StreamWithEventsOptions,
    state: DeepAgentState,
    baseStep: number,
    pendingInterrupt: InterruptData | undefined,
    eventQueue: DeepAgentEvent[],
    stepNumberRef: { value: number }
  ): Parameters<typeof streamText>[0] {
    const { threadId } = options;

    const streamOptions: Parameters<typeof streamText>[0] = {
      model: this.model,
      messages: inputMessages,
      tools,
      stopWhen: stepCountIs(options.maxSteps ?? this.maxSteps),
      abortSignal: options.abortSignal,
      onStepFinish: async ({ toolCalls, toolResults }) => {
        stepNumberRef.value++;
        const cumulativeStep = baseStep + stepNumberRef.value;

        // Emit step finish event (relative step number)
        const stepEvent: DeepAgentEvent = {
          type: "step-finish",
          stepNumber: stepNumberRef.value,
          toolCalls: toolCalls.map((tc, i) => ({
            toolName: tc.toolName,
            args: "input" in tc ? tc.input : undefined,
            result: toolResults[i] ? ("output" in toolResults[i] ? toolResults[i].output : undefined) : undefined,
          })),
        };
        eventQueue.push(stepEvent);

        // Save checkpoint if configured
        if (threadId && this.checkpointer) {
          // Get current messages state - we need to track messages as they're built
          // For now, we'll save with the input messages (will be updated after assistant response)
          const checkpoint: Checkpoint = {
            threadId,
            step: cumulativeStep, // Cumulative step number
            messages: inputMessages, // Current messages before assistant response
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
      },
    };

    // Add system prompt with optional caching for Anthropic models
    if (this.enablePromptCaching) {
      // Use messages format with cache control for Anthropic
      streamOptions.messages = [
        {
          role: "system",
          content: this.systemPrompt,
          providerOptions: {
            anthropic: { cacheControl: { type: "ephemeral" } },
          },
        } as ModelMessage,
        ...inputMessages,
      ];
    } else {
      // Use standard system prompt
      streamOptions.system = this.systemPrompt;
    }

    return streamOptions;
  }
```

**Missing Components**:

- `buildStreamTextOptions()` only sets: `model`, `messages`, `tools`, `stopWhen`, `abortSignal`, `onStepFinish`, `system`
- It does NOT include:
  - `this.generationOptions` (temperature, maxRetries, etc.)
  - `this.advancedOptions` (experimental_telemetry, providerOptions, etc.)

**Result**: When `agent.streamWithEvents()` is called, `streamText()` does not receive `experimental_telemetry` from `advancedOptions`, preventing telemetry collection.

### 3. Advanced Options Structure

**Type Definition** (`src/types/core.ts:148-159`):

```typescript
export interface AdvancedAgentOptions {
  /** OpenTelemetry configuration for observability. */
  experimental_telemetry?: ToolLoopAgentSettings["experimental_telemetry"];
  /** Provider-specific options passed through to the model provider. */
  providerOptions?: ToolLoopAgentSettings["providerOptions"];
  /** Custom context passed to tool executions. */
  experimental_context?: ToolLoopAgentSettings["experimental_context"];
  /** Control which tool the model should call. */
  toolChoice?: ToolLoopAgentSettings["toolChoice"];
  /** Limit which tools are available for the model to call. */
  activeTools?: ToolLoopAgentSettings["activeTools"];
}
```

**Storage in DeepAgent** (`src/agent.ts:113-167`):

```typescript
  // AI SDK ToolLoopAgent passthrough options
  private loopControl?: CreateDeepAgentParams["loopControl"];
  private generationOptions?: CreateDeepAgentParams["generationOptions"];
  private advancedOptions?: CreateDeepAgentParams["advancedOptions"];

  constructor(params: CreateDeepAgentParams) {
    const {
      model,
      middleware,
      tools = {},
      systemPrompt,
      subagents = [],
      backend,
      maxSteps = 100,
      includeGeneralPurposeAgent = true,
      toolResultEvictionLimit,
      enablePromptCaching = false,
      summarization,
      interruptOn,
      checkpointer,
      skillsDir,
      agentId,
      output,
      loopControl,
      generationOptions,
      advancedOptions,
    } = params;

    // ... model wrapping logic ...

    // Store AI SDK passthrough options
    this.loopControl = loopControl;
    this.generationOptions = generationOptions;
    this.advancedOptions = advancedOptions;
```

The `advancedOptions` are stored as a private field and should be included in options passed to AI SDK functions.

### 4. Example Usage Pattern

**Example File** (`examples/with-langfuse.ts:67-100`):

```typescript
async function streamingWithTelemetryExample() {
  console.log("📊 Example 3: Streaming with Telemetry\n");

  const agent = createDeepAgent({
    model: anthropic("claude-haiku-4-5-20251001"),
    systemPrompt: `You are a creative writer. Write engaging short content.`,
    advancedOptions: {
      experimental_telemetry: { isEnabled: true },
    },
  });

  console.log("Streaming response:\n");

  // Use streamWithEvents for real-time streaming with full telemetry
  for await (const event of agent.streamWithEvents({
    messages: [{ role: "user", content: "Write a haiku about programming." }],
    maxSteps: 2,
  })) {
    switch (event.type) {
      case "text":
        process.stdout.write(event.text);
        break;
      case "step-finish":
        console.log(`\n[Step ${event.stepNumber} completed]`);
        break;
      case "done":
        console.log("\n\n✅ Stream completed, telemetry sent to Langfuse\n");
        break;
      case "error":
        console.error("\n❌ Error:", event.error);
        break;
    }
  }
}
```

The user correctly configures `experimental_telemetry: { isEnabled: true }` in `advancedOptions`, but it is not passed through to `streamText()`.

## Code References

- `src/agent.ts:345-381` - `buildAgentSettings()` method (includes `advancedOptions`)
- `src/agent.ts:389-399` - `createAgent()` method (uses `buildAgentSettings()`)
- `src/agent.ts:424-443` - `generate()` method (uses `createAgent()`)
- `src/agent.ts:603-680` - `buildStreamTextOptions()` method (does NOT include `advancedOptions`)
- `src/agent.ts:850-925` - `streamWithEvents()` method (uses `buildStreamTextOptions()`)
- `src/types/core.ts:148-159` - `AdvancedAgentOptions` interface definition
- `examples/with-langfuse.ts:67-100` - Example showing telemetry configuration

## Architecture Documentation

### Current Pattern

**Two Different Code Paths**:

1. **Non-streaming (`generate()`)**:
   - Uses `ToolLoopAgent` wrapper
   - Settings built via `buildAgentSettings()`
   - Includes all passthrough options (`generationOptions`, `advancedOptions`)

2. **Streaming (`streamWithEvents()`)**:
   - Calls `streamText()` directly
   - Options built via `buildStreamTextOptions()`
   - Missing passthrough options (`generationOptions`, `advancedOptions`)

### Design Inconsistency

The codebase has an architectural inconsistency where:

- `generate()` uses a higher-level abstraction (`ToolLoopAgent`) that automatically includes all settings
- `streamWithEvents()` uses a lower-level function (`streamText()`) and manually builds options, but incompletely

This inconsistency causes the telemetry passthrough to work for `generate()` but not for `streamWithEvents()`.

## Historical Context

Based on research documents:

- `docs/tickets/008_tool_loop_agent_passthrough/research.md` - Documents the passthrough of options to `ToolLoopAgent`, including `experimental_telemetry`
- `docs/tickets/011_provider_options_passthrough/research.md` - Documents how `advancedOptions` are structured and passed through

The passthrough mechanism was designed to work with `ToolLoopAgent`, but `streamWithEvents()` bypasses this abstraction and calls `streamText()` directly.

## Related Research

- `docs/tickets/008_tool_loop_agent_passthrough/` - ToolLoopAgent passthrough implementation
- `docs/tickets/011_provider_options_passthrough/` - Provider options passthrough research

## Open Questions

None - the root cause has been identified and documented.

## Conclusion

The user's suspicion is correct. The `buildStreamTextOptions()` method does not include `advancedOptions` (which contains `experimental_telemetry`), while `buildAgentSettings()` does. This causes telemetry to work for `generate()` but not for `streamWithEvents()`.

**Recommended Fix**: Modify `buildStreamTextOptions()` to include `generationOptions` and `advancedOptions` similar to how `buildAgentSettings()` does it (lines 353-360).

---

## Follow-up Research: Validation Review [2025-12-22 09:19 AEDT]

### Validation Objective

Review and validate the research findings and implementation plan to ensure they are:

1. Accurate and complete
2. Ready for test case generation
3. Comprehensive in identifying all affected code paths

### Validation Results Summary

| Aspect | Status | Notes |
|--------|--------|-------|
| Root Cause Analysis | ✅ CONFIRMED | All 6 verification points validated against codebase |
| Line Number References | ✅ ACCURATE | Line 659 is correct insertion point |
| Code Path Analysis | ✅ COMPLETE | Both paths (generate vs streamWithEvents) documented correctly |
| Plan Implementation Approach | ✅ CORRECT | Matches existing `buildAgentSettings()` pattern |
| Additional Gaps Found | ⚠️ GAPS IDENTIFIED | See details below |

### Detailed Validation Findings

#### 1. Root Cause Verification (All Confirmed)

| Verification Point | Status | Evidence |
|-------------------|--------|----------|
| `buildAgentSettings()` includes passthrough options | ✅ | Lines 354, 359 use `Object.assign()` |
| `buildStreamTextOptions()` LACKS passthrough options | ✅ | Lines 603-680 missing these assignments |
| Line ~659 is correct insertion point | ✅ | After `onStepFinish` callback, before system prompt handling |
| `createAgent()` uses `buildAgentSettings()` | ✅ | Line 391 |
| `generate()` uses `createAgent()` | ✅ | Line 431 |
| `streamWithEvents()` calls `buildStreamTextOptions()` | ✅ | Line 913 |

#### 2. Plan Implementation Approach (Validated)

The plan correctly identifies the fix pattern:

```typescript
// After line 659, before line 662 (system prompt handling)

// Add generation options if provided
if (this.generationOptions) {
  Object.assign(streamOptions, this.generationOptions);
}

// Add advanced options if provided
if (this.advancedOptions) {
  Object.assign(streamOptions, this.advancedOptions);
}

// Add output configuration if provided
if (this.outputConfig) {
  streamOptions.output = Output.object(this.outputConfig);
}
```

**This matches the existing `buildAgentSettings()` pattern exactly** and is the correct approach.

#### 3. Options Coverage Analysis

##### Options IN the Plan (15 fields) - ✅ Complete

| Category | Fields | Plan Coverage |
|----------|--------|---------------|
| GenerationOptions | temperature, topP, topK, maxOutputTokens, presencePenalty, frequencyPenalty, seed, stopSequences, maxRetries | ✅ All 9 via Object.assign |
| AdvancedAgentOptions | experimental_telemetry, providerOptions, experimental_context, toolChoice, activeTools | ✅ All 5 via Object.assign |
| Output | outputConfig | ✅ Via Output.object() |

##### Options NOT in the Plan (4 fields from LoopControl) - ⚠️ Deferred

| Option | Current Status | Impact |
|--------|---------------|--------|
| prepareStep | NOT passed | Dynamic model/toolChoice adjustments won't work |
| onStepFinish | Custom impl, not composed | User's callback not called |
| onFinish | NOT passed | User's finalization logic not called |
| stopWhen | Only maxSteps used | User's custom stop conditions ignored |

**Plan Acknowledgment**: The plan correctly notes in "Open Questions #1" that `loopControl.onStepFinish` composition is deferred. This is acceptable for Phase 1 but should be tracked as follow-up work.

### Additional Issues Discovered

#### Issue 1: `summarizeIfNeeded()` Missing Telemetry Passthrough

**Location**: `src/utils/summarization.ts:117-137`

**Problem**: When summarization is triggered (line 752 in agent.ts), the `generateText()` call in `summarizeIfNeeded()` doesn't receive telemetry options.

```typescript
// src/utils/summarization.ts:123-134 - MISSING telemetry options
const result = await generateText({
  model,
  system: `You are a conversation summarizer...`,
  prompt: `Please summarize the following conversation:\n\n${conversationText}`,
  // Missing: experimental_telemetry, providerOptions, etc.
});
```

**Impact**: Summarization LLM calls won't appear in Langfuse traces even after the main fix is applied.

**Recommendation**: Create follow-up ticket to pass telemetry options through to summarization.

#### Issue 2: Methods Correctly Using `createAgent()` (No Issues)

The following methods correctly use `createAgent()` and don't need fixes:

- `generate()` (line 431)
- `stream()` (line 456)
- `generateWithState()` (line 483)
- `getAgent()` (line 497)

#### Issue 3: Subagent Implementation (No Issues)

The subagent tool (`src/tools/subagent.ts:312-380`) correctly merges parent and subagent options:

```typescript
// Lines 312-321 - Correctly merges options
const mergedGenerationOptions = {
  ...parentGenerationOptions,
  ...subagentSpec?.generationOptions,
};
const mergedAdvancedOptions = {
  ...parentAdvancedOptions,
  ...subagentSpec?.advancedOptions,
};
```

### Test Case Readiness Assessment

#### Ready for Test Case Generation ✅

The plan provides sufficient detail for generating the following test cases:

1. **Unit Tests**:
   - `buildStreamTextOptions()` includes `generationOptions` when provided
   - `buildStreamTextOptions()` includes `advancedOptions` when provided
   - `buildStreamTextOptions()` includes `outputConfig` when provided
   - Options merge correctly without conflicts

2. **Integration Tests**:
   - `streamWithEvents()` with `experimental_telemetry: { isEnabled: true }` completes without errors
   - Telemetry traces appear in Langfuse when running `examples/with-langfuse.ts`
   - Provider options (e.g., Anthropic cache control) work in streaming mode

3. **Edge Case Tests**:
   - Options are undefined (should not break)
   - Multiple options provided together
   - Empty options objects

#### Test Gaps to Address

1. **Telemetry Verification**: As noted in the plan, directly verifying telemetry is sent requires either:
   - Mocking the AI SDK telemetry layer
   - Integration tests with actual Langfuse credentials

2. **loopControl Tests**: Not in scope for Phase 1, but should be tracked

### Recommendations

#### Immediate (Before Implementation)

1. ✅ **Proceed with plan as-is** - The implementation approach is correct and comprehensive for the identified scope
2. ✅ **Plan is ready for test case generation** - Success criteria are clear and measurable

#### Follow-up Tickets (After Phase 1)

1. **[Medium Priority]** Create ticket for `loopControl` options passthrough:
   - Title: "Fix LoopControl Options Passthrough in streamWithEvents()"
   - Scope: prepareStep, onStepFinish composition, onFinish, stopWhen

2. **[Medium Priority]** Create ticket for summarization telemetry:
   - Title: "Pass Telemetry Options to summarizeIfNeeded()"
   - Location: `src/utils/summarization.ts`

### Validation Conclusion

| Assessment | Result |
|------------|--------|
| Research Document | ✅ **VALID AND ACCURATE** |
| Plan Document | ✅ **VALID AND READY FOR IMPLEMENTATION** |
| Test Case Readiness | ✅ **READY** - Clear success criteria defined |
| Gaps Identified | ⚠️ loopControl and summarization (documented as follow-up) |

**Final Status**: The research and plan are **validated and ready** for test case generation and implementation. The identified gaps are correctly scoped as follow-up work and do not block the primary telemetry fix.
