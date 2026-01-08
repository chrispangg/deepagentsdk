---
date: 2026-01-08
researcher: Claude Code
git_commit: a253333531cc03900a1981548cba400b55978416
branch: main
repository: chrispangg/deepagentsdk
topic: "Vercel AI SDK Elements UI Component Compatibility with deepagentsdk"
tags: [research, compatibility, ui-components, ai-sdk-elements, vercel, react]
status: complete
last_updated: 2026-01-08
last_updated_by: Claude Code
---

# Research: Vercel AI SDK Elements Compatibility with deepagentsdk

## Research Question

Analyze the architectural compatibility between deepagentsdk (AI SDK v6 ToolLoopAgent-based framework with virtual filesystem, todos, and subagent spawning) and Vercel AI SDK Elements UI components. For each Elements component category, determine: (1) whether it works out-of-box with deepagentsdk's streaming and state management patterns, (2) what adaptations are required for integration, or (3) whether architectural incompatibilities prevent usage.

## Summary

**Overall Compatibility: Moderate with Required Adaptations**

deepagentsdk and AI SDK Elements share the same foundation (Vercel AI SDK v6), but have architectural differences that require adapter code for integration. The primary gap is that Elements expects the `useChat` hook's message format with `parts` array, while deepagentsdk uses a custom `useAgent` hook with `DeepAgentEvent` streaming. However, since both use AI SDK's `ModelMessage` type under the hood, adaptation is feasible.

### Quick Reference

| Component Category | Compatibility | Required Work |
|-------------------|---------------|---------------|
| Message/Conversation | Works with adaptation | Transform `DeepAgentEvent` to `UIMessage.parts` |
| Prompt Input | Works out-of-box | Wire to `sendPrompt()` |
| Tool | Works with adaptation | Map `ToolCallEvent`/`ToolResultEvent` to tool parts |
| Task | High compatibility | Map `TodoItem` to Task component props |
| Reasoning | Works with adaptation | Create reasoning events from extended thinking |
| Sources | Works out-of-box | Pass source data directly |
| Suggestion | Works out-of-box | No AI SDK dependency |
| Model Selector | Works out-of-box | No AI SDK dependency |
| Shimmer | Works out-of-box | Pure loading animation |
| Queue | Works with adaptation | Map `DeepAgentState.todos` |
| Confirmation | High compatibility | Wire to `onApprovalRequest` |
| Checkpoint | Works with adaptation | Map to checkpointer events |
| Context | Limited | Token counting not exposed by deepagentsdk |
| Chain of Thought | Works with adaptation | Aggregate step events |
| Plan | Works with adaptation | Map todo structure |
| Inline Citation | Works out-of-box | Pass citation data directly |

---

## Detailed Findings

### 1. Message Components

**Components:** `Message`, `MessageContent`, `MessageResponse`, `MessageBranch`, `MessageBranchSelector`

**Elements Expected Format:**

```typescript
// From useChat hook
interface UIMessage {
  id: string;
  role: 'system' | 'user' | 'assistant';
  parts: UIMessagePart[];  // Key difference
  status: 'submitted' | 'streaming' | 'ready' | 'error';
}

// Parts can be text, tool-call, or tool-result
type UIMessagePart =
  | { type: 'text'; text: string }
  | { type: 'tool-call'; toolName: string; toolCallId: string; args: unknown }
  | { type: 'tool-result'; toolCallId: string; result: unknown };
```

**deepagentsdk Output Format:**

```typescript
// From useAgent hook (src/cli/hooks/useAgent.ts:58-113)
interface UseAgentReturn {
  status: 'idle' | 'thinking' | 'streaming' | 'tool-call' | 'subagent' | 'done' | 'error';
  streamingText: string;
  messages: ModelMessage[];  // AI SDK ModelMessage type
  events: AgentEventLog[];   // Custom event format
  toolCalls: ToolCallData[];
}
```

**Compatibility Assessment: Works with Adaptation**

The core `ModelMessage` type is compatible, but deepagentsdk streams via `DeepAgentEvent` rather than the `parts` array format.

**Adaptation Required:**

```typescript
// Adapter: Convert deepagentsdk events to UIMessage parts
function convertEventsToMessageParts(
  events: AgentEventLog[],
  streamingText: string
): UIMessagePart[] {
  const parts: UIMessagePart[] = [];

  for (const event of events) {
    switch (event.type) {
      case 'text-segment':
        parts.push({ type: 'text', text: event.event.text });
        break;
      case 'tool-call':
        const tc = event.event as ToolCallEvent;
        parts.push({
          type: 'tool-call',
          toolName: tc.toolName,
          toolCallId: tc.toolCallId,
          args: tc.args
        });
        break;
      case 'tool-result':
        const tr = event.event as ToolResultEvent;
        parts.push({
          type: 'tool-result',
          toolCallId: tr.toolCallId,
          result: tr.result
        });
        break;
    }
  }

  // Add current streaming text as final text part
  if (streamingText) {
    parts.push({ type: 'text', text: streamingText });
  }

  return parts;
}
```

**Code Reference:** `src/cli/hooks/useAgent.ts:136-142` for message state, `src/types/events.ts:42-57` for tool events

---

### 2. Conversation Components

**Components:** `Conversation`, `ConversationContent`, `ConversationScrollButton`, `ConversationEmptyState`

**Compatibility Assessment: Works with Adaptation**

These are container/layout components that wrap messages. They expect children to be `Message` components. Once the Message adaptation is done, Conversation works.

**Key Integration Point:**

```typescript
// Elements pattern
<Conversation>
  <ConversationContent>
    {messages.map(msg => (
      <Message from={msg.role} key={msg.id}>
        <MessageContent>{msg.parts.map(renderPart)}</MessageContent>
      </Message>
    ))}
  </ConversationContent>
</Conversation>

// deepagentsdk integration
const { events, streamingText, status } = useAgent(options);
const adaptedMessages = convertEventsToUIMessages(events, streamingText);
```

---

### 3. Prompt Input Components

**Components:** `PromptInput`, `PromptInputTextarea`, `PromptInputSubmit`, `PromptInputAttachments`, `PromptInputButton`, `PromptInputTools`, etc.

**Compatibility Assessment: Works Out-of-Box**

PromptInput is a self-contained input component that emits a `PromptInputMessage` on submit. This maps directly to deepagentsdk's `sendPrompt()`.

**Integration Pattern:**

```typescript
const { sendPrompt, status } = useAgent(options);

<PromptInput onSubmit={(message) => sendPrompt(message.text)}>
  <PromptInputBody>
    <PromptInputTextarea />
  </PromptInputBody>
  <PromptInputFooter>
    <PromptInputSubmit status={mapStatus(status)} />
  </PromptInputFooter>
</PromptInput>

// Status mapping
function mapStatus(agentStatus: AgentStatus): 'submitted' | 'streaming' | 'ready' | 'error' {
  switch (agentStatus) {
    case 'thinking':
    case 'tool-call':
    case 'subagent':
      return 'submitted';
    case 'streaming':
      return 'streaming';
    case 'error':
      return 'error';
    default:
      return 'ready';
  }
}
```

---

### 4. Tool Components

**Components:** `Tool`, `ToolContent`, `ToolHeader`, `ToolInput`, `ToolOutput`

**Elements Expected Format:**

```typescript
// From message.parts with type === 'tool-call'
{ type: 'tool-call', toolName: string, toolCallId: string, args: unknown }
{ type: 'tool-result', toolCallId: string, result: unknown }
```

**deepagentsdk Format:**

```typescript
// src/types/events.ts:42-57
interface ToolCallEvent {
  type: 'tool-call';
  toolName: string;
  toolCallId: string;
  args: unknown;
}

interface ToolResultEvent {
  type: 'tool-result';
  toolName: string;
  toolCallId: string;
  result: unknown;
}
```

**Compatibility Assessment: High Compatibility with Minor Adaptation**

The data structures are nearly identical. deepagentsdk includes `toolName` in results (Elements infers from call), but otherwise matches perfectly.

**Integration Pattern:**

```typescript
// Map deepagentsdk ToolCallData to Elements Tool component
const { toolCalls } = useAgent(options);

{toolCalls.map(tc => (
  <Tool key={tc.toolCallId} state={tc.status === 'success' ? 'result' : 'call'}>
    <ToolHeader title={tc.toolName} />
    <ToolContent>
      <ToolInput>{JSON.stringify(tc.args, null, 2)}</ToolInput>
      {tc.result && <ToolOutput>{tc.result}</ToolOutput>}
    </ToolContent>
  </Tool>
))}
```

**Code Reference:** `src/cli/hooks/useAgent.ts:318-357` for tool call tracking

---

### 5. Task Components

**Components:** `Task`, `TaskTrigger`, `TaskContent`, `TaskItem`, `TaskItemFile`

**Elements Expected Format:**

```typescript
// Task items with status indicators
interface TaskItem {
  title: string;
  status: 'pending' | 'in-progress' | 'completed' | 'error';
  description?: string;
}
```

**deepagentsdk Format:**

```typescript
// src/types/core.ts:51-58
interface TodoItem {
  id: string;
  content: string;
  status: 'pending' | 'in_progress' | 'completed' | 'cancelled';
}
```

**Compatibility Assessment: High Compatibility**

Status values are nearly identical (snake_case vs kebab-case, 'cancelled' vs 'error'). Content maps to title.

**Integration Pattern:**

```typescript
const { state } = useAgent(options);

<Task>
  <TaskTrigger title={`Tasks (${completedCount}/${state.todos.length})`} />
  <TaskContent>
    {state.todos.map(todo => (
      <TaskItem
        key={todo.id}
        status={mapTodoStatus(todo.status)}
        title={todo.content}
      />
    ))}
  </TaskContent>
</Task>

function mapTodoStatus(status: TodoItem['status']): TaskStatus {
  const map = {
    'pending': 'pending',
    'in_progress': 'in-progress',
    'completed': 'completed',
    'cancelled': 'error'
  };
  return map[status];
}
```

**Code Reference:** `src/types/core.ts:51-58` for TodoItem, `src/tools/todos.ts:7-20` for TodoItemSchema

---

### 6. Reasoning Components

**Components:** `Reasoning`, `ReasoningContent`, `ReasoningTrigger`

**Elements Expected Format:**

```typescript
// Collapsible reasoning display with duration
interface ReasoningProps {
  duration?: number;  // seconds of thinking
  children: ReactNode; // reasoning content
}
```

**deepagentsdk Format:**

deepagentsdk does not currently emit dedicated reasoning events. However, step events could be aggregated to simulate reasoning.

**Compatibility Assessment: Works with Adaptation**

**Adaptation Required:**

```typescript
// Create reasoning from step aggregation
function extractReasoning(events: AgentEventLog[]): { content: string; duration: number } | null {
  const stepEvents = events.filter(e =>
    e.type === 'step-start' || e.type === 'step-finish'
  );

  if (stepEvents.length < 2) return null;

  const firstStep = stepEvents[0];
  const lastStep = stepEvents[stepEvents.length - 1];
  const duration = (lastStep.timestamp.getTime() - firstStep.timestamp.getTime()) / 1000;

  // Aggregate tool call descriptions as "reasoning"
  const toolEvents = events.filter(e => e.type === 'tool-call');
  const content = toolEvents.map(e =>
    `Called ${e.event.toolName} with ${JSON.stringify(e.event.args)}`
  ).join('\n');

  return { content, duration };
}
```

**Enhancement Opportunity:** deepagentsdk could add a `ReasoningEvent` type to expose model thinking when available (e.g., from Claude's extended thinking).

---

### 7. Sources Components

**Components:** `Sources`, `SourcesContent`, `SourcesTrigger`, `Source`

**Elements Expected Format:**

```typescript
interface Source {
  href: string;
  title: string;
}
```

**Compatibility Assessment: Works Out-of-Box**

Sources is a pure display component with no AI SDK hook dependencies. Pass source data directly.

**Integration Pattern:**

```typescript
// Extract sources from tool results (e.g., web search)
const webSearchEvents = events.filter(e => e.type === 'web-search-finish');
const sources = webSearchEvents.flatMap(e => e.event.results || []);

<Sources>
  <SourcesTrigger count={sources.length} />
  <SourcesContent>
    {sources.map(s => <Source href={s.url} title={s.title} key={s.url} />)}
  </SourcesContent>
</Sources>
```

---

### 8. Suggestion Components

**Components:** `Suggestion`, `Suggestions`

**Compatibility Assessment: Works Out-of-Box**

Pure UI component with no AI SDK dependencies. Just renders clickable suggestion chips.

```typescript
<Suggestions>
  {suggestions.map(s => (
    <Suggestion
      key={s}
      suggestion={s}
      onClick={() => sendPrompt(s)}
    />
  ))}
</Suggestions>
```

---

### 9. Model Selector Components

**Components:** `ModelSelector`, `ModelSelectorTrigger`, `ModelSelectorContent`, `ModelSelectorItem`, etc.

**Compatibility Assessment: Works Out-of-Box**

Pure UI component for model selection. deepagentsdk's `useAgent` exposes `setModel()` for model changes.

```typescript
const { currentModel, setModel } = useAgent(options);

<ModelSelector>
  <ModelSelectorTrigger>
    <ModelSelectorName>{currentModel}</ModelSelectorName>
  </ModelSelectorTrigger>
  <ModelSelectorContent>
    {models.map(m => (
      <ModelSelectorItem
        key={m.id}
        value={m.id}
        onSelect={() => setModel(m.id)}
      />
    ))}
  </ModelSelectorContent>
</ModelSelector>
```

**Code Reference:** `src/cli/hooks/useAgent.ts:837-843` for setModel

---

### 10. Shimmer Components

**Components:** `Shimmer`

**Compatibility Assessment: Works Out-of-Box**

Pure CSS animation component for loading states. No AI SDK dependencies.

```typescript
const { status } = useAgent(options);

{status === 'thinking' && <Shimmer>Thinking...</Shimmer>}
```

---

### 11. Queue Components

**Components:** `Queue`, `QueueGroup`, `QueueItem`, `QueueTodo`

**Elements Expected Format:**

```typescript
// List of items with collapsible groups
interface QueueItemProps {
  title: string;
  description?: string;
}
```

**Compatibility Assessment: Works with Adaptation**

Maps to deepagentsdk's todo list structure.

```typescript
const { state } = useAgent(options);

<Queue>
  <QueueGroup title="Tasks">
    {state.todos.map(todo => (
      <QueueItem key={todo.id} title={todo.content} />
    ))}
  </QueueGroup>
</Queue>
```

---

### 12. Confirmation Components

**Components:** `Confirmation`

**Elements Expected Format:**

```typescript
// Alert-based approval workflow
interface ConfirmationProps {
  title: string;
  description: string;
  onConfirm: () => void;
  onCancel: () => void;
  state: 'pending' | 'approved' | 'denied';
}
```

**deepagentsdk Format:**

```typescript
// src/types/events.ts:294-315
interface ApprovalRequestedEvent {
  type: 'approval-requested';
  approvalId: string;
  toolCallId: string;
  toolName: string;
  args: unknown;
}
```

**Compatibility Assessment: High Compatibility**

deepagentsdk's approval system maps well to Confirmation.

```typescript
const { pendingApproval, respondToApproval } = useAgent(options);

{pendingApproval && (
  <Confirmation
    title={`Approve ${pendingApproval.toolName}?`}
    description={JSON.stringify(pendingApproval.args)}
    state="pending"
    onConfirm={() => respondToApproval(true)}
    onCancel={() => respondToApproval(false)}
  />
)}
```

**Code Reference:** `src/cli/hooks/useAgent.ts:875-889` for respondToApproval

---

### 13. Checkpoint Components

**Components:** `Checkpoint`

**Elements Expected Format:**

```typescript
// Marks conversation restoration points
interface CheckpointProps {
  onRestore: () => void;
}
```

**deepagentsdk Format:**

```typescript
// src/types/events.ts:320-339
interface CheckpointSavedEvent {
  type: 'checkpoint-saved';
  threadId: string;
  step: number;
}

interface CheckpointLoadedEvent {
  type: 'checkpoint-loaded';
  threadId: string;
  step: number;
  messagesCount: number;
}
```

**Compatibility Assessment: Works with Adaptation**

deepagentsdk has full checkpointing support via `BaseCheckpointSaver`.

```typescript
const checkpointEvents = events.filter(e =>
  e.type === 'checkpoint-saved' || e.type === 'checkpoint-loaded'
);

{checkpointEvents.map(e => (
  <Checkpoint
    key={e.id}
    step={e.event.step}
    onRestore={() => loadCheckpoint(e.event.threadId, e.event.step)}
  />
))}
```

---

### 14. Context Components

**Components:** `Context`, `ContextWindow`, `ContextUsage`

**Elements Expected Format:**

```typescript
// Token usage display
interface ContextProps {
  inputTokens: number;
  outputTokens: number;
  maxTokens: number;
}
```

**Compatibility Assessment: Limited - Not Currently Exposed**

deepagentsdk does not currently expose token usage metrics. The AI SDK's streamText result includes usage data, but it's not surfaced through deepagentsdk's event system.

**Enhancement Opportunity:** Add `TokenUsageEvent` to deepagentsdk:

```typescript
interface TokenUsageEvent {
  type: 'token-usage';
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
}
```

---

### 15. Chain of Thought Components

**Components:** `ChainOfThought`, `ChainOfThoughtContent`, `ChainOfThoughtTrigger`

**Compatibility Assessment: Works with Adaptation**

Similar to Reasoning, but designed for search results and multi-step thinking.

```typescript
// Aggregate step events as chain of thought
const steps = events.filter(e => e.type === 'step-finish');

<ChainOfThought>
  <ChainOfThoughtTrigger />
  <ChainOfThoughtContent>
    {steps.map((step, i) => (
      <div key={i}>
        Step {i + 1}: {step.event.toolCalls.length} tool calls
      </div>
    ))}
  </ChainOfThoughtContent>
</ChainOfThought>
```

---

### 16. Plan Components

**Components:** `Plan`, `PlanContent`, `PlanTrigger`, `PlanItem`

**Compatibility Assessment: Works with Adaptation**

Maps to deepagentsdk's todo system as a plan visualization.

```typescript
const { state } = useAgent(options);

<Plan>
  <PlanTrigger>Execution Plan</PlanTrigger>
  <PlanContent>
    {state.todos.map((todo, i) => (
      <PlanItem
        key={todo.id}
        step={i + 1}
        title={todo.content}
        status={mapTodoStatus(todo.status)}
      />
    ))}
  </PlanContent>
</Plan>
```

---

### 17. Inline Citation Components

**Components:** `InlineCitation`, `InlineCitationTrigger`, `InlineCitationContent`

**Compatibility Assessment: Works Out-of-Box**

Pure display component for hoverable citations. No AI SDK dependencies.

---

## Architecture Compatibility Analysis

### Why Adaptation is Needed

1. **Hook Architecture Difference:**
   - Elements designed for `useChat` from `@ai-sdk/react`
   - deepagentsdk uses custom `useAgent` hook with event-based streaming

2. **Message Format:**
   - Elements expects `message.parts[]` array
   - deepagentsdk uses `DeepAgentEvent` stream that must be converted

3. **State Management:**
   - Elements relies on `useChat`'s internal state
   - deepagentsdk manages state via backends (StateBackend, FilesystemBackend, etc.)

### Recommended Integration Approach

Create an adapter layer that converts deepagentsdk's output to Elements-compatible format:

```typescript
// hooks/useDeepAgentWithElements.ts
import { useAgent, type UseAgentOptions } from 'deepagentsdk';

export function useDeepAgentWithElements(options: UseAgentOptions) {
  const agent = useAgent(options);

  return {
    ...agent,
    // Adapted for Elements
    uiMessages: convertToUIMessages(agent.events, agent.streamingText),
    uiStatus: mapAgentStatusToUIStatus(agent.status),
    toolParts: convertToolCallsToToolParts(agent.toolCalls),
  };
}
```

---

## Component Compatibility Matrix

| Component | Works Out-of-Box | Works with Adaptation | Incompatible | Notes |
|-----------|------------------|----------------------|--------------|-------|
| Message | | X | | Transform events to parts |
| MessageBranch | | X | | Need message versioning |
| Conversation | | X | | Wrapper, depends on Message |
| PromptInput | X | | | Direct integration |
| PromptInputSubmit | X | | | Map status values |
| Tool | | X | | Minor format differences |
| Task | X | | | Status name mapping only |
| Reasoning | | X | | Aggregate from step events |
| Sources | X | | | Pure display |
| Suggestion | X | | | Pure display |
| ModelSelector | X | | | Wire to setModel() |
| Shimmer | X | | | Pure CSS |
| Queue | | X | | Map todo structure |
| Confirmation | X | | | Maps to approval system |
| Checkpoint | | X | | Wire to checkpointer |
| Context | | | X | Token data not exposed |
| ChainOfThought | | X | | Aggregate step events |
| Plan | | X | | Map todo as plan |
| InlineCitation | X | | | Pure display |
| CodeBlock | X | | | Pure display |
| Image | X | | | Pure display |
| Artifact | X | | | Pure display container |
| WebPreview | X | | | Pure display |

**Summary:**

- **Works Out-of-Box (12):** PromptInput, Task, Sources, Suggestion, ModelSelector, Shimmer, Confirmation, InlineCitation, CodeBlock, Image, Artifact, WebPreview
- **Works with Adaptation (8):** Message, MessageBranch, Conversation, Tool, Reasoning, Queue, Checkpoint, ChainOfThought, Plan
- **Incompatible (1):** Context (token usage not exposed)

---

## Recommendations

### Short-term (Quick Integration)

1. Use the pure display components directly (Sources, Suggestions, ModelSelector, Shimmer)
2. Create a thin adapter for Message/Conversation using the pattern above
3. Wire PromptInput to `sendPrompt()`
4. Use Task component with status mapping for todos

### Medium-term (Enhanced Integration)

1. Create `useDeepAgentWithElements` adapter hook
2. Add token usage events to deepagentsdk for Context component
3. Implement message versioning for MessageBranch support

### Long-term (Full Compatibility)

1. Consider adding optional `useChat`-compatible output mode to deepagentsdk
2. Expose AI SDK's native `parts` format alongside events
3. Create official `@deepagentsdk/elements` adapter package

---

## External References

- [AI SDK Elements Documentation](https://ai-sdk.dev/elements)
- [AI SDK Elements GitHub Repository](https://github.com/vercel/ai-elements)
- [AI SDK useChat Reference](https://ai-sdk.dev/docs/reference/ai-sdk-ui/use-chat)
- [Vercel AI Elements Announcement](https://vercel.com/changelog/introducing-ai-elements)
- [AI SDK 6 Blog Post](https://vercel.com/blog/ai-sdk-6)
- [LogRocket: Building with AI Elements](https://blog.logrocket.com/vercel-ai-elements/)

---

## Code References

- deepagentsdk event types: `src/types/events.ts:1-429`
- useAgent hook: `src/cli/hooks/useAgent.ts:132-932`
- TodoItem type: `src/types/core.ts:51-58`
- DeepAgent class: `src/agent.ts:97-1058`
- Approval system: `src/cli/hooks/useAgent.ts:875-889`
- Checkpointing: `src/agent.ts:650-665`

---

## Open Questions

1. Should deepagentsdk add a `useChat`-compatible output mode for easier Elements integration?
2. Should token usage be exposed via events for Context component support?
3. Would an official adapter package benefit the ecosystem?
