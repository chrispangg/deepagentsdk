---
title: CLI tool not returning anything when prompted
date: 2024-12-24 06:45:00 AEDT
researcher: Claude (Sonnet 4.5)
git_commit: e7398eff8adb8b64d1bca9d7ea5273b9b9d5d011
branch: main
repository: deepagentsdk
topic: "CLI tool not returning anything when prompted"
tags: [research, codebase, cli, bug, streamWithEvents]
status: complete
last_updated: 2024-12-24
last_updated_by: Claude
---

## Research Question

The CLI tool in `src/cli/` is not working. When launched and prompted, nothing returns. Investigate the reason why this could be the case.

## Summary

**ROOT CAUSE IDENTIFIED**: A critical bug exists in the `useAgent` hook ([`src/cli/hooks/useAgent.ts:667`](https://github.com/chrispangg/deepagentsdk/blob/e7398eff8adb8b64d1bca9d7ea5273b9b9d5d011/src/cli/hooks/useAgent.ts#L667)) where an empty `messages` array is passed to `streamWithEvents` along with the user's `prompt`. The `buildMessageArray` function in [`agent.ts:721-831`](https://github.com/chrispangg/deepagentsdk/blob/e7398eff8adb8b64d1bca9d7ea5273b9b9d5d011/src/agent.ts#L721-L831) interprets an empty messages array as "explicit empty messages" and **ignores the prompt parameter entirely**, resulting in no valid input and a "nothing returns" scenario.

The CLI help command works correctly, indicating the CLI launches and renders properly. The issue occurs specifically when the user submits their first prompt.

`★ Insight ─────────────────────────────────────`

1. **Empty Array Ambiguity**: The code distinguishes between "no messages parameter provided" vs. "messages = [] explicitly provided". An explicit empty array takes priority over prompt, which is the opposite of what might be expected.
2. **State Synchronization Issue**: The `messagesRef` is synchronized at the start of `sendPrompt`, but on first call it's always empty because messages state starts as `[]`.
3. **Event Flow**: The agent does yield an error event for "No valid input", but this error may not be displayed to the user depending on how events are consumed.
`─────────────────────────────────────────────────`

## Detailed Findings

### 1. CLI Entry Point Works Correctly

**Location**: [`src/cli/index.tsx:1041-1066`](https://github.com/chrispangg/deepagentsdk/blob/e7398eff8adb8b64d1bca9d7ea5273b9b9d5d011/src/cli/index.tsx#L1041-L1066)

The CLI successfully:

- Parses command-line arguments
- Loads environment variables from `.env` file
- Renders the Ink/React UI
- Displays the welcome banner and input field

Testing with `--help` confirms the CLI executable and renders output correctly.

---

### 2. Input Submission Flow

**Location**: [`src/cli/index.tsx:290-316`](https://github.com/chrispangg/deepagentsdk/blob/e7398eff8adb8b64d1bca9d7ea5273b9b9d5d011/src/cli/index.tsx#L290-L316)

When user submits input:

1. `Input` component calls `onSubmit(value)` ([`Input.tsx:71`](https://github.com/chrispangg/deepagentsdk/blob/e7398eff8adb8b64d1bca9d7ea5273b9b9d5d011/src/cli/components/Input.tsx#L71))
2. `App.handleSubmit` is invoked ([`index.tsx:290`](https://github.com/chrispangg/deepagentsdk/blob/e7398eff8adb8b64d1bca9d7ea5273b9b9d5d011/src/cli/index.tsx#L290))
3. After command parsing, `agent.sendPrompt(trimmed)` is called ([`index.tsx:313`](https://github.com/chrispangg/deepagentsdk/blob/e7398eff8adb8b64d1bca9d7ea5273b9b9d5d011/src/cli/index.tsx#L313))
4. `useAgent.sendPrompt` executes the agent stream

---

### 3. The Bug: Empty Messages Array Priority Issue

**Location**: [`src/cli/hooks/useAgent.ts:650-756`](https://github.com/chrispangg/deepagentsdk/blob/e7398eff8adb8b64d1bca9d7ea5273b9b9d5d011/src/cli/hooks/useAgent.ts#L650-L756)

#### The Problematic Code Flow

```typescript
// useAgent.ts:141 - Initial state
const [messages, setMessages] = useState<ModelMessage[]>([]);

// useAgent.ts:650-667 - sendPrompt function
const sendPrompt = useCallback(
  async (prompt: string): Promise<{ text: string; toolCalls: ToolCallData[] }> => {
    // ... reset code ...
    accumulatedTextRef.current = "";
    totalTextRef.current = "";
    toolCallsRef.current = [];
    pendingToolCallsRef.current.clear();

    // Add user message to events for history
    addEvent({ type: "user-message", content: prompt });

    // BUG IS HERE: Sync messages ref with current state
    messagesRef.current = messages;  // messages = [] on first call!

    // Create new abort controller
    abortControllerRef.current = new AbortController();

    try {
      for await (const event of agentRef.current.streamWithEvents({
        prompt,              // User's prompt string
        state,
        messages: messagesRef.current,  // [] - EMPTY ARRAY!
        threadId: options.sessionId,
        abortSignal: abortControllerRef.current.signal,
        onApprovalRequest: async (request) => { ... },
      })) {
        // Event processing...
      }
    } catch (err) { ... }
  },
  [state, messages, addEvent, flushTextSegment, autoApproveEnabled]
);
```

#### Why This Causes "Nothing Returns"

When `streamWithEvents` receives **both** `prompt` and `messages: []`:

**In [`agent.ts:buildMessageArray`](https://github.com/chrispangg/deepagentsdk/blob/e7398eff8adb8b64d1bca9d7ea5273b9b9d5d011/src/agent.ts#L721-L831):**

```typescript
// agent.ts:748-767
if (options.messages && options.messages.length > 0) {
  // Use explicit messages array (preferred)
  userMessages = options.messages;
  shouldUseCheckpointHistory = false;
} else if (options.messages) {  // ← THIS BRANCH: Empty array is truthy!
  // Empty messages array provided - clear checkpoint history
  shouldUseCheckpointHistory = false;
  patchedHistory = [];

  // Prompt is ignored in this branch
} else if (options.prompt) {  // ← NEVER REACHED
  // Convert prompt to message for backward compatibility
  userMessages = [{ role: "user", content: options.prompt }];
}

// agent.ts:800-802
const hasEmptyMessages = options.messages && options.messages.length === 0;  // true
const hasValidInput = userMessages.length > 0 || patchedHistory.length > 0;  // false!

// agent.ts:804-810 - Special case: empty messages with no checkpoint
if (hasEmptyMessages && !hasValidInput && !resume) {
  // This is a "no-op" case - return done immediately with empty messages
  return {
    messages: [],
    patchedHistory,
    shouldReturnEmpty: true,  // ← TRIGGERS EARLY RETURN
  };
}
```

**In [`agent.ts:streamWithEvents`](https://github.com/chrispangg/deepagentsdk/blob/e7398eff8adb8b64d1bca9d7ea5273b9b9d5d011/src/agent.ts#L908-L917):**

```typescript
// agent.ts:908-917
const messageResult = await this.buildMessageArray(options, patchedHistory);

// Handle empty messages no-op case
if (messageResult.shouldReturnEmpty) {
  yield {
    type: "done",
    text: "",
    messages: [],
    state,
  };
  return;  // ← STREAM ENDS IMMEDIATELY
}
```

#### Result

1. Stream yields a single `done` event with `text: ""`
2. No `text` events with streaming content are emitted
3. No tool calls are executed
4. The CLI displays... nothing (or the welcome message disappears)

---

### 4. Alternative Failure Mode: Error Event

**Location**: [`agent.ts:813-823`](https://github.com/chrispangg/deepagentsdk/blob/e7398eff8adb8b64d1bca9d7ea5273b9b9d5d011/src/agent.ts#L813-L823)

If the special case at lines 804-810 is removed or modified, the code would reach validation:

```typescript
// agent.ts:813-823
if (!hasValidInput && !resume) {
  return {
    messages: [],
    patchedHistory,
    error: {
      type: "error",
      error: new Error("No valid input: provide either non-empty messages..."),
    },
  };
}
```

This would yield an `error` event, which is handled in [`useAgent.ts:745-749`](https://github.com/chrispangg/deepagentsdk/blob/e7398eff8adb8b64d1bca9d7ea5273b9b9d5d011/src/cli/hooks/useAgent.ts#L745-L749):

```typescript
} else {
  // Flush remaining text before showing error
  flushTextSegment();
  setStatus("error");
  setError(err as Error);
  return { text: "", toolCalls: [] };
}
```

The error would be displayed via the `ErrorDisplay` component at [`index.tsx:606`](https://github.com/chrispangg/deepagentsdk/blob/e7398eff8adb8b64d1bca9d7ea5273b9b9d5d011/src/cli/index.tsx#L606).

---

### 5. Other Potential Root Causes (Less Likely)

While the empty messages bug is the primary cause, other issues could also contribute:

#### 5.1 Missing API Keys

**Location**: [`src/cli/index.tsx:1054-1056`](https://github.com/chrispangg/deepagentsdk/blob/e7398eff8adb8b64d1bca9d7ea5273b9b9d5d011/src/cli/index.tsx#L1054-L1056)

The CLI only **warns** about missing API keys but continues execution:

```typescript
if (!process.env.ANTHROPIC_API_KEY && !process.env.OPENAI_API_KEY) {
  console.log(`⚠ No API keys found. Set ANTHROPIC_API_KEY or OPENAI_API_KEY...`);
}
```

If API keys are missing, the agent would fail during the first API call with an authentication error.

#### 5.2 Model Parsing Issues

**Location**: [`src/utils/model-parser.ts:27-38`](https://github.com/chrispangg/deepagentsdk/blob/e7398eff8adb8b64d1bca9d7ea5273b9b9d5d011/src/utils/model-parser.ts#L27-L38)

The model parser has no validation:

- Unknown providers default to Anthropic (could cause API errors)
- Invalid model IDs are not validated
- Missing API keys are not checked

#### 5.3 streamText Hanging

**Location**: [`agent.ts:959-981`](https://github.com/chrispangg/deepagentsdk/blob/e7398eff8adb8b64d1bca9d7ea5273b9b9d5d011/src/agent.ts#L959-L981)

If `streamText()` from the AI SDK never resolves:

- The `for await (const chunk of result.textStream)` loop would hang
- No events would be yielded
- The CLI would appear frozen

---

## Code References

### Primary Bug Location

| File | Lines | Description |
|------|-------|-------------|
| `src/cli/hooks/useAgent.ts` | 667 | `messagesRef.current = messages;` - Empty array passed |
| `src/agent.ts` | 748-767 | Empty messages array branch - prompt ignored |
| `src/agent.ts` | 804-810 | Early return with empty `done` event |

### Related Event Flow

| File | Lines | Description |
|------|-------|-------------|
| `src/agent.ts` | 884-917 | `streamWithEvents` initialization and message building |
| `src/agent.ts` | 945-981 | `streamText` execution loop |
| `src/cli/hooks/useAgent.ts` | 673-730 | Event processing loop |
| `src/cli/index.tsx` | 572-607 | Event rendering in UI |
| `src/cli/index.tsx` | 606 | Error display component |

### Message State Initialization

| File | Lines | Description |
|------|-------|-------------|
| `src/cli/hooks/useAgent.ts` | 141 | `useState<ModelMessage[]>([])` - Empty initial state |
| `src/cli/hooks/useAgent.ts` | 580-583 | Messages updated from `done` event |

---

## Architecture Documentation

### Expected Event Flow

**Normal Flow (Working)**:

```
User Input → handleSubmit → sendPrompt(prompt)
    ↓
streamWithEvents({ prompt: "hello" })
    ↓
buildMessageArray({ prompt: "hello", messages: undefined })
    ↓
userMessages = [{ role: "user", content: "hello" }]
    ↓
inputMessages = [userMessages]
    ↓
streamText(inputMessages)
    ↓
Yield: step-start → text chunks → done
    ↓
CLI displays response
```

**Broken Flow (Current Bug)**:

```
User Input → handleSubmit → sendPrompt(prompt)
    ↓
streamWithEvents({ prompt: "hello", messages: [] })
    ↓
buildMessageArray({ prompt: "hello", messages: [] })
    ↓
// messages is empty array (truthy but length = 0)
// Enters "empty messages" branch
shouldUseCheckpointHistory = false
patchedHistory = []
// prompt is IGNORED (else if chain skipped)
    ↓
hasEmptyMessages = true
hasValidInput = false
    ↓
shouldReturnEmpty = true
    ↓
Yield: { type: "done", text: "", messages: [] }
    ↓
STREAM ENDS (no text events)
    ↓
CLI displays nothing
```

---

## Historical Context (from docs/)

No relevant prior research found in the `docs/` directory regarding this specific issue.

---

## Related Research

- **Model Parser Analysis**: [`src/utils/model-parser.ts`](https://github.com/chrispangg/deepagentsdk/blob/e7398eff8adb8b64d1bca9d7ea5273b9b9d5d011/src/utils/model-parser.ts) - CLI-only utility for string-to-model conversion
- **Event System**: [`src/types/events.ts`](https://github.com/chrispangg/deepagentsdk/blob/e7398eff8adb8b64d1bca9d7ea5273b9b9d5d011/src/types/events.ts) - 31 event types for streaming
- **streamWithEvents**: [`src/agent.ts:884-1031`](https://github.com/chrispangg/deepagentsdk/blob/e7398eff8adb8b64d1bca9d7ea5273b9b9d5d011/src/agent.ts#L884-L1031) - Core streaming method

---

## Open Questions

1. **Why was `messages` parameter added to `streamWithEvents` call?**
   - The call includes both `prompt` and `messages` parameters
   - According to [`agent.ts:754-756`](https://github.com/chrispangg/deepagentsdk/blob/e7398eff8adb8b64d1bca9d7ea5273b9b9d5d011/src/agent.ts#L754-L756), when both are provided, `messages` takes priority
   - Suggests a design for multi-turn conversation, but first call has empty history

2. **Should empty `messages` array clear history or be ignored?**
   - Current behavior: Empty array = "clear history and reset"
   - Alternative: Empty array = "no messages parameter, use prompt"
   - The code at [`agent.ts:757-767`](https://github.com/chrispangg/deepagentsdk/blob/e7398eff8adb8b64d1bca9d7ea5273b9b9d5d011/src/agent.ts#L757-L767) explicitly handles empty array as a reset

3. **Why does the CLI pass empty messages instead of undefined?**
   - At [`useAgent.ts:667`](https://github.com/chrispangg/deepagentsdk/blob/e7398eff8adb8b64d1bca9d7ea5273b9b9d5d011/src/cli/hooks/useAgent.ts#L667), `messagesRef.current = messages` syncs state
   - On first call, `messages` state is `[]` from initialization
   - Could be fixed by conditionally passing `messages` only when non-empty

---

## Recommended Fix Options

### Option 1: Conditionally Pass Messages (Minimal Change)

**File**: `src/cli/hooks/useAgent.ts:673-677`

```typescript
for await (const event of agentRef.current.streamWithEvents({
  prompt,
  state,
  messages: messagesRef.current.length > 0 ? messagesRef.current : undefined,  // Only pass if non-empty
  threadId: options.sessionId,
  abortSignal: abortControllerRef.current.signal,
  onApprovalRequest: async (request) => { ... },
})) {
```

**Pros**: Minimal change, preserves intent
**Cons**: Doesn't address root cause in `buildMessageArray`

---

### Option 2: Fix buildMessageArray Priority Logic

**File**: `src/agent.ts:748-775`

Modify the priority logic to treat empty `messages` array as "no messages provided":

```typescript
if (options.messages && options.messages.length > 0) {
  // Use explicit messages array (preferred)
  userMessages = options.messages;
  shouldUseCheckpointHistory = false;
} else if (options.prompt) {  // ← Prompt takes priority over empty messages
  // Convert prompt to message for backward compatibility
  userMessages = [{ role: "user", content: options.prompt }];
} else if (options.messages) {  // ← Empty array is now last priority
  // Empty messages array provided - clear checkpoint history
  shouldUseCheckpointHistory = false;
  patchedHistory = [];
}
```

**Pros**: Fixes root cause, consistent with expectations
**Cons**: Changes established behavior for reset functionality

---

### Option 3: Only Use Messages (Remove Prompt Parameter)

**File**: `src/cli/hooks/useAgent.ts:673-677`

```typescript
// Build messages array from prompt
const inputMessages: ModelMessage[] = [
  ...messagesRef.current,
  { role: "user", content: prompt } as ModelMessage,
];

for await (const event of agentRef.current.streamWithEvents({
  messages: inputMessages,  // Only pass messages
  state,
  threadId: options.sessionId,
  abortSignal: abortControllerRef.current.signal,
  onApprovalRequest: async (request) => { ... },
})) {
```

**Pros**: Clearer intent, follows AI SDK patterns
**Cons**: Larger refactor, may affect other callers

---

## Testing Recommendations

To validate the fix and prevent regression:

1. **First Prompt Test**: Verify first user message generates response
2. **Multi-turn Test**: Verify conversation history works correctly
3. **Reset Test**: Verify `/clear` command works properly
4. **Error Display Test**: Verify API errors are shown to user
5. **Session Load Test**: Verify checkpoint restoration works

---

## Conclusion

The CLI "nothing returns" issue is caused by a bug in how the `useAgent` hook passes an empty `messages` array to `streamWithEvents`, which causes the `buildMessageArray` function to ignore the user's prompt and return an empty `done` event immediately. The fix requires modifying either the calling code to conditionally pass the `messages` parameter or the `buildMessageArray` logic to properly handle empty arrays as "no messages provided" rather than "clear history" command.
