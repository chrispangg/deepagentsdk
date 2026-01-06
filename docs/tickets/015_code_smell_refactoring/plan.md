---
title: Code Smell Refactoring Plan
description: Documentation
---

**Created**: 2025-12-23
**Status**: In Progress
**Research**: [research.md](./research.md)
**Commit Base**: 4fac6660ed59556574d8443dc0026e121f6bb0ed

---

## Overview

This plan addresses technical debt identified in a comprehensive codebase analysis. The codebase is in good health following the 2025-12-21 architectural refactoring, with remaining work focused on code organization, test coverage, and function complexity.

**Summary of Findings**:

- 252 tests passing, zero `as any` in production code
- 13 functions over 50 lines, with `sendPrompt()` at 266 lines
- Scattered magic numbers and error message duplication
- Missing test coverage for utility functions and backends

**Refactoring Goals**:

1. Improve code maintainability through centralization
2. Increase test coverage for critical utilities
3. Reduce function complexity where beneficial

---

## Phase 1: Error Message Consolidation

**Priority**: High
**Estimated Time**: 1-2 hours
**Impact**: Consistency, DRY principle

### Changes Required

**New File**: `src/constants/errors.ts`

```typescript
/**
 * Centralized error message constants for backend operations
 * Reduces duplication across 6 backend implementations
 */

export const FILE_NOT_FOUND = (path: string) =>
  `Error: File '${path}' not found`;

export const FILE_ALREADY_EXISTS = (path: string) =>
  `Cannot write to ${path} because it already exists. Read and then make an edit, or write to a new path.`;

export const STRING_NOT_FOUND = (path: string, string: string) =>
  `Error: String not found in file: '${path}'\n\n${string}`;

export const INVALID_REGEX = (message: string) =>
  `Invalid regex pattern: ${message}`;

export const WEB_SEARCH_ERROR = (message: string) =>
  `Web search error: ${message}`;

export const REQUEST_TIMEOUT = (timeout: number) =>
  `Request timed out after ${timeout} seconds`;

export const SYSTEM_REMINDER_FILE_EMPTY =
  'System reminder: File exists but has empty contents';

// Generic errors
export const OPERATION_ERROR = (operation: string, message: string) =>
  `Operation error: ${operation} - ${message}`;
```

**Files to Update** (in order):

1. `src/backends/state.ts` - Replace error strings with constants
2. `src/backends/filesystem.ts` - Replace error strings with constants
3. `src/backends/persistent.ts` - Replace error strings with constants
4. `src/backends/sandbox.ts` - Replace error strings with constants
5. `src/backends/utils.ts` - Replace error strings with constants
6. `src/tools/web.ts` - Replace error strings with constants

### Success Criteria

#### Automated

- [x] All 252 existing tests still pass
- [x] TypeScript compilation successful
- [x] No new errors introduced

#### Manual

- [x] Error messages remain identical (user-facing)
- [x] Code is more maintainable (single source of truth)

---

## Phase 2: Magic Number Constants

**Priority**: Medium
**Estimated Time**: 1-2 hours
**Impact**: Maintainability, discoverability

### Changes Required

**New File**: `src/constants/limits.ts`

```typescript
/**
 * Centralized token, size, and timeout limits
 * Prevents magic number scattering across codebase
 */

// Token limits
export const DEFAULT_EVICTION_TOKEN_LIMIT = 20000;
export const DEFAULT_SUMMARIZATION_THRESHOLD = 170000;
export const CONTEXT_WINDOW = 200000;

// Message limits
export const DEFAULT_KEEP_MESSAGES = 6;
export const DEFAULT_MAX_STEPS = 100;
export const DEFAULT_SUBAGENT_MAX_STEPS = 50;
export const DEFAULT_MAX_HISTORY = 100;

// File size limits
export const DEFAULT_READ_LIMIT = 2000;
export const MAX_LINE_LENGTH = 10000;
export const MAX_FILE_SIZE_MB = 10;
export const MAX_OUTPUT_SIZE_BYTES = 1048576; // 1MB

// Timeouts
export const DEFAULT_TIMEOUT_SECONDS = 30;
export const DEFAULT_TIMEOUT_MS = DEFAULT_TIMEOUT_SECONDS * 1000;
export const FILESYSTEM_TIMEOUT_MS = 30000;

// Formatting
export const LINE_NUMBER_WIDTH = 6;
```

**Files to Update**:

1. `src/agent.ts` - Replace `maxSteps: 100` with `DEFAULT_MAX_STEPS`
2. `src/utils/eviction.ts` - Replace `20000` with `DEFAULT_EVICTION_TOKEN_LIMIT`
3. `src/utils/summarization.ts` - Replace `170000` and `6`
4. `src/backends/filesystem.ts` - Replace `2000`, `10` (file size)
5. `src/backends/utils.ts` - Replace `10000`, `6` (line width)
6. `src/backends/sandbox.ts` - Replace timeout values
7. `src/tools/subagent.ts` - Replace `50` (max steps)
8. `src/tools/web.ts` - Replace `30` (timeout)
9. `src/cli/index.tsx` - Replace limit constants
10. `src/cli/components/Input.tsx` - Replace `100` (max history)

### Success Criteria

#### Automated

- [ ] All tests pass
- [ ] No behavioral changes
- [ ] Constants are properly typed

#### Manual

- [ ] Magic numbers eliminated from production code
- [ ] Constants are discoverable in single location

---

## Phase 3: sendPrompt() Decomposition

**Priority**: High
**Estimated Time**: 2-3 hours
**Impact**: Maintainability, readability

### Changes Required

**File**: `src/cli/hooks/useAgent.ts`

**Current Structure** (lines 244-509, 266 lines):

```typescript
const sendPrompt = async (input: string) => {
  // ... setup code ...

  for await (const event of events) {
    switch (event.type) {
      case "text":
        // 40+ lines of text handling
        break;
      case "tool-call":
        // 30+ lines of tool call handling
        break;
      case "tool-result":
        // 20+ lines of tool result handling
        break;
      // ... 16 more cases ...
    }
  }

  // ... cleanup code ...
};
```

**Proposed Structure**:

```typescript
// Event handler map type
type EventHandler = (event: DeepAgentEvent) => void;

// Extract handlers (after sendPrompt, in same file)
const handleTextEvent: EventHandler = (event) => {
  if ('text' in event) {
    appendMessages((prev) => [...prev, { role: 'assistant', content: event.text }]);
  }
};

const handleToolCallEvent: EventHandler = (event) => {
  if ('toolName' in event) {
    setToolCalls((prev) => [...prev, event]);
    appendMessages((prev) => [...prev, {
      role: 'tool',
      content: `[Calling tool: ${event.toolName}]`,
    }]);
  }
};

// ... 17 more handler functions ...

// Handler map
const EVENT_HANDLERS: Record<string, EventHandler> = {
  "text": handleTextEvent,
  "tool-call": handleToolCallEvent,
  "tool-result": handleToolResultEvent,
  // ... all other handlers ...
};

// Simplified sendPrompt
const sendPrompt = async (input: string) => {
  // ... setup code ...

  for await (const event of events) {
    const handler = EVENT_HANDLERS[event.type];
    if (handler) {
      handler(event);
    }
  }

  // ... cleanup code ...
};
```

### Success Criteria

#### Automated

- [x] All tests pass
- [x] No behavioral changes
- [x] Event handling identical to original

#### Manual

- [x] Main `sendPrompt` function reduced to <150 lines
- [x] Each handler is focused and readable
- [x] Type safety maintained

---

## Phase 4: Test Coverage for Utilities

**Priority**: High (utils), Medium (backends)
**Estimated Time**: 2-3 hours per file
**Impact**: Confidence, regression prevention

### Changes Required

**New File**: `test/backends/utils.test.ts`

Test coverage for `src/backends/utils.ts`:

- `formatFileContent()` - Line number formatting, empty file handling
- `applyStringReplacement()` - String replacement logic
- `estimateTokens()` - Token estimation (may need mocking)

**New File**: `test/utils/summarization.test.ts`

Test coverage for `src/utils/summarization.ts`:

- `summarizeMessages()` - Message summarization with mock model
- Edge cases: empty array, single message, already under limit

**New File**: `test/backends/composite.test.ts`

Test coverage for `src/backends/composite.ts`:

- Backend routing by path prefix
- Fallback to default backend
- Error handling

### Success Criteria

#### Automated

- [x] New tests achieve >80% coverage for target files
- [x] All existing tests still pass
- [x] Tests follow bun:test patterns

#### Manual

- [x] Critical paths are tested
- [x] Edge cases are covered
- [x] Tests are readable and maintainable

---

## Phase 5: Event Creation Helpers (Optional)

**Priority**: Medium
**Estimated Time**: 2-3 hours
**Impact**: DRY, type safety

### Changes Required

**New File**: `src/utils/events.ts`

```typescript
/**
 * Type-safe event creation helpers
 * Reduces duplication of event object creation
 */

export function createFileReadEvent(path: string, lines: number): FileReadEvent {
  return {
    type: "file-read",
    path,
    lines,
  };
}

export function createFileWriteEvent(path: string, success: boolean): FileWriteEvent {
  return {
    type: "file-written",
    path,
    success,
  };
}

export function createToolCallEvent(
  toolName: string,
  args: Record<string, unknown>
): ToolCallEvent {
  return {
    type: "tool-call",
    toolName,
    args,
  };
}

// ... helpers for all 35+ event types
```

**Files to Update**:

- `src/tools/filesystem.ts` - Use event helpers
- `src/tools/todos.ts` - Use event helpers
- `src/tools/subagent.ts` - Use event helpers
- `src/tools/web.ts` - Use event helpers
- `src/agent.ts` - Use event helpers

### Success Criteria

#### Automated

- [x] All tests pass
- [x] Event types remain identical
- [x] Type inference works correctly

#### Manual

- [x] Event creation code reduced by ~30%
- [x] Event objects are consistently formatted

---

## Testing Strategy

### Pre-Refactoring Tests

**Verify baseline**:

```bash
bun test                    # All 252 tests pass
bun run typecheck          # No TypeScript errors
```

### Per-Phase Testing

**After each phase**:

1. Run full test suite: `bun test`
2. Run type check: `bun run typecheck`
3. Manual smoke test: `bun run cli --model anthropic/claude-haiku-4-5-20251001`
4. Commit with phase-specific message

### Test Files to Create

| Phase | Test File | Coverage Target |
|-------|-----------|-----------------|
| Phase 4 | `test/backends/utils.test.ts` | >80% |
| Phase 4 | `test/utils/summarization.test.ts` | >80% |
| Phase 4 | `test/backends/composite.test.ts` | >80% |

---

## Rollback Strategy

Each phase is independent and can be reverted:

```bash
# To rollback a specific phase
git revert <commit-hash>
# Or reset to before phase started
git reset --hard <commit-before-phase>
```

**No breaking changes** - All changes are internal refactoring.

---

## Progress Tracking

- [x] Phase 1: Error Message Consolidation
  - [x] Create `src/constants/errors.ts`
  - [x] Update 6 backend files
  - [x] Verify tests pass
  - [x] Commit changes

- [x] Phase 2: Magic Number Constants
  - [x] Create `src/constants/limits.ts`
  - [x] Update 10 files
  - [x] Verify tests pass
  - [x] Commit changes

- [x] Phase 3: sendPrompt() Decomposition
  - [x] Extract 17 event handlers
  - [x] Create handler map
  - [x] Simplify sendPrompt
  - [x] Verify tests pass
  - [x] Commit changes

- [x] Phase 4: Test Coverage
  - [x] Create `test/backends/utils.test.ts`
  - [x] Create `test/utils/summarization.test.ts`
  - [x] Create `test/backends/composite.test.ts`
  - [x] Verify all tests pass
  - [x] Commit changes

- [x] Phase 5: Event Creation Helpers (Optional)
  - [x] Create `src/utils/events.ts`
  - [x] Update tool files to use event helpers
  - [x] Verify tests pass
  - [x] Commit changes

---

## Commit Messages

Use semantic commit messages (per AGENTS.md):

```bash
# Phase 1
refactor: centralize error message constants

- Create src/constants/errors.ts with error message factories
- Update 6 backend implementations to use centralized errors
- Reduce error message duplication from 14+ occurrences to single source

# Phase 2
refactor: centralize magic number constants

- Create src/constants/limits.ts with token, size, and timeout limits
- Update 10 files to use centralized constants
- Eliminate magic numbers from production code

# Phase 3
refactor: decompose sendPrompt event handling

- Extract 17 event handlers from 266-line sendPrompt function
- Create type-safe event handler map
- Improve maintainability and readability

# Phase 4
test: add coverage for backends/utils, utils/summarization, backends/composite

- Create test/backends/utils.test.ts with >80% coverage
- Create test/utils/summarization.test.ts with >80% coverage
- Create test/backends/composite.test.ts with >80% coverage

# Phase 5
refactor: extract event creation helpers

- Create src/utils/events.ts with type-safe event factories
- Update 5 tool files to use event helpers
- Reduce event creation code duplication by ~30%
```

---

## Notes

### Non-Goals

**Explicitly NOT addressing** (per research recommendations):

- ❌ Centralized event bus - Current callback pattern is appropriate
- ❌ Async-only backends - Dual return types provide flexibility
- ❌ CLI component tests - Low ROI for internal tooling
- ❌ Decompose `streamWithEvents()` - Function is cohesive despite length
- ❌ Decompose subagent execute - Single responsibility, acceptable complexity

### Risk Mitigation

1. **Incremental changes** - One phase at a time
2. **Test coverage** - 252 existing tests prevent regressions
3. **Type safety** - TypeScript catches mismatches
4. **Manual testing** - Smoke test CLI after each phase

### Success Metrics

- ✅ All 252+ tests still passing
- ✅ Zero TypeScript errors
- ✅ Zero behavioral changes
- ✅ Improved code metrics (lower complexity, less duplication)
- ✅ No new code smells introduced

---

## References

- **Research Document**: [research.md](./research.md)
- **PROJECT-STATE**: [docs/PROJECT-STATE.md](https://github.com/chrispangg/deepagentsdk/blob/main/docs/PROJECT-STATE.md)
- **AGENTS.md**: [AGENTS.md](https://github.com/chrispangg/deepagentsdk/blob/main/AGENTS.md)
- **Publishing Guide**: [.github/PUBLISHING.md](https://github.com/chrispangg/deepagentsdk/blob/main/.github/PUBLISHING.md)
