---
title: Remove all 'as any' type assertions from codebase
date: 2025-12-21 15:22:00 AEDT
researcher: Claude Code
git_commit: 3159edf99372af24e59b2d45c110d5115f0e62ae
branch: main
repository: ai-sdk-deepagent
topic: "Remove all 'as any' type assertions from codebase"
tags: [research, typescript, type-safety, code-quality, as-any]
status: complete
last_updated: 2025-12-21
last_updated_by: Claude Code
---

## Research Question

User wants to review and remove all instances of `as any` type assertions from the ai-sdk-deep-agent codebase as part of a high-priority type safety improvement initiative.

## Summary

The codebase contains a total of **93 instances** of `as any` type assertions across three main areas:

- **1 instance** in the main source code (`src/`)
- **6 instances** in example files (`examples/`)
- **86 instances** in test files

The usage of `as any` is generally well-justified, with most occurrences serving specific purposes like mock simplification, internal property access for testing, and working around AI SDK integration limitations.

## Detailed Findings

### Source Code (`src/`) - 1 Instance

#### Single Critical Instance

**File:** [`src/utils/patch-tool-calls.ts:99`](https://github.com/chrispangg/ai-sdk-deepagent/blob/3159edf99372af24e59b2d45c110d5115f0e62ae/src/utils/patch-tool-calls.ts#L99)

```typescript
function createCancelledToolResult(
  toolCallId: string,
  _toolName: string // Not used but kept for API compatibility
): ModelMessage {
  const message: ModelMessage = {
    role: "tool",
    content: [
      {
        type: "tool-result",
        toolCallId,
        // TODO: Fix the property name based on AI SDK requirements
        // result: `Tool call ${toolName} with id ${toolCallId} was cancelled - another message came in before it could be completed.`,
      } as any,
    ],
  };
  return message;
}
```

- **Context**: Creating synthetic tool result messages for cancelled tool calls
- **Reason**: Working around AI SDK type system limitations for tool-result object structure
- **Priority**: HIGH - This is the only `as any` in production code
- **Status**: Has explicit TODO comment indicating it needs fixing
- **Recommended Solution**: Determine correct AI SDK property name and proper typing

### Examples (`examples/`) - 6 Instances

#### All in Structured Output Example

**File:** [`examples/with-structured-output.ts`](https://github.com/chrispangg/ai-sdk-deepagent/blob/3159edf99372af24e59b2d45c110d5115f0e62ae/examples/with-structured-output.ts)

All 6 instances follow the same pattern of accessing structured output from agent results:

- **Line 45**: `console.log("Structured output:", (sentimentResult as any).output);`
- **Line 46**: `console.log("Type-safe access:", (sentimentResult as any).output?.sentiment);`
- **Line 73**: `console.log(JSON.stringify((researchResult as any).output, null, 2));`
- **Line 88**: `const output = event.output as any;`
- **Line 104**: `console.log("[Logging] Output schema:", (result as any).output ? "present" : "absent");`
- **Line 121**: `console.log("Result with middleware:", (middlewareResult as any).output);`

- **Pattern**: Accessing `output` property on agent result objects
- **Reason**: TypeScript type system limitations with AI SDK's structured output feature
- **Impact**: Example functionality depends on this pattern
- **Priority**: MEDIUM - Examples should demonstrate type-safe patterns
- **Recommended Solution**: Add proper type definitions for structured output results or provide type-safe utility functions

### Test Files - 86 Instances

The 86 test instances follow well-established testing patterns and are generally acceptable:

#### Primary Usage Patterns

1. **Mock Simplification (45 occurrences - ~52%)**
   - **Mock Models**: 25 occurrences - `model: mockModel as any`
   - **Global API Mocking**: 17 occurrences - `(globalThis.fetch as any)`
   - **Configuration Objects**: 3 occurrences - Various config simplifications

2. **Internal Property Access (23 occurrences - ~27%)**
   - Testing private implementation details without exposing them in public APIs
   - Validating internal configuration storage
   - Accessing agent internals for state verification

3. **Edge Case Testing (10 occurrences - ~12%)**
   - Testing null/undefined handling
   - Invalid input validation
   - Error scenario simulation

4. **JSON Parsing and Dynamic Properties (8 occurrences - ~9%)**
   - Parsing structured output from responses
   - Accessing dynamically added properties

#### Key Test Files with High Usage

- **[`test/passthrough/passthrough.test.ts`](https://github.com/chrispangg/ai-sdk-deepagent/blob/3159edf99372af24e59b2d45c110d5115f0e62ae/test/passthrough/passthrough.test.ts)**: 13 occurrences
- **[`test/structured-output.test.ts`](https://github.com/chrispangg/ai-sdk-deepagent/blob/3159edf99372af24e59b2d45c110d5115f0e62ae/test/structured-output.test.ts)**: 18 occurrences
- **[`test/subagents/selective-tools.test.ts`](https://github.com/chrispangg/ai-sdk-deepagent/blob/3159edf99372af24e59b2d45c110d5115f0e62ae/test/subagents/selective-tools.test.ts)**: 16 occurrences
- **[`test/tools/web.test.ts`](https://github.com/chrispangg/ai-sdk-deepagent/blob/3159edf99372af24e59b2d45c110d5115f0e62ae/test/tools/web.test.ts)**: 17 occurrences

## Code References

### Critical Production Code

- [`src/utils/patch-tool-calls.ts:99`](https://github.com/chrispangg/ai-sdk-deepagent/blob/3159edf99372af24e59b2d45c110d5115f0e62ae/src/utils/patch-tool-calls.ts#L99) - AI SDK integration workaround

### Example Code

- [`examples/with-structured-output.ts:45`](https://github.com/chrispangg/ai-sdk-deepagent/blob/3159edf99372af24e59b2d45c110d5115f0e62ae/examples/with-structured-output.ts#L45) - Structured output access pattern
- [`examples/with-structured-output.ts:88`](https://github.com/chrispangg/ai-sdk-deepagent/blob/3159edf99372af24e59b2d45c110d5115f0e62ae/examples/with-structured-output.ts#L88) - Streaming structured output

### Test Code (Representative Examples)

- [`test/structured-output.test.ts:212`](https://github.com/chrispangg/ai-sdk-deepagent/blob/3159edf99372af24e59b2d45c110d5115f0e62ae/test/structured-output.test.ts#L212) - Internal property access
- [`test/tools/web.test.ts:39`](https://github.com/chrispangg/ai-sdk-deepagent/blob/3159edf99372af24e59b2d45c110d5115f0e62ae/test/tools/web.test.ts#L39) - Global fetch mocking
- [`test/passthrough/passthrough.test.ts:40`](https://github.com/chrispangg/ai-sdk-deepagent/blob/3159edf99372af24e59b2d45c110d5115f0e62ae/test/passthrough/passthrough.test.ts#L40) - Mock model casting

## Architecture Documentation

### Current Type Safety Practices

The codebase demonstrates generally good TypeScript discipline with minimal `as any` usage in production code:

1. **Production Code**: Only 1 instance, isolated with clear TODO
2. **Example Code**: 6 instances, all related to structured output feature
3. **Test Code**: 86 instances, following standard testing patterns

### Integration Challenges

The primary sources of `as any` usage are external integration points:

1. **AI SDK Integration**: Tool-result object structure limitations
2. **Structured Output**: TypeScript inference limitations with AI SDK results
3. **Testing Framework**: Mock object simplification and internal access patterns

### Type System Design

The library uses complex type patterns including:

- Zod schema integration (`z.ZodType<any>`)
- Generic event systems with dynamic properties
- Middleware composition with flexible parameter passing
- Backend protocol implementations

## Related Research

- [`docs/tickets/012_architectural_health_assessment/research.md`](https://github.com/chrispangg/ai-sdk-deepagent/blob/main/docs/tickets/012_architectural_health_assessment/research.md) - Previous architectural analysis
- [`.agent/PROJECT-STATE.md`](https://github.com/chrispangg/ai-sdk-deepagent/blob/main/.agent/PROJECT-STATE.md) - Tracks this as high-priority item

## Open Questions

1. **AI SDK Integration**: What are the correct property names and types for tool-result objects?
2. **Structured Output Types**: Should the library provide type-safe result wrappers for structured output?
3. **Test Infrastructure**: Should test utilities be created to reduce mock-related `as any` usage?

## Recommendations

### Immediate Actions (High Priority)

1. **Fix the Single Production Instance**
   - Investigate AI SDK documentation for correct tool-result structure
   - Replace `as any` with proper typing in [`src/utils/patch-tool-calls.ts:99`](https://github.com/chrispangg/ai-sdk-deepagent/blob/3159edf99372af24e59b2d45c110d5115f0e62ae/src/utils/patch-tool-calls.ts#L99)

### Medium Priority Improvements

1. **Enhance Structured Output Types**
   - Add proper type definitions for agent results with structured output
   - Consider type-safe utility functions for accessing output properties
   - Update examples to demonstrate type-safe patterns

2. **Improve Test Infrastructure**
   - Create typed mock builders for common test scenarios
   - Add test-specific interfaces for internal property access
   - Consider utility functions for common mocking patterns

### Low Priority (Optional)

1. **Test Code Refinement**
   - Gradually replace well-justified test `as any` instances with more specific types
   - Focus on areas where better typing would improve test maintainability
   - Maintain balance between test simplicity and type safety

## Implementation Effort Estimate

- **Production Code Fix**: 0.5-1 day (requires AI SDK research)
- **Example Improvements**: 0.5-1 day (type definition work)
- **Test Infrastructure**: 1-2 days (optional, for improved maintainability)
- **Total Critical Path**: 1-2 days

The research shows this is a manageable type safety improvement with clear impact and well-defined scope.
