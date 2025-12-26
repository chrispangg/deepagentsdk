---
title: Remove `as any` Type Assertions from src/ and examples/ Implementation Plan
description: Documentation
---

## Overview

A focused type safety improvement to eliminate all `as any` type assertions from production code (`src/`) and examples (`examples/`), replacing them with proper TypeScript types and patterns. This improves compile-time type safety, developer experience, and code maintainability while preserving all existing functionality.

## Current State Analysis

### Production Code (`src/`)

- **Single instance**: `src/utils/patch-tool-calls.ts:99` - Tool-result object type assertion
- **Issue**: Missing `result` property in tool-result structure, using `as any` as workaround
- **Impact**: Critical path for tool call handling, needs immediate attention

### Example Code (`examples/`)

- **6 instances**: All in `examples/with-structured-output.ts` - Structured output access patterns
- **Pattern**: Accessing `output` property on agent results using `(result as any).output`
- **Issue**: TypeScript limitations with AI SDK structured output inference
- **Impact**: Examples don't demonstrate type-safe patterns

### What We're NOT Doing

- **Not modifying test files** - 86 test instances left unchanged as per requirements
- **Not breaking existing APIs** - All changes are internal or additive
- **Not removing functionality** - Preserving all current behavior while improving types

## Desired End State

1. **Zero `as any` assertions in production code** - All replaced with proper types
2. **Type-safe structured output access** - Examples demonstrate best practices
3. **Maintainable patterns** - Clear typing guidelines for future development
4. **All tests passing** - No functional regressions
5. **TypeScript compilation** - Full type checking without errors

## Implementation Approach

The solution involves two distinct patterns:

1. **Tool-result fix**: Add missing `result` property to satisfy AI SDK interface requirements
2. **Structured output**: Create type-safe wrapper utilities and generic access patterns

This approach provides immediate fixes for production code while establishing patterns for future structured output usage.

## Phase 1: Fix Tool-Result Type in patch-tool-calls.ts

### Overview

Resolve the single production `as any` instance by implementing the correct AI SDK tool-result object structure.

### Changes Required

#### 1. Fix createCancelledToolResult Function

**File**: `src/utils/patch-tool-calls.ts`
**Changes**: Complete the tool-result object with proper typing

```typescript
/**
 * Create a synthetic tool result message for a cancelled tool call.
 */
function createCancelledToolResult(
  toolCallId: string,
  toolName: string
): ModelMessage {
  const message: ModelMessage = {
    role: "tool",
    content: [
      {
        type: "tool-result" as const,
        toolCallId,
        result: `Tool call ${toolName} with id ${toolCallId} was cancelled - another message came in before it could be completed.`,
      },
    ],
  };
  return message;
}
```

**Key Changes:**

- Remove `as any` assertion
- Add missing `result` property with descriptive message
- Use `as const` for type narrowing on the `type` field
- Remove commented-out code and TODO

### Success Criteria

#### Automated Verification

- [x] TypeScript compilation passes: `bun run typecheck`
- [x] All existing tests pass: `bun test`
- [ ] No new linting errors: `bun run lint`

#### Manual Verification

- [ ] Tool call cancellation functionality works in existing examples
- [ ] No regressions in message history handling
- [ ] Patch tool calls utility works with synthetic results

---

## Phase 2: Add Structured Output Type Support

### Overview

Create type-safe utilities and interfaces for structured output access, enabling type-safe patterns without `as any` assertions.

### Changes Required

#### 1. Create Structured Output Types

**File**: `src/types/structured-output.ts`
**Changes**: Add new type definitions for structured output

```typescript
import type { z } from "zod";

/**
 * Interface for agent results that include structured output
 */
export interface StructuredAgentResult<T = unknown> {
  text: string;
  output?: T;
  state?: any; // DeepAgentState from core types
  messages?: any[]; // ModelMessage array
}

/**
 * Type guard for checking if a result has structured output
 */
export function hasStructuredOutput<T>(
  result: any
): result is StructuredAgentResult<T> {
  return result && typeof result === "object" && "output" in result;
}

/**
 * Type guard for checking if an event has structured output
 */
export function eventHasStructuredOutput<T>(
  event: any
): event is { type: "done"; output: T } {
  return event && event.type === "done" && "output" in event;
}

/**
 * Extract structured output from agent result with type safety
 */
export function getStructuredOutput<T>(result: any): T | undefined {
  return hasStructuredOutput<T>(result) ? result.output : undefined;
}

/**
 * Extract structured output from event with type safety
 */
export function getEventOutput<T>(event: any): T | undefined {
  return eventHasStructuredOutput<T>(event) ? event.output : undefined;
}
```

#### 2. Export New Types

**File**: `src/types/index.ts`
**Changes**: Add re-export for structured output types

```typescript
// Add to existing re-exports
export * from "./structured-output";
```

### Success Criteria

#### Automated Verification

- [x] TypeScript compilation passes with new types
- [x] Export resolution works correctly
- [x] No circular dependency issues

#### Manual Verification

- [ ] Types are importable from main package
- [ ] Type inference works with Zod schemas

---

## Phase 3: Update Examples with Type-Safe Access

### Overview

Replace all `as any` instances in examples with the new type-safe patterns, demonstrating best practices for structured output access.

### Changes Required

#### 1. Update Structured Output Example

**File**: `examples/with-structured-output.ts`
**Changes**: Replace all 6 `as any` instances with type-safe patterns

```typescript
import { createDeepAgent, getStructuredOutput, getEventOutput } from "../src/index";

// Type inference helpers
type SentimentResult = z.infer<typeof sentimentSchema>;
type ResearchResult = z.infer<typeof researchSchema>;

// Example 1: Type-safe access
const sentimentResult = await sentimentAgent.generate({
  prompt: 'Analyze this review: "The product exceeded my expectations!"',
});

console.log("Text response:", sentimentResult.text);
console.log("Structured output:", getStructuredOutput<SentimentResult>(sentimentResult));
console.log("Type-safe access:", getStructuredOutput<SentimentResult>(sentimentResult)?.sentiment);

// Example 2: Complex nested schema
const researchResult = await researchAgent.generate({
  prompt: "Research the latest developments in AI agents (2025)",
  maxSteps: 10,
});

console.log("Structured research output:");
console.log(JSON.stringify(getStructuredOutput<ResearchResult>(researchResult), null, 2));

// Example 3: Streaming with type-safe event access
for await (const event of researchAgent.streamWithEvents({
  messages: [{ role: "user", content: "Briefly explain how agents use tools" }],
})) {
  if (event.type === "text") {
    process.stdout.write(event.text);
  }

  if (event.type === "done") {
    console.log("\n\nStructured output from stream:");
    const output = getEventOutput<ResearchResult>(event);
    console.log("Summary:", output?.summary);
    console.log("Key points:", output?.keyPoints);
    console.log("Topics:", output?.topics);
    console.log("Reliability:", output?.reliability);
  }
}

// Example 4: Middleware with type checking
const loggingMiddleware = {
  specificationVersion: 'v3' as const,
  wrapGenerate: async ({ doGenerate, params }: any) => {
    console.log("[Logging] Generate called with prompt:", params.prompt?.[0]?.content?.substring(0, 50));
    const result = await doGenerate();
    console.log("[Logging] Output schema:", getStructuredOutput<SentimentResult>(result) ? "present" : "absent");
    return result;
  },
};

const middlewareResult = await agentWithMiddleware.generate({
  prompt: "Analyze: This is great!",
});

console.log("Result with middleware:", getStructuredOutput<SentimentResult>(middlewareResult));
```

**Key Changes:**

- Import type-safe utility functions
- Define result types using Zod inference
- Replace all `(result as any).output` with `getStructuredOutput<T>(result)`
- Replace `(event as any).output` with `getEventOutput<T>(event)`
- Maintain all existing console output and functionality

### Success Criteria

#### Automated Verification

- [x] Example compiles without errors
- [x] No `as any` assertions remain in examples/
- [x] All imports resolve correctly

#### Manual Verification

- [ ] Example runs successfully with `bun examples/with-structured-output.ts`
- [ ] All console output matches current behavior
- [ ] Type inference works correctly in IDE
- [ ] Hovering over variables shows correct types

---

## Testing Strategy

### Unit Tests

- **New utility functions**: Test type guards and extraction functions
- **Edge cases**: Null/undefined handling, empty results
- **Type safety**: Verify TypeScript compilation catches type errors

### Integration Tests

- **Tool-call patching**: Ensure synthetic tool results work correctly
- **Structured output**: Verify end-to-end functionality with typed access
- **Examples**: Run examples to ensure no regressions

### Manual Testing Steps

1. **Compile Check**: Run `bun run typecheck` - should pass without errors
2. **Example Execution**: Run `bun examples/with-structured-output.ts` - should work identically
3. **Test Suite**: Run `bun test` - all existing tests should pass
4. **IDE Validation**: Open in VS Code - should show proper type inference

## Performance Considerations

- **Type guards**: Minimal runtime overhead, compile-time benefit
- **Utility functions**: Simple property access, no performance impact
- **Type inference**: Zero runtime cost, improved developer experience
- **Bundle size**: No significant impact, only adding type definitions

## Migration Notes

### For Developers Using the Library

1. **Structured Output Access**: Use `getStructuredOutput<T>(result)` instead of `(result as any).output`
2. **Event Output Access**: Use `getEventOutput<T>(event)` instead of `(event as any).output`
3. **Type Inference**: Define result types with `z.infer<typeof schema>`

### Backward Compatibility

- All existing APIs remain unchanged
- No breaking changes to public interfaces
- Optional migration to type-safe patterns

## Implementation Effort Estimate

- **Phase 1**: 0.5 day - Simple fix with immediate impact
- **Phase 2**: 0.5 day - Type definitions and utilities
- **Phase 3**: 0.5 day - Example updates and verification
- **Total**: 1.5 days across all phases

## Verification Checklist

Before marking this task complete, verify:

- [x] Zero `as any` assertions in `src/` directory
- [x] Zero `as any` assertions in `examples/` directory
- [x] TypeScript compilation passes: `bun run typecheck`
- [x] All tests pass: `bun test`
- [ ] Examples run without errors
- [x] IDE shows proper type inference
- [x] No functionality regressions
- [ ] Documentation updated if needed
