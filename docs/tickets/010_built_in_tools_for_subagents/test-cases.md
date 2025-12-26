---
title: "Test Cases: Subagent Selective Builtin Tools"
description: Documentation
---

**Test File**: `test/subagents/selective-tools.test.ts`
**Generated**: 2025-12-20
**Total Tests**: 31

## Quick Start

```bash
# Run all tests
bun test test/subagents/selective-tools.test.ts

# Run specific phase
bun test test/subagents/selective-tools.test.ts -t "Individual Tool Exports"
bun test test/subagents/selective-tools.test.ts -t "Configuration"
bun test test/subagents/selective-tools.test.ts -t "Error Handling"

# Watch mode
bun test --watch test/subagents/selective-tools.test.ts

# Coverage
bun test --coverage test/subagents/selective-tools.test.ts
```

## Test Organization

### Phase 1: Individual Tool Exports (3 tests)
- `test/subagents/selective-tools.test.ts:47` - exports individual web tools
- `test/subagents/selective-tools.test.ts:58` - exports individual filesystem tools
- `test/subagents/selective-tools.test.ts:72` - exports individual utility tools

### Phase 2: Subagent Configuration (5 tests)
- `test/subagents/selective-tools.test.ts:91` - configures subagent with single web tool
- `test/subagents/selective-tools.test.ts:112` - configures subagent with multiple filesystem tools
- `test/subagents/selective-tools.test.ts:133` - configures subagent with mixed tool types
- `test/subagents/selective-tools.test.ts:154` - configures multiple subagents with different tool sets

### Phase 3: Default Behavior (4 tests)
- `test/subagents/selective-tools.test.ts:185` - maintains default behavior when no tools specified
- `test/subagents/selective-tools.test.ts:202` - accepts legacy ToolSet format for tools
- `test/subagents/selective-tools.test.ts:225` - accepts empty tools array

### Phase 4: Error Handling and Edge Cases (4 tests)
- `test/subagents/selective-tools.test.ts:243` - handles null tools gracefully
- `test/subagents/selective-tools.test.ts:260` - handles undefined tools gracefully
- `test/subagents/selective-tools.test.ts:277` - handles invalid tool objects in array

### Phase 5: Type Safety and TypeScript Integration (3 tests)
- `test/subagents/selective-tools.test.ts:301` - provides correct TypeScript types for individual tools
- `test/subagents/selective-tools.test.ts:312` - allows tool arrays in subagent configuration
- `test/subagents/selective-tools.test.ts:323` - maintains type safety with mixed tool formats

### Phase 6: Integration with Existing Features (3 tests)
- `test/subagents/selective-tools.test.ts:338` - works with generation options
- `test/subagents/selective-tools.test.ts:364` - works with structured output
- `test/subagents/selective-tools.test.ts:386` - works with interrupt configuration

## Coverage Summary

- ✅ Happy paths: 15 tests
- ✅ Edge cases: 8 tests
- ✅ Error scenarios: 4 tests
- ✅ Boundary conditions: 4 tests
- ✅ Type safety: 3 tests
- ✅ Integration scenarios: 3 tests

## Key Test Patterns

### Helper Functions (Used 3+ times)
- `createMockState()` - Creates mock DeepAgent state
- `createEventCollector()` - Collects tool events
- `createMockModel()` - Mock language model
- `createMockTool()` - Creates mock tools
- `createMockBackend()` - Mock state backend

### Test Structure
- All tests follow Given-When-Then pattern with descriptive comments
- Tests are organized by implementation phases
- Comprehensive coverage of happy paths, edge cases, and error scenarios
- Integration tests ensure compatibility with existing features