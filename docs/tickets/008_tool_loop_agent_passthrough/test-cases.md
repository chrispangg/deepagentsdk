# Test Cases: ToolLoopAgent Passthrough

**Test File**: `test/passthrough/passthrough.test.ts`
**Generated**: 2025-12-20
**Total Tests**: 46

## Quick Start

```bash
# Run all passthrough tests
bun test test/passthrough/passthrough.test.ts

# Run specific phase
bun test test/passthrough/passthrough.test.ts -t "Phase 1"

# Run integration tests (requires API keys)
bun test test/passthrough/passthrough.test.ts -t "Phase 6"

# Run with coverage
bun test --coverage test/passthrough/passthrough.test.ts
```

## Test Organization

### Phase 1: Type Definitions (6 tests)

- `passthrough.test.ts:33` - Should accept empty configuration
- `passthrough.test.ts:47` - Should accept loop control options
- `passthrough.test.ts:79` - Should accept generation options
- `passthrough.test.ts:103` - Should accept advanced options
- `passthrough.test.ts:123` - Should accept subagent passthrough options
- `passthrough.test.ts:155` - Should prevent loop control in subagents

### Phase 2: Constructor Updates (3 tests)

- `passthrough.test.ts:186` - Should store passthrough options in private fields
- `passthrough.test.ts:213` - Should accept passthrough options independently
- `passthrough.test.ts:235` - Should preserve backward compatibility

### Phase 3: ToolLoopAgent Instantiation Updates (5 tests)

- `passthrough.test.ts:271` - Should build stop conditions with maxSteps safety limit
- `passthrough.test.ts:294` - Should accept multiple stop conditions
- `passthrough.test.ts:315` - Should build agent settings with generation options
- `passthrough.test.ts:340` - Should build agent settings with advanced options
- `passthrough.test.ts:363` - Should build agent settings with prepareStep

### Phase 4: Callback Composition (4 tests)

- `passthrough.test.ts:387` - Should execute user onStepFinish before internal logic
- `passthrough.test.ts:424` - Should handle user callback errors without breaking checkpointing
- `passthrough.test.ts:447` - Should call user onFinish callback
- `passthrough.test.ts:476` - Should compose prepareStep with stream options

### Phase 5: Subagent Passthrough Support (5 tests)

- `passthrough.test.ts:504` - Should pass generation options to subagent
- `passthrough.test.ts:526` - Should inherit telemetry from parent if not specified
- `passthrough.test.ts:548` - Should override parent options when specified
- `passthrough.test.ts:577` - Should enforce 50-step limit for subagents
- `passthrough.test.ts:595` - Should prevent toolChoice and activeTools in subagents

### Phase 6: Integration Tests (2 tests - skipped without API keys)

- `passthrough.test.ts:619` - Should work with real model
- `passthrough.test.ts:653` - Should handle streaming with all options

### Error Scenarios (4 tests)

- `passthrough.test.ts:683` - Should handle invalid temperature gracefully
- `passthrough.test.ts:702` - Should handle callback errors
- `passthrough.test.ts:720` - Should handle malformed prepareStep return
- `passthrough.test.ts:739` - Should handle missing subagent options

### Boundary Conditions (4 tests)

- `passthrough.test.ts:759` - Should handle zero maxSteps
- `passthrough.test.ts:775` - Should handle very large maxSteps
- `passthrough.test.ts:791` - Should handle empty stop conditions array
- `passthrough.test.ts:807` - Should handle generation options at boundaries

### Performance (2 tests)

- `passthrough.test.ts:835` - Should not affect creation time without options
- `passthrough.test.ts:857` - Should not significantly affect creation time with options

## Coverage Summary

- ✅ Happy paths: 23 tests
- ✅ Edge cases: 11 tests
- ✅ Error scenarios: 4 tests
- ✅ Boundary conditions: 4 tests
- ✅ Type safety: 6 tests
- ✅ Performance: 2 tests
- ⚠️ Integration: 2 tests (requires API keys)

## Test Dependencies

- **Bun test runner** (`bun:test`)
- **AI SDK v6** (ToolLoopAgent, stop conditions)
- **Mock LanguageModel** for unit tests
- **API keys** for integration tests (ANTHROPIC_API_KEY or OPENAI_API_KEY)
