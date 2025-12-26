---
title: "API Migration Analysis: Replacing prompt:string with messages:string[] in streamWithEvents"
date: 2025-12-20 10:45:00 AEDT
researcher: claude-sonnet-4-5-20251001
git_commit: d8cff28e51a84bf19436e47fedba27240673d0ac
branch: main
repository: chrispangg/ai-sdk-deepagent
topic: "API Migration Analysis: Replacing prompt:string with messages:string[] in streamWithEvents"
tags: [research, api-migration, prompt, messages, breaking-change]
status: complete
last_updated: 2025-12-20
last_updated_by: claude-sonnet-4-5-20251001
---

## Research Question

Analyze the feasibility and impact of replacing the `prompt: string` parameter with `messages: string[]` in the `streamWithEvents` method to better align with AI SDK v6 patterns.

## Summary

**MIGRATION FEASIBLE** but **BREAKING** - Replacing `prompt: string` with `messages: string[]` is technically straightforward and aligns better with AI SDK v6 patterns, but it would be a breaking change affecting all examples, documentation, and user code. A hybrid approach supporting both patterns would be less disruptive while providing migration path.

## Detailed Findings

### 1. Current Prompt Implementation Analysis

#### **Prompt to Message Conversion** (src/agent.ts:622-625)

```typescript
const inputMessages: ModelMessage[] = [
  ...patchedHistory,
  ...(prompt ? [{ role: "user", content: prompt } as ModelMessage] : []),
];
```

**Current Pattern**:

- Single string prompt always converted to a user message
- Simple and intuitive for basic use cases
- Limited flexibility for complex conversation contexts

### 2. Proposed Migration: messages: string[]

#### **Type Definition Change**

```typescript
// Current (src/types.ts:1571-1582)
export interface StreamWithEventsOptions {
  /** The user's prompt/message */
  prompt?: string;
  state?: DeepAgentState;
  /** Conversation history for multi-turn conversations */
  messages?: ModelMessage[];
  // ... other options
}

// Proposed
export interface StreamWithEventsOptions {
  state?: DeepAgentState;
  /** The conversation messages as strings [role, content, role, content, ...] */
  messages?: string[];
  // ... other options
}
```

#### **Implementation Change** (src/agent.ts:622-625)

```typescript
// Current implementation
const inputMessages: ModelMessage[] = [
  ...patchedHistory,
  ...(prompt ? [{ role: "user", content: prompt } as ModelMessage] : []),
];

// Proposed implementation
let userMessages: ModelMessage[] = [];

if (options.messages && options.messages.length > 0) {
  // Convert string array to ModelMessage array
  // Format: ["user", "hello", "assistant", "hi there", "user", "how are you?"]
  for (let i = 0; i < options.messages.length; i += 2) {
    const role = options.messages[i];
    const content = options.messages[i + 1];
    if (role && content) {
      userMessages.push({
        role: role as "user" | "assistant" | "system",
        content: content
      });
    }
  }
}

const inputMessages: ModelMessage[] = [
  ...patchedHistory,
  ...userMessages,
];
```

### 3. Migration Strategy Analysis

#### **Option 1: Full Replacement (BREAKING)**

**Pros**:

- Clean API aligned with AI SDK v6
- Forces best practices from the start
- Eliminates confusion between prompt and messages

**Cons**:

- Breaking change for all existing users
- Requires updating all examples (15+ files)
- Documentation rewrite needed
- Migration burden on users

**Affected Files**:

- All examples (examples/*.ts) - 15+ files need updates
- CLI implementation (src/cli/hooks/useAgent.ts)
- Documentation (docs/patterns.md, docs/*.md)
- Test files (test/*.test.ts)

#### **Option 2: Hybrid Approach (RECOMMENDED)**

**Support both patterns during transition**:

```typescript
// Type definition
export interface StreamWithEventsOptions {
  state?: DeepAgentState;
  /** Legacy single prompt (deprecated) */
  prompt?: string;
  /** Full conversation messages array */
  messages?: ModelMessage[];
  // ... other options
}

// Implementation
let userMessages: ModelMessage[] = [];

if (options.messages) {
  // Use messages array (preferred)
  userMessages = options.messages;
} else if (prompt) {
  // Fallback to prompt for backward compatibility
  userMessages = [{ role: "user", content: prompt }];
}

const inputMessages: ModelMessage[] = [
  ...patchedHistory,
  ...userMessages,
];
```

**Benefits**:

- Non-breaking change
- Gradual migration path
- Deprecation warnings possible
- Flexibility for different use cases

#### **Option 3: String Array Alternative**

**Keep prompt but add string-based messages**:

```typescript
export interface StreamWithEventsOptions {
  /** Single user prompt */
  prompt?: string;
  /** Messages as string array: ["user", "hello", "assistant", "hi"] */
  messages?: string[];
}
```

**Pros**:

- Simpler than ModelMessage array
- More approachable for beginners
- Easy serialization

**Cons**:

- Still need conversion logic
- Type safety issues (role validation)
- Different from AI SDK v6 pattern

### 4. Impact Analysis

#### **Methods Affected**

1. **streamWithEvents** - Primary change point
2. **generate** - Would need similar update
3. **stream** - Would need similar update
4. **generateWithState** - Would need similar update
5. **CLI** - sendPrompt function needs updates

#### **Example Updates Required**

**Current Usage** (15+ files):

```typescript
// All examples currently use:
agent.streamWithEvents({ prompt: "Hello world" });
agent.generate({ prompt: "Do something" });
```

**New Usage Would Be**:

```typescript
// Single message
agent.streamWithEvents({
  messages: [{ role: "user", content: "Hello world" }]
});

// Conversation
agent.streamWithEvents({
  messages: [
    { role: "user", content: "Hello" },
    { role: "assistant", content: "Hi there!" },
    { role: "user", content: "How are you?" }
  ]
});
```

#### **CLI Impact**

- **File**: src/cli/hooks/useAgent.ts:267
- **Function**: sendPrompt takes string prompt
- **Change needed**: Convert CLI input to message format

### 5. Implementation Recommendations

#### **Phase 1: Add Support (Non-breaking)**

```typescript
export interface StreamWithEventsOptions {
  /** @deprecated Use messages instead */
  prompt?: string;
  /** The conversation messages */
  messages?: ModelMessage[];
}

// Add deprecation warning in implementation
if (prompt && !options.messages) {
  console.warn('prompt parameter is deprecated, use messages instead');
}
```

#### **Phase 2: Migration Period**

- Update documentation to prefer messages
- Add examples for both patterns
- Migration guide for users

#### **Phase 3: Remove Deprecated API**

- Remove prompt parameter in next major version
- Clean up deprecation warnings

### 6. Alternative Approaches

#### **Factory Function Approach**

```typescript
// Helper function for backward compatibility
function createMessageFromPrompt(prompt: string): ModelMessage[] {
  return [{ role: "user", content: prompt }];
}

// Usage in examples
agent.streamWithEvents({
  messages: createMessageFromPrompt("Hello world")
});
```

#### **Overloaded Methods**

```typescript
// TypeScript method overloads
streamWithEvents(options: { prompt: string }): AsyncGenerator<DeepAgentEvent>;
streamWithEvents(options: { messages: ModelMessage[] }): AsyncGenerator<DeepAgentEvent>;
```

### 7. Alignment with AI SDK v6

#### **Current AI SDK v6 Pattern**

```typescript
import { streamText } from 'ai';

const result = await streamText({
  model,
  messages: [
    { role: 'user', content: 'Hello!' },
    { role: 'assistant', content: 'Hi there!' },
    { role: 'user', content: 'How are you?' }
  ]
});
```

#### **Proposed DeepAgent Pattern**

```typescript
const agent = createDeepAgent({ model });

for await (const event of agent.streamWithEvents({
  messages: [
    { role: 'user', content: 'Hello!' },
    { role: 'assistant', content: 'Hi there!' },
    { role: 'user', content: 'How are you?' }
  ]
})) {
  // Handle events
}
```

**Benefits of Alignment**:

- Consistent with AI SDK v6
- Better TypeScript support
- Clearer conversation flow
- Multi-turn support built-in

## Code References

### Key Files to Modify

- **src/types.ts:1571-1582** - StreamWithEventsOptions interface
- **src/agent.ts:622-625** - Message construction logic
- **src/cli/hooks/useAgent.ts:267** - CLI prompt handling
- **examples/*.ts** - 15+ example files need updates

### Examples Needing Updates

1. examples/basic.ts - Line with prompt parameter
2. examples/streaming.ts - Multiple prompt usages
3. examples/with-subagents.ts - Complex prompt example
4. examples/with-structured-output.ts - Multiple prompt calls
5. examples/with-checkpointer.ts - Prompt with checkpointer
6. examples/with-custom-tools.ts - Prompt with tools
7. examples/with-tool-loop-passthrough.ts - Prompt example

## Migration Path

### Recommended Timeline

1. **v0.5.x** - Add messages support with deprecation warnings
2. **v0.6.x** - Update all examples and documentation
3. **v1.0.0** - Remove deprecated prompt parameter

### Backward Compatibility Strategy

- Support both prompt and messages simultaneously
- Clear deprecation warnings
- Migration utilities in documentation
- Gradual example updates

## Conclusion

**RECOMMENDED**: Implement a **hybrid approach** that supports both `prompt` and `messages` parameters during a transition period. This allows:

1. **Immediate alignment** with AI SDK v6 patterns for new users
2. **Gradual migration** for existing users
3. **No breaking changes** in the short term
4. **Clean path** to removing deprecated API later

The migration is technically straightforward but requires careful coordination of examples, documentation, and user communication to ensure smooth transition.

`★ Insight ─────────────────────────────────────`
The current `prompt` parameter creates an artificial simplicity that doesn't match the complexity of real conversations. By migrating to `messages: ModelMessage[]`, we align with AI SDK v6's more explicit conversation model. However, the migration strategy matters more than the technical change - a phased approach with backward compatibility preserves user trust while enabling better patterns. The hybrid approach recognizes that different use cases need different levels of complexity - sometimes a simple prompt is enough, other times full conversation context is needed.
`─────────────────────────────────────────────────`
