---
title: Research
date: 2025-12-20 10:32:00 AEDT
researcher: claude-sonnet-4-5-20251001
git_commit: d8cff28e51a84bf19436e47fedba27240673d0ac
branch: main
repository: chrispangg/ai-sdk-deepagent
topic: "Validation of DeepAgentOptions.messages bug - messages parameter is ignored"
tags: [research, bug-validation, ai-sdk, messages, deep-agent]
status: complete
last_updated: 2025-12-20
last_updated_by: claude-sonnet-4-5-20251001
---

## Research Question

Investigate the critical bug mentioned in `.agent/PROJECT-STATE.md` regarding `DeepAgentOptions.messages` implementation - specifically whether the `messages` parameter is being ignored in the DeepAgent implementation.

## Summary

**BUG VALIDATED**: The `messages` parameter in `StreamWithEventsOptions` is indeed defined but completely ignored in the implementation. This is a valid critical bug that breaks standard AI SDK v6 patterns where users expect to pass conversation history via a `messages` parameter. The library only supports checkpoint-based persistence through `threadId` and `checkpointer`, forcing users into a specific persistence pattern.

## Detailed Findings

### 1. Messages Parameter Definition vs Implementation

#### **Type Definition** (confirmed)

- **File**: `src/types.ts:1578-1579`
- **Interface**: `StreamWithEventsOptions`
- **Property**: `messages?: ModelMessage[]` with descriptive comment: "Conversation history for multi-turn conversations"
- **Status**: Properly defined and documented

#### **Implementation Issue** (bug confirmed)

- **File**: `src/agent.ts:553` (streamWithEvents method signature)
- **Problem**: Method accepts `StreamWithEventsOptions` but **completely ignores** `options.messages`
- **Line 622-625**: Messages are built only from checkpoint history:

  ```typescript
  const inputMessages: ModelMessage[] = [
    ...patchedHistory,    // Only from checkpoint resumption
    ...(prompt ? [{ role: "user", content: prompt }] : []),
  ];
  ```

- **Missing**: No code checks `if (options.messages)` to incorporate explicit messages

### 2. Current Message Handling Architecture

#### **Checkpoint-Based Pattern Only**

- **Primary method**: `threadId` + `checkpointer` for conversation persistence
- **File**: `src/agent.ts:564-580` - checkpoint loading logic
- **Limitation**: Users cannot pass explicit conversation history without using checkpoints

#### **Event-Based History Return**

- **File**: `src/agent.ts:762` - done event includes `messages` property
- **Pattern**: Users can capture `event.messages` for next turn
- **Works**: But requires manual state management by users

### 3. AI SDK v6 Pattern Compliance

#### **Standard AI SDK v6 Pattern** (not supported)

```typescript
// Expected pattern (doesn't work in this library):
const response = await agent.streamWithEvents({
  prompt: "What do you think?",
  messages: [
    { role: "user", content: "Hello" },
    { role: "assistant", content: "Hi there!" }
  ]
});
```

#### **Current Workaround** (requires checkpoints)

```typescript
// Only supported pattern:
let messages: ModelMessage[] = [];
for await (const event of agent.streamWithEvents({ prompt: "First message" })) {
  if (event.type === 'done') {
    messages = event.messages || [];
  }
}
// Next turn with context
for await (const event of agent.streamWithEvents({ prompt: "Follow up" })) {
  // Manual message management required
}
```

### 4. Impact Assessment

#### **User Experience Impact**

- **Breaking expectation**: Standard AI SDK v6 pattern doesn't work
- **Silent failure**: No error when `messages` is passed, it's just ignored
- **Forced architecture**: Must use checkpoint-based persistence even for simple use cases

#### **Technical Impact**

- **Inconsistent API**: Other AI SDK libraries support `messages` parameter
- **Limited flexibility**: Cannot inject conversation history programmatically
- **Testing difficulty**: Hard to test with specific conversation contexts

### 5. Implementation Path (Identified)

#### **Required Changes**

- **File**: `src/agent.ts:608-625` (in `streamWithEvents` method)
- **Add logic**: Check `options.messages` and use it as base for `patchedHistory`
- **Preserve**: Existing checkpoint functionality as alternative
- **Priority**: Should use explicit messages over checkpoint when both provided

#### **Example Fix**

```typescript
// Around line 608 in streamWithEvents method:
if (options.messages) {
  // Use explicit messages instead of checkpoint history
  patchedHistory = options.messages;
} else if (checkpoint) {
  // Use checkpoint history as fallback
  patchedHistory = checkpoint.messages;
}
```

### 6. Related Components

#### **Type System** (ready)

- `ModelMessage` type: Re-exported from "ai" package (src/types.ts:18)
- Standard AI SDK v6 message format
- No changes needed

#### **Message Processing** (reusable)

- `patchToolCalls()` function: Handles dangling tool calls
- `summarizeIfNeeded()` function: Manages long conversations
- Both functions work with any `ModelMessage[]` array

## Code References

- **Bug location**: `src/agent.ts:622-625` - Messages array construction ignores `options.messages`
- **Type definition**: `src/types.ts:1578-1579` - `messages` property properly defined
- **Method signature**: `src/agent.ts:553` - Accepts `StreamWithEventsOptions` but doesn't use messages
- **Checkpoint logic**: `src/agent.ts:564-580` - Only source of conversation history
- **Event return**: `src/agent.ts:762` - Returns updated messages in done event

## Architecture Documentation

### Current Message Flow

1. **Input**: Only checkpoint-based history OR single prompt
2. **Processing**: Apply tool call patches, optionally summarize
3. **AI SDK**: Pass to `streamText()` with standard messages format
4. **Output**: Return updated messages in done event
5. **Missing**: Explicit `messages` parameter support

### AI SDK v6 Integration

- **Current**: Uses `streamText()` directly from AI SDK v6
- **Planned**: Migration to `ToolLoopAgent` (commented in code)
- **Compatibility**: Standard `ModelMessage[]` format already used

## Historical Context

### Bug Documentation

- **Tracked**: `.agent/PROJECT-STATE.md:45-50` - Listed as critical bug with detailed explanation
- **Impact**: "Users expect to pass conversation history via `messages` parameter (standard AI SDK pattern), but it's silently ignored"
- **Workaround**: "Manually prepend message history to prompt or use checkpointer"

### Implementation Notes

- **Library design**: Wraps AI SDK v6's ToolLoopAgent with additional state management
- **Architecture**: Four pillars - planning tools, virtual filesystem, subagent spawning, detailed prompting
- **Goal**: Provide LangChain DeepAgents functionality using AI SDK v6

## Related Research

### AI SDK v6 Patterns

- **Standard**: `messages` parameter widely supported across AI SDK tools
- **Format**: `ModelMessage[]` from "ai" package
- **Usage**: Multi-turn conversations, context injection, testing scenarios

### Alternative Implementations

- **Checkpointer system**: Works but requires specific persistence architecture
- **Manual management**: Users must track messages across turns manually
- **Hybrid approach**: Should support both patterns for flexibility

## Open Questions

1. **Priority**: This is documented as "Critical" - what's the timeline for fixing?
2. **Breaking changes**: Fix should be non-breaking (add functionality, don't remove existing)
3. **Testing**: Need tests for both explicit messages and checkpoint scenarios
4. **Documentation**: Update examples to show both patterns once fixed

## Conclusion

**BUG CONFIRMED**: The `messages` parameter in `StreamWithEventsOptions` is defined but completely ignored in the implementation. This is a valid critical bug that:

1. Breaks standard AI SDK v6 patterns that users expect
2. Forces users into checkpoint-based persistence unnecessarily
3. Has a straightforward implementation path identified
4. Should be prioritized as documented in PROJECT-STATE.md

The fix is relatively simple: check for `options.messages` and use it as the conversation history base, while preserving existing checkpoint functionality as an alternative approach.
