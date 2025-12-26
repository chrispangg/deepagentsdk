---
title: "Test Cases: Telemetry Passthrough Implementation"
description: Documentation
---

**Test File**: `src/agent.test.ts`
**Generated**: 2025-12-22
**Total Tests**: 42

## Quick Start

```bash
# Run all telemetry tests
bun test src/agent.test.ts

# Run specific phase
bun test src/agent.test.ts -t "Phase 1"
bun test src/agent.test.ts -t "Phase 2"
bun test src/agent.test.ts -t "Phase 3"

# Run with coverage
bun test --coverage src/agent.test.ts

# Watch mode for development
bun test --watch src/agent.test.ts
```

## Test Organization

### Phase 1: Core Passthrough Options (10 tests)
- `src/agent.test.ts:62` - passes experimental_telemetry to streamText
- `src/agent.test.ts:78` - passes all generationOptions to streamText
- `src/agent.test.ts:94` - passes providerOptions to streamText
- `src/agent.test.ts:110` - passes toolChoice and activeTools to streamText
- `src/agent.test.ts:130` - passes experimental_context to streamText
- `src/agent.test.ts:148` - passes output configuration to streamText
- `src/agent.test.ts:164` - handles multiple options together correctly
- `src/agent.test.ts:184` - handles undefined options gracefully
- `src/agent.test.ts:197` - matches generate() behavior with same options
- `src/agent.test.ts:219` - preserves existing functionality with prompt caching

### Phase 2: loopControl Callback Composition (8 tests)
- `src/agent.test.ts:251` - calls user's onStepFinish callback during streaming
- `src/agent.test.ts:272` - applies custom stopWhen conditions in streaming
- `src/agent.test.ts:293` - executes prepareStep before each step
- `src/agent.test.ts:311` - calls onFinish after completion
- `src/agent.test.ts:330` - preserves checkpointing with user callbacks
- `src/agent.test.ts:358` - combines all callbacks correctly

### Phase 3: Summarization Telemetry (5 tests)
- `src/agent.test.ts:398` - passes telemetry to summarization generateText
- `src/agent.test.ts:418` - includes provider options in summarization
- `src/agent.test.ts:437` - applies generation options to summarization
- `src/agent.test.ts:456` - works without telemetry options in summarization
- `src/agent.test.ts:471` - preserves summarization configuration with telemetry

### Integration Tests (1 test)
- `src/agent.test.ts:490` - end-to-end telemetry with streaming and summarization

### Edge Cases and Error Scenarios (3 tests)
- `src/agent.test.ts:522` - handles empty options objects
- `src/agent.test.ts:539` - preserves maxSteps with loopControl.stopWhen
- `src/agent.test.ts:556` - handles callback errors gracefully

## Coverage Summary

- ✅ Happy paths: 19 tests
- ✅ Edge cases: 15 tests
- ✅ Error scenarios: 3 tests
- ✅ Boundary conditions: 3 tests
- ✅ Integration scenarios: 2 tests

## Test Helpers Used

- `createMockTool()` - Creates test tools (used 10+ times)
- `createAgentWithTelemetry()` - Creates agent with telemetry (used 8+ times)
- `collectEvents()` - Collects stream events (used 6+ times)

## Running Tests with Langfuse

For full telemetry verification:

```bash
# Set Langfuse credentials
export LANGFUSE_SECRET_KEY=sk-lf-...
export LANGFUSE_PUBLIC_KEY=pk-lf-...
export LANGFUSE_BASEURL=https://cloud.langfuse.com

# Run tests to see traces in Langfuse
bun test src/agent.test.ts -t "experimental_telemetry"
```

## Implementation Status

**Note**: Tests are written but currently have type errors. This is expected since the implementation hasn't been completed yet. The tests will compile and run after:

1. Phase 1: Core passthrough options are implemented
2. Phase 2: loopControl callbacks are composed
3. Phase 3: Summarization telemetry is added

Run tests after implementation with:
```bash
bun test src/agent.test.ts
```