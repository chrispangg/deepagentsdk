# Test Cases: AI SDK Elements Integration - Phase 1

**Test File**: `test/adapters/elements.test.ts`
**Generated**: 2026-01-08
**Total Tests**: 40 tests across 10 phases

## Quick Start

```bash
# Run all Phase 1 tests
bun test test/adapters/elements.test.ts

# Run specific phase
bun test test/adapters/elements.test.ts -t "Phase 1.2"

# Watch mode
bun test --watch test/adapters/elements.test.ts

# Coverage
bun test --coverage test/adapters/elements.test.ts
```

## Test Organization

### Phase 1.1: useElementsAdapter Hook Initialization (3 tests)
- `elements.test.ts:57` - should initialize with empty messages and ready status
- `elements.test.ts:69` - should provide sendMessage callback
- `elements.test.ts:81` - should provide abort and clear callbacks

### Phase 1.2: Message Transformation - Text Events (3 tests)
- `elements.test.ts:99` - should convert user message to UIMessage with text part
- `elements.test.ts:120` - should accumulate streaming text chunks into text parts
- `elements.test.ts:141` - should create separate text parts for text-segment events

### Phase 1.3: Message Transformation - Tool Call Events (5 tests)
- `elements.test.ts:167` - should convert tool-call event to tool-call part
- `elements.test.ts:197` - should convert tool-result event to tool-result part
- `elements.test.ts:227` - should match tool-call and tool-result by toolCallId
- `elements.test.ts:264` - should preserve tool call args in tool-call part
- `elements.test.ts:292` - should include tool result in tool-result part

### Phase 1.4: Status Mapping (6 tests)
- `elements.test.ts:318` - should map 'idle' agent status to 'ready' UI status
- `elements.test.ts:328` - should map 'thinking' agent status to 'submitted' UI status
- `elements.test.ts:344` - should map 'streaming' agent status to 'streaming' UI status
- `elements.test.ts:360` - should map 'tool-call' agent status to 'submitted' UI status
- `elements.test.ts:389` - should map 'error' agent status to 'error' UI status
- `elements.test.ts:411` - should map 'done' agent status to 'ready' UI status

### Phase 1.5: Tool Parts Extraction (2 tests)
- `elements.test.ts:433` - should extract tool parts from current message
- `elements.test.ts:458` - should provide tool parts with correct structure

### Phase 1.6: Message State Management (3 tests)
- `elements.test.ts:494` - should maintain message history across multiple sends
- `elements.test.ts:516` - should clear messages when clear() is called
- `elements.test.ts:534` - should preserve message order (user, assistant, user, assistant)

### Phase 1.7: Streaming Message Updates (2 tests)
- `elements.test.ts:561` - should update streaming message status during generation
- `elements.test.ts:582` - should mark message as ready when streaming completes

### Phase 1.8: Abort Functionality (2 tests)
- `elements.test.ts:606` - should abort streaming when abort() is called
- `elements.test.ts:629` - should preserve partial message after abort

### Phase 1.9: Integration with PromptInput Component (2 tests)
- `elements.test.ts:659` - should accept PromptInputMessage format
- `elements.test.ts:684` - should handle empty text in PromptInputMessage

### Phase 1.10: Edge Cases (4 tests)
- `elements.test.ts:710` - should handle rapid consecutive sends
- `elements.test.ts:738` - should handle message with no tool calls
- `elements.test.ts:752` - should handle very long message content
- `elements.test.ts:770` - should handle unicode and special characters in messages

## Coverage Summary

- ✅ Happy paths: 15 tests
- ✅ Edge cases: 8 tests
- ✅ Error scenarios: 3 tests
- ✅ Boundary conditions: 6 tests
- ✅ Integration: 8 tests

## Test Dependencies

**Required packages:**
- `@testing-library/react` - React hooks testing
- `@ai-sdk/anthropic` - Anthropic provider (for types)
- `bun:test` - Test runner

**Mock dependencies:**
- Language model (custom mock, no API key needed)
- StateBackend (in-memory, no filesystem)

## Notes

- All tests use mock model (no API calls)
- Tests are deterministic and fast (<100ms each)
- No external dependencies or API keys required
- Tests follow Given-When-Then structure
- Helper functions only created for 3+ uses pattern
