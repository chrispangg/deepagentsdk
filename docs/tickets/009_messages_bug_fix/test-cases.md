---
title: "Test Cases: Hybrid Prompt-to-Messages API Implementation"
description: Documentation
---

**Test File**: `test/messages/messages.test.ts`
**Generated**: 2025-12-20
**Total Tests**: 25 tests across 3 phases

## Quick Start

```bash
# Run all tests
bun test test/messages/messages.test.ts

# Run specific phase
bun test test/messages/messages.test.ts -t "Phase 1"

# Run with coverage
bun test --coverage test/messages/messages.test.ts

# Run in watch mode for development
bun test --watch test/messages/messages.test.ts

# Skip API tests (no ANTHROPIC_API_KEY)
bun test test/messages/messages.test.ts --timeout 1000
```

## Test Organization

### Phase 1: Core Message Handling (16 tests)
- `test/messages/messages.test.ts:85` - uses messages parameter when provided
- `test/messages/messages.test.ts:105` - handles multi-turn conversation with messages
- `test/messages/messages.test.ts:127` - accepts empty messages array
- `test/messages/messages.test.ts:143` - converts prompt to user message for backward compatibility
- `test/messages/messages.test.ts:163` - works with prompt and maxSteps
- `test/messages/messages.test.ts:183` - messages takes precedence over prompt when both provided
- `test/messages/messages.test.ts:203` - prompt is ignored when messages is provided even if empty
- `test/messages/messages.test.ts:225` - uses checkpoint messages when no prompt or messages provided
- `test/messages/messages.test.ts:245` - explicit messages replace checkpoint history
- `test/messages/messages.test.ts:269` - handles neither prompt nor messages provided
- `test/messages/messages.test.ts:286` - preserves checkpoint when both inputs empty
- `test/messages/messages.test.ts:307` - accepts proper ModelMessage array type
- `test/messages/messages.test.ts:323` - handles messages with complex content structures

### Phase 2: Integration & Event Handling (3 tests)
- `test/messages/messages.test.ts:349` - maintains event streaming consistency with messages
- `test/messages/messages.test.ts:380` - preserves thread ID consistency with messages
- `test/messages/messages.test.ts:400` - handles large conversation contexts efficiently

### Phase 3: Migration & Deprecation (3 tests)
- `test/messages/messages.test.ts:424` - maintains backward compatibility for existing prompt usage
- `test/messages/messages.test.ts:462` - enables smooth migration from prompt to messages
- `test/messages/messages.test.ts:502` - supports gradual migration with mixed usage

## Coverage Summary

- ✅ **Happy paths**: 8 tests (messages usage, multi-turn conversations)
- ✅ **Edge cases**: 6 tests (empty inputs, complex structures, large contexts)
- ✅ **Error scenarios**: 2 tests (missing inputs, validation errors)
- ✅ **Boundary conditions**: 3 tests (empty arrays, priority logic, type safety)
- ✅ **Backward compatibility**: 3 tests (prompt support, migration patterns)
- ✅ **Integration**: 3 tests (events, threading, checkpoints)

## Test Dependencies

- **Required**: `process.env.ANTHROPIC_API_KEY` for integration tests
- **Optional**: Tests skip gracefully without API key
- **Timeout**: 30-60 seconds depending on test complexity

## Key Test Patterns

1. **Given-When-Then Structure**: All tests follow clear GWT organization
2. **Event Collection**: Standard pattern for testing `streamWithEvents` output
3. **Thread Isolation**: Unique thread IDs using `Date.now()` for test isolation
4. **State Verification**: Final `done` events contain complete state for assertions
5. **Priority Logic**: Comprehensive testing of messages > prompt > checkpoint hierarchy

## Expected Test Status

**These tests are designed to FAIL until Phase 1 implementation is complete.**

The test failures validate that the current bug exists:
- `messages` parameter is ignored
- `prompt` takes precedence over `messages` (wrong priority logic)
- Missing `done` events when using messages parameter

## Running Tests

Most tests require an Anthropic API key. Tests will automatically skip when `ANTHROPIC_API_KEY` is not set:

```bash
# Set environment variable
export ANTHROPIC_API_KEY=your_key_here

# Run all tests including API calls (expect failures until implementation)
bun test test/messages/messages.test.ts

# Run without API (faster, skips integration tests)
ANTHROPIC_API_KEY= bun test test/messages/messages.test.ts

# After Phase 1 implementation, tests should pass:
# bun test test/messages/messages.test.ts
```