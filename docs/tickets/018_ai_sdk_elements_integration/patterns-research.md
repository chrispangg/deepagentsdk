---
title: 018 AI SDK Elements Integration - Architecture Patterns Research
date: 2026-01-08
researcher: Claude Code
git_commit: a253333531cc03900a1981548cba400b55978416
branch: main
repository: chrispangg/deepagentsdk
topic: Industry Patterns for UI Library Integration with deepagentsdk
tags: [research, patterns, architecture, headless-ui, adapters, react, elements]
status: complete
last_updated: 2026-01-08
last_updated_by: Claude Code
---

# Architecture Patterns Research: AI SDK Elements Integration

## Research Question

What are the best industry patterns for integrating deepagentsdk with Vercel AI SDK Elements UI components? Which approach provides the most robust, ergonomic, and maintainable developer experience?

## Executive Summary

After analyzing patterns from TanStack (Query, Table, Form), Radix UI Primitives, Zustand, and the AI SDK ecosystem, we recommend a **Headless Core with Framework Adapter** architecture. This approach:

1. Keeps deepagentsdk framework-agnostic at its core
2. Provides a dedicated `@deepagentsdk/react` adapter package
3. Offers first-class AI SDK Elements compatibility via an optional `useElementsAdapter` hook
4. Maintains backwards compatibility with existing `useAgent` consumers

**Recommended Pattern: Headless Core + Adapter Layer**

```
deepagentsdk (core)           - Framework-agnostic, event-based
    ↓
@deepagentsdk/react           - React hooks (useAgent, useDeepAgent)
    ↓
@deepagentsdk/elements        - AI SDK Elements adapter (optional)
```

---

## Industry Patterns Analysis

### Pattern 1: Headless Core + Framework Adapters (TanStack Approach)

**Source:** [TanStack](https://tanstack.com/) (Query, Table, Form, Router)

**Architecture:**

```
@tanstack/query-core          ← Framework-agnostic core
    ↓
@tanstack/react-query         ← React adapter
@tanstack/vue-query           ← Vue adapter
@tanstack/solid-query         ← Solid adapter
@tanstack/angular-query       ← Angular adapter
```

**Key Principles:**

1. **Framework-agnostic core**: All business logic lives in a core package with no framework dependencies
2. **Thin adapters**: Framework packages are thin wrappers that connect the core to framework primitives
3. **Shared state model**: The core manages state; adapters subscribe and update UI
4. **Independent versioning**: Each adapter can evolve independently

**Why It Works:**

- **Portability**: Same mental model across frameworks
- **Testability**: Core can be tested without React/DOM
- **Bundle size**: Only ship what you use
- **Ecosystem**: Enables third-party adapters

**TanStack Query Example:**

```typescript
// Core: Framework-agnostic
import { QueryClient, QueryObserver } from '@tanstack/query-core';

const queryClient = new QueryClient();
const observer = new QueryObserver(queryClient, { queryKey: ['todos'] });

// React Adapter: Subscribes to core
import { useQuery } from '@tanstack/react-query';

function Todos() {
  const { data, status } = useQuery({ queryKey: ['todos'], queryFn: fetchTodos });
}
```

**Applicability to deepagentsdk:**

| Aspect | Current State | With Pattern |
|--------|---------------|--------------|
| Core | `DeepAgent` class | Extract to `@deepagentsdk/core` |
| React | `useAgent` in CLI | Extract to `@deepagentsdk/react` |
| Elements | None | Add `@deepagentsdk/elements` |

---

### Pattern 2: Primitives + Composition (Radix UI Approach)

**Source:** [Radix UI Primitives](https://www.radix-ui.com/primitives)

**Architecture:**

```
Radix Primitives              ← Unstyled, accessible components
    ↓
shadcn/ui                     ← Styled layer (copies source)
    ↓
AI SDK Elements               ← AI-specific styled layer
```

**Key Principles:**

1. **Unstyled by default**: Components ship with zero styles
2. **Open component architecture**: Every part is exposed and composable
3. **Controlled/Uncontrolled**: Work both ways out of the box
4. **Accessibility first**: WAI-ARIA compliance built-in

**Why It Works:**

- **Customization**: Full control over styling and behavior
- **Composition**: Build complex UIs from simple parts
- **No vendor lock-in**: Easy to swap or extend

**Radix Example:**

```typescript
// Primitives: Headless, composable
import * as Dialog from '@radix-ui/react-dialog';

<Dialog.Root>
  <Dialog.Trigger>Open</Dialog.Trigger>
  <Dialog.Portal>
    <Dialog.Overlay />
    <Dialog.Content>
      <Dialog.Title>Title</Dialog.Title>
      <Dialog.Description>Description</Dialog.Description>
      <Dialog.Close>Close</Dialog.Close>
    </Dialog.Content>
  </Dialog.Portal>
</Dialog.Root>
```

**Applicability to deepagentsdk:**

This pattern suggests we should expose **composable primitives** that Elements (or any UI) can consume:

```typescript
// Expose primitives, not just high-level hooks
import { useAgentStream, useAgentState, useAgentTools } from '@deepagentsdk/react';

// Each primitive is independently useful
const { textStream, status } = useAgentStream();
const { todos, files } = useAgentState();
const { toolCalls, pendingApproval } = useAgentTools();
```

---

### Pattern 3: Store + Selectors (Zustand Approach)

**Source:** [Zustand](https://github.com/pmndrs/zustand)

**Architecture:**

```
Zustand Store                 ← Minimal, hook-based store
    ↓
Selectors                     ← Derived state via selectors
    ↓
Components                    ← Subscribe to specific slices
```

**Key Principles:**

1. **Minimal API**: `create()` → store → `useStore(selector)`
2. **No providers needed**: Direct store access via hooks
3. **Selective subscriptions**: Components only re-render for their slice
4. **Middleware composition**: `devtools`, `persist`, `immer` chain together

**Why It Works:**

- **Simplicity**: Less boilerplate than Redux
- **Performance**: Built-in selective re-rendering
- **Flexibility**: Works with any React pattern
- **DevTools**: Redux DevTools integration

**Zustand Example:**

```typescript
// Store definition
const useAgentStore = create((set, get) => ({
  messages: [],
  status: 'idle',
  streamingText: '',

  sendPrompt: async (prompt) => {
    set({ status: 'streaming' });
    for await (const event of agent.streamWithEvents({ prompt })) {
      // Update store based on events
      if (event.type === 'text') {
        set({ streamingText: get().streamingText + event.text });
      }
    }
    set({ status: 'idle' });
  },
}));

// Component usage with selector
function StreamingText() {
  const text = useAgentStore((state) => state.streamingText);
  return <div>{text}</div>;
}
```

**Applicability to deepagentsdk:**

Expose agent state as a store that any UI can consume:

```typescript
import { createAgentStore } from '@deepagentsdk/react';

const useAgentStore = createAgentStore({ model, backend });

// Components select what they need
const status = useAgentStore(s => s.status);
const todos = useAgentStore(s => s.state.todos);
const toolCalls = useAgentStore(s => s.toolCalls);
```

---

### Pattern 4: Dual Output Mode (AI SDK Approach)

**Source:** [Vercel AI SDK](https://ai-sdk.dev/)

**Architecture:**

```
AI SDK Core                   ← Provider-agnostic
    ↓
streamText / generateText     ← Core streaming functions
    ↓
useChat / useCompletion       ← React hooks with UIMessage format
```

**Key Principles:**

1. **Multiple output formats**: Same input, different output shapes
2. **Progressive enhancement**: Start simple, add complexity
3. **Hook composition**: Hooks can be customized via options

**Applicability to deepagentsdk:**

Offer multiple output modes from the same core:

```typescript
// Mode 1: Event-based (current, for CLI/custom UIs)
for await (const event of agent.streamWithEvents({ prompt })) {
  // Raw events
}

// Mode 2: Message-parts format (for Elements)
const { messages, status } = await agent.streamAsUIMessages({ prompt });
// messages: UIMessage[] with parts array

// Mode 3: Simple text (for basic use cases)
const { text } = await agent.stream({ prompt });
```

---

### Pattern 5: Plugin/Middleware Architecture

**Source:** AI SDK middleware, Express.js, Koa

**Architecture:**

```
Core Pipeline                 ← Event stream
    ↓
Middleware 1                  ← Transform/observe
    ↓
Middleware 2                  ← Transform/observe
    ↓
Output                        ← Final format
```

**Key Principles:**

1. **Composable transformations**: Stack middlewares
2. **Non-invasive**: Core doesn't know about plugins
3. **Optional enhancement**: Only load what you need

**Applicability to deepagentsdk:**

Elements support as optional middleware:

```typescript
import { createDeepAgent } from 'deepagentsdk';
import { elementsMiddleware } from '@deepagentsdk/elements';

const agent = createDeepAgent({
  model,
  middleware: [elementsMiddleware()],  // Transforms output to UIMessage format
});
```

---

## Recommended Architecture

Based on the pattern analysis, we recommend a **hybrid approach** combining:

1. **TanStack's Headless Core** for framework independence
2. **Zustand's Store Pattern** for React state management
3. **Radix's Composition** for UI flexibility
4. **AI SDK's Dual Output** for format compatibility

### Proposed Package Structure

```
deepagentsdk/
├── packages/
│   ├── core/                      # @deepagentsdk/core
│   │   ├── src/
│   │   │   ├── agent.ts           # DeepAgent class
│   │   │   ├── events.ts          # Event types
│   │   │   ├── backends/          # Backend implementations
│   │   │   └── tools/             # Tool implementations
│   │   └── package.json
│   │
│   ├── react/                     # @deepagentsdk/react
│   │   ├── src/
│   │   │   ├── hooks/
│   │   │   │   ├── useAgent.ts    # Main hook (current)
│   │   │   │   ├── useAgentStore.ts # Zustand-based store
│   │   │   │   ├── useAgentStream.ts # Stream primitive
│   │   │   │   ├── useAgentState.ts  # State primitive
│   │   │   │   └── useAgentTools.ts  # Tools primitive
│   │   │   ├── context/
│   │   │   │   └── AgentProvider.tsx # Optional provider
│   │   │   └── index.ts
│   │   └── package.json
│   │
│   └── elements/                  # @deepagentsdk/elements
│       ├── src/
│       │   ├── adapters/
│       │   │   ├── useElementsAdapter.ts  # UIMessage adapter
│       │   │   ├── messageAdapter.ts      # Event → UIMessagePart
│       │   │   └── statusAdapter.ts       # Status mapping
│       │   ├── components/
│       │   │   ├── DeepAgentConversation.tsx
│       │   │   ├── DeepAgentMessage.tsx
│       │   │   └── DeepAgentTool.tsx
│       │   └── index.ts
│       └── package.json
```

### API Design

#### Level 1: Core (Framework-Agnostic)

```typescript
// @deepagentsdk/core
import { createDeepAgent, type DeepAgentEvent } from '@deepagentsdk/core';

const agent = createDeepAgent({ model, backend });

// Event-based streaming (current API, unchanged)
for await (const event of agent.streamWithEvents({ prompt })) {
  switch (event.type) {
    case 'text': console.log(event.text); break;
    case 'tool-call': console.log(event.toolName); break;
    case 'done': console.log(event.state); break;
  }
}
```

#### Level 2: React Hooks

```typescript
// @deepagentsdk/react
import { useAgent, useAgentStore, createAgentStore } from '@deepagentsdk/react';

// Option A: All-in-one hook (current pattern)
const {
  status,
  streamingText,
  messages,
  toolCalls,
  sendPrompt,
} = useAgent({ model, backend });

// Option B: Zustand store (new, recommended for complex apps)
const useMyAgentStore = createAgentStore({ model, backend });

function Component() {
  const status = useMyAgentStore(s => s.status);
  const sendPrompt = useMyAgentStore(s => s.sendPrompt);
}

// Option C: Primitive hooks (new, for composition)
const { stream, abort } = useAgentStream({ model, backend });
const { todos, files } = useAgentState();
const { toolCalls, pendingApproval, respondToApproval } = useAgentTools();
```

#### Level 3: Elements Adapter

```typescript
// @deepagentsdk/elements
import { useElementsAdapter } from '@deepagentsdk/elements';
import { Message, Conversation, Tool } from '@/components/ai-elements';

// Adapts useAgent output to Elements-compatible format
const {
  uiMessages,     // UIMessage[] with parts array
  uiStatus,       // 'submitted' | 'streaming' | 'ready' | 'error'
  toolParts,      // ToolUIPart[]
  sendMessage,    // Adapted submit handler
} = useElementsAdapter({ model, backend });

// Use directly with Elements
<Conversation>
  <ConversationContent>
    {uiMessages.map(msg => (
      <Message from={msg.role} key={msg.id}>
        <MessageContent>
          {msg.parts.map(part => (
            part.type === 'text'
              ? <MessageResponse>{part.text}</MessageResponse>
              : <Tool state="result" key={part.toolCallId}>
                  <ToolHeader title={part.toolName} />
                </Tool>
          ))}
        </MessageContent>
      </Message>
    ))}
  </ConversationContent>
</Conversation>
```

### Migration Path

#### Phase 1: Non-Breaking (Current Release)

1. Keep current `useAgent` in the main package
2. Add `useElementsAdapter` as an experimental export
3. Document Elements integration patterns

```typescript
// Current usage (unchanged)
import { useAgent } from 'deepagentsdk';

// New experimental usage
import { useElementsAdapter } from 'deepagentsdk/elements';
```

#### Phase 2: Package Split (Next Major)

1. Extract core to `@deepagentsdk/core`
2. Extract React hooks to `@deepagentsdk/react`
3. Create `@deepagentsdk/elements` adapter package
4. Main package re-exports for backwards compatibility

```typescript
// Old (still works)
import { createDeepAgent, useAgent } from 'deepagentsdk';

// New (recommended)
import { createDeepAgent } from '@deepagentsdk/core';
import { useAgent } from '@deepagentsdk/react';
import { useElementsAdapter } from '@deepagentsdk/elements';
```

#### Phase 3: Full Integration (Future)

1. Add Zustand-based store option
2. Add primitive hooks for composition
3. Provide pre-built Elements wrapper components
4. Support AI SDK's native `useChat` protocol

---

## Developer Experience Comparison

### Current Experience (No Elements Support)

```typescript
// Developer must build all UI from scratch
import { useAgent } from 'deepagentsdk';

function Chat() {
  const { status, streamingText, events, sendPrompt } = useAgent(options);

  return (
    <div>
      {/* Must manually render each event type */}
      {events.map(e => {
        if (e.type === 'text-segment') return <p>{e.event.text}</p>;
        if (e.type === 'tool-call') return <ToolCard {...e.event} />;
        // ... many more cases
      })}

      {/* Must build input from scratch */}
      <input onKeyDown={e => e.key === 'Enter' && sendPrompt(value)} />
    </div>
  );
}
```

**Pain Points:**

- Must handle 20+ event types manually
- No streaming text display components
- No tool visualization
- No accessibility built-in

### Proposed Experience (With Elements Adapter)

```typescript
// Developer uses pre-built, accessible components
import { useElementsAdapter } from '@deepagentsdk/elements';
import {
  Conversation,
  ConversationContent,
  Message,
  MessageContent,
  MessageResponse,
  Tool,
  ToolContent,
  PromptInput,
  PromptInputTextarea,
  PromptInputSubmit,
} from '@/components/ai-elements';

function Chat() {
  const { uiMessages, uiStatus, sendMessage } = useElementsAdapter(options);

  return (
    <Conversation>
      <ConversationContent>
        {uiMessages.map(msg => (
          <Message from={msg.role} key={msg.id}>
            <MessageContent>
              {msg.parts.map(renderPart)}
            </MessageContent>
          </Message>
        ))}
      </ConversationContent>

      <PromptInput onSubmit={sendMessage}>
        <PromptInputTextarea />
        <PromptInputSubmit status={uiStatus} />
      </PromptInput>
    </Conversation>
  );
}

function renderPart(part) {
  switch (part.type) {
    case 'text':
      return <MessageResponse>{part.text}</MessageResponse>;
    case 'tool-call':
      return (
        <Tool state="call">
          <ToolContent>
            <ToolInput>{JSON.stringify(part.args)}</ToolInput>
          </ToolContent>
        </Tool>
      );
    case 'tool-result':
      return (
        <Tool state="result">
          <ToolContent>
            <ToolOutput>{part.result}</ToolOutput>
          </ToolContent>
        </Tool>
      );
  }
}
```

**Benefits:**

- Pre-built, accessible components
- Streaming handled automatically
- Tool visualization included
- Consistent with AI SDK ecosystem

### Ultimate Experience (With Wrapper Components)

```typescript
// Developer uses zero-config wrapper components
import {
  DeepAgentChat,
  DeepAgentInput,
} from '@deepagentsdk/elements';

function Chat() {
  return (
    <DeepAgentChat model={model} backend={backend}>
      <DeepAgentInput placeholder="Ask anything..." />
    </DeepAgentChat>
  );
}
```

**Benefits:**

- Minimal boilerplate
- Sensible defaults
- Full customization via props/slots
- TypeScript autocomplete for all options

---

## Trade-off Analysis

| Pattern | Complexity | Flexibility | Bundle Size | Adoption Curve |
|---------|------------|-------------|-------------|----------------|
| Headless Core + Adapters | High initial | Very High | Optimal | Steep then flat |
| Store (Zustand-style) | Medium | High | Small | Gentle |
| Dual Output Mode | Low | Medium | Minimal | Very Gentle |
| Plugin/Middleware | Medium | High | Optimal | Medium |

**Recommendation:** Start with **Dual Output Mode** for quick wins, then evolve to **Headless Core + Adapters** for long-term maintainability.

---

## Implementation Recommendations

### Short-Term (Next Release)

1. **Add `useElementsAdapter` hook** to existing package
   - Transforms `DeepAgentEvent` stream to `UIMessage.parts` format
   - Maps status values to Elements-compatible status
   - Provides `sendMessage` callback compatible with `PromptInput`

2. **Document integration patterns**
   - Create "Using with AI SDK Elements" guide
   - Provide copy-paste examples for each component

3. **Add Elements-compatible types**
   - Export `UIMessage`, `UIMessagePart` types
   - Add type guards for part types

### Medium-Term (Following Release)

1. **Extract packages**
   - `@deepagentsdk/core` - Framework-agnostic
   - `@deepagentsdk/react` - React hooks
   - `@deepagentsdk/elements` - Elements adapter

2. **Add Zustand-based store option**
   - `createAgentStore()` factory
   - Selective subscriptions
   - DevTools integration

3. **Add primitive hooks**
   - `useAgentStream` - Just the stream
   - `useAgentState` - Just todos/files
   - `useAgentTools` - Just tool calls

### Long-Term (Future Major)

1. **Native `useChat` protocol support**
   - Implement transport interface from AI SDK
   - Allow Elements to work directly without adapter

2. **Pre-built wrapper components**
   - `<DeepAgentChat>` - Full chat experience
   - `<DeepAgentMessage>` - Single message
   - `<DeepAgentTool>` - Tool visualization

3. **Server Components support**
   - RSC-compatible streaming
   - Server-side rendering support

---

## External References

- [TanStack Architecture](https://tanstack.com/) - Headless core + adapters pattern
- [Radix UI Primitives](https://www.radix-ui.com/primitives) - Composition pattern
- [Zustand](https://github.com/pmndrs/zustand) - Minimal store pattern
- [AI SDK Elements](https://ai-sdk.dev/elements) - Target UI library
- [AI SDK useChat](https://ai-sdk.dev/docs/reference/ai-sdk-ui/use-chat) - Reference hook API
- [TkDodo's Blog](https://tanstack.com/query/v4/docs/framework/react/community/tkdodos-blog) - React Query architecture deep-dive
- [LogRocket: AI Elements](https://blog.logrocket.com/vercel-ai-elements/) - Elements usage patterns

---

## Conclusion

The recommended approach is a **phased evolution** from the current monolithic structure to a headless core + adapter architecture:

1. **Phase 1**: Add `useElementsAdapter` hook (non-breaking)
2. **Phase 2**: Split into `core`, `react`, `elements` packages
3. **Phase 3**: Add store pattern and wrapper components

This approach:

- Maintains backwards compatibility
- Enables incremental adoption
- Follows industry best practices
- Provides optimal developer experience
- Sets foundation for future framework support (Vue, Solid, etc.)
