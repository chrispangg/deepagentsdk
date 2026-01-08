---
title: AI SDK Elements Integration
description: Enable first-class support for Vercel AI SDK Elements UI components
priority: high
status: research-complete
---

## Overview

Add robust support for Vercel AI SDK Elements UI components to deepagentsdk, enabling developers to build production-ready AI chat interfaces with minimal boilerplate while maintaining full control over agent behavior.

**Ticket**: 018_ai_sdk_elements_integration
**Research Documents**:

- `compatibility-research.md` - Component-by-component compatibility analysis
- `patterns-research.md` - Industry patterns and architecture recommendations
**Estimated Effort**: 2-3 weeks (phased)
**Complexity**: Medium-High (architectural changes required)

---

## Problem Statement

### Current State

1. **deepagentsdk uses custom event streaming** (`DeepAgentEvent`)
2. **AI SDK Elements expects `useChat` format** (`UIMessage.parts[]`)
3. **No adapter layer exists** between these formats
4. **Developers must build UI from scratch** or write custom adapters

### Developer Pain Points

- Must manually handle 20+ event types for UI rendering
- No pre-built components for tool visualization, reasoning display
- No accessibility features built-in
- Duplicating effort that Elements already solves

### Impact

- Slower time-to-production for deepagentsdk users
- Inconsistent UX across applications
- Missing accessibility features
- Barrier to adoption for teams using AI SDK Elements

---

## Desired End State

### Phase 1: Adapter Hook (Quick Win)

```typescript
import { useElementsAdapter } from 'deepagentsdk/elements';
import { Conversation, Message, PromptInput } from '@/components/ai-elements';

function Chat() {
  const {
    uiMessages,  // UIMessage[] with parts
    uiStatus,    // Elements-compatible status
    sendMessage, // Submit handler
  } = useElementsAdapter({ model, backend });

  return (
    <Conversation>
      {uiMessages.map(msg => <Message from={msg.role} key={msg.id} />)}
      <PromptInput onSubmit={sendMessage} />
    </Conversation>
  );
}
```

### Phase 2: Separate Packages

```
@deepagentsdk/core      - Framework-agnostic agent
@deepagentsdk/react     - React hooks
@deepagentsdk/elements  - Elements adapter
```

### Phase 3: Zero-Config Components

```typescript
import { DeepAgentChat } from '@deepagentsdk/elements';

function Chat() {
  return <DeepAgentChat model={model} backend={backend} />;
}
```

---

## Compatibility Summary

Based on research in `compatibility-research.md`:

| Status | Count | Components |
|--------|-------|------------|
| Works Out-of-Box | 12 | PromptInput, Task, Sources, Suggestion, ModelSelector, Shimmer, Confirmation, InlineCitation, CodeBlock, Image, Artifact, WebPreview |
| Works with Adaptation | 8 | Message, Conversation, Tool, Reasoning, Queue, Checkpoint, ChainOfThought, Plan |
| Incompatible | 1 | Context (token usage not exposed) |

### Key Mappings Required

| deepagentsdk | AI SDK Elements |
|--------------|-----------------|
| `DeepAgentEvent` | `UIMessagePart` |
| `AgentStatus` | `'submitted' | 'streaming' | 'ready' | 'error'` |
| `TodoItem` | `TaskItem` |
| `ToolCallEvent` + `ToolResultEvent` | `tool-call` + `tool-result` parts |
| `ApprovalRequestedEvent` | Confirmation component props |

---

## Architecture Decision

Based on research in `patterns-research.md`, we recommend:

**Headless Core + Framework Adapters** (TanStack pattern)

```
deepagentsdk (core)           - Framework-agnostic, event-based
    ↓
@deepagentsdk/react           - React hooks
    ↓
@deepagentsdk/elements        - AI SDK Elements adapter
```

### Why This Pattern?

1. **Framework independence** - Can support Vue, Solid, Angular later
2. **Optimal bundle size** - Only ship what you use
3. **Testability** - Core tested without React
4. **Industry proven** - TanStack, Radix, Zustand all use this

---

## Implementation Phases

### Phase 1: Adapter Hook (Non-Breaking)

**Scope**: Add `useElementsAdapter` to existing package

**Files to Create**:

```
src/
├── adapters/
│   └── elements/
│       ├── index.ts
│       ├── useElementsAdapter.ts
│       ├── messageAdapter.ts
│       ├── statusAdapter.ts
│       └── types.ts
```

**API**:

```typescript
// New export from main package
export { useElementsAdapter } from './adapters/elements';

// Types
export interface UseElementsAdapterReturn {
  uiMessages: UIMessage[];
  uiStatus: 'submitted' | 'streaming' | 'ready' | 'error';
  toolParts: ToolUIPart[];
  sendMessage: (message: PromptInputMessage) => Promise<void>;
  abort: () => void;
  clear: () => void;
}
```

**Acceptance Criteria**:

- [ ] `useElementsAdapter` hook works with all Elements components
- [ ] Status mapping is correct for all agent states
- [ ] Tool calls display correctly in Tool component
- [ ] Streaming text renders in Message component
- [ ] PromptInput integrates seamlessly
- [ ] Unit tests for all adapters
- [ ] Documentation with examples

### Phase 2: Package Split

**Scope**: Extract to separate packages

**New Package Structure**:

```
packages/
├── core/           # @deepagentsdk/core
├── react/          # @deepagentsdk/react
└── elements/       # @deepagentsdk/elements
```

**Acceptance Criteria**:

- [ ] `@deepagentsdk/core` is framework-agnostic
- [ ] `@deepagentsdk/react` re-exports `useAgent`
- [ ] `@deepagentsdk/elements` provides `useElementsAdapter`
- [ ] Main package re-exports for backwards compatibility
- [ ] All existing tests pass
- [ ] Migration guide documented

### Phase 3: Enhanced Integration

**Scope**: Zustand store + wrapper components

**API**:

```typescript
// Store option
import { createAgentStore } from '@deepagentsdk/react';
const useStore = createAgentStore({ model, backend });

// Wrapper components
import { DeepAgentChat, DeepAgentInput } from '@deepagentsdk/elements';
<DeepAgentChat model={model}>
  <DeepAgentInput />
</DeepAgentChat>
```

**Acceptance Criteria**:

- [ ] Store enables selective re-rendering
- [ ] DevTools integration works
- [ ] Wrapper components are customizable
- [ ] Zero-config defaults work out of box

---

## Technical Approach

### Message Transformation

```typescript
// src/adapters/elements/messageAdapter.ts

export function convertEventsToUIMessages(
  events: AgentEventLog[],
  streamingText: string
): UIMessage[] {
  const messages: UIMessage[] = [];
  let currentAssistantParts: UIMessagePart[] = [];

  for (const event of events) {
    switch (event.type) {
      case 'user-message':
        // Flush assistant parts if any
        if (currentAssistantParts.length > 0) {
          messages.push({
            id: generateId(),
            role: 'assistant',
            parts: currentAssistantParts,
            status: 'ready',
          });
          currentAssistantParts = [];
        }
        // Add user message
        messages.push({
          id: event.id,
          role: 'user',
          parts: [{ type: 'text', text: event.event.content }],
          status: 'ready',
        });
        break;

      case 'text-segment':
        currentAssistantParts.push({
          type: 'text',
          text: event.event.text,
        });
        break;

      case 'tool-call':
        currentAssistantParts.push({
          type: 'tool-call',
          toolName: event.event.toolName,
          toolCallId: event.event.toolCallId,
          args: event.event.args,
        });
        break;

      case 'tool-result':
        currentAssistantParts.push({
          type: 'tool-result',
          toolCallId: event.event.toolCallId,
          result: event.event.result,
        });
        break;
    }
  }

  // Add streaming text as in-progress message
  if (streamingText || currentAssistantParts.length > 0) {
    if (streamingText) {
      currentAssistantParts.push({ type: 'text', text: streamingText });
    }
    messages.push({
      id: 'streaming',
      role: 'assistant',
      parts: currentAssistantParts,
      status: 'streaming',
    });
  }

  return messages;
}
```

### Status Mapping

```typescript
// src/adapters/elements/statusAdapter.ts

export function mapAgentStatusToUIStatus(
  agentStatus: AgentStatus
): 'submitted' | 'streaming' | 'ready' | 'error' {
  switch (agentStatus) {
    case 'thinking':
    case 'tool-call':
    case 'subagent':
      return 'submitted';
    case 'streaming':
      return 'streaming';
    case 'error':
      return 'error';
    case 'idle':
    case 'done':
    default:
      return 'ready';
  }
}
```

---

## Testing Strategy

### Unit Tests

```typescript
// test/adapters/elements/messageAdapter.test.ts
import { test, expect } from 'bun:test';
import { convertEventsToUIMessages } from '../../../src/adapters/elements/messageAdapter';

test('converts text events to text parts', () => {
  const events = [
    { id: '1', type: 'text-segment', event: { type: 'text-segment', text: 'Hello' } },
  ];

  const messages = convertEventsToUIMessages(events, '');

  expect(messages).toHaveLength(1);
  expect(messages[0].parts[0]).toEqual({ type: 'text', text: 'Hello' });
});

test('converts tool-call events to tool-call parts', () => {
  const events = [
    {
      id: '1',
      type: 'tool-call',
      event: {
        type: 'tool-call',
        toolName: 'write_todos',
        toolCallId: 'call-1',
        args: { todos: [] },
      },
    },
  ];

  const messages = convertEventsToUIMessages(events, '');

  expect(messages[0].parts[0].type).toBe('tool-call');
  expect(messages[0].parts[0].toolName).toBe('write_todos');
});
```

### Integration Tests

```typescript
// test-integration/elements-adapter.test.ts
import { test, expect } from 'bun:test';
import { renderHook, waitFor } from '@testing-library/react';
import { useElementsAdapter } from '../src/adapters/elements';

test('useElementsAdapter provides Elements-compatible output', async () => {
  const { result } = renderHook(() =>
    useElementsAdapter({ model, backend })
  );

  await act(() => result.current.sendMessage({ text: 'Hello' }));

  await waitFor(() => {
    expect(result.current.uiMessages).toHaveLength(2);
    expect(result.current.uiMessages[0].role).toBe('user');
    expect(result.current.uiMessages[1].role).toBe('assistant');
  });
});
```

---

## Documentation Plan

### New Docs

1. **Guide: Using with AI SDK Elements** (`docs/site/handbook/guides/elements-integration.mdx`)
   - Installation
   - Basic usage with `useElementsAdapter`
   - Component-by-component examples
   - Customization patterns

2. **Reference: Elements Adapter API** (`docs/site/handbook/reference/elements-adapter.mdx`)
   - `useElementsAdapter` API
   - Type definitions
   - Status mapping reference

3. **Example: Elements Chat** (`examples/elements-chat/`)
   - Full working example with all Elements components
   - Shows todos, tools, confirmation dialogs

---

## Success Metrics

1. **Developer Experience**: Build a full chat UI in <50 lines of code
2. **Compatibility**: 90%+ of Elements components work without modification
3. **Performance**: No measurable overhead vs direct Elements usage
4. **Adoption**: Track npm downloads of `@deepagentsdk/elements`

---

## Risks & Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| Elements API changes | High | Pin to tested Elements version, add version matrix |
| Breaking existing `useAgent` users | High | Non-breaking adapter, no changes to core API |
| Bundle size increase | Medium | Tree-shakeable exports, optional package |
| Maintenance burden | Medium | Automated tests, integration CI |

---

## Open Questions

1. **Should we support `useChat` protocol directly?**
   - Pro: Native Elements compatibility
   - Con: Significant architectural change

2. **Should wrapper components be in separate package?**
   - Pro: Smaller core bundle
   - Con: More packages to maintain

3. **How to handle token usage for Context component?**
   - Option A: Add token usage events to core
   - Option B: Mark Context as unsupported
   - Option C: Provide estimation utilities

---

## Related Work

- **Ticket 004**: Middleware Architecture (enables plugin-based Elements support)
- **Ticket 007**: Structured Output (pattern for optional features)
- **Ticket 014**: Telemetry (could expose token usage for Context)
