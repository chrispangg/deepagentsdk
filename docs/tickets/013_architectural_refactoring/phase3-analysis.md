# Phase 3: Function Decomposition - Detailed Analysis

**Date**: 2025-12-21
**Status**: Analysis Complete, Ready for Implementation

---

## Overview

Phase 3 aims to decompose two large methods in `src/agent.ts` into smaller, focused functions to improve maintainability and testability.

---

## Current State Analysis

### streamWithEvents Method

**Location**: `src/agent.ts` lines 553-900
**Size**: ~348 lines
**Complexity**: High (async generator with multiple responsibilities)

**Current Structure**:

```typescript
async *streamWithEvents(options: StreamWithEventsOptions): AsyncGenerator<DeepAgentEvent> {
  // 1. Checkpoint Loading & Resume (lines 558-594) - ~37 lines
  // 2. Message Building & Validation (lines 596-683) - ~88 lines
  // 3. StreamText Setup & Execution (lines 684-855) - ~172 lines
  // 4. Final Checkpoint Save & Done Event (lines 807-846) - ~40 lines
  // 5. Error Handling (lines 847-856) - ~10 lines
}
```

**Key Responsibilities**:
1. Load checkpoint if threadId provided
2. Handle resume from interrupt
3. Validate input (prompt/messages/threadId)
4. Build message array with priority logic
5. Apply summarization if configured
6. Create tools with event callbacks
7. Wrap tools with approval if needed
8. Build streamText options
9. Process stream and yield events
10. Save checkpoints after steps
11. Yield final done event

### createTools Method

**Location**: `src/agent.ts` (need to find exact line)
**Current Structure**: Single method creating all tools at once
**Complexity**: Medium-High (handles multiple tool categories)

---

## Decomposition Strategy

### Approach 1: Extract Logical Sections (Recommended)

Keep `streamWithEvents` as the main generator but extract logical sections into private helper methods:

```typescript
// Private helper methods (non-generators)
private async loadCheckpointContext(
  options: StreamWithEventsOptions
): Promise<StreamContext> {
  // Extract lines 558-594 (checkpoint loading & resume)
  // Returns: { state, patchedHistory, currentStep, pendingInterrupt, checkpointEvent }
}

private async buildMessageArray(
  options: StreamWithEventsOptions,
  patchedHistory: ModelMessage[]
): Promise<{ messages: ModelMessage[], error?: ErrorEvent }> {
  // Extract lines 596-683 (message building & validation)
  // Returns: Built message array or error
}

private buildStreamTextOptions(
  messages: ModelMessage[],
  tools: ToolSet,
  baseStep: number,
  state: DeepAgentState,
  options: StreamWithEventsOptions
): StreamTextOptions {
  // Extract streamText configuration building
  // Returns: Complete streamText options object
}

// Main generator stays simple
async *streamWithEvents(options: StreamWithEventsOptions) {
  // 1. Load context
  const context = await this.loadCheckpointContext(options);
  if (context.checkpointEvent) yield context.checkpointEvent;

  // 2. Build messages
  const { messages, error } = await this.buildMessageArray(options, context.patchedHistory);
  if (error) { yield error; return; }

  // 3. Create tools
  const tools = this.createTools(context.state, onEvent);

  // 4. Build options & stream
  const streamOptions = this.buildStreamTextOptions(messages, tools, context.baseStep, context.state, options);

  // 5. Execute streaming (stays in main method - yields events)
  // ... streaming logic ...
}
```

### Approach 2: Full Decomposition (More Complex)

Create sub-generators for different phases:

```typescript
private async *loadAndYieldCheckpoint(...): AsyncGenerator<DeepAgentEvent> {
  // Checkpoint loading with events
}

private async *executeStreamingLoop(...): AsyncGenerator<DeepAgentEvent> {
  // Main streaming execution
}
```

**Trade-off**: More complex due to generator composition, harder to maintain.

---

## Recommended Implementation Plan

### Step 1: Extract loadCheckpointContext

**What to Extract**: Lines 558-594
**New Method Signature**:

```typescript
private async loadCheckpointContext(
  options: StreamWithEventsOptions
): Promise<{
  state: DeepAgentState;
  patchedHistory: ModelMessage[];
  currentStep: number;
  pendingInterrupt: InterruptData | undefined;
  checkpointEvent?: CheckpointLoadedEvent;
}> {
  const { threadId, resume } = options;
  let state: DeepAgentState = options.state || { todos: [], files: {} };
  let patchedHistory: ModelMessage[] = [];
  let currentStep = 0;
  let pendingInterrupt: InterruptData | undefined;
  let checkpointEvent: CheckpointLoadedEvent | undefined;

  if (threadId && this.checkpointer) {
    const checkpoint = await this.checkpointer.load(threadId);
    if (checkpoint) {
      state = checkpoint.state;
      patchedHistory = checkpoint.messages;
      currentStep = checkpoint.step;
      pendingInterrupt = checkpoint.interrupt;

      checkpointEvent = {
        type: "checkpoint-loaded",
        threadId,
        step: checkpoint.step,
        messagesCount: checkpoint.messages.length,
      };
    }
  }

  // Handle resume from interrupt
  if (resume && pendingInterrupt) {
    const decision = resume.decisions[0];
    if (decision?.type === 'approve') {
      pendingInterrupt = undefined;
    } else {
      pendingInterrupt = undefined;
    }
  }

  return { state, patchedHistory, currentStep, pendingInterrupt, checkpointEvent };
}
```

**Benefits**:
- Isolates checkpoint loading logic
- ~37 lines extracted
- Easy to test independently
- Clear input/output contract

**Risks**: None (straightforward extraction)

### Step 2: Extract buildMessageArray

**What to Extract**: Lines 596-683
**New Method Signature**:

```typescript
private async buildMessageArray(
  options: StreamWithEventsOptions,
  patchedHistory: ModelMessage[]
): Promise<{
  messages: ModelMessage[];
  shouldUseCheckpointHistory: boolean;
  error?: ErrorEvent;
}> {
  // Validation logic
  if (!options.prompt && !options.messages && !options.resume && !options.threadId) {
    return {
      messages: [],
      shouldUseCheckpointHistory: false,
      error: {
        type: "error",
        error: new Error("Either 'prompt', 'messages', 'resume', or 'threadId' is required"),
      },
    };
  }

  // Message building logic with priority: explicit messages > prompt > checkpoint
  let userMessages: ModelMessage[] = [];
  let shouldUseCheckpointHistory = true;

  if (options.messages && options.messages.length > 0) {
    userMessages = options.messages;
    shouldUseCheckpointHistory = false;

    if (options.prompt && process.env.NODE_ENV !== 'production') {
      console.warn('prompt parameter is deprecated when messages are provided, using messages instead');
    }
  } else if (options.messages) {
    shouldUseCheckpointHistory = false;
    patchedHistory = [];

    if (options.prompt && process.env.NODE_ENV !== 'production') {
      console.warn('prompt parameter is deprecated when empty messages are provided, prompt ignored');
    }
  } else if (options.prompt) {
    userMessages = [{ role: "user", content: options.prompt } as ModelMessage];

    if (process.env.NODE_ENV !== 'production') {
      console.warn('prompt parameter is deprecated, use messages instead');
    }
  }

  // Apply checkpoint history and summarization
  if (shouldUseCheckpointHistory && patchedHistory.length > 0) {
    patchedHistory = patchToolCalls(patchedHistory);

    if (this.summarizationConfig?.enabled && patchedHistory.length > 0) {
      const summarizationResult = await summarizeIfNeeded(patchedHistory, {
        model: this.summarizationConfig.model || this.model,
        tokenThreshold: this.summarizationConfig.tokenThreshold,
        keepMessages: this.summarizationConfig.keepMessages,
      });
      patchedHistory = summarizationResult.messages;
    }
  } else if (!shouldUseCheckpointHistory) {
    patchedHistory = [];
  }

  // Validate we have input
  const hasEmptyMessages = options.messages && options.messages.length === 0;
  const hasValidInput = userMessages.length > 0 || patchedHistory.length > 0;

  if (hasEmptyMessages && !hasValidInput && !options.resume) {
    return {
      messages: [],
      shouldUseCheckpointHistory: false,
      error: undefined, // This is a no-op case, handled by caller
    };
  }

  if (!hasValidInput && !options.resume) {
    return {
      messages: [],
      shouldUseCheckpointHistory: false,
      error: {
        type: "error",
        error: new Error("No valid input: provide either non-empty messages, prompt, or threadId with existing checkpoint"),
      },
    };
  }

  const inputMessages: ModelMessage[] = [...patchedHistory, ...userMessages];
  return { messages: inputMessages, shouldUseCheckpointHistory };
}
```

**Benefits**:
- Isolates complex message building logic
- ~88 lines extracted
- Easier to understand and test
- Clear validation logic

**Risks**: Low (well-defined input/output)

### Step 3: Extract buildStreamTextOptions

**What to Extract**: Lines ~710-775 (streamText options configuration)
**New Method Signature**:

```typescript
private buildStreamTextOptions(
  messages: ModelMessage[],
  tools: ToolSet,
  baseStep: number,
  state: DeepAgentState,
  options: StreamWithEventsOptions,
  eventQueue: DeepAgentEvent[]
): Parameters<typeof streamText>[0] {
  const streamOptions: Parameters<typeof streamText>[0] = {
    model: this.model,
    messages,
    tools,
    stopWhen: stepCountIs(options.maxSteps ?? this.maxSteps),
    abortSignal: options.abortSignal,
    onStepFinish: async ({ toolCalls, toolResults }) => {
      // Step finish logic (remains here due to eventQueue access)
      stepNumber++;
      const cumulativeStep = baseStep + stepNumber;

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

      if (options.threadId && this.checkpointer) {
        const checkpoint: Checkpoint = {
          threadId: options.threadId,
          step: cumulativeStep,
          messages,
          state: { ...state },
          interrupt: undefined,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };
        await this.checkpointer.save(checkpoint);

        eventQueue.push({
          type: "checkpoint-saved",
          threadId: options.threadId,
          step: cumulativeStep,
        });
      }
    },
  };

  // Add system prompt with optional caching
  if (this.enablePromptCaching) {
    streamOptions.messages = [
      {
        role: "system",
        content: this.systemPrompt,
        providerOptions: {
          anthropic: { cacheControl: { type: "ephemeral" } },
        },
      } as ModelMessage,
      ...messages,
    ];
  } else {
    streamOptions.system = this.systemPrompt;
  }

  return streamOptions;
}
```

**Note**: The `onStepFinish` callback needs access to `eventQueue` which is local to `streamWithEvents`, so this might need to be passed as a parameter or kept inline.

**Benefits**:
- Isolates configuration building
- ~60 lines extracted
- Clearer separation of concerns

**Risks**: Medium (onStepFinish callback has closure dependencies)

### Step 4: Keep Streaming Logic in Main Method

The actual streaming loop (lines ~780-856) should **stay in streamWithEvents** because:
1. It's the core generator logic (yields events)
2. It has complex control flow (for await loops, event queue management)
3. Moving it would make code harder to follow

**Simplified Main Method After Extraction**:

```typescript
async *streamWithEvents(options: StreamWithEventsOptions): AsyncGenerator<DeepAgentEvent> {
  // 1. Load checkpoint context
  const context = await this.loadCheckpointContext(options);
  if (context.checkpointEvent) {
    yield context.checkpointEvent;
  }

  // 2. Build message array
  const messageResult = await this.buildMessageArray(options, context.patchedHistory);
  if (messageResult.error) {
    yield messageResult.error;
    return;
  }

  // Special case: empty messages no-op
  const hasEmptyMessages = options.messages && options.messages.length === 0;
  const hasValidInput = messageResult.messages.length > 0;
  if (hasEmptyMessages && !hasValidInput && !options.resume) {
    yield {
      type: "done",
      text: "",
      messages: [],
      state: context.state,
    };
    return;
  }

  // 3. Setup event queue and tools
  const eventQueue: DeepAgentEvent[] = [];
  const onEvent: EventCallback = (event) => { eventQueue.push(event); };
  let tools = this.createTools(context.state, onEvent);

  // 4. Wrap tools with approval if configured
  if (this.interruptOn && options.onApprovalRequest) {
    tools = wrapToolsWithApproval(tools, this.interruptOn, options.onApprovalRequest);
  }

  // 5. Build stream options
  let stepNumber = 0;
  const streamOptions = this.buildStreamTextOptions(
    messageResult.messages,
    tools,
    context.currentStep,
    context.state,
    options,
    eventQueue
  );

  // 6. Execute streaming (KEEP THIS IN MAIN METHOD)
  try {
    const result = streamText(streamOptions);
    yield { type: "step-start", stepNumber: 1 };

    for await (const chunk of result.textStream) {
      // Yield queued events
      while (eventQueue.length > 0) {
        const event = eventQueue.shift()!;
        yield event;

        if (event.type === "step-finish") {
          yield { type: "step-start", stepNumber: event.stepNumber + 1 };
        }
      }

      // Yield text chunk
      if (chunk) {
        yield { type: "text", text: chunk };
      }
    }

    // Yield remaining events
    while (eventQueue.length > 0) {
      yield eventQueue.shift()!;
    }

    // Get final text and build response
    const finalText = await result.text;
    const updatedMessages: ModelMessage[] = [
      ...messageResult.messages,
      { role: "assistant", content: finalText } as ModelMessage,
    ];

    const output = 'output' in result ? (result as { output: unknown }).output : undefined;

    yield {
      type: "done",
      state: context.state,
      text: finalText,
      messages: updatedMessages,
      ...(output !== undefined ? { output } : {}),
    };

    // Final checkpoint save
    if (options.threadId && this.checkpointer) {
      const finalCheckpoint: Checkpoint = {
        threadId: options.threadId,
        step: context.currentStep + stepNumber,
        messages: updatedMessages,
        state: context.state,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      await this.checkpointer.save(finalCheckpoint);

      yield {
        type: "checkpoint-saved",
        threadId: options.threadId,
        step: context.currentStep + stepNumber,
      };
    }
  } catch (error) {
    yield {
      type: "error",
      error: error as Error,
    };
  }
}
```

**Result**: ~180 lines (down from ~348 lines) - 48% reduction
**Extracted**: ~168 lines into 3 helper methods
**Maintainability**: Significantly improved

---

## createTools Refactoring

### Current Structure

Need to locate and analyze current `createTools` method.

### Proposed Structure

```typescript
private createTools(state: DeepAgentState, onEvent?: EventCallback): ToolSet {
  const tools: ToolSet = {};

  // Core tools (always included)
  Object.assign(tools, this.createCoreTools(state, onEvent));

  // Web tools (if enabled)
  if (this.includeWebTools) {
    Object.assign(tools, this.createWebToolSet(state, onEvent));
  }

  // Execute tool (if sandbox backend)
  if (this.sandboxBackend) {
    Object.assign(tools, this.createExecuteToolSet(state, onEvent));
  }

  // Subagent tools (if subagents configured)
  if (this.subagents.length > 0 || this.includeGeneralPurposeAgent) {
    Object.assign(tools, this.createSubagentToolSet(state, onEvent));
  }

  // Custom tools (user-provided)
  if (this.customTools) {
    Object.assign(tools, this.customTools);
  }

  return tools;
}

private createCoreTools(state: DeepAgentState, onEvent?: EventCallback): ToolSet {
  return {
    write_todos: createTodosTool(state, onEvent),
    ...createFilesystemTools(state, {
      backend: this.backend,
      onEvent,
      toolResultEvictionLimit: this.toolResultEvictionLimit,
    }),
  };
}

private createWebToolSet(state: DeepAgentState, onEvent?: EventCallback): ToolSet {
  return createWebTools(state, {
    backend: this.backend,
    onEvent,
    toolResultEvictionLimit: this.toolResultEvictionLimit,
  });
}

private createExecuteToolSet(state: DeepAgentState, onEvent?: EventCallback): ToolSet {
  return {
    execute: createExecuteTool(this.sandboxBackend!, onEvent),
  };
}

private createSubagentToolSet(state: DeepAgentState, onEvent?: EventCallback): ToolSet {
  // Extract subagent tool creation logic
  return {
    task: createSubagentTool(/* ... */),
  };
}
```

---

## Testing Strategy

After each extraction:

1. Run full test suite:
   ```bash
   bun test
   ```

2. Run architectural refactoring tests specifically:
   ```bash
   bun test test/architecture/architectural-refactoring.test.ts
   ```

3. Verify type checking:
   ```bash
   bun run typecheck
   ```

4. Test manually with examples:
   ```bash
   bun examples/basic.ts
   bun examples/streaming.ts
   ```

---

## Implementation Checklist

### streamWithEvents Decomposition

- [ ] Extract `loadCheckpointContext()` private method
  - [ ] Write extraction
  - [ ] Update `streamWithEvents` to use it
  - [ ] Run tests
  - [ ] Commit

- [ ] Extract `buildMessageArray()` private method
  - [ ] Write extraction
  - [ ] Update `streamWithEvents` to use it
  - [ ] Run tests
  - [ ] Commit

- [ ] Extract `buildStreamTextOptions()` private method
  - [ ] Write extraction (note: onStepFinish complexity)
  - [ ] Update `streamWithEvents` to use it
  - [ ] Run tests
  - [ ] Commit

- [ ] Verify final streamWithEvents is ~180 lines
- [ ] Run full test suite
- [ ] Update documentation

### createTools Decomposition

- [ ] Locate current `createTools` method
- [ ] Extract `createCoreTools()` private method
- [ ] Extract `createWebToolSet()` private method
- [ ] Extract `createExecuteToolSet()` private method
- [ ] Extract `createSubagentToolSet()` private method
- [ ] Update main `createTools` to use extracted methods
- [ ] Run tests after each extraction
- [ ] Commit

---

## Success Criteria

- [ ] streamWithEvents reduced from ~348 lines to ~180 lines
- [ ] 3-4 new private helper methods created for streamWithEvents
- [ ] createTools organized into 4-5 category-specific methods
- [ ] All tests passing (227/227)
- [ ] No performance regressions
- [ ] Code easier to read and understand
- [ ] Each extracted method has clear responsibility

---

## Risks & Mitigations

**Risk**: Breaking existing functionality
**Mitigation**: Extract one method at a time, test after each extraction

**Risk**: Generator composition complexity
**Mitigation**: Keep streaming logic in main method, only extract non-generator helpers

**Risk**: Closure dependencies (e.g., eventQueue, stepNumber)
**Mitigation**: Pass as parameters or keep logic inline if too complex

**Risk**: Performance impact from additional function calls
**Mitigation**: Minimal - extracted methods are called once per stream, not per event

---

## Estimated Effort

- **streamWithEvents decomposition**: 3-4 hours
- **createTools decomposition**: 1-2 hours
- **Testing and verification**: 1 hour
- **Total**: 5-7 hours

---

## Next Steps

1. Implement `loadCheckpointContext()` extraction
2. Test and commit
3. Implement `buildMessageArray()` extraction
4. Test and commit
5. Implement `buildStreamTextOptions()` extraction
6. Test and commit
7. Implement createTools refactoring
8. Test and commit
9. Update documentation
10. Run validation

---

**Status**: Ready for implementation
**Blocker**: None
**Dependencies**: None
