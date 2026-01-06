---
title: Checkpointer Support - Persist agent state between invocations (pause/resume)
date: 2025-12-13 09:35:00 AEDT
researcher: Claude Code (Opus 4.5)
git_commit: 6479239d7976e3ea62be9a3368ba5b9de607f1d3
branch: main
repository: deepagentsdk
topic: "Checkpointer Support - Persist agent state between invocations (pause/resume)"
tags: [research, codebase, checkpointer, state-persistence, pause-resume, hitl]
status: complete
last_updated: 2025-12-13
last_updated_by: Claude Code
---

## Research Question

How should Checkpointer Support be implemented in deepagentsdk to enable persisting agent state (todos, files, conversation history) between invocations for pause/resume functionality, based on the reference LangChain DeepAgents implementations?

## Summary

The reference LangChain DeepAgents implementations use LangGraph's `BaseCheckpointSaver` interface for state persistence. AI SDK v6 does **not** provide a universal checkpointing system - state persistence must be implemented manually by saving the `messages` array and custom state.

This research documents:

1. How LangChain DeepAgents implements checkpointing via LangGraph
2. Current state management in deepagentsdk
3. AI SDK's state persistence capabilities and limitations
4. Recommendations for implementation

**Key Finding**: We need to implement our own Checkpointer interface since AI SDK lacks built-in checkpointing.

---

## Detailed Findings

### 1. Reference Implementation: LangChain DeepAgents

#### Checkpointer Architecture

LangChain DeepAgents relies on **LangGraph's checkpoint system** - it does not implement custom checkpointing. The key components:

**JavaScript (`.refs/deepagentsjs/src/agent.ts:14-15, 53-55`):**

```typescript
import type { BaseCheckpointSaver, BaseStore } from "@langchain/langgraph-checkpoint";

// Agent creation accepts checkpointer
checkpointer?: BaseCheckpointSaver | boolean;
store?: BaseStore;
```

**Python (`.refs/deepagents/libs/deepagents/deepagents/graph.py:49-50`):**

```python
from langgraph.types import Checkpointer
from langgraph.checkpoint.memory import MemorySaver, InMemorySaver

checkpointer: Checkpointer | None = None
store: BaseStore | None = None
```

#### What Gets Checkpointed

| Component | Scope | Persisted By | Shared Across Threads |
|-----------|-------|--------------|----------------------|
| **Messages** | Per-thread | Checkpointer | No |
| **Files (StateBackend)** | Per-thread | Checkpointer | No |
| **Files (StoreBackend)** | Global | Store | Yes |
| **Todos** | Per-thread | Checkpointer | No |
| **Tool Calls** | Per-thread | Checkpointer | No |
| **Interrupt State** | Per-thread | Checkpointer | No |

#### Thread ID for Conversation Isolation

All checkpoint operations require a `thread_id` in the config:

**JavaScript (`.refs/deepagentsjs/tests/integration/hitl.test.ts:44`):**

```typescript
const config = { configurable: { thread_id: uuidv4() } };
const result = await agent.invoke({ messages: [message] }, config);
```

**Python (`.refs/deepagents/libs/deepagents/tests/integration_tests/test_hitl.py:21`):**

```python
config = {"configurable": {"thread_id": uuid.uuid4()}}
result = agent.invoke({"messages": [...]}, config=config)
```

#### Pause/Resume via HITL

When a tool requires approval, the agent interrupts and returns an `__interrupt__` object:

**JavaScript Pause (`.refs/deepagentsjs/tests/integration/hitl.test.ts:48-58`):**

```typescript
const result = await agent.invoke({ messages: [...] }, config);
expect(result.__interrupt__).toBeDefined();
const interrupts = result.__interrupt__[0].value as HITLRequest;
```

**JavaScript Resume (`.refs/deepagentsjs/tests/integration/hitl.test.ts:111-117`):**

```typescript
const result2 = await agent.invoke(
  new Command({
    resume: { decisions: [{ type: "approve" }] },
  }),
  config  // SAME thread_id to resume
);
```

#### Two-Tier Storage Pattern

- **Checkpointer**: Ephemeral, per-conversation state (messages, todos, tool calls)
- **Store**: Persistent, cross-conversation memory (files that persist across threads)

**Example (`.refs/deepagentsjs/examples/backends/store-backend.ts`):**

```typescript
export const agent = createDeepAgent({
  checkpointer: new MemorySaver(),  // For conversation history
  store: new InMemoryStore(),        // For cross-thread files
  backend: (config) => new StoreBackend(config),
});
```

---

### 2. Current deepagentsdk State Management

#### State Structure (`src/types.ts:86-91`)

```typescript
export interface DeepAgentState {
  todos: TodoItem[];                    // Task planning
  files: Record<string, FileData>;      // Virtual filesystem
}
```

**Important**: Messages are NOT part of `DeepAgentState` - they are passed separately.

#### State Flow in streamWithEvents (`src/agent.ts:307-452`)

1. **Input**: Accept optional `state` and `messages` parameters
2. **During Execution**: Tools mutate `state` directly via closure
3. **Output**: `done` event includes mutated `state` and updated `messages`

```typescript
async *streamWithEvents(options: StreamWithEventsOptions) {
  const state = options.state ?? { todos: [], files: {} };
  const patchedHistory = patchToolCalls(options.messages || []);
  // ...execution...
  yield { type: 'done', state, messages: updatedMessages };
}
```

#### Backend Persistence Patterns

**StateBackend** (`src/backends/state.ts`):

- Stores files in `DeepAgentState.files`
- Ephemeral - no persistence across invocations

**FilesystemBackend** (`src/backends/filesystem.ts`):

- Writes directly to disk
- Persists across invocations

**PersistentBackend** (`src/backends/persistent.ts`):

- Uses `KeyValueStore` interface
- Cross-conversation memory with namespaces

```typescript
export interface KeyValueStore {
  get(namespace: string[], key: string): Promise<Record<string, unknown> | undefined>;
  put(namespace: string[], key: string, value: Record<string, unknown>): Promise<void>;
  delete(namespace: string[], key: string): Promise<void>;
  list(namespace: string[]): Promise<Array<{ key: string; value: Record<string, unknown> }>>;
}
```

#### CLI State Management (`src/cli/hooks/useAgent.ts`)

The CLI manages state via React hooks:

```typescript
const [state, setState] = useState<DeepAgentState>({ todos: [], files: {} });
const [messages, setMessages] = useState<ModelMessage[]>([]);
const messagesRef = useRef<ModelMessage[]>([]);  // For streaming

// On done event:
case "done":
  setState(event.state);
  if (event.messages) {
    setMessages(event.messages);
    messagesRef.current = event.messages;
  }
```

**Gap**: CLI state is not persisted between sessions.

---

### 3. AI SDK State Persistence Capabilities

#### No Universal Checkpointing

AI SDK v6 does **not** provide a general-purpose checkpointing system. The only built-in persistence is OpenAI-specific:

```typescript
// OpenAI-specific response chaining
const result2 = await generateText({
  model: openai.responses('gpt-4o-mini'),
  prompt: 'Continue...',
  providerOptions: {
    openai: { previousResponseId: result1.providerMetadata?.openai.responseId },
  },
});
```

For Anthropic and other providers, you must implement persistence manually.

#### Message Structure (`ModelMessage`)

Messages can be serialized using Zod schemas:

```typescript
type ModelMessage =
  | SystemModelMessage    // { role: 'system', content: string }
  | UserModelMessage      // { role: 'user', content: string | Part[] }
  | AssistantModelMessage // { role: 'assistant', content: string | Part[] }
  | ToolModelMessage;     // { role: 'tool', content: ToolResultPart[] }
```

AI SDK provides schemas: `modelMessageSchema`, `systemModelMessageSchema`, etc.

#### Middleware and Callbacks

**`onFinish` Callback** - Recommended for persistence:

```typescript
const result = streamText({
  model: anthropic('claude-sonnet-4'),
  messages,
  onFinish: async ({ response }) => {
    await saveChat({
      id: chatId,
      messages: [...messages, ...response.messages],
    });
  },
});
```

**`onStepFinish` Callback** - Per-step checkpoint opportunity:

```typescript
generateText({
  model,
  messages,
  onStepFinish: async ({ stepNumber, toolCalls, toolResults }) => {
    await saveCheckpoint({ stepNumber, toolCalls, toolResults });
  },
});
```

**Language Model Middleware** - Intercept and modify calls:

```typescript
const cachedModel = wrapLanguageModel({
  model: baseModel,
  middleware: {
    wrapGenerate: async ({ doGenerate, params }) => {
      const cached = await cache.get(getCacheKey(params));
      if (cached) return cached;
      const result = await doGenerate();
      await cache.set(getCacheKey(params), result);
      return result;
    },
  },
});
```

#### No Pause/Resume for Tool Calls

AI SDK does not support pausing mid-tool-call. Options:

- **AbortSignal**: Cancel entire stream with `onAbort` cleanup
- **Manual Loop**: Implement step-by-step execution with checkpoints
- **Stream Resumption**: UI-only, requires Redis infrastructure

---

### 4. Serialization Considerations

#### What Needs to Be Serialized

For pause/resume functionality:

| Data | Type | Serializable? | Notes |
|------|------|---------------|-------|
| `todos` | `TodoItem[]` | Yes | Already JSON-compatible |
| `files` | `Record<string, FileData>` | Yes | Already JSON-compatible |
| `messages` | `ModelMessage[]` | Mostly | May need special handling for images/files |
| `providerOptions` | Varies | Maybe | Provider-specific, may contain non-JSON data |

#### FileData Structure (Already Serializable)

```typescript
interface FileData {
  content: string[];        // Lines of text
  created_at: string;       // ISO 8601 timestamp
  modified_at: string;      // ISO 8601 timestamp
}
```

#### TodoItem Structure (Already Serializable)

```typescript
interface TodoItem {
  id: string;
  content: string;
  status: 'pending' | 'in_progress' | 'completed' | 'cancelled';
}
```

#### Message Serialization Challenges

- **Text content**: Fully serializable
- **Image/File parts**: May contain base64 data or URLs (large but serializable)
- **Tool calls**: Complex structure but JSON-compatible
- **`providerOptions`**: Varies by provider, may need filtering

---

## Code References

### Reference Implementations

- `.refs/deepagentsjs/src/agent.ts:14-15` - Checkpointer type definition
- `.refs/deepagentsjs/tests/integration/hitl.test.ts:44` - Thread ID usage
- `.refs/deepagentsjs/examples/backends/store-backend.ts:53-63` - Two-tier storage
- `.refs/deepagents/libs/deepagents/deepagents/graph.py:49-50` - Python checkpointer

### Current Implementation

- `src/types.ts:86-91` - DeepAgentState interface
- `src/agent.ts:307-452` - streamWithEvents state flow
- `src/backends/persistent.ts:70-101` - KeyValueStore interface
- `src/backends/utils.ts` - FileData serialization utilities
- `src/cli/hooks/useAgent.ts:127-131` - CLI state management

---

## Architecture Documentation

### Current State Flow

```
                    ┌─────────────────────────────────────────┐
                    │         streamWithEvents()              │
                    │                                         │
  ┌──────────────┐  │  ┌─────────────┐    ┌───────────────┐  │  ┌──────────────┐
  │   messages   │──┼─►│ patchToolCalls│───►│   streamText  │──┼─►│    done      │
  │   (input)    │  │  └─────────────┘    │   (AI SDK)    │  │  │   event      │
  └──────────────┘  │                      └───────────────┘  │  └──────┬───────┘
                    │                            │            │         │
  ┌──────────────┐  │                      ┌─────▼─────┐      │  ┌──────▼───────┐
  │    state     │──┼─────────────────────►│   Tools   │──────┼─►│    state     │
  │   (input)    │  │                      │ (mutate)  │      │  │  (mutated)   │
  └──────────────┘  │                      └───────────┘      │  └──────────────┘
                    │                                         │
                    └─────────────────────────────────────────┘
```

### Proposed Checkpointer Integration

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                          DeepAgent with Checkpointer                        │
│                                                                             │
│  ┌────────────────────────────────────────────────────────────────────────┐ │
│  │                       Checkpoint Data                                  │ │
│  │  { thread_id, messages, state: { todos, files }, step, interrupt }     │ │
│  └──────────────────────────────┬─────────────────────────────────────────┘ │
│                                 │                                           │
│             ┌───────────────────┴───────────────────┐                       │
│             ▼                                       ▼                       │
│  ┌─────────────────────┐                 ┌─────────────────────┐           │
│  │  checkpointer.save  │                 │ checkpointer.load   │           │
│  │  (on step finish)   │                 │ (on resume)         │           │
│  └──────────┬──────────┘                 └──────────┬──────────┘           │
│             │                                       │                       │
│             ▼                                       ▼                       │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                    Checkpointer Implementation                       │   │
│  │  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────────┐  │   │
│  │  │ MemorySaver     │  │ FileSaver       │  │ CustomSaver         │  │   │
│  │  │ (in-memory)     │  │ (JSON files)    │  │ (Redis, DB, etc.)   │  │   │
│  │  └─────────────────┘  └─────────────────┘  └─────────────────────┘  │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Answers to Key Questions

### 1. Does `streamWithEvents` support resume functionality?

**Answer: YES, it should.**

Current `streamWithEvents` flow:
- Accepts `messages` (history) + `prompt` (new input)
- Patches tool calls, applies summarization
- Streams through AI SDK's `streamText`
- Returns mutated `state` and updated `messages` in `done` event

Resume integration should follow LangChain's pattern:
```typescript
// Current usage
agent.streamWithEvents({ prompt: "...", messages: [...] })

// Resume usage
agent.streamWithEvents({
  threadId: "abc123",
  resume: { decisions: [{ type: "approve" }] }
})
```

The resume path would:
1. Load checkpoint for thread
2. Skip prompt (resuming existing conversation)
3. Process approval decisions for pending tool calls
4. Continue streaming from interrupt point

### 2. When should checkpoints be saved?

**Answer: AFTER EVERY STEP** (matching LangChain behavior)

LangGraph checkpoints automatically after each graph node execution:
1. Model invocation → **CHECKPOINT**
2. Tool execution → **CHECKPOINT**
3. Next model invocation → **CHECKPOINT**

For deepagentsdk, implement in `onStepFinish`:
```typescript
onStepFinish: async ({ stepNumber, toolCalls, toolResults }) => {
  if (this.checkpointer) {
    await this.checkpointer.save({
      threadId: options.threadId,
      step: stepNumber,
      messages: currentMessages,
      state: currentState,
    });
  }
}
```

When interrupts occur:
```
Model Call → CHECKPOINT (with __interrupt__) → Wait for Approval → Tool Execute → CHECKPOINT
```

### 3. Do checkpoints revert FilesystemBackend disk changes?

**Answer: NO, external storage is NOT reverted**

The `filesUpdate` field determines what gets checkpointed:

| Backend | `filesUpdate` | Saved in Checkpoint? | Reverted on Restore? |
|---------|---------------|---------------------|---------------------|
| **StateBackend** | `{"/file.txt": FileData}` | ✅ Yes | ✅ Yes |
| **FilesystemBackend** | `null` | ❌ No | ❌ No |
| **PersistentBackend** | Varies | Varies | Varies |

**Example scenario**:
```typescript
// Step 1: Agent writes to disk
agent.streamWithEvents({ prompt: "Write /config.json" })
// Physical disk: /config.json exists
// Checkpoint state.files: {} (empty - filesUpdate was null)

// Step 2: Restore earlier checkpoint
checkpointer.load("earlier-checkpoint-id")
// Physical disk: /config.json STILL EXISTS
// Checkpoint state.files: {} (unchanged)
```

**Design rationale**: External backends (disk, S3, database) are "already persistent" and treated as intentional side effects that survive checkpoint restoration. Only StateBackend files participate in rollback.

---

## Open Questions

1. **Thread ID Source**: Should we generate UUIDs automatically or require the caller to provide thread IDs?

2. **Message Serialization**: How to handle non-serializable content parts?
   - Filter out base64 images?
   - Store references only?
   - Provider-specific handling?

---

## Related Research

- `docs/tickets/001_human_in_the_loop_hitl/research.md` - HITL implementation (interrupt pattern)
- `docs/tickets/002_sandbox_backend/research.md` - Sandbox backend (execute tool)

---

## Implementation Recommendations

Based on this research, the recommended implementation approach:

### 1. Define Checkpointer Interface

```typescript
export interface Checkpoint {
  threadId: string;
  step: number;
  messages: ModelMessage[];
  state: DeepAgentState;
  interrupt?: InterruptData;
  createdAt: string;
}

export interface BaseCheckpointSaver {
  save(checkpoint: Checkpoint): Promise<void>;
  load(threadId: string): Promise<Checkpoint | undefined>;
  list(): Promise<string[]>;  // List thread IDs
  delete(threadId: string): Promise<void>;
}
```

### 2. Implement Built-in Savers

- **MemorySaver**: In-memory Map for testing
- **FileSaver**: JSON files for development
- **KeyValueStoreSaver**: Adapter for existing `KeyValueStore` interface

### 3. Integrate with streamWithEvents

- Add `checkpointer` option to DeepAgent constructor
- Add `threadId` to `streamWithEvents` options
- Auto-save after each step via `onStepFinish`
- Support `resume` option for continuing interrupted streams

### 4. Message Serialization Strategy

- Use AI SDK's built-in Zod schemas for validation
- Filter or truncate large content parts (images > 1MB)
- Store references for FilesystemBackend files
