---
title: "Test Cases: Structured Output"
description: Documentation
---

**Test File**: `test/structured-output.test.ts`
**Generated**: 2025-12-19
**Total Tests**: 35+ tests

## Quick Start

```bash
# Run all structured output tests
bun test test/structured-output.test.ts

# Run Phase 1 tests only
bun test test/structured-output.test.ts -t "Phase 1: Core"

# Run Phase 1.5 subagent tests only
bun test test/structured-output.test.ts -t "Phase 1.5: Subagent"

# Run integration tests only (requires ANTHROPIC_API_KEY)
bun test test/structured-output.test.ts -t "Phase 2: Integration"

# Watch mode for development
bun test --watch test/structured-output.test.ts

# Type check
bun run typecheck
```

## Test Organization

### Phase 1: Core Structured Output (25 tests)

**Type Definition Tests** (`test/structured-output.test.ts:108-160`)

- `[L135]` - accepts optional output schema configuration
- `[L145]` - output field is optional and can be undefined
- `[L155]` - output schema can be any Zod type

**Agent Creation** (`test/structured-output.test.ts:162-210`)

- `[L169]` - creates agent successfully with output schema
- `[L186]` - creates agent without output schema (backwards compatible)
- `[L200]` - stores output configuration on agent instance
- `[L210]` - validates output schema is Zod type

**ToolLoopAgent Configuration** (`test/structured-output.test.ts:212-250`)

- `[L220]` - passes output schema to ToolLoopAgent constructor
- `[L237]` - omits output field from ToolLoopAgent when undefined
- `[L245]` - includes optional description in output config

**Result Enhancement** (`test/structured-output.test.ts:252-285`)

- `[L260]` - preserves original result properties when output is returned
- `[L272]` - adds structured output property to result using Object.defineProperty

**DoneEvent Type** (`test/structured-output.test.ts:287-310`)

- `[L295]` - DoneEvent includes optional output field when structured output is used
- `[L309]` - DoneEvent output field is optional and backwards compatible

**Edge Cases** (`test/structured-output.test.ts:312-355`)

- `[L320]` - handles empty object schema
- `[L331]` - handles complex nested schema
- `[L344]` - preserves schema definition when creating multiple agents

### Phase 1.5: Subagent Structured Output (10 tests)

**SubAgent Type** (`test/structured-output.test.ts:370-400`)

- `[L378]` - SubAgent interface includes optional output field
- `[L399]` - SubAgent output field is optional (backwards compatible)

**Subagent Registry** (`test/structured-output.test.ts:402-435`)

- `[L410]` - registry stores output configuration for each subagent
- `[L431]` - registry handles subagents with and without output configs

**ToolLoopAgent Config** (`test/structured-output.test.ts:437-465`)

- `[L445]` - output config is passed to subagent ToolLoopAgent constructor
- `[L464]` - subagent ToolLoopAgent omits output when not configured

**Result Formatting** (`test/structured-output.test.ts:467-525`)

- `[L475]` - formats structured output as JSON when present
- `[L500]` - returns only text when subagent has no output config
- `[L513]` - handles complex nested structured output

**Parent Agent Consumption** (`test/structured-output.test.ts:527-560`)

- `[L535]` - subagent output is included in tool result for parent agent
- `[L549]` - parent agent can parse subagent JSON output

**Edge Cases** (`test/structured-output.test.ts:562-600`)

- `[L570]` - handles subagent with no tools but with output config
- `[L583]` - handles output schema validation type mismatch
- `[L597]` - maintains output format consistency across multiple subagents

### Phase 2: Integration Tests (2 tests)

**End-to-End Flows** (`test/structured-output.test.ts:604-660`)

- `[L609]` - end-to-end: agent generates text with structured output parsing (requires API key)
- `[L643]` - end-to-end: subagent with structured output delegates and formats correctly (requires API key)

## Coverage Summary

- ✅ **Type Definitions**: 3 tests (output field on CreateDeepAgentParams)
- ✅ **Agent Creation**: 4 tests (with/without schema, storage, validation)
- ✅ **ToolLoopAgent Config**: 3 tests (pass-through, omission, description)
- ✅ **Result Enhancement**: 2 tests (property preservation, structured output)
- ✅ **DoneEvent Type**: 2 tests (with/without output field)
- ✅ **Core Edge Cases**: 3 tests (empty schema, nested, multiple agents)
- ✅ **SubAgent Types**: 2 tests (optional field, backwards compatibility)
- ✅ **Subagent Registry**: 2 tests (storage, mixed configs)
- ✅ **Subagent ToolLoopAgent**: 2 tests (with/without config)
- ✅ **Result Formatting**: 3 tests (JSON format, text-only, nested)
- ✅ **Parent Agent Integration**: 2 tests (tool result, JSON parsing)
- ✅ **Subagent Edge Cases**: 3 tests (no tools, validation, consistency)
- ✅ **Integration Tests**: 2 tests (end-to-end, requires API key)

**Total**: 35+ tests covering all implementation phases

## Test Helpers

The test file includes the following helper functions (used 3+ times each):

- `createMockState()` - Creates empty DeepAgentState for testing (10+ uses)
- `createCalculationTool()` - Math operation tool for testing (3+ uses)
- `createSentimentTool()` - Sentiment analysis tool for testing (3+ uses)
- `createTestOutputSchema()` - Standard test output schema (5+ uses)
- `createCalculationSchema()` - Calculation result schema (2+ uses)
- `createEventCollector()` - Event collection for testing (3+ uses)

## Implementation Verification Checklist

Before running tests, ensure these files have been implemented:

- [ ] `src/types.ts` - Added `output` field to `CreateDeepAgentParams`
- [ ] `src/types.ts` - Added `output` field to `SubAgent` interface
- [ ] `src/types.ts` - Updated `DoneEvent` to include optional `output` field
- [ ] `src/agent.ts` - DeepAgent stores `outputConfig`
- [ ] `src/agent.ts` - Pass `output` to ToolLoopAgent constructor
- [ ] `src/tools/subagent.ts` - Updated registry to include `output`
- [ ] `src/tools/subagent.ts` - Pass `output` to subagent ToolLoopAgent
- [ ] `src/tools/subagent.ts` - Format structured output in results

## Running Tests After Implementation

Once Phase 1 and 1.5 are implemented:

```bash
# Run unit tests (no API key required)
bun test test/structured-output.test.ts -t "Phase 1"
bun test test/structured-output.test.ts -t "Phase 1.5"

# Run all tests with API key
ANTHROPIC_API_KEY=xxx bun test test/structured-output.test.ts

# Get coverage report
bun test --coverage test/structured-output.test.ts
```

## Notes

- Tests are executable specifications (BDD style)
- Given-When-Then comments mark each test phase
- Helper functions only created when duplication > 2x
- Integration tests require `ANTHROPIC_API_KEY` environment variable
- 30-second timeout for API-dependent tests
