---
title: CLI No Response Bug Fix Implementation Plan
description: Documentation
---

## Overview

Fix the critical bug where the CLI returns nothing when the user submits their first prompt. The root cause is that an empty `messages` array is passed to `streamWithEvents`, which causes `buildMessageArray` to ignore the prompt parameter and return an empty `done` event immediately.

**Fix Strategy**: Option 1 - Conditionally pass `messages` parameter only when non-empty (minimal change).

## Current State Analysis

### Bug Location

**File**: `src/cli/hooks/useAgent.ts`
**Lines**: 650-756 (specifically line 667 and 673-677)

**Current Code**:
```typescript
// Line 141: Initial state
const [messages, setMessages] = useState<ModelMessage[]>([]);

// Line 667: Sync messages ref
messagesRef.current = messages;  // Always [] on first call

// Lines 673-677: Call streamWithEvents
for await (const event of agentRef.current.streamWithEvents({
  prompt,
  state,
  messages: messagesRef.current,  // ← BUG: Empty array passed
  threadId: options.sessionId,
  abortSignal: abortControllerRef.current.signal,
  onApprovalRequest: async (request) => { ... },
})) {
```

### Why This Causes Failure

1. On first prompt, `messages` state is `[]` (empty array)
2. `streamWithEvents` receives both `prompt: "user input"` AND `messages: []`
3. In `buildMessageArray` (agent.ts:748-767), the empty array triggers the "empty messages" branch
4. This branch ignores the `prompt` parameter entirely
5. `hasValidInput` becomes `false`
6. Returns `shouldReturnEmpty: true`
7. Stream yields `{ type: "done", text: "", messages: [] }` and ends immediately

### Key Constraint

The "empty messages = reset" semantic may be intentional for features like the `/clear` command. Our fix should preserve this behavior while fixing the first-prompt case.

## Desired End State

1. **First prompt works**: User can submit their first message and get a response
2. **Multi-turn works**: Conversation history accumulates correctly
3. **Reset still works**: `/clear` command can still reset conversation
4. **Session load works**: Checkpoint restoration works as expected

## What We're NOT Doing

- NOT changing `buildMessageArray` logic in `agent.ts` (Option 2 - deferred to future)
- NOT refactoring to only use `messages` parameter (Option 3 - larger change)
- NOT adding deprecation warnings for `prompt` parameter
- NOT changing the reset/clear behavior

## Implementation Approach

**Single-line fix**: Conditionally pass `messages` parameter to `streamWithEvents` only when it has content.

### Why This Approach

1. **Minimal Risk**: Changes only the CLI hook, doesn't affect core agent logic
2. **Preserves Semantics**: Empty array can still mean "reset" in future
3. **Easy to Revert**: Single line change
4. **Fast to Implement**: No API changes, no migration needed
5. **Isolated Impact**: Only affects `useAgent` hook callers

## Phase 1: Apply Minimal Fix

### Overview

Fix the immediate bug by conditionally passing the `messages` parameter only when non-empty.

### Changes Required

#### 1. useAgent Hook

**File**: `src/cli/hooks/useAgent.ts`
**Line**: 674

**Current Code**:
```typescript
for await (const event of agentRef.current.streamWithEvents({
  prompt,
  state,
  messages: messagesRef.current,
  threadId: options.sessionId,
  abortSignal: abortControllerRef.current.signal,
  onApprovalRequest: async (request) => {
```

**Fixed Code**:
```typescript
for await (const event of agentRef.current.streamWithEvents({
  prompt,
  state,
  messages: messagesRef.current.length > 0 ? messagesRef.current : undefined,
  threadId: options.sessionId,
  abortSignal: abortControllerRef.current.signal,
  onApprovalRequest: async (request) => {
```

**Explanation**:
- When `messagesRef.current` is empty (first prompt), pass `undefined` instead of `[]`
- This causes `buildMessageArray` to skip the "empty messages" branch
- The `prompt` parameter will be used instead, converted to a user message
- When `messagesRef.current` has content (subsequent turns), pass the array normally
- Multi-turn conversations continue to work as expected

### Success Criteria

#### Automated Verification

- [x] Type checking passes: `bun run typecheck`
- [x] No new linting errors introduced
- [x] Existing tests still pass: `bun test` (214 tests pass)

**Note**: Integration test failure is pre-existing and unrelated to this fix (verified by testing before change)

#### Manual Verification

- [ ] CLI launches without errors
- [ ] First prompt generates a response from the agent
- [ ] Multi-turn conversation works (context preserved across turns)
- [ ] `/clear` command still resets conversation
- [ ] `/help`, `/todos`, `/files` commands still work
- [ ] Error messages display correctly (e.g., missing API key)

---

## Phase 2: Add Unit Tests (Optional but Recommended)

### Overview

Add tests to prevent regression of this bug and document the expected behavior.

### Changes Required

#### 1. Test sendPrompt with Empty Messages

**File**: `test/cli/useAgent.test.ts` (create if doesn't exist)

**Test to Add**:
```typescript
import { describe, it, expect } from "bun:test";

describe("useAgent hook - sendPrompt", () => {
  it("should handle first prompt when messages state is empty", async () => {
    // Mock the agent and verify streamWithEvents is called
    // with messages: undefined instead of messages: []
    // This ensures prompt parameter is used
  });

  it("should pass messages array when conversation has history", async () => {
    // Verify that when messages state has content,
    // it's passed to streamWithEvents correctly
  });

  it("should handle reset when messages is explicitly empty", async () => {
    // If we want to support empty messages = reset,
    // test that behavior (future enhancement)
  });
});
```

**Note**: Testing React hooks requires `@testing-library/react` or similar. CLI integration testing may be more practical.

### Success Criteria

- [ ] New tests pass
- [ ] Tests document the expected behavior
- [ ] Tests would catch this bug if reintroduced

---

## Phase 3: Manual Testing Verification

### Overview

Comprehensive manual testing to ensure the fix works and doesn't break existing functionality.

### Test Scenarios

#### Scenario 1: First Prompt
1. Launch CLI: `bun run cli`
2. Observe welcome banner displays
3. Type: `hello, what can you help me with?`
4. Press Enter
5. **Expected**: Agent responds with text (streaming)
6. **Expected**: No errors in console
7. **Expected**: Status shows current model

#### Scenario 2: Multi-turn Conversation
1. After first response, type: `list all files in current directory`
2. Press Enter
3. **Expected**: Agent has context from previous turn
4. **Expected**: Tool calls execute (ls command)
5. **Expected**: Response references the conversation

#### Scenario 3: Clear Command
1. Type: `/clear`
2. Press Enter
3. **Expected**: Welcome banner reappears
4. **Expected**: History is cleared
5. Type a new prompt
6. **Expected**: Agent responds without previous context

#### Scenario 4: Error Handling
1. Unset API key: `unset ANTHROPIC_API_KEY`
2. Launch CLI: `bun run cli`
3. Type a prompt
4. **Expected**: Error message displayed about missing API key
5. **Expected**: CLI doesn't hang or crash

#### Scenario 5: Session Persistence (if available)
1. Start CLI with session: `bun run cli --session test-session`
2. Type a prompt, get response
3. Exit CLI: Ctrl+D
4. Restart CLI with same session
5. **Expected**: Conversation history is restored
6. **Expected**: Context is maintained

#### Scenario 6: All Slash Commands
Test each slash command still works:
- `/help` - Shows help
- `/todos` - Shows todo list
- `/files` - Shows files
- `/model` - Shows/changes model
- `/features` - Shows feature status
- `/tokens` - Shows token usage
- `/cache` - Toggles caching
- `/eviction` - Toggles eviction
- `/summarize` - Toggles summarization
- `/approve` - Toggles auto-approve
- `/quit` - Exits CLI

---

## Testing Strategy

### Unit Tests

**What to Test**:
- `sendPrompt` function behavior with empty vs. non-empty messages state
- Edge cases: undefined messages, empty array, array with content

**Key Edge Cases**:
- First prompt (messages = `[]`)
- Second prompt (messages has content)
- After `/clear` (messages reset to `[]`)
- After session load (messages has checkpoint history)

**Implementation Note**:
Testing React hooks requires additional setup. Consider:
- `@testing-library/react` for hook testing
- Integration tests instead of unit tests
- Manual testing as primary verification

### Integration Tests

**End-to-End Scenarios**:
1. First prompt → response received
2. Multi-turn → context preserved
3. Reset → new conversation starts
4. Missing API key → error displayed

**Test Environment**:
- Requires valid API key (ANTHROPIC_API_KEY or OPENAI_API_KEY)
- Mark as integration test (skip in CI)
- Use test model (fastest available)

### Manual Testing Steps

See Phase 3 above for detailed manual test scenarios.

---

## Performance Considerations

**Performance Impact**: None

The fix adds a single conditional check (`messagesRef.current.length > 0`) which:
- Executes once per prompt submission
- Is O(1) operation (array length check)
- Negligible compared to API call overhead
- No additional memory allocation

**No Regressions Expected**:
- StreamWithEvents behavior unchanged
- Agent execution unchanged
- Event flow unchanged
- Only parameter passing modified

---

## Migration Notes

**No Migration Required**

This is a bug fix with no API changes:
- Existing code continues to work
- No breaking changes
- No configuration changes needed
- No data migration needed

**Deployment**:
- Safe to deploy immediately
- No feature flags needed
- No gradual rollout required

---

## Future Improvements (Out of Scope)

### Option 2: Fix buildMessageArray Priority Logic

**Rationale**: The root cause is in `agent.ts:buildMessageArray` which has ambiguous priority handling.

**Proposed Change** (for future):
```typescript
// In agent.ts:748-775
if (options.messages && options.messages.length > 0) {
  // Use explicit messages array
} else if (options.prompt) {
  // Prompt takes priority over empty messages (changed!)
  userMessages = [{ role: "user", content: options.prompt }];
} else if (options.messages) {
  // Empty array = reset (lowest priority)
}
```

**Pros**:
- Fixes root cause for all callers
- More intuitive API behavior
- Consistent with user expectations

**Cons**:
- Affects all `streamWithEvents` callers
- May break code relying on current behavior
- Requires broader testing

**When to Consider**:
- If other callers hit same bug
- If we want to deprecate `prompt` parameter
- During major version bump

---

## Rollout Plan

1. **Apply Fix**: Change line 674 in `src/cli/hooks/useAgent.ts`
2. **Type Check**: Run `bun run typecheck`
3. **Manual Test**: Run through Phase 3 scenarios
4. **Commit**: Use `fix: cli no response bug - conditionally pass messages parameter`
5. **Test**: Have team member verify fix works
6. **Merge**: Merge to main branch
7. **Release**: Publish as patch version (e.g., 0.9.2)

---

## Rollback Plan

If issues are discovered:

1. **Revert Commit**: `git revert <commit-hash>`
2. **Verify**: Test that revert resolves the issue
3. **Investigate**: Debug what went wrong
4. **Alternative**: Consider Option 2 fix instead

**Rollback Risk**: Very low - single line change, easy to revert

---

## Success Metrics

- [x] Type checking passes
- [x] Unit tests pass (214 tests)
- [ ] CLI first prompt returns response (primary metric) - requires manual testing
- [ ] No regressions in multi-turn conversations - requires manual testing
- [ ] No regressions in slash commands - requires manual testing
- [ ] No regressions in session persistence - requires manual testing
- [ ] No console errors or warnings

---

## Related Issues

- **Research Document**: `docs/tickets/cli-no-response-fix/research.md`
- **Bug Location**: `src/cli/hooks/useAgent.ts:667` and `673-677`
- **Root Cause**: `src/agent.ts:748-767` (buildMessageArray)
- **Related Feature**: Session persistence via checkpointing

---

## Notes

- This fix is intentionally minimal (Option 1) to reduce risk
- Option 2 (fix buildMessageArray) can be implemented later if needed
- Consider adding integration tests for CLI to prevent future regressions
- The `prompt` parameter is deprecated but still used by CLI
- Future work: migrate CLI to only use `messages` parameter (Option 3)
