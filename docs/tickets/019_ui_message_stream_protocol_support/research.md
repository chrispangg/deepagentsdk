---
date: 2025-01-09 09:00:00 AEDT
researcher: Sonnet 4.5
git_commit: 02bfb287c112f9af32b1ba35027bab76015790ef
branch: main
repository: deepagentsdk
topic: "Supporting Missing UI Message Stream Protocol Features in Elements Adapter"
tags: [research, elements-adapter, streaming-protocol, event-mapping]
status: complete
last_updated: 2025-01-09
last_updated_by: Sonnet 4.5
last_updated_note: "Implemented full event visibility via custom data parts"
---

# Research

## Research Question

How can we extend the Elements adapter to support the missing UI Message Stream Protocol features (reasoning parts, source/file references, and streaming tool inputs) to achieve complete AI SDK Elements compatibility?

## Summary

The Elements adapter now provides **complete event visibility** for all 26+ DeepAgent event types through a pragmatic approach: standard protocol events for core functionality (text, tools, steps, errors) and custom `data` parts for specialized events (file operations, web requests, subagents, execution, checkpoints).

**Implementation Status:**
- ✅ **Text & Tool Events** - Full support via standard protocol parts
- ✅ **File Operations** - Via custom `data` parts (file-write-start/written/edited/read, ls, glob, grep)
- ✅ **Web Requests** - Via custom `data` parts (web-search-start/finish, http-request-start/finish, fetch-url-start/finish)
- ✅ **Subagent Lifecycle** - Via custom `data` parts (subagent-start/finish/step)
- ✅ **Execution/Sandbox** - Via custom `data` parts (execute-start/finish)
- ✅ **Checkpoints** - Via custom `data` parts (checkpoint-saved/loaded)
- ⚠️ **Reasoning** - Not supported (requires new event types and chunk handling)
- ❌ **Streaming Tool Inputs** - Not feasible (AI SDK limitation)

## Key Architecture Decisions

**1. Pure Function Event Mapping**

The `mapEventToProtocol` function ([`createElementsRouteHandler.ts:241-611`](https://github.com/chrispangg/deepagentsdk/blob/main/src/adapters/elements/createElementsRouteHandler.ts#L241-L611)) extracts event-to-stream mapping into a testable, reusable pure function:

```typescript
export function mapEventToProtocol(
  event: DeepAgentEvent,
  writer: { write: (chunk: any) => void },
  genId: () => string,
  currentTextId: string | null
): string | null
```

**Benefits:**
- **Testable**: Can unit test event mapping without full handler
- **Extensible**: Users can customize by wrapping the function
- **Composable**: Can be used in other contexts beyond route handlers

**2. Custom Data Parts for Specialized Events**

Instead of forcing every event into the standard protocol (which only defines ~15 part types), all specialized events use the flexible `data` part type:

```typescript
writer.write({
  type: 'data',
  name: 'file-written',  // Event-specific identifier
  data: { path, content }  // Full event payload
});
```

**Trade-off:**
- ✅ **Maximum visibility**: UI receives all event data
- ✅ **No protocol constraints**: Not limited to predefined part types
- ⚠️ **Custom UI required**: Off-the-shelf AI Elements components won't render these by default
- ✅ **Future-proof**: Easy to add new events without protocol changes

**3. Explicit `finish` Event Emission**

The adapter explicitly emits a `finish` event with usage metadata:

```typescript
case 'done':
  writer.write({
    type: 'finish',
    finishReason: 'stop',
    usage: event.usage ? {
      promptTokens: event.usage.promptTokens,
      completionTokens: event.usage.completionTokens,
    } : undefined,
  });
```

While `createUIMessageStream` auto-emits `finish`, explicit emission provides:
- Clear documentation of completion
- Usage statistics for cost tracking
- Explicit `finishReason` for UI feedback

## Detailed Event Mapping

### Standard Protocol Events (AI SDK Compatible)

| DeepAgent Event | Stream Part | Purpose | Lines |
|----------------|-------------|---------|-------|
| `step-start` | `start-step` | UI progress tracking | 252-254 |
| `step-finish` | `finish-step` | UI progress tracking | 256-258 |
| `text` (first) | `text-start` | Begin text block | 262-268 |
| `text` (subsequent) | `text-delta` | Stream text chunks | 270-275 |
| `tool-call` | `tool-input-available` | Tool called with args | 281-296 |
| `tool-result` (success) | `tool-output-available` | Tool result | 298-311 |
| `tool-result` (error) | `tool-output-error` | Tool error | 299-304 |
| `error` | `error` | Error message | 571-584 |
| `done` | `finish` | Completion with usage | 586-605 |

### Custom Data Events (DeepAgent-Specific)

#### File System Events

| DeepAgent Event | Data Name | Fields | Lines |
|----------------|-----------|--------|-------|
| `file-write-start` | `file-write-start` | `path`, `content` | 330-339 |
| `file-written` | `file-written` | `path`, `content` | 341-350 |
| `file-edited` | `file-edited` | `path`, `occurrences` | 352-361 |
| `file-read` | `file-read` | `path`, `lines` | 363-372 |
| `ls` | `ls` | `path`, `count` | 374-383 |
| `glob` | `glob` | `pattern`, `count` | 385-394 |
| `grep` | `grep` | `pattern`, `count` | 396-405 |

**Use Cases:**
- **Debug UIs**: Show real-time file operations in a sidebar
- **Audit trails**: Log all file system access
- **Progress indicators**: Display file read/write progress

#### Execution Events

| DeepAgent Event | Data Name | Fields | Lines |
|----------------|-----------|--------|-------|
| `execute-start` | `execute-start` | `command`, `sandboxId` | 411-420 |
| `execute-finish` | `execute-finish` | `command`, `exitCode`, `truncated`, `sandboxId` | 422-433 |

**Use Cases:**
- **Command visualization**: Show running commands in terminal UI
- **Sandbox monitoring**: Track which sandbox is executing
- **Exit code display**: Show command success/failure status

#### Web Request Events

| DeepAgent Event | Data Name | Fields | Lines |
|----------------|-----------|--------|-------|
| `web-search-start` | `web-search-start` | `query` | 439-447 |
| `web-search-finish` | `web-search-finish` | `query`, `resultCount` | 449-458 |
| `http-request-start` | `http-request-start` | `url`, `method` | 460-469 |
| `http-request-finish` | `http-request-finish` | `url`, `statusCode` | 471-480 |
| `fetch-url-start` | `fetch-url-start` | `url` | 482-490 |
| `fetch-url-finish` | `fetch-url-finish` | `url`, `success` | 492-501 |

**Use Cases:**
- **Network monitoring**: Show active HTTP requests
- **Search results**: Display web search queries
- **URL tracking**: List all fetched URLs for citation

#### Subagent Events

| DeepAgent Event | Data Name | Fields | Lines |
|----------------|-----------|--------|-------|
| `subagent-start` | `subagent-start` | `name`, `task` | 507-516 |
| `subagent-finish` | `subagent-finish` | `name`, `result` | 518-527 |
| `subagent-step` | `subagent-step` | `stepIndex`, `toolCalls` | 529-538 |

**Use Cases:**
- **Multi-agent visualization**: Show subagent hierarchy
- **Task delegation**: Display which agent is working
- **Nested tool calls**: Show subagent's tool invocations

#### Checkpoint Events

| DeepAgent Event | Data Name | Fields | Lines |
|----------------|-----------|--------|-------|
| `checkpoint-saved` | `checkpoint-saved` | `threadId`, `step` | 544-553 |
| `checkpoint-loaded` | `checkpoint-loaded` | `threadId`, `step`, `messageCount` | 555-565 |

**Use Cases:**
- **Persistence monitoring**: Show when state is saved
- **Resume indicators**: Display that conversation was restored
- **Debug persistence**: Track checkpoint operations

#### Planning Events

| DeepAgent Event | Data Name | Fields | Lines |
|----------------|-----------|--------|-------|
| `todos-changed` | `todos-changed` | `todos` array | 318-324 |

**Use Cases:**
- **Task list UI**: Render todo items in sidebar
- **Progress tracking**: Show agent's plan
- **Step completion**: Display checklist status

## Not Supported Features

### 1. Reasoning (reasoning-start/delta/end)

**Status**: ❌ **Not Supported**

**Why**: DeepAgent doesn't capture reasoning chunks from AI SDK's `fullStream`.

**Research Findings**:
- Provider options enable extended thinking (e.g., `providerOptions.anthropic.thinking`)
- AI SDK emits `reasoning-delta` chunks during generation
- DeepAgent's streaming loop ([`agent.ts:979-1023`](https://github.com/chrispangg/deepagentsdk/blob/main/src/agent.ts#L979-L1023)) ignores these chunks
- No event types defined for reasoning tokens

**Implementation Path** (if desired):
1. Add event types: `ReasoningStartEvent`, `ReasoningDeltaEvent`, `ReasoningEndEvent`
2. Modify chunk processing to handle `reasoning-delta` chunks
3. Map events to `reasoning-start`/`reasoning-delta`/`reasoning-end` stream parts

**Model Support**:
- Claude 3.7 Sonnet (`claude-sonnet-4-5-20250929`)
- OpenAI o1/o3-series

### 2. Streaming Tool Inputs (tool-input-start/delta)

**Status**: ❌ **Not Feasible**

**Why**: AI SDK v6 doesn't emit incremental tool input chunks.

**Research Findings**:
- LLMs generate complete tool calls in single responses (not streamed like text)
- `fullStream` yields `tool-call` with complete `input` object
- No `tool-input-delta` or similar chunk type exists
- Current `tool-input-available` approach is the best possible

**Impact**: None - this is a fundamental architectural limitation, not a DeepAgent-specific issue.

## Text Streaming Pattern

The adapter uses a **text ID tracking pattern** to properly manage text part lifecycle:

```typescript
let currentTextId: string | null = null;

// First text chunk starts a new part
if (!currentTextId) {
  currentTextId = genId();
  writer.write({ type: 'text-start', id: currentTextId });
}

// Subsequent chunks are deltas
writer.write({ type: 'text-delta', id: currentTextId, delta: event.text });

// Tool calls, errors, or completion end the text
if (currentTextId) {
  writer.write({ type: 'text-end', id: currentTextId });
  currentTextId = null;
}
```

**Why This Matters:**
- **Proper stream structure**: Text parts have clear boundaries
- **UI compatibility**: `text-start`/`text-delta`/`text-end` is the expected pattern
- **Nested content**: Closes text before tool calls (prevents malformed streams)

**Text Closure Occurs:**
- Before tool calls ([line 283](https://github.com/chrispangg/deepagentsdk/blob/main/src/adapters/elements/createElementsRouteHandler.ts#L283))
- Before errors ([line 573](https://github.com/chrispangg/deepagentsdk/blob/main/src/adapters/elements/createElementsRouteHandler.ts#L573))
- Before completion ([line 588](https://github.com/chrispangg/deepagentsdk/blob/main/src/adapters/elements/createElementsRouteHandler.ts#L588))
- On stream completion ([line 195](https://github.com/chrispangg/deepagentsdk/blob/main/src/adapters/elements/createElementsRouteHandler.ts#L195))
- On error ([line 203](https://github.com/chrispangg/deepagentsdk/blob/main/src/adapters/elements/createElementsRouteHandler.ts#L203))

## Usage Examples

### Basic Usage (Standard AI Elements)

```typescript
// app/api/chat/route.ts
import { createDeepAgent } from 'deepagentsdk';
import { createElementsRouteHandler } from 'deepagentsdk/adapters/elements';
import { anthropic } from '@ai-sdk/anthropic';

const agent = createDeepAgent({
  model: anthropic('claude-sonnet-4-20250514'),
});

export const POST = createElementsRouteHandler({ agent });
```

### Custom Event Mapping (Advanced)

```typescript
// app/api/chat/route.ts
import { createElementsRouteHandler, mapEventToProtocol } from 'deepagentsdk/adapters/elements';
import { createDeepAgent } from 'deepagentsdk';

const agent = createDeepAgent({ model });

// Customize event mapping
function customMapper(event, writer, genId, currentTextId) {
  // Handle specific events differently
  if (event.type === 'file-written') {
    // Emit as source-document instead of data
    writer.write({
      type: 'source-document',
      sourceId: genId(),
      mediaType: 'text/markdown',
      title: event.path,
    });
    return currentTextId;
  }

  // Default to standard mapping
  return mapEventToProtocol(event, writer, genId, currentTextId);
}

export const POST = createElementsRouteHandler({
  agent,
  // Inject custom mapper by monkey-patching (or fork the handler)
});
```

### Accessing Custom Data Events

```typescript
// app/page.tsx
'use client';
import { useChat } from '@ai-sdk/react';

export default function Chat() {
  const { messages } = useChat({
    // Custom hook to intercept data parts
    experimental_onDataStream: ({ data }) => {
      if (data.type === 'data') {
        switch (data.name) {
          case 'file-written':
            console.log('File written:', data.data.path);
            break;
          case 'web-search-finish':
            console.log('Search results:', data.data.resultCount);
            break;
        }
      }
    },
  });

  // Render messages
  return (
    <div>
      {messages.map(m => (
        <Message key={m.id} message={m} />
      ))}
    </div>
  );
}
```

## Architecture Documentation

### Event Flow

```
┌──────────────────────────────────────────────────────────────┐
│ 1. User Request (UIMessage[])                                │
└────────────────────┬─────────────────────────────────────────┘
                     │
                     ▼
┌──────────────────────────────────────────────────────────────┐
│ 2. createElementsRouteHandler                                │
│    - Parse request                                           │
│    - Convert UIMessages to ModelMessages                     │
│    - Call agent.streamWithEvents()                           │
└────────────────────┬─────────────────────────────────────────┘
                     │
                     ▼
┌──────────────────────────────────────────────────────────────┐
│ 3. DeepAgent.streamWithEvents()                              │
│    - Call AI SDK streamText()                                │
│    - Iterate over fullStream chunks                          │
│    - Yield DeepAgentEvent for each chunk                     │
└────────────────────┬─────────────────────────────────────────┘
                     │
                     ▼
┌──────────────────────────────────────────────────────────────┐
│ 4. Event Loop (for await of events)                         │
│    - For each DeepAgentEvent:                                │
│      - Call mapEventToProtocol(event, ...)                    │
│      - writer.write(mapped part)                             │
└────────────────────┬─────────────────────────────────────────┘
                     │
                     ▼
┌──────────────────────────────────────────────────────────────┐
│ 5. mapEventToProtocol (Pure Function)                        │
│    - Switch on event.type                                    │
│    - Map to standard protocol part OR                        │
│    - Map to custom data part                                 │
│    - Return new currentTextId                                │
└────────────────────┬─────────────────────────────────────────┘
                     │
                     ▼
┌──────────────────────────────────────────────────────────────┐
│ 6. createUIMessageStreamResponse()                           │
│    - Wrap stream in HTTP Response                            │
│    - Set SSE headers                                         │
└────────────────────┬─────────────────────────────────────────┘
                     │
                     ▼
┌──────────────────────────────────────────────────────────────┐
│ 7. Client receives SSE stream                                │
│    - useChat() consumes stream                              │
│    - AI Elements render standard parts                       │
│    - Custom UI handles data parts                            │
└──────────────────────────────────────────────────────────────┘
```

### Code Organization

**Primary Files**:
- [`src/adapters/elements/createElementsRouteHandler.ts`](https://github.com/chrispangg/deepagentsdk/blob/main/src/adapters/elements/createElementsRouteHandler.ts) - Route handler factory + event mapper
- [`src/adapters/elements/index.ts`](https://github.com/chrispangg/deepagentsdk/blob/main/src/adapters/elements/index.ts) - Public exports

**Supporting Files**:
- [`src/agent.ts`](https://github.com/chrispangg/deepagentsdk/blob/main/src/agent.ts) - DeepAgent streaming implementation
- [`src/types/events.ts`](https://github.com/chrispangg/deepagentsdk/blob/main/src/types/events.ts) - Event type definitions
- [`src/tools/*.ts`](https://github.com/chrispangg/deepagentsdk/blob/main/src/tools/) - Tool implementations that emit events

## Testing Considerations

### Unit Testing `mapEventToProtocol`

```typescript
import { mapEventToProtocol } from 'deepagentsdk/adapters/elements';

test('maps tool-call event to tool-input-available', () => {
  const writer = { write: jest.fn() };
  const genId = () => 'test-id';

  const result = mapEventToProtocol(
    { type: 'tool-call', toolName: 'search', toolCallId: 'tc1', args: { query: 'test' } },
    writer,
    genId,
    null
  );

  expect(writer.write).toHaveBeenCalledWith({
    type: 'tool-input-available',
    toolCallId: 'tc1',
    toolName: 'search',
    input: { query: 'test' }
  });
});
```

### Integration Testing Event Streaming

```typescript
test('streams file-written event as data part', async () => {
  const handler = createElementsRouteHandler({ agent });

  const response = await handler(new Request('http://localhost/api/chat', {
    method: 'POST',
    body: JSON.stringify({ messages: [{ role: 'user', parts: [{ type: 'text', text: 'Write a file' }]] }),
  }));

  const reader = response.body.getReader();
  const chunks = [];

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(new TextDecoder().decode(value));
  }

  const fileEvent = chunks.find(c => c.includes('data') && c.includes('file-written'));
  expect(fileEvent).toBeDefined();
});
```

## Historical Context

### Previous Implementation

**Before** ([Commit `02bfb28`](https://github.com/chrispangg/deepagentsdk/blob/main/)):
- Only 8 event types mapped
- Monolithic switch statement embedded in handler
- 26+ event types silently ignored
- No extensibility for custom event handling

### Community Contribution

The implementation described in this research was based on a community-contributed `createFullEventsHandler` that demonstrated:
- **Better architecture**: Pure function event mapping
- **Complete coverage**: All 26+ events emitted as custom `data` parts
- **Production-tested**: Real-world usage with observability needs

This research validated the approach and led to adopting it as the official implementation.

## Related Research

- [Ticket 018: AI SDK Elements Integration Compatibility Research](https://github.com/chrispangg/deepagentsdk/blob/main/docs/tickets/018_ai_sdk_elements_integration/compatibility-research.md) - Initial compatibility analysis
- [Ticket 011: Provider Options Passthrough](https://github.com/chrispangg/deepagentsdk/blob/main/docs/tickets/011_provider_options_passthrough/research.md) - Extended thinking configuration
- [Streaming Protocol Documentation](https://ai-sdk.dev/docs/ai-sdk-ui/stream-protocol) - Official AI SDK protocol spec

## Open Questions

1. **Custom UI Components**: Should we provide example React components that render these custom data parts (e.g., `<FileOperationEvent />`, `<WebSearchEvent />`)?

2. **Event Filtering**: Should we add an option to filter which events are streamed (e.g., only critical events in production, all events in debug mode)?

3. **Source Citations**: Should we enhance web-search events to include structured results (URLs, titles) for better citation support?

4. **Performance**: For high-volume events (e.g., file reads), should we batch or throttle emissions to avoid overwhelming the client?

5. **Standard Protocol Parts**: Should we add a mapping mode that emits standard `source-url`/`source-document`/`file` parts instead of custom `data` parts for better AI Elements compatibility?
