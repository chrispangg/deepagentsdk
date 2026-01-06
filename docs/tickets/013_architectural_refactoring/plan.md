---
title: Architectural Refactoring Implementation Plan
description: Documentation
---

## Overview

Comprehensive refactoring to improve maintainability, reduce cognitive load, and standardise patterns across the deepagentsdk codebase. This plan addresses the key architectural debt identified in the health assessment while maintaining backward compatibility.

## Current State Analysis

Based on the architectural health assessment (`docs/tickets/012_architectural_health_assessment/research.md`):

### Issues Identified

- **types.ts**: 1,670 lines in a single file with mixed concerns
- **streamWithEvents()**: 300+ line function handling multiple responsibilities
- **Error handling**: Inconsistent patterns across modules (some return `{error?: string}`, others throw)
- **Type assertions**: 4 `as unknown` casts in `src/` (fewer than initially estimated)

### Impact on Developer Experience

- Navigation difficulty in large type files
- Unpredictable error handling patterns
- Complex function logic hard to test in isolation

## Desired End State

1. **Modular type system** organised by domain (agent, backend, events)
2. **Consistent error handling** with discriminated success/failure types
3. **Smaller, focused functions** with single responsibilities

## What We're NOT Doing

- Breaking changes to public APIs (all changes will be backward compatible)
- Event system refactoring (deferred to future major release per PROJECT-STATE.md)
- Skills ecosystem enhancement (deferred to future major release per PROJECT-STATE.md)
- CLI separation from core library (keeping as-is per user request)
- Backend API changes (maintaining current protocol interfaces)
- Introducing new libraries (using minimal, in-place improvements)
- Tool factory signature standardisation (excluded from scope)
- Custom Result<T> type (using discriminant approach instead)

## Implementation Approach

**Strategy**: Incremental refactoring with clear phase boundaries. Each phase builds on the previous one without breaking existing functionality.

**Key Principles**:

1. Backward compatibility is maintained throughout
2. Each phase can be independently tested and verified
3. Minimal changes - evolve existing patterns rather than replace
4. No new library dependencies

---

## Phase 1: Type System Modularisation

### Overview

Split the monolithic `types.ts` file into domain-specific modules to improve navigation and reduce cognitive load.

### Changes Required

#### 1. Create Type Module Structure

**Files**: New files in `src/types/`

```
src/types/
├── index.ts       # Re-exports for backward compatibility
├── core.ts        # Agent config + State + Approval (tightly coupled)
├── backend.ts     # BackendProtocol + Filesystem types
├── events.ts      # All 30+ event types + EventCallback
└── subagent.ts    # Subagent infrastructure
```

**File contents**:

```typescript
// src/types/core.ts - Core agent configuration, state, and approval types
export interface CreateDeepAgentParams { ... }
export interface DeepAgentState { ... }
export interface TodoItem { ... }
export interface SummarizationConfig { ... }
export interface GenerationOptions { ... }
export interface AdvancedAgentOptions { ... }
export interface InterruptOnConfig { ... }
export interface DynamicApprovalConfig { ... }

// src/types/backend.ts - Backend protocol and filesystem types
export interface BackendProtocol { ... }
export interface BackendFactory { ... }
export interface SandboxBackendProtocol extends BackendProtocol { ... }
export interface FileData { ... }
export interface FileInfo { ... }
export interface WriteResult { ... }
export interface EditResult { ... }

// src/types/events.ts - All event system types
export type DeepAgentEvent = ... // Union of 30+ event types
export type EventCallback = (event: DeepAgentEvent) => void;
export interface ToolEventContext { ... }
// ... all individual event interfaces

// src/types/subagent.ts - Subagent infrastructure
export interface SubAgent { ... }
export interface SubagentToolConfig { ... }
export interface BuiltinToolCreator { ... }
```

**Note**: CLI-specific types remain in `src/cli/` (not moved to `src/types/cli.ts`).

#### 2. Update Index File

**File**: `src/types.ts` (replace contents with re-exports)

```typescript
// Re-export everything for backward compatibility
export * from './types/core.js';
export * from './types/backend.js';
export * from './types/events.js';
export * from './types/subagent.js';

// Keep existing utility exports
export { isSandboxBackend } from './types/backend.js';
```

#### 3. Fix Type Assertion in patch-tool-calls.ts

**File**: `src/utils/patch-tool-calls.ts`

```typescript
// Before (line 102):
} as unknown as ModelMessage;

// After - properly type the object construction:
const message: ModelMessage = {
  role: 'assistant',
  content: [
    // ... properly typed content
  ],
};
return message;
```

**Note**: The other 2 `as unknown` casts in `kv-saver.ts` are legitimate type boundaries with the KV store and should be kept.

#### 4. Update Internal Imports

**Files**: `src/tools/*.ts`, `src/backends/*.ts`, `src/utils/*.ts`

All internal imports continue to use `../types.js` - the re-exports maintain compatibility.

### Success Criteria

#### Automated Verification

- [ ] All tests pass: `bun test`
- [ ] Type checking passes: `bun run typecheck`
- [ ] No breaking changes to public API (verified by existing tests)
- [ ] No circular dependencies introduced

#### Manual Verification

- [ ] IDE navigation to types works correctly
- [ ] Import autocomplete functions properly
- [ ] Each type file is <400 lines

---

## Phase 2: Error Handling Standardisation

### Overview

Evolve existing error handling patterns by adding discriminants to success/failure types. This is a minimal change that maintains backward compatibility while enabling better type narrowing.

### Changes Required

#### 1. Update WriteResult Interface

**File**: `src/types/backend.ts` (or `src/types.ts` before Phase 1)

```typescript
// Before:
export interface WriteResult {
  /** Error message on failure, undefined on success */
  error?: string;
  /** File path of written file, undefined on failure */
  path?: string;
}

// After - add discriminant while keeping existing fields:
export interface WriteResult {
  /** Whether the operation succeeded */
  success: boolean;
  /** Error message on failure, undefined on success */
  error?: string;
  /** File path of written file, undefined on failure */
  path?: string;
}
```

#### 2. Update EditResult Interface

**File**: `src/types/backend.ts`

```typescript
// Before:
export interface EditResult {
  error?: string;
  path?: string;
  replacements?: number;
}

// After:
export interface EditResult {
  success: boolean;
  error?: string;
  path?: string;
  replacements?: number;
}
```

#### 3. Add Type Guards

**File**: `src/types/backend.ts`

```typescript
/**
 * Type guard for successful write operations
 */
export function isWriteSuccess(result: WriteResult): result is WriteResult & { success: true; path: string } {
  return result.success === true && typeof result.path === 'string';
}

/**
 * Type guard for successful edit operations
 */
export function isEditSuccess(result: EditResult): result is EditResult & { success: true; path: string } {
  return result.success === true && typeof result.path === 'string';
}
```

#### 4. Update Backend Implementations

**Files**: `src/backends/filesystem.ts`, `src/backends/state.ts`, `src/backends/persistent.ts`, `src/backends/sandbox.ts`, `src/backends/composite.ts`

Update all `write()` and `edit()` methods to include `success` field:

```typescript
// Example: src/backends/filesystem.ts write method
async write(filePath: string, content: string): Promise<WriteResult> {
  try {
    // ... existing logic ...
    
    // Success case - add success: true
    return { success: true, path: filePath };
  } catch (e: unknown) {
    const error = e as Error;
    // Failure case - add success: false
    return { success: false, error: `Error writing file '${filePath}': ${error.message}` };
  }
}
```

```typescript
// Example: src/backends/state.ts write method (sync)
write(filePath: string, content: string): WriteResult {
  const files = this.getFiles();

  if (filePath in files) {
    return {
      success: false,
      error: `Cannot write to ${filePath} because it already exists.`,
    };
  }

  const newFileData = createFileData(content);
  this.state.files[filePath] = newFileData;
  return { success: true, path: filePath };
}
```

#### 5. Update Tool Consumers (Optional)

Tools can optionally use the new type guards, but existing checks still work:

```typescript
// Both patterns work - backward compatible:

// Old pattern (still works):
const result = await backend.write(filePath, content);
if (result.error) {
  return `Error: ${result.error}`;
}
return `File written: ${result.path}`;

// New pattern (optional, better type narrowing):
const result = await backend.write(filePath, content);
if (!isWriteSuccess(result)) {
  return `Error: ${result.error}`;
}
return `File written: ${result.path}`; // TypeScript knows path is string
```

### Success Criteria

#### Automated Verification

- [ ] All tests pass: `bun test`
- [ ] Type checking passes: `bun run typecheck`
- [ ] All backend write/edit methods return `success` field

#### Manual Verification

- [ ] Existing code checking `result.error` still works
- [ ] Type guards provide proper type narrowing
- [ ] Error messages remain clear and actionable

---

## Phase 3: Function Decomposition

### Overview

Break down large functions into smaller, focused functions with single responsibilities.

### Changes Required

#### 1. Refactor streamWithEvents Method

**File**: `src/agent.ts`

**Before**: ~300 line single function handling:

- Checkpoint loading
- Message validation and building
- Tool creation with approval wrapping
- StreamText options construction
- Event queue processing
- Checkpoint saving

**After**: Decomposed into focused private methods:

```typescript
async *streamWithEvents(options: StreamWithEventsOptions): AsyncGenerator<DeepAgentEvent> {
  // 1. Initialize context from options and checkpoint
  const context = await this.initializeStreamContext(options);
  if (context.error) {
    yield context.error;
    return;
  }

  // 2. Yield checkpoint loaded event if applicable
  if (context.checkpointLoaded) {
    yield context.checkpointLoaded;
  }

  // 3. Execute main streaming loop
  yield* this.executeStreamingLoop(context);
}

/**
 * Initialize stream context: load checkpoint, validate inputs, build messages
 */
private async initializeStreamContext(
  options: StreamWithEventsOptions
): Promise<StreamContext> {
  // ~80 lines extracted from streamWithEvents
  // - Load checkpoint if threadId provided
  // - Handle resume from interrupt
  // - Validate prompt/messages/threadId
  // - Build message array with proper priority
  // - Apply summarization if needed
}

/**
 * Execute the main streaming loop with tool calls
 */
private async *executeStreamingLoop(
  context: StreamContext
): AsyncGenerator<DeepAgentEvent> {
  // ~150 lines extracted from streamWithEvents
  // - Create tools with event callback
  // - Wrap tools with approval if configured
  // - Build streamText options
  // - Process stream and yield events
  // - Save checkpoint on completion
}

/**
 * Build streamText configuration from context
 */
private buildStreamOptions(context: StreamContext): StreamTextOptions {
  // ~40 lines extracted
  // - Construct system prompt
  // - Add provider options
  // - Configure generation options
}

/**
 * Process and yield queued events
 */
private async *yieldQueuedEvents(
  eventQueue: DeepAgentEvent[]
): AsyncGenerator<DeepAgentEvent> {
  // ~20 lines extracted
  while (eventQueue.length > 0) {
    yield eventQueue.shift()!;
  }
}
```

**Supporting Types**:

```typescript
// Add to src/types/core.ts or keep private in agent.ts
interface StreamContext {
  state: DeepAgentState;
  messages: ModelMessage[];
  currentStep: number;
  threadId?: string;
  error?: ErrorEvent;
  checkpointLoaded?: CheckpointLoadedEvent;
}
```

#### 2. Refactor createTools Method

**File**: `src/agent.ts`

**Before**: Large method creating all tools at once

**After**: Separated by tool category for better organisation:

```typescript
private createTools(state: DeepAgentState, onEvent?: EventCallback): ToolSet {
  const tools: ToolSet = {};

  // Core tools (always included)
  Object.assign(tools, this.createCoreTools(state, onEvent));

  // Web tools (if enabled)
  if (this.includeWebTools) {
    Object.assign(tools, this.createWebToolSet(state, onEvent));
  }

  // Execute tool (if sandbox backend)
  if (this.sandboxBackend) {
    Object.assign(tools, this.createExecuteToolSet(state, onEvent));
  }

  // Subagent tools (if subagents configured)
  if (this.subagents.length > 0 || this.includeGeneralPurposeAgent) {
    Object.assign(tools, this.createSubagentToolSet(state, onEvent));
  }

  // Custom tools (user-provided)
  if (this.customTools) {
    Object.assign(tools, this.customTools);
  }

  return tools;
}

private createCoreTools(state: DeepAgentState, onEvent?: EventCallback): ToolSet {
  return {
    write_todos: createTodosTool(state, onEvent),
    ...createFilesystemTools(state, {
      backend: this.backend,
      onEvent,
      toolResultEvictionLimit: this.toolResultEvictionLimit,
    }),
  };
}

private createWebToolSet(state: DeepAgentState, onEvent?: EventCallback): ToolSet {
  return createWebTools(state, {
    backend: this.backend,
    onEvent,
    toolResultEvictionLimit: this.toolResultEvictionLimit,
  });
}

private createExecuteToolSet(state: DeepAgentState, onEvent?: EventCallback): ToolSet {
  return {
    execute: createExecuteTool(this.sandboxBackend!, onEvent),
  };
}

private createSubagentToolSet(state: DeepAgentState, onEvent?: EventCallback): ToolSet {
  // Extract subagent tool creation logic
}
```

### Success Criteria

#### Automated Verification

- [ ] All tests pass: `bun test`
- [ ] Type checking passes: `bun run typecheck`
- [ ] No functional regressions (same behavior, different structure)

#### Manual Verification

- [ ] Individual methods are <100 lines each
- [ ] Function names clearly indicate their purpose
- [ ] Code is easier to read and understand

---

## Testing Strategy

### Unit Tests

For each phase:

1. **Type System Modularisation**
   - All type imports still work correctly
   - Public API exports are maintained
   - No circular dependencies introduced

2. **Error Handling Standardisation**
   - Success cases return `{ success: true, path: "..." }`
   - Failure cases return `{ success: false, error: "..." }`
   - Type guards narrow types correctly
   - Existing `result.error` checks still work

3. **Function Decomposition**
   - Refactored functions maintain the same behaviour
   - No performance regressions
   - Edge cases still handled correctly

### Integration Tests

- End-to-end agent functionality remains unchanged
- All example files continue to work
- Error handling behaves consistently across scenarios

### Manual Testing Steps

1. Run all example files to ensure compatibility
2. Test error scenarios (missing files, invalid permissions, etc.)
3. Verify IDE experience improves with new type structure

---

## Performance Considerations

### Positive Impacts

- Smaller type files may improve IDE performance
- Better type narrowing may enable compiler optimisations

### Negligible Impacts

- Additional function calls from decomposition (JIT optimises these away)
- Type system changes are compile-time only

---

## Migration Notes

### For Internal Developers

1. Import paths remain unchanged (re-exports maintain compatibility)
2. `WriteResult` and `EditResult` now have `success` field
3. New type guards available: `isWriteSuccess()`, `isEditSuccess()`

### For Library Users

- No breaking changes to public API
- All existing code continues to work
- Improved type information available

---

## Rollback Plan

If any phase introduces issues:

1. Git revert the specific phase changes
2. Run tests to verify rollback
3. Address issues before proceeding
4. Each phase is independent, so rollbacks don't affect other phases

---

## Timeline Estimate

| Phase | Duration | Description |
|-------|----------|-------------|
| Phase 1 | 2-3 days | Type system modularisation + type assertion fix |
| Phase 2 | 1-2 days | Error handling standardisation (minimal approach) |
| Phase 3 | 2-3 days | Function decomposition |

**Total**: 5-8 days (can be done incrementally)

---

## Summary of Changes from Original Plan

1. **Reduced type file count**: 4 files instead of 7 (avoid over-fragmentation)
2. **CLI types excluded**: Stay in `src/cli/` per guidance
3. **No custom Result<T>**: Using discriminant approach instead (minimal change)
4. **No neverthrow dependency**: Keeping dependencies minimal
5. **Phase 3 removed**: Type assertion fixes merged into Phase 1
6. **Tool factory standardisation excluded**: Out of scope
7. **Timeline reduced**: 5-8 days instead of 7-11 days
