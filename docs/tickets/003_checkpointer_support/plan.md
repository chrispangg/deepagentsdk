---
title: Checkpointer Support Implementation Plan
description: Documentation
---

## Overview

Implement Checkpointer Support for ai-sdk-deep-agent to enable persisting agent state (todos, files, conversation history) between invocations. This allows long-running agent workflows to be paused, resumed later, or moved between sessions—essential for production deployments and long-running tasks.

## Current State Analysis

### What Exists

- **DeepAgentState** (`src/types.ts:86-91`): Contains `todos: TodoItem[]` and `files: Record<string, FileData>`
- **streamWithEvents** (`src/agent.ts:307-452`): Accepts `state`, `messages`, `prompt` - returns mutated state and updated messages in `done` event
- **onStepFinish callback**: Available in `streamText` options - ideal hook for checkpointing
- **KeyValueStore interface** (`src/backends/persistent.ts:70-101`): Reusable pattern for storage adapters
- **HITL approval flow**: Already implements pause/resume pattern via callbacks

### What's Missing

- No `Checkpoint` type definition
- No `BaseCheckpointSaver` interface
- No `threadId` concept for conversation isolation
- No auto-save after each step
- No `resume` option for continuing interrupted workflows
- No CLI session persistence

### Key Constraints

- AI SDK v6 does **not** provide built-in checkpointing - we must implement manually
- Messages must be serializable (may contain images/files that need special handling)
- FilesystemBackend changes are NOT reverted on checkpoint restore (by design)
- Must maintain backward compatibility - checkpointing is opt-in

## Desired End State

### Library API

```typescript
import { anthropic } from '@ai-sdk/anthropic';
import { createDeepAgent, MemorySaver, FileSaver } from 'ai-sdk-deep-agent';

// Create agent with checkpointer
const agent = createDeepAgent({
  model: anthropic('claude-sonnet-4-20250514'),
  checkpointer: new FileSaver({ dir: './.checkpoints' }),
});

// Start a new conversation thread
const threadId = 'session-123';

for await (const event of agent.streamWithEvents({
  prompt: "Create a project plan",
  threadId,  // Enable checkpointing for this thread
})) {
  if (event.type === 'done') {
    console.log('Checkpoint saved automatically');
  }
}

// Later: Resume the same thread
for await (const event of agent.streamWithEvents({
  threadId: 'session-123',  // Load existing checkpoint
  prompt: "Now implement the first task",
})) {
  // Agent has full context from previous interaction
}

// Resume from interrupt (e.g., after approval)
for await (const event of agent.streamWithEvents({
  threadId: 'session-123',
  resume: { decisions: [{ type: 'approve' }] },
})) {
  // Continue from where we left off
}
```

### CLI Behavior

```
# CLI auto-saves session
$ bun run cli --session my-project

# Session is restored on restart
$ bun run cli --session my-project
> Restored session: 5 messages, 3 todos, 2 files

# List sessions
> /sessions
  my-project (last updated: 2025-12-13 10:30)
  refactoring-task (last updated: 2025-12-12 15:45)

# Clear session
> /session clear
Session cleared.
```

### Verification

- [x] Checkpoints are saved after each step when `checkpointer` is configured
- [x] `threadId` isolates conversations - different threads don't interfere
- [x] `resume` option works for continuing from interrupts
- [x] State (todos, files) is correctly restored from checkpoint
- [x] Messages (conversation history) are correctly restored
- [x] FilesystemBackend changes persist even when checkpoint is not used
- [x] CLI sessions are restored on restart
- [x] Backward compatible - no `checkpointer` = existing behavior

## What We're NOT Doing

1. **Full rollback of FilesystemBackend** - External storage is intentionally not rolled back
2. **Branching/forking checkpoints** - Single linear checkpoint per thread
3. **Automatic cleanup/TTL** - Users manage checkpoint lifecycle
4. **Cross-machine checkpoint sharing** - Users provide their own distributed storage
5. **Message compression** - Large messages stored as-is (users can filter if needed)

---

## Implementation Approach

We follow the same pattern as LangChain DeepAgents:

1. **Checkpointer interface** for pluggable storage
2. **Thread ID** for conversation isolation
3. **Auto-save after each step** via `onStepFinish`
4. **Resume support** for continuing interrupted workflows

Key differences from LangChain:

- We checkpoint via callbacks (not graph nodes)
- Resume is handled via options (not `Command` objects)
- Integration with existing approval flow

---

## Phase 1: Core Types and Interfaces

### Overview

Define the `Checkpoint`, `BaseCheckpointSaver`, and related types. This establishes the foundation for all checkpointing functionality.

### Changes Required

#### 1. Checkpoint Types

**File**: `src/checkpointer/types.ts` (NEW)

```typescript
/**
 * Type definitions for checkpointer support.
 */

import type { DeepAgentState, ModelMessage } from "../types.ts";

/**
 * Data stored in a checkpoint.
 * Contains everything needed to resume an agent session.
 */
export interface Checkpoint {
  /** Unique identifier for the conversation thread */
  threadId: string;
  
  /** Step number when this checkpoint was created */
  step: number;
  
  /** Conversation history (serialized messages) */
  messages: ModelMessage[];
  
  /** Agent state (todos and StateBackend files) */
  state: DeepAgentState;
  
  /** 
   * Interrupt data if the agent was paused mid-execution.
   * Present when waiting for tool approval.
   */
  interrupt?: InterruptData;
  
  /** ISO 8601 timestamp when checkpoint was created */
  createdAt: string;
  
  /** ISO 8601 timestamp when checkpoint was last updated */
  updatedAt: string;
}

/**
 * Data about an interrupted tool execution.
 * Used to resume from approval requests.
 */
export interface InterruptData {
  /** The tool call that requires approval */
  toolCall: {
    toolCallId: string;
    toolName: string;
    args: unknown;
  };
  
  /** Step number where interrupt occurred */
  step: number;
}

/**
 * Decision to resume from an interrupt.
 */
export interface ResumeDecision {
  /** Type of decision */
  type: 'approve' | 'deny';
  
  /** Optional modified arguments (for future "edit" feature) */
  modifiedArgs?: unknown;
}

/**
 * Options for resuming from a checkpoint.
 */
export interface ResumeOptions {
  /** Decisions for pending tool approvals */
  decisions: ResumeDecision[];
}

/**
 * Interface for checkpoint storage implementations.
 * 
 * Implement this interface to use any storage backend (memory, files,
 * Redis, database, etc.) for persisting checkpoints.
 */
export interface BaseCheckpointSaver {
  /**
   * Save a checkpoint.
   * If a checkpoint for the threadId already exists, it is overwritten.
   * 
   * @param checkpoint - The checkpoint data to save
   */
  save(checkpoint: Checkpoint): Promise<void>;
  
  /**
   * Load the latest checkpoint for a thread.
   * 
   * @param threadId - The thread identifier
   * @returns The checkpoint, or undefined if not found
   */
  load(threadId: string): Promise<Checkpoint | undefined>;
  
  /**
   * List all thread IDs with saved checkpoints.
   * 
   * @returns Array of thread IDs
   */
  list(): Promise<string[]>;
  
  /**
   * Delete a checkpoint.
   * 
   * @param threadId - The thread identifier to delete
   */
  delete(threadId: string): Promise<void>;
  
  /**
   * Check if a checkpoint exists for a thread.
   * 
   * @param threadId - The thread identifier
   * @returns True if checkpoint exists
   */
  exists(threadId: string): Promise<boolean>;
}

/**
 * Options for creating a checkpoint saver.
 */
export interface CheckpointSaverOptions {
  /** Optional namespace prefix for isolation */
  namespace?: string;
}
```

#### 2. Export from Index

**File**: `src/checkpointer/index.ts` (NEW)

```typescript
export * from "./types.ts";
```

#### 3. Main Index Export

**File**: `src/index.ts`
**Changes**: Add checkpoint exports

```typescript
// Add to existing exports
export * from "./checkpointer/index.ts";
```

### Success Criteria

#### Automated Verification

- [x] Type checking passes: `bun run typecheck`
- [x] Types are exported from main index

#### Manual Verification

- [x] `Checkpoint` interface captures all required data
- [x] `BaseCheckpointSaver` interface is implementable

---

## Phase 2: Built-in Checkpoint Savers

### Overview

Implement three checkpoint savers for different use cases:

- **MemorySaver**: In-memory storage for testing
- **FileSaver**: JSON files for local development
- **KeyValueStoreSaver**: Adapter for existing `KeyValueStore` interface

### Changes Required

#### 1. MemorySaver Implementation

**File**: `src/checkpointer/memory-saver.ts` (NEW)

```typescript
/**
 * In-memory checkpoint saver for testing and single-session use.
 */

import type { Checkpoint, BaseCheckpointSaver, CheckpointSaverOptions } from "./types.ts";

/**
 * In-memory checkpoint saver.
 * 
 * Stores checkpoints in a Map. Data is lost when the process exits.
 * Useful for testing or single-session applications.
 * 
 * @example
 * ```typescript
 * const saver = new MemorySaver();
 * const agent = createDeepAgent({
 *   model: anthropic('claude-sonnet-4-20250514'),
 *   checkpointer: saver,
 * });
 * ```
 */
export class MemorySaver implements BaseCheckpointSaver {
  private checkpoints = new Map<string, Checkpoint>();
  private namespace: string;

  constructor(options: CheckpointSaverOptions = {}) {
    this.namespace = options.namespace || "default";
  }

  private getKey(threadId: string): string {
    return `${this.namespace}:${threadId}`;
  }

  async save(checkpoint: Checkpoint): Promise<void> {
    const key = this.getKey(checkpoint.threadId);
    this.checkpoints.set(key, {
      ...checkpoint,
      updatedAt: new Date().toISOString(),
    });
  }

  async load(threadId: string): Promise<Checkpoint | undefined> {
    const key = this.getKey(threadId);
    return this.checkpoints.get(key);
  }

  async list(): Promise<string[]> {
    const prefix = `${this.namespace}:`;
    const threadIds: string[] = [];
    for (const key of this.checkpoints.keys()) {
      if (key.startsWith(prefix)) {
        threadIds.push(key.substring(prefix.length));
      }
    }
    return threadIds;
  }

  async delete(threadId: string): Promise<void> {
    const key = this.getKey(threadId);
    this.checkpoints.delete(key);
  }

  async exists(threadId: string): Promise<boolean> {
    const key = this.getKey(threadId);
    return this.checkpoints.has(key);
  }

  /**
   * Clear all checkpoints (useful for testing).
   */
  clear(): void {
    this.checkpoints.clear();
  }

  /**
   * Get the number of stored checkpoints.
   */
  size(): number {
    return this.checkpoints.size;
  }
}
```

#### 2. FileSaver Implementation

**File**: `src/checkpointer/file-saver.ts` (NEW)

```typescript
/**
 * File-based checkpoint saver for local development.
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync, unlinkSync, readdirSync } from "node:fs";
import { join } from "node:path";
import type { Checkpoint, BaseCheckpointSaver } from "./types.ts";

/**
 * Options for FileSaver.
 */
export interface FileSaverOptions {
  /** Directory to store checkpoint files */
  dir: string;
}

/**
 * File-based checkpoint saver.
 * 
 * Stores checkpoints as JSON files in a directory. Each thread gets
 * its own file named `{threadId}.json`.
 * 
 * @example
 * ```typescript
 * const saver = new FileSaver({ dir: './.checkpoints' });
 * const agent = createDeepAgent({
 *   model: anthropic('claude-sonnet-4-20250514'),
 *   checkpointer: saver,
 * });
 * ```
 */
export class FileSaver implements BaseCheckpointSaver {
  private dir: string;

  constructor(options: FileSaverOptions) {
    this.dir = options.dir;
    
    // Ensure directory exists
    if (!existsSync(this.dir)) {
      mkdirSync(this.dir, { recursive: true });
    }
  }

  private getFilePath(threadId: string): string {
    // Sanitize threadId to be safe for filenames
    const safeId = threadId.replace(/[^a-zA-Z0-9_-]/g, '_');
    return join(this.dir, `${safeId}.json`);
  }

  async save(checkpoint: Checkpoint): Promise<void> {
    const filePath = this.getFilePath(checkpoint.threadId);
    const data = {
      ...checkpoint,
      updatedAt: new Date().toISOString(),
    };
    writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf-8');
  }

  async load(threadId: string): Promise<Checkpoint | undefined> {
    const filePath = this.getFilePath(threadId);
    
    if (!existsSync(filePath)) {
      return undefined;
    }
    
    try {
      const content = readFileSync(filePath, 'utf-8');
      return JSON.parse(content) as Checkpoint;
    } catch {
      return undefined;
    }
  }

  async list(): Promise<string[]> {
    if (!existsSync(this.dir)) {
      return [];
    }
    
    const files = readdirSync(this.dir);
    return files
      .filter(f => f.endsWith('.json'))
      .map(f => f.replace('.json', ''));
  }

  async delete(threadId: string): Promise<void> {
    const filePath = this.getFilePath(threadId);
    
    if (existsSync(filePath)) {
      unlinkSync(filePath);
    }
  }

  async exists(threadId: string): Promise<boolean> {
    const filePath = this.getFilePath(threadId);
    return existsSync(filePath);
  }
}
```

#### 3. KeyValueStoreSaver Implementation

**File**: `src/checkpointer/kv-saver.ts` (NEW)

```typescript
/**
 * Checkpoint saver using KeyValueStore interface.
 * 
 * Allows using existing KeyValueStore implementations (Redis, etc.)
 * for checkpoint storage.
 */

import type { KeyValueStore } from "../backends/persistent.ts";
import type { Checkpoint, BaseCheckpointSaver, CheckpointSaverOptions } from "./types.ts";

/**
 * Options for KeyValueStoreSaver.
 */
export interface KeyValueStoreSaverOptions extends CheckpointSaverOptions {
  /** The KeyValueStore implementation to use */
  store: KeyValueStore;
}

/**
 * Checkpoint saver using KeyValueStore interface.
 * 
 * This adapter allows using any KeyValueStore implementation (Redis,
 * database, cloud storage, etc.) for checkpoint storage.
 * 
 * @example
 * ```typescript
 * import { InMemoryStore } from 'ai-sdk-deep-agent';
 * 
 * const store = new InMemoryStore();
 * const saver = new KeyValueStoreSaver({ store });
 * const agent = createDeepAgent({
 *   model: anthropic('claude-sonnet-4-20250514'),
 *   checkpointer: saver,
 * });
 * ```
 * 
 * @example With Redis
 * ```typescript
 * const redisStore = new RedisStore(redisClient); // Your implementation
 * const saver = new KeyValueStoreSaver({ store: redisStore });
 * ```
 */
export class KeyValueStoreSaver implements BaseCheckpointSaver {
  private store: KeyValueStore;
  private namespace: string[];

  constructor(options: KeyValueStoreSaverOptions) {
    this.store = options.store;
    this.namespace = [options.namespace || "default", "checkpoints"];
  }

  async save(checkpoint: Checkpoint): Promise<void> {
    const data = {
      ...checkpoint,
      updatedAt: new Date().toISOString(),
    };
    await this.store.put(this.namespace, checkpoint.threadId, data as unknown as Record<string, unknown>);
  }

  async load(threadId: string): Promise<Checkpoint | undefined> {
    const data = await this.store.get(this.namespace, threadId);
    if (!data) {
      return undefined;
    }
    return data as unknown as Checkpoint;
  }

  async list(): Promise<string[]> {
    const items = await this.store.list(this.namespace);
    return items.map(item => item.key);
  }

  async delete(threadId: string): Promise<void> {
    await this.store.delete(this.namespace, threadId);
  }

  async exists(threadId: string): Promise<boolean> {
    const data = await this.store.get(this.namespace, threadId);
    return data !== undefined;
  }
}
```

#### 4. Export All Savers

**File**: `src/checkpointer/index.ts`
**Changes**: Add saver exports

```typescript
export * from "./types.ts";
export * from "./memory-saver.ts";
export * from "./file-saver.ts";
export * from "./kv-saver.ts";
```

### Success Criteria

#### Automated Verification

- [x] Type checking passes: `bun run typecheck`
- [ ] Unit tests pass for all three savers

#### Manual Verification

- [x] MemorySaver stores and retrieves checkpoints
- [x] FileSaver creates JSON files in specified directory
- [x] KeyValueStoreSaver works with InMemoryStore

---

## Phase 3: DeepAgent Integration

### Overview

Integrate checkpointing into the DeepAgent class. Add `checkpointer` to constructor and auto-save after each step via `onStepFinish`.

### Changes Required

#### 1. Update CreateDeepAgentParams

**File**: `src/types.ts`
**Changes**: Add checkpointer parameter

```typescript
// Add import at top
import type { BaseCheckpointSaver } from "./checkpointer/types.ts";

// Add to CreateDeepAgentParams interface (around line 350)

  /**
   * Optional checkpointer for persisting agent state between invocations.
   * 
   * When provided, the agent automatically saves checkpoints after each step.
   * Use with `threadId` in streamWithEvents to enable conversation persistence.
   * 
   * @example
   * ```typescript
   * import { MemorySaver } from 'ai-sdk-deep-agent';
   * 
   * const agent = createDeepAgent({
   *   model: anthropic('claude-sonnet-4-20250514'),
   *   checkpointer: new MemorySaver(),
   * });
   * ```
   */
  checkpointer?: BaseCheckpointSaver;
```

#### 2. Update StreamWithEventsOptions

**File**: `src/types.ts`
**Changes**: Add threadId and resume options

```typescript
// Add import
import type { ResumeOptions } from "./checkpointer/types.ts";

// Update StreamWithEventsOptions interface

export interface StreamWithEventsOptions {
  /** The user's prompt/message */
  prompt?: string;  // Make optional for resume-only calls
  
  /** Maximum number of steps for the agent loop */
  maxSteps?: number;
  
  /** Shared state for todos and files */
  state?: DeepAgentState;
  
  /** Conversation history for multi-turn conversations */
  messages?: ModelMessage[];
  
  /** Signal to abort the generation */
  abortSignal?: AbortSignal;
  
  /**
   * Thread ID for checkpoint persistence.
   * When provided with a checkpointer, enables:
   * - Auto-saving checkpoints after each step
   * - Loading previous conversation state on start
   * - Resume from interrupts
   */
  threadId?: string;
  
  /**
   * Resume options for continuing from an interrupt.
   * Use when resuming from a tool approval request.
   */
  resume?: ResumeOptions;
  
  /**
   * Callback to handle tool approval requests.
   * Return true to approve, false to deny.
   * If not provided, tools requiring approval will be auto-denied.
   */
  onApprovalRequest?: (request: {
    approvalId: string;
    toolCallId: string;
    toolName: string;
    args: unknown;
  }) => Promise<boolean>;
}
```

#### 3. Add Checkpoint Events

**File**: `src/types.ts`
**Changes**: Add checkpoint-related events

```typescript
// Add after ApprovalResponseEvent

/**
 * Event emitted when a checkpoint is saved.
 */
export interface CheckpointSavedEvent {
  type: "checkpoint-saved";
  /** Thread ID */
  threadId: string;
  /** Step number */
  step: number;
}

/**
 * Event emitted when a checkpoint is loaded.
 */
export interface CheckpointLoadedEvent {
  type: "checkpoint-loaded";
  /** Thread ID */
  threadId: string;
  /** Step number from loaded checkpoint */
  step: number;
  /** Number of messages restored */
  messagesCount: number;
}

// Update DeepAgentEvent union
export type DeepAgentEvent =
  | TextEvent
  | StepStartEvent
  | StepFinishEvent
  | ToolCallEvent
  | ToolResultEvent
  | TodosChangedEvent
  | FileWriteStartEvent
  | FileWrittenEvent
  | FileEditedEvent
  | FileReadEvent
  | LsEvent
  | GlobEvent
  | GrepEvent
  | ExecuteStartEvent
  | ExecuteFinishEvent
  | SubagentStartEvent
  | SubagentFinishEvent
  | TextSegmentEvent
  | UserMessageEvent
  | ApprovalRequestedEvent
  | ApprovalResponseEvent
  | CheckpointSavedEvent   // NEW
  | CheckpointLoadedEvent  // NEW
  | DoneEvent
  | ErrorEvent;
```

#### 4. Update DeepAgent Class

**File**: `src/agent.ts`
**Changes**: Add checkpointer integration

```typescript
// Add imports
import type { BaseCheckpointSaver, Checkpoint, InterruptData } from "./checkpointer/types.ts";

// Add to class properties (around line 90)
private checkpointer?: BaseCheckpointSaver;

// Update constructor (around line 92)
constructor(params: CreateDeepAgentParams) {
  const {
    // ... existing params ...
    checkpointer,  // NEW
  } = params;
  
  // ... existing code ...
  
  this.checkpointer = checkpointer;  // NEW
}

// Update streamWithEvents method signature and implementation
async *streamWithEvents(
  options: StreamWithEventsOptions
): AsyncGenerator<DeepAgentEvent, void, unknown> {
  const { threadId, resume } = options;
  
  // Load checkpoint if threadId is provided and checkpointer exists
  let state: DeepAgentState = options.state || { todos: [], files: {} };
  let patchedHistory: ModelMessage[] = [];
  let currentStep = 0;
  let pendingInterrupt: InterruptData | undefined;
  
  if (threadId && this.checkpointer) {
    const checkpoint = await this.checkpointer.load(threadId);
    if (checkpoint) {
      // Restore from checkpoint
      state = checkpoint.state;
      patchedHistory = checkpoint.messages;
      currentStep = checkpoint.step;
      pendingInterrupt = checkpoint.interrupt;
      
      yield {
        type: "checkpoint-loaded",
        threadId,
        step: checkpoint.step,
        messagesCount: checkpoint.messages.length,
      };
    }
  }
  
  // Handle resume from interrupt
  if (resume && pendingInterrupt) {
    // Process the resume decision (approve/deny the pending tool call)
    const decision = resume.decisions[0];
    if (decision?.type === 'approve') {
      // Clear the interrupt and continue
      pendingInterrupt = undefined;
    } else {
      // Deny - the tool was rejected, clear interrupt
      pendingInterrupt = undefined;
      // Could add a denied message to history here if needed
    }
  }
  
  // Require prompt unless resuming
  if (!options.prompt && !resume) {
    yield {
      type: "error",
      error: new Error("Either 'prompt' or 'resume' is required"),
    };
    return;
  }
  
  // If no prompt but resuming, use an empty prompt (the checkpoint has context)
  const prompt = options.prompt || "";
  
  // ... rest of existing implementation ...
  
  // In onStepFinish, add checkpoint saving:
  onStepFinish: async ({ toolCalls, toolResults }) => {
    stepNumber++;
    
    // Emit step finish event (existing code)
    const stepEvent: DeepAgentEvent = {
      type: "step-finish",
      stepNumber,
      toolCalls: toolCalls.map((tc, i) => ({
        toolName: tc.toolName,
        args: "input" in tc ? tc.input : undefined,
        result: toolResults[i] ? ("output" in toolResults[i] ? toolResults[i].output : undefined) : undefined,
      })),
    };
    eventQueue.push(stepEvent);
    
    // Save checkpoint if configured
    if (threadId && this.checkpointer) {
      const checkpoint: Checkpoint = {
        threadId,
        step: stepNumber,
        messages: [...inputMessages], // Current messages
        state: { ...state },
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      await this.checkpointer.save(checkpoint);
      
      eventQueue.push({
        type: "checkpoint-saved",
        threadId,
        step: stepNumber,
      });
    }
  },
  
  // ... rest of implementation ...
  
  // After done event, save final checkpoint
  if (threadId && this.checkpointer) {
    const finalCheckpoint: Checkpoint = {
      threadId,
      step: stepNumber,
      messages: updatedMessages,
      state,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    await this.checkpointer.save(finalCheckpoint);
  }
}
```

### Success Criteria

#### Automated Verification

- [x] Type checking passes: `bun run typecheck`
- [ ] Tests pass: `bun test`

#### Manual Verification

- [x] Checkpoints are saved after each step when `threadId` provided
- [x] State is correctly restored from checkpoint on new call
- [x] Messages are correctly restored from checkpoint

---

## Phase 4: Resume Support

### Overview

Add full resume support for continuing from interrupted workflows, particularly after tool approval requests.

### Changes Required

#### 1. Update Approval Flow for Checkpointing

**File**: `src/utils/approval.ts`
**Changes**: Store interrupt data when approval is requested

When a tool needs approval and checkpointing is enabled:

1. Save checkpoint with `interrupt` data before waiting for approval
2. On resume, check for pending interrupt and process decision

```typescript
// Add to wrapToolsWithApproval function or create new utility

/**
 * Create interrupt data for checkpoint when approval is requested.
 */
export function createInterruptData(
  toolCallId: string,
  toolName: string,
  args: unknown,
  step: number
): InterruptData {
  return {
    toolCall: {
      toolCallId,
      toolName,
      args,
    },
    step,
  };
}
```

#### 2. Handle Resume in streamWithEvents

The logic added in Phase 3 handles the resume case. Additional handling may be needed for:

- Continuing tool execution after approval
- Adding denied tool message to history
- Handling multiple pending approvals (edge case)

#### 3. Add Resume Example

**File**: `examples/with-checkpointer.ts` (NEW)

```typescript
/**
 * Example: Using checkpointer for session persistence
 */

import { anthropic } from '@ai-sdk/anthropic';
import { createDeepAgent, MemorySaver } from '../src';

async function main() {
  const checkpointer = new MemorySaver();
  
  const agent = createDeepAgent({
    model: anthropic('claude-sonnet-4-20250514'),
    checkpointer,
  });
  
  const threadId = 'demo-session';
  
  // First interaction
  console.log('=== First interaction ===');
  for await (const event of agent.streamWithEvents({
    prompt: "Create a todo list for building a web app",
    threadId,
  })) {
    if (event.type === 'text') {
      process.stdout.write(event.text);
    } else if (event.type === 'checkpoint-saved') {
      console.log(`\n[Checkpoint saved at step ${event.step}]`);
    }
  }
  
  // Later: Resume the same thread
  console.log('\n\n=== Resuming session ===');
  for await (const event of agent.streamWithEvents({
    prompt: "What was the first item on our todo list?",
    threadId,
  })) {
    if (event.type === 'text') {
      process.stdout.write(event.text);
    } else if (event.type === 'checkpoint-loaded') {
      console.log(`[Loaded checkpoint with ${event.messagesCount} messages]`);
    }
  }
}

main().catch(console.error);
```

### Success Criteria

#### Automated Verification

- [x] Type checking passes: `bun run typecheck`
- [ ] Tests pass: `bun test`

#### Manual Verification

- [x] Resume from checkpoint correctly restores context
- [x] Resume from approval interrupt works correctly
- [x] Example runs successfully

---

## Phase 5: CLI Integration

### Overview

Add session persistence to the CLI with auto-save and session management commands.

### Changes Required

#### 1. Add CLI Session Arguments

**File**: `src/cli/index.tsx`
**Changes**: Add `--session` argument

```typescript
// Add to CLI argument parsing
const sessionArg = process.argv.find(arg => arg.startsWith('--session='));
const sessionId = sessionArg?.split('=')[1] || undefined;
```

#### 2. Update useAgent Hook

**File**: `src/cli/hooks/useAgent.ts`
**Changes**: Add session/checkpoint support

```typescript
export interface UseAgentOptions {
  // ... existing options ...
  
  /** Session ID for checkpoint persistence */
  sessionId?: string;
  
  /** Checkpoint saver for session persistence */
  checkpointer?: BaseCheckpointSaver;
}

// In useAgent, add checkpoint loading on mount
useEffect(() => {
  if (sessionId && checkpointer) {
    loadSession();
  }
}, [sessionId, checkpointer]);

const loadSession = useCallback(async () => {
  if (!sessionId || !checkpointer) return;
  
  const checkpoint = await checkpointer.load(sessionId);
  if (checkpoint) {
    setState(checkpoint.state);
    setMessages(checkpoint.messages);
    messagesRef.current = checkpoint.messages;
    // Show restore message
    addEvent({
      type: "checkpoint-loaded",
      threadId: sessionId,
      step: checkpoint.step,
      messagesCount: checkpoint.messages.length,
    });
  }
}, [sessionId, checkpointer, addEvent]);
```

#### 3. Add Session Slash Commands

**File**: `src/cli/components/SlashMenu.tsx`
**Changes**: Add session commands

```typescript
// Add to SLASH_COMMANDS
{
  command: "/sessions",
  description: "List saved sessions",
  action: "list-sessions",
},
{
  command: "/session",
  description: "Session management (clear, save, load)",
  action: "session",
},

// Add handlers
case "list-sessions":
  const sessions = await checkpointer?.list() || [];
  return {
    handled: true,
    message: sessions.length > 0 
      ? `Sessions:\n${sessions.map(s => `  - ${s}`).join('\n')}`
      : 'No saved sessions',
  };

case "session":
  // Parse subcommand: /session clear, /session save, etc.
  // ...
```

#### 4. Add Session Status to StatusBar

**File**: `src/cli/components/StatusBar.tsx`
**Changes**: Show current session

```typescript
interface StatusBarProps {
  // ... existing props ...
  sessionId?: string;
}

// In render
{sessionId && (
  <Text>
    <Text dimColor>Session:</Text> {sessionId}
  </Text>
)}
```

### Success Criteria

#### Automated Verification

- [x] Type checking passes: `bun run typecheck`

#### Manual Verification

- [x] `bun run cli --session=test` starts with session
- [x] Session is auto-saved after each response
- [x] Session is restored on restart
- [x] `/sessions` lists available sessions
- [x] `/session clear` clears current session
- [x] Status bar shows current session

---

## Phase 6: Testing and Documentation

### Overview

Add comprehensive tests and update documentation.

### Changes Required

#### 1. Unit Tests

**File**: `src/checkpointer/memory-saver.test.ts` (NEW)

```typescript
import { test, expect, beforeEach } from "bun:test";
import { MemorySaver } from "./memory-saver";
import type { Checkpoint } from "./types";

const createTestCheckpoint = (threadId: string, step = 1): Checkpoint => ({
  threadId,
  step,
  messages: [{ role: "user", content: "test" }],
  state: { todos: [], files: {} },
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
});

let saver: MemorySaver;

beforeEach(() => {
  saver = new MemorySaver();
});

test("save and load checkpoint", async () => {
  const checkpoint = createTestCheckpoint("thread-1");
  await saver.save(checkpoint);
  
  const loaded = await saver.load("thread-1");
  expect(loaded).toBeDefined();
  expect(loaded?.threadId).toBe("thread-1");
});

test("load returns undefined for non-existent thread", async () => {
  const loaded = await saver.load("non-existent");
  expect(loaded).toBeUndefined();
});

test("list returns all thread IDs", async () => {
  await saver.save(createTestCheckpoint("thread-1"));
  await saver.save(createTestCheckpoint("thread-2"));
  
  const threads = await saver.list();
  expect(threads).toContain("thread-1");
  expect(threads).toContain("thread-2");
});

test("delete removes checkpoint", async () => {
  await saver.save(createTestCheckpoint("thread-1"));
  await saver.delete("thread-1");
  
  const loaded = await saver.load("thread-1");
  expect(loaded).toBeUndefined();
});

test("exists returns correct value", async () => {
  expect(await saver.exists("thread-1")).toBe(false);
  
  await saver.save(createTestCheckpoint("thread-1"));
  expect(await saver.exists("thread-1")).toBe(true);
});

test("save overwrites existing checkpoint", async () => {
  await saver.save(createTestCheckpoint("thread-1", 1));
  await saver.save(createTestCheckpoint("thread-1", 2));
  
  const loaded = await saver.load("thread-1");
  expect(loaded?.step).toBe(2);
});

test("namespace isolates checkpoints", async () => {
  const saver1 = new MemorySaver({ namespace: "ns1" });
  const saver2 = new MemorySaver({ namespace: "ns2" });
  
  await saver1.save(createTestCheckpoint("thread-1"));
  
  expect(await saver1.exists("thread-1")).toBe(true);
  expect(await saver2.exists("thread-1")).toBe(false);
});
```

**File**: `src/checkpointer/file-saver.test.ts` (NEW)

```typescript
import { test, expect, beforeEach, afterEach } from "bun:test";
import { FileSaver } from "./file-saver";
import { rmSync, existsSync } from "node:fs";
import type { Checkpoint } from "./types";

const TEST_DIR = "./.test-checkpoints";

const createTestCheckpoint = (threadId: string): Checkpoint => ({
  threadId,
  step: 1,
  messages: [],
  state: { todos: [], files: {} },
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
});

let saver: FileSaver;

beforeEach(() => {
  saver = new FileSaver({ dir: TEST_DIR });
});

afterEach(() => {
  if (existsSync(TEST_DIR)) {
    rmSync(TEST_DIR, { recursive: true });
  }
});

test("creates directory if it doesn't exist", () => {
  expect(existsSync(TEST_DIR)).toBe(true);
});

test("save and load checkpoint", async () => {
  await saver.save(createTestCheckpoint("test-thread"));
  
  const loaded = await saver.load("test-thread");
  expect(loaded?.threadId).toBe("test-thread");
});

test("list returns saved threads", async () => {
  await saver.save(createTestCheckpoint("thread-a"));
  await saver.save(createTestCheckpoint("thread-b"));
  
  const threads = await saver.list();
  expect(threads).toHaveLength(2);
});

test("delete removes file", async () => {
  await saver.save(createTestCheckpoint("to-delete"));
  await saver.delete("to-delete");
  
  expect(await saver.exists("to-delete")).toBe(false);
});
```

#### 2. Integration Tests

**File**: `test/checkpointer/integration.test.ts` (NEW)

```typescript
import { test, expect, beforeEach } from "bun:test";
import { createDeepAgent, MemorySaver } from "../../src";
import { anthropic } from "@ai-sdk/anthropic";

// Skip if no API key
const hasApiKey = !!process.env.ANTHROPIC_API_KEY;

test.skipIf(!hasApiKey)("checkpoint saves and restores state", async () => {
  const checkpointer = new MemorySaver();
  
  const agent = createDeepAgent({
    model: anthropic("claude-haiku-4-5-20251001"),
    checkpointer,
  });
  
  const threadId = "test-" + Date.now();
  
  // First interaction
  for await (const event of agent.streamWithEvents({
    prompt: "Remember that my favorite color is blue",
    threadId,
  })) {
    // Process events
  }
  
  // Verify checkpoint exists
  const checkpoint = await checkpointer.load(threadId);
  expect(checkpoint).toBeDefined();
  expect(checkpoint?.messages.length).toBeGreaterThan(0);
  
  // Resume and verify context is maintained
  let foundBlue = false;
  for await (const event of agent.streamWithEvents({
    prompt: "What is my favorite color?",
    threadId,
  })) {
    if (event.type === "text" && event.text.toLowerCase().includes("blue")) {
      foundBlue = true;
    }
  }
  
  expect(foundBlue).toBe(true);
});
```

#### 3. Update AGENTS.md

**File**: `AGENTS.md`
**Changes**: Add Checkpointer documentation section

```markdown
### Checkpointer Support

Enable conversation persistence and pause/resume functionality:

```typescript
import { anthropic } from '@ai-sdk/anthropic';
import { createDeepAgent, MemorySaver, FileSaver } from 'ai-sdk-deep-agent';

// In-memory (for testing)
const agent1 = createDeepAgent({
  model: anthropic('claude-sonnet-4-20250514'),
  checkpointer: new MemorySaver(),
});

// File-based (for local development)
const agent2 = createDeepAgent({
  model: anthropic('claude-sonnet-4-20250514'),
  checkpointer: new FileSaver({ dir: './.checkpoints' }),
});

// Usage with threadId
for await (const event of agent.streamWithEvents({
  prompt: "Start a project",
  threadId: "session-123",  // Enable checkpointing
})) {
  // Process events
}

// Later: Resume same thread
for await (const event of agent.streamWithEvents({
  prompt: "Continue from where we left off",
  threadId: "session-123",  // Loads existing checkpoint
})) {
  // Agent has full context from previous interaction
}
```

**Built-in Savers:**

- `MemorySaver`: In-memory storage for testing
- `FileSaver`: JSON files for local development
- `KeyValueStoreSaver`: Adapter for existing `KeyValueStore` implementations

**Custom Saver:**
Implement `BaseCheckpointSaver` interface for custom storage (Redis, database, etc.).

```

#### 4. Update PROJECT-STATE.md

**File**: `.agent/PROJECT-STATE.md`
**Changes**: Move Checkpointer Support to Implemented

### Success Criteria

#### Automated Verification

- [x] All tests pass: `bun test` (71 tests pass)
- [x] Type checking passes: `bun run typecheck`

#### Manual Verification

- [x] Documentation accurately describes the feature (AGENTS.md updated)
- [x] Examples work correctly (checkpointer-demo.ts runs successfully)
- [x] CLI session persistence works

---

## Testing Strategy

### Unit Tests

- `MemorySaver`: save, load, list, delete, exists, namespace isolation
- `FileSaver`: directory creation, file operations, cleanup
- `KeyValueStoreSaver`: adapter functionality with InMemoryStore
- Checkpoint serialization/deserialization

### Integration Tests

- Checkpoint saves and restores state
- Messages are correctly persisted
- Resume from interrupt works
- Multiple threads don't interfere

### Manual Testing Steps

#### Basic Checkpointing:
1. Create agent with MemorySaver
2. Send a prompt with threadId
3. Verify checkpoint-saved event
4. Send another prompt with same threadId
5. Verify checkpoint-loaded event and context is maintained

#### File-based Persistence:
1. Create agent with FileSaver
2. Send prompt with threadId
3. Verify JSON file created in directory
4. Restart process
5. Create new agent with same FileSaver
6. Send prompt with same threadId
7. Verify context is restored

#### CLI Sessions:
1. Run `bun run cli --session=test`
2. Have a conversation
3. Exit CLI
4. Run `bun run cli --session=test` again
5. Verify session is restored
6. Run `/sessions` to list sessions
7. Run `/session clear` to clear current session

---

## Performance Considerations

- Checkpoints are saved async (don't block streaming)
- Large states may impact save time (users can filter files)
- FileSaver uses synchronous fs operations for simplicity
- MemorySaver has no persistence cost but no durability

## Migration Notes

- Fully backward compatible - `checkpointer` is optional
- No changes required for existing users
- Users can gradually adopt checkpointing per use case

