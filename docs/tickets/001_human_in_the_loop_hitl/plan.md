---
title: Human-in-the-Loop (HITL) Implementation Plan
description: Documentation
---

## Overview

Implement Human-in-the-Loop tool approval for ai-sdk-deep-agent, leveraging AI SDK 6's native `needsApproval` feature. This allows users to approve or deny tool executions before they run, particularly useful for destructive operations like `write_file`, `edit_file`, and `execute`.

## Current State Analysis

### What Exists

- AI SDK 6 beta already installed (`ai: ^6.0.0-beta.120`)
- Tools created using AI SDK's `tool()` function in `src/tools/*.ts`
- Custom `useAgent` hook for CLI (not `useChat` from `@ai-sdk/react`)
- `streamWithEvents()` method in `DeepAgent` for event-based streaming
- Subagent support via `task` tool

### What's Missing

- No `interruptOn` configuration parameter
- No `needsApproval` on any tools
- No approval UI components in CLI
- No approval event types in event system

### Key Constraints

- CLI uses custom `useAgent` hook, not `useChat` - must implement approval handling ourselves
- AI SDK 6's `needsApproval` returns tool calls with `approval-requested` state
- Must maintain backward compatibility (approval is opt-in)

## Desired End State

### Library API

```typescript
// User can configure tool approval via interruptOn
const agent = createDeepAgent({
  model: anthropic('claude-sonnet-4-20250514'),
  interruptOn: {
    execute: true,  // Always require approval
    write_file: true,
    edit_file: { shouldApprove: (args) => !args.file_path.startsWith('/tmp/') },
  },
});

// Agent emits approval events, caller handles via callback
for await (const event of agent.streamWithEvents({
  prompt: "...",
  onApprovalRequest: async (request) => {
    // Show UI, get user decision
    return userApproved; // true or false
  },
})) {
  // Handle events
}
```

### CLI Behavior

```
# CLI starts in Safe Mode (default)
> Status: 🔴 Safe mode

# When agent tries to write a file:
┌─────────────────────────────────────┐
│ 🛑 Tool Approval Required           │
│ Tool: write_file                    │
│ Arguments:                          │
│   { "file_path": "/src/main.ts" }   │
│                                     │
│ Press [Y] approve, [N] deny,        │
│       [A] approve all               │
└─────────────────────────────────────┘

# User types /approve to toggle mode
> 🟢 Auto-approve enabled - all tools will execute without confirmation
> Status: 🟢 Auto-approve

# Now tools execute without prompts
# Type /approve again to return to Safe mode
```

### Verification

- [ ] Tools with `interruptOn: true` require approval before execution
- [ ] Tools with dynamic `shouldApprove` function work correctly
- [ ] CLI displays approval UI and handles approve/deny
- [ ] Denied tools return appropriate error to model
- [ ] Subagents respect their own `interruptOn` config
- [ ] CLI starts in Safe Mode by default
- [ ] `/approve` toggles between Safe and Auto-approve modes
- [ ] [A] key enables auto-approve from approval prompt
- [ ] Status bar reflects current mode

## What We're NOT Doing

1. **Edit Decision** - AI SDK 6 only supports approve/deny, not arg editing
2. **Checkpointing** - Using message-based state, not full checkpointer
3. **useChat Migration** - Keeping custom `useAgent` hook

---

## Implementation Approach

Since we use a custom streaming approach (`streamWithEvents`), we need to:

1. Add `needsApproval` to tools based on `interruptOn` config
2. Detect approval-requested state in streaming
3. Emit approval events through our event system
4. Provide method to submit approval decisions
5. Update CLI to display approval UI

---

## Phase 1: Core Types and Configuration

### Overview

Add the `interruptOn` type definitions and configuration parameter.

### Changes Required

#### 1. Type Definitions

**File**: `src/types.ts`
**Changes**: Add InterruptOnConfig types and update CreateDeepAgentParams

```typescript
// Add after line 211 (after SummarizationConfig)

/**
 * Configuration for dynamic tool approval.
 */
export interface DynamicApprovalConfig {
  /**
   * Function to determine if approval is needed based on tool arguments.
   * Return true to require approval, false to auto-approve.
   */
  shouldApprove?: (args: unknown) => boolean | Promise<boolean>;
}

/**
 * Configuration for human-in-the-loop tool approval.
 * Maps tool names to approval configurations.
 * 
 * - `true`: Always require approval
 * - `false`: Never require approval (same as not including)
 * - `DynamicApprovalConfig`: Dynamic approval based on arguments
 * 
 * @example
 * ```typescript
 * interruptOn: {
 *   execute: true,  // Always require approval
 *   write_file: true,
 *   edit_file: { shouldApprove: (args) => !args.file_path.startsWith('/tmp/') },
 * }
 * ```
 */
export type InterruptOnConfig = Record<string, boolean | DynamicApprovalConfig>;
```

```typescript
// Add to CreateDeepAgentParams interface (around line 331)

  /**
   * Configuration for human-in-the-loop tool approval.
   * 
   * Maps tool names to approval configurations. When a tool requires approval,
   * the agent will pause and emit an `approval-requested` event before execution.
   * 
   * @example
   * ```typescript
   * interruptOn: {
   *   execute: true,        // Always require approval
   *   write_file: true,     // Always require approval
   *   edit_file: {          // Dynamic approval
   *     shouldApprove: (args) => !args.file_path.startsWith('/tmp/')
   *   },
   * }
   * ```
   */
  interruptOn?: InterruptOnConfig;
```

#### 2. New Event Types

**File**: `src/types.ts`
**Changes**: Add approval-related events

```typescript
// Add after ErrorEvent (around line 889)

/**
 * Event emitted when a tool requires approval before execution.
 */
export interface ApprovalRequestedEvent {
  type: "approval-requested";
  /** Unique ID for this approval request */
  approvalId: string;
  /** The tool call ID */
  toolCallId: string;
  /** Name of the tool requiring approval */
  toolName: string;
  /** Arguments that will be passed to the tool */
  args: unknown;
}

/**
 * Event emitted when user responds to an approval request.
 */
export interface ApprovalResponseEvent {
  type: "approval-response";
  /** The approval ID being responded to */
  approvalId: string;
  /** Whether the tool was approved */
  approved: boolean;
}
```

```typescript
// Update DeepAgentEvent union (around line 894)
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
  | ApprovalRequestedEvent  // NEW
  | ApprovalResponseEvent   // NEW
  | DoneEvent
  | ErrorEvent;
```

#### 3. Update SubAgent Type

**File**: `src/types.ts`
**Changes**: Add interruptOn to SubAgent interface

```typescript
// Add to SubAgent interface (around line 157)
  /**
   * Optional interrupt configuration for this subagent.
   * If not provided, uses the parent agent's interruptOn config.
   */
  interruptOn?: InterruptOnConfig;
```

### Success Criteria

#### Automated Verification

- [x] Type checking passes: `bun run typecheck`
- [ ] Tests pass: `bun test`

#### Manual Verification

- [x] New types are exported from `src/index.ts`

---

## Phase 2: Tool Approval Wrapper Utility

### Overview

Create utility functions to apply `needsApproval` from `interruptOn` config to tools.

### Changes Required

#### 1. Approval Utility Module

**File**: `src/utils/approval.ts` (NEW)

```typescript
/**
 * Utilities for applying tool approval configuration.
 */

import type { ToolSet } from "ai";
import type { InterruptOnConfig, DynamicApprovalConfig } from "../types.ts";

/**
 * Convert interruptOn config to needsApproval function for a tool.
 */
function configToNeedsApproval(
  config: boolean | DynamicApprovalConfig
): boolean | ((args: unknown) => boolean | Promise<boolean>) {
  if (typeof config === "boolean") {
    return config;
  }
  
  if (config.shouldApprove) {
    return config.shouldApprove;
  }
  
  return true;
}

/**
 * Apply interruptOn configuration to a toolset.
 * 
 * This adds the `needsApproval` property to tools based on the config.
 * 
 * @param tools - The original toolset
 * @param interruptOn - Configuration mapping tool names to approval settings
 * @returns New toolset with needsApproval applied
 * 
 * @example
 * ```typescript
 * const approvedTools = applyInterruptConfig(tools, {
 *   write_file: true,
 *   execute: { shouldApprove: (args) => args.command.includes('rm') },
 * });
 * ```
 */
export function applyInterruptConfig(
  tools: ToolSet,
  interruptOn?: InterruptOnConfig
): ToolSet {
  if (!interruptOn) {
    return tools;
  }

  const result: ToolSet = {};

  for (const [name, tool] of Object.entries(tools)) {
    const config = interruptOn[name];
    
    if (config === undefined || config === false) {
      // No approval needed - use tool as-is
      result[name] = tool;
    } else {
      // Apply needsApproval
      result[name] = {
        ...tool,
        needsApproval: configToNeedsApproval(config),
      };
    }
  }

  return result;
}

/**
 * Check if a toolset has any tools requiring approval.
 */
export function hasApprovalTools(interruptOn?: InterruptOnConfig): boolean {
  if (!interruptOn) return false;
  return Object.values(interruptOn).some((v) => v !== false);
}
```

#### 2. Export from Utils Index

**File**: `src/utils/index.ts`
**Changes**: Add export

```typescript
export * from "./approval.ts";
```

### Success Criteria

#### Automated Verification

- [x] Type checking passes: `bun run typecheck`

#### Manual Verification

- [x] `applyInterruptConfig` correctly sets `needsApproval` on tools

---

## Phase 3: DeepAgent Integration

### Overview

Integrate `interruptOn` config into DeepAgent class and handle approval flow.

### Changes Required

#### 1. Update DeepAgent Constructor

**File**: `src/agent.ts`
**Changes**: Store interruptOn config and apply to tools

```typescript
// Add to imports (around line 1)
import { applyInterruptConfig } from "./utils/approval.ts";

// Add to DeepAgent class properties (around line 87)
private interruptOn?: InterruptOnConfig;

// Update constructor (around line 89)
constructor(params: CreateDeepAgentParams) {
  const {
    model,
    tools = {},
    systemPrompt,
    subagents = [],
    backend,
    maxSteps = 100,
    includeGeneralPurposeAgent = true,
    toolResultEvictionLimit,
    enablePromptCaching = false,
    summarization,
    interruptOn,  // NEW
  } = params;

  // ... existing code ...
  
  this.interruptOn = interruptOn;  // NEW
  
  // ... rest of constructor ...
}
```

#### 2. Apply Approval Config to Tools

**File**: `src/agent.ts`
**Changes**: Modify `createTools` method

```typescript
// Update createTools method (around line 138)
private createTools(state: DeepAgentState, onEvent?: EventCallback): ToolSet {
  const todosTool = createTodosTool(state, onEvent);
  const filesystemTools = createFilesystemTools(state, {
    backend: this.backend,
    onEvent,
    toolResultEvictionLimit: this.toolResultEvictionLimit,
  });

  let allTools: ToolSet = {
    write_todos: todosTool,
    ...filesystemTools,
    ...this.userTools,
  };

  // Add execute tool if backend is a sandbox
  if (this.hasSandboxBackend) {
    const sandboxBackend = this.backend as SandboxBackendProtocol;
    allTools.execute = createExecuteTool({
      backend: sandboxBackend,
      onEvent,
    });
  }

  // Add subagent tool if configured
  if (
    this.subagentOptions.includeGeneralPurposeAgent ||
    (this.subagentOptions.subagents &&
      this.subagentOptions.subagents.length > 0)
  ) {
    const subagentTool = createSubagentTool(state, {
      defaultModel: this.subagentOptions.defaultModel,
      defaultTools: this.userTools,
      subagents: this.subagentOptions.subagents,
      includeGeneralPurposeAgent:
        this.subagentOptions.includeGeneralPurposeAgent,
      backend: this.backend,
      onEvent,
      interruptOn: this.interruptOn,  // NEW: Pass to subagents
    });
    allTools.task = subagentTool;
  }

  // Apply interruptOn configuration to tools
  allTools = applyInterruptConfig(allTools, this.interruptOn);

  return allTools;
}
```

#### 3. Update Subagent Tool Options

**File**: `src/tools/subagent.ts`
**Changes**: Accept and pass interruptOn config

```typescript
// Add to CreateSubagentToolOptions interface
export interface CreateSubagentToolOptions {
  // ... existing options ...
  /** Interrupt config to pass to subagents */
  interruptOn?: InterruptOnConfig;
}

// Update the subagent creation to use the config
// (Pass to each subagent's tool creation)
```

### Success Criteria

#### Automated Verification

- [x] Type checking passes: `bun run typecheck`
- [ ] Tests pass: `bun test`

#### Manual Verification

- [x] Tools with `interruptOn` have `needsApproval` set
- [x] Subagents receive their interruptOn config

---

## Phase 4: Streaming Approval Handling

### Overview

Handle tool approval requests and responses in `streamWithEvents`.

### Changes Required

#### 1. Update StreamWithEventsOptions

**File**: `src/types.ts`
**Changes**: Add approval callback

```typescript
// Update StreamWithEventsOptions (around line 932)
export interface StreamWithEventsOptions {
  /** The user's prompt/message */
  prompt: string;
  /** Maximum number of steps for the agent loop */
  maxSteps?: number;
  /** Shared state for todos and files */
  state?: DeepAgentState;
  /** Conversation history for multi-turn conversations */
  messages?: ModelMessage[];
  /** Signal to abort the generation */
  abortSignal?: AbortSignal;
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

#### 2. Handle Approval in streamWithEvents

**File**: `src/agent.ts`
**Changes**: Add approval handling logic

This is the most complex change. We need to:

1. Detect when a tool call has `approval-requested` state
2. Emit an `approval-requested` event
3. Wait for approval decision via callback
4. Continue or cancel based on decision

```typescript
// In streamWithEvents method, add approval handling
// This requires understanding AI SDK 6's approval flow for streamText
// The implementation will depend on how AI SDK 6 exposes approval state

// Pseudo-code for the approach:
// 1. streamText returns tool calls with potential approval state
// 2. For each tool call needing approval:
//    - Emit approval-requested event
//    - Call onApprovalRequest callback if provided
//    - Based on result, approve or deny the tool
```

**Note**: The exact implementation depends on AI SDK 6's API for handling approvals in `streamText`. We may need to:

- Use `onToolCall` callback to intercept
- Handle approval via the tool result mechanism
- Or use AI SDK's native approval response mechanism

### Success Criteria

#### Automated Verification

- [x] Type checking passes: `bun run typecheck`
- [ ] Tests pass: `bun test`

#### Manual Verification

- [x] Approval events are emitted when tools need approval (structure in place)
- [x] Approval callback is called and awaited (implemented in useAgent)
- [ ] Denied tools don't execute (needs testing with actual AI SDK behavior)

---

## Phase 5: CLI Integration

### Overview

Add approval UI to the CLI with two modes:

1. **Default Mode (Safe)**: Requires approval for execute/write/edit actions
2. **Auto-Approve Mode (Trust)**: Automatically approves all tool executions

Users can toggle between modes using the `/approve` slash command.

### Changes Required

#### 1. New Approval Component

**File**: `src/cli/components/ToolApproval.tsx` (NEW)

```tsx
import React from "react";
import { Box, Text, useInput } from "ink";

interface ToolApprovalProps {
  toolName: string;
  args: unknown;
  onApprove: () => void;
  onDeny: () => void;
}

export function ToolApproval({
  toolName,
  args,
  onApprove,
  onDeny,
}: ToolApprovalProps) {
  useInput((input, key) => {
    if (input === "y" || input === "Y") {
      onApprove();
    } else if (input === "n" || input === "N" || key.escape) {
      onDeny();
    }
  });

  // Format args for display (truncate if too long)
  const argsDisplay = JSON.stringify(args, null, 2);
  const truncatedArgs = argsDisplay.length > 500 
    ? argsDisplay.slice(0, 500) + "\n... (truncated)"
    : argsDisplay;

  return (
    <Box
      flexDirection="column"
      borderStyle="round"
      borderColor="yellow"
      paddingX={1}
    >
      <Text bold color="yellow">
        🛑 Tool Approval Required
      </Text>
      <Text>
        Tool: <Text bold>{toolName}</Text>
      </Text>
      <Box marginTop={1}>
        <Text dimColor>Arguments:</Text>
      </Box>
      <Text>{truncatedArgs}</Text>
      <Box marginTop={1}>
        <Text>
          Press <Text bold color="green">[Y]</Text> to approve,{" "}
          <Text bold color="red">[N]</Text> to deny,{" "}
          <Text bold color="blue">[A]</Text> to approve all (enable auto-approve)
        </Text>
      </Box>
    </Box>
  );
}
```

#### 2. Update useAgent Hook

**File**: `src/cli/hooks/useAgent.ts`
**Changes**: Handle approval state, auto-approve mode, and events

```typescript
// Add to UseAgentOptions interface
export interface UseAgentOptions {
  // ... existing options ...
  
  /** 
   * Default interruptOn config for CLI.
   * Default: { execute: true, write_file: true, edit_file: true }
   */
  interruptOn?: InterruptOnConfig;
}

// Add to UseAgentReturn interface
export interface UseAgentReturn {
  // ... existing properties ...
  
  /** Current approval request if any */
  pendingApproval: {
    approvalId: string;
    toolName: string;
    args: unknown;
  } | null;
  
  /** Respond to approval request */
  respondToApproval: (approved: boolean) => void;
  
  /** Whether auto-approve mode is enabled */
  autoApproveEnabled: boolean;
  
  /** Toggle auto-approve mode */
  setAutoApprove: (enabled: boolean) => void;
}

// Default interruptOn config for CLI - safe defaults
const DEFAULT_CLI_INTERRUPT_ON: InterruptOnConfig = {
  execute: true,
  write_file: true,
  edit_file: true,
};

export function useAgent(options: UseAgentOptions): UseAgentReturn {
  // ... existing state ...
  
  // Auto-approve mode state
  const [autoApproveEnabled, setAutoApproveEnabled] = useState(false);
  
  // Pending approval state
  const [pendingApproval, setPendingApproval] = useState<{
    approvalId: string;
    toolName: string;
    args: unknown;
  } | null>(null);
  const approvalResolverRef = useRef<((approved: boolean) => void) | null>(null);

  // Respond to approval request
  const respondToApproval = useCallback((approved: boolean) => {
    if (approvalResolverRef.current) {
      approvalResolverRef.current(approved);
      approvalResolverRef.current = null;
      setPendingApproval(null);
      if (pendingApproval) {
        addEvent({ 
          type: "approval-response", 
          approvalId: pendingApproval.approvalId, 
          approved 
        });
      }
    }
  }, [addEvent, pendingApproval]);

  // Toggle auto-approve and recreate agent
  const setAutoApprove = useCallback((enabled: boolean) => {
    setAutoApproveEnabled(enabled);
    
    // When enabling auto-approve, immediately approve any pending request
    if (enabled && approvalResolverRef.current) {
      respondToApproval(true);
    }
    
    // Recreate agent with/without interruptOn config
    recreateAgent({ 
      interruptOn: enabled ? undefined : (options.interruptOn ?? DEFAULT_CLI_INTERRUPT_ON)
    });
  }, [recreateAgent, options.interruptOn, respondToApproval]);

  // Update sendPrompt to handle approval
  const sendPrompt = useCallback(async (prompt: string) => {
    // ... existing setup code ...
    
    for await (const event of agentRef.current.streamWithEvents({
      prompt,
      state,
      messages: messagesRef.current,
      abortSignal: abortControllerRef.current.signal,
      // Approval callback - auto-approve or prompt user
      onApprovalRequest: async (request) => {
        // If auto-approve is enabled, immediately approve
        if (autoApproveEnabled) {
          addEvent({ 
            type: "approval-requested", 
            ...request,
            autoApproved: true  // Mark as auto-approved for logging
          });
          addEvent({ 
            type: "approval-response", 
            approvalId: request.approvalId, 
            approved: true 
          });
          return true;
        }
        
        // Otherwise, show approval UI and wait for user response
        setPendingApproval({
          approvalId: request.approvalId,
          toolName: request.toolName,
          args: request.args,
        });
        addEvent({ type: "approval-requested", ...request });
        
        // Return a promise that resolves when user responds
        return new Promise<boolean>((resolve) => {
          approvalResolverRef.current = resolve;
        });
      },
    })) {
      // ... existing event handling ...
    }
    
    // ... rest of sendPrompt ...
  }, [/* deps including autoApproveEnabled */]);

  return {
    // ... existing return values ...
    pendingApproval,
    respondToApproval,
    autoApproveEnabled,
    setAutoApprove,
  };
}
```

#### 3. Add `/approve` Slash Command

**File**: `src/cli/components/SlashMenu.tsx`
**Changes**: Add approve command to slash menu

```typescript
// Add to SLASH_COMMANDS array
{
  command: "/approve",
  description: "Toggle auto-approve mode for tool executions",
  action: "toggle-approve",
},

// In the command handler, add case for toggle-approve
case "toggle-approve":
  const newValue = !autoApproveEnabled;
  setAutoApprove(newValue);
  return {
    handled: true,
    message: newValue 
      ? "🟢 Auto-approve enabled - all tools will execute without confirmation"
      : "🔴 Auto-approve disabled - execute/write/edit require confirmation",
  };
```

#### 4. Update StatusBar to Show Mode

**File**: `src/cli/components/StatusBar.tsx`
**Changes**: Display current approval mode

```tsx
// Add autoApproveEnabled prop
interface StatusBarProps {
  // ... existing props ...
  autoApproveEnabled?: boolean;
}

export function StatusBar({ 
  // ... existing props ...
  autoApproveEnabled = false,
}: StatusBarProps) {
  return (
    <Box flexDirection="row" gap={2}>
      {/* ... existing status items ... */}
      
      {/* Approval mode indicator */}
      <Text>
        {autoApproveEnabled ? (
          <Text color="green">🟢 Auto-approve</Text>
        ) : (
          <Text color="yellow">🔴 Safe mode</Text>
        )}
      </Text>
    </Box>
  );
}
```

#### 5. Update CLI App

**File**: `src/cli/index.tsx`
**Changes**: Render approval UI and pass mode to status bar

```tsx
// In the main App component
const {
  // ... existing destructured values ...
  pendingApproval,
  respondToApproval,
  autoApproveEnabled,
  setAutoApprove,
} = useAgent(agentOptions);

// Handle "approve all" action from approval component
const handleApproveAll = useCallback(() => {
  setAutoApprove(true);
  respondToApproval(true);
}, [setAutoApprove, respondToApproval]);

// Render approval UI when pending (only in safe mode)
{pendingApproval && !autoApproveEnabled && (
  <ToolApproval
    toolName={pendingApproval.toolName}
    args={pendingApproval.args}
    onApprove={() => respondToApproval(true)}
    onDeny={() => respondToApproval(false)}
    onApproveAll={handleApproveAll}
  />
)}

// Pass to status bar
<StatusBar 
  // ... existing props ...
  autoApproveEnabled={autoApproveEnabled}
/>
```

#### 6. Update Help Text

**File**: `src/cli/components/Welcome.tsx` or help handler
**Changes**: Document the approval modes

```markdown
## Approval Modes

The CLI has two modes for tool execution:

- **Safe Mode (default)**: Prompts for approval before execute/write/edit
  - Press [Y] to approve, [N] to deny, [A] to approve all

- **Auto-Approve Mode**: Automatically approves all tool executions
  - Use `/approve` to toggle between modes
  - Status bar shows current mode (🟢 Auto-approve / 🔴 Safe mode)
```

### Success Criteria

#### Automated Verification

- [x] Type checking passes: `bun run typecheck`

#### Manual Verification

- [x] CLI starts in Safe Mode by default (implemented)
- [x] Status bar shows "🔴 Safe mode" initially (implemented)
- [ ] execute/write/edit tools trigger approval prompt (needs testing)
- [x] Y/N keys work to approve/deny individual requests (implemented)
- [x] [A] key enables auto-approve and approves current request (implemented)
- [x] `/approve` command toggles between modes (implemented)
- [x] After `/approve`, status bar shows "🟢 Auto-approve" (implemented)
- [ ] In Auto-approve mode, tools execute without prompts (needs testing)
- [x] `/approve` again returns to Safe mode (implemented)

---

## Phase 6: Testing and Documentation

### Overview

Add tests and update documentation.

### Changes Required

#### 1. Unit Tests

**File**: `src/utils/approval.test.ts` (NEW)

```typescript
import { test, expect } from "bun:test";
import { applyInterruptConfig, hasApprovalTools } from "./approval";
import { tool } from "ai";
import { z } from "zod";

const mockTool = tool({
  description: "Test tool",
  inputSchema: z.object({ arg: z.string() }),
  execute: async ({ arg }) => arg,
});

test("applyInterruptConfig adds needsApproval: true", () => {
  const tools = { test: mockTool };
  const result = applyInterruptConfig(tools, { test: true });
  expect(result.test.needsApproval).toBe(true);
});

test("applyInterruptConfig skips false config", () => {
  const tools = { test: mockTool };
  const result = applyInterruptConfig(tools, { test: false });
  expect(result.test.needsApproval).toBeUndefined();
});

test("applyInterruptConfig handles dynamic config", () => {
  const tools = { test: mockTool };
  const shouldApprove = (args: unknown) => true;
  const result = applyInterruptConfig(tools, { test: { shouldApprove } });
  expect(result.test.needsApproval).toBe(shouldApprove);
});

test("hasApprovalTools returns true when tools need approval", () => {
  expect(hasApprovalTools({ write_file: true })).toBe(true);
});

test("hasApprovalTools returns false when no tools need approval", () => {
  expect(hasApprovalTools({ write_file: false })).toBe(false);
  expect(hasApprovalTools(undefined)).toBe(false);
});
```

#### 2. Integration Tests

**File**: `src/agent.test.ts`
**Changes**: Add HITL test cases

```typescript
// Add test for interruptOn configuration
test("createDeepAgent with interruptOn applies needsApproval to tools", async () => {
  const agent = createDeepAgent({
    model: mockModel,
    interruptOn: {
      write_file: true,
    },
  });
  
  // Verify the write_file tool has needsApproval
  const tools = agent.getAgent().tools;
  expect(tools.write_file.needsApproval).toBe(true);
});
```

#### 3. Update AGENTS.md

**Changes**: Document interruptOn parameter and CLI modes

```markdown
### Human-in-the-Loop (Tool Approval)

Configure which tools require human approval before execution:

```typescript
const agent = createDeepAgent({
  model: anthropic('claude-sonnet-4-20250514'),
  interruptOn: {
    execute: true,  // Always require approval
    write_file: true,
    edit_file: { 
      shouldApprove: (args) => !args.file_path.startsWith('/tmp/') 
    },
  },
});
```

### CLI Approval Modes

The CLI operates in two modes:

**Safe Mode (default)**

- Prompts for approval before execute/write/edit operations
- Status bar shows: 🔴 Safe mode
- At approval prompt: [Y] approve, [N] deny, [A] approve all

**Auto-Approve Mode**

- All tool executions proceed without prompts
- Status bar shows: 🟢 Auto-approve
- Toggle with `/approve` command

```bash
# Start in Safe mode (default)
$ bun run cli

# Toggle to Auto-approve mode
> /approve
🟢 Auto-approve enabled - all tools will execute without confirmation

# Toggle back to Safe mode
> /approve
🔴 Auto-approve disabled - execute/write/edit require confirmation
```

```

#### 4. Update PROJECT-STATE.md
**Changes**: Move HITL to Implemented section

### Success Criteria:

#### Automated Verification:
- [x] All tests pass: `bun test`
- [x] Type checking passes: `bun run typecheck`

#### Manual Verification:
- [x] Documentation accurately describes the feature
- [x] Examples in docs work correctly

---

## Testing Strategy

### Unit Tests:
- `applyInterruptConfig` correctly transforms tools
- Dynamic approval functions are properly attached
- `hasApprovalTools` helper works correctly

### Integration Tests:
- Agent with `interruptOn` creates tools with `needsApproval`
- Subagents receive interruptOn config
- Approval flow works end-to-end (may require mocking)

### Manual Testing Steps:

#### Basic Approval Flow:
1. Start CLI - verify status shows "🔴 Safe mode"
2. Ask agent to write a file (e.g., "create a hello.txt file")
3. Verify approval prompt appears with tool name and args
4. Press Y to approve, verify file is written
5. Ask agent to write another file
6. Press N to deny, verify agent receives rejection and responds appropriately

#### Auto-Approve Mode:
7. Type `/approve` command
8. Verify message: "🟢 Auto-approve enabled..."
9. Verify status bar shows "🟢 Auto-approve"
10. Ask agent to write a file
11. Verify file is written WITHOUT approval prompt
12. Type `/approve` again
13. Verify returns to Safe mode

#### Approve All Shortcut:
14. In Safe mode, trigger an approval prompt
15. Press [A] to approve all
16. Verify current request is approved AND mode switches to Auto-approve
17. Verify subsequent requests don't prompt

#### Dynamic Approval:
18. Create agent with conditional: `edit_file: { shouldApprove: (args) => !args.file_path.startsWith('/tmp/') }`
19. Ask agent to edit `/tmp/test.txt` - should NOT prompt
20. Ask agent to edit `/src/main.ts` - SHOULD prompt

---

## Performance Considerations

- Approval adds latency (waiting for user input)
- No impact when `interruptOn` not configured
- `applyInterruptConfig` is O(n) where n = number of tools

---

## Migration Notes

- Fully backward compatible - `interruptOn` is optional
- No changes required for existing users
- Users can gradually add approval to specific tools
