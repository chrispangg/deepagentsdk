---
title: Human-in-the-Loop (HITL) Implementation
date: 2025-12-12T00:00:00.000Z
researcher: Claude
topic: "Human-in-the-Loop (HITL) Implementation"
tags: [research, codebase, hitl, tool-approval, ai-sdk-6, needsApproval]
status: complete
updated: 2025-12-12
---

## Research Question

How should Human-in-the-Loop (HITL) functionality be implemented in deepagentsdk to achieve feature parity with the LangChain DeepAgents reference implementation?

## Summary

**CRITICAL UPDATE**: AI SDK 6 Beta includes **native Human-in-the-Loop support** via the `needsApproval` property on tools. This dramatically simplifies implementation compared to the LangChain approach.

Source: [AI SDK 6 Beta Announcement](https://ai-sdk.dev/docs/announcing-ai-sdk-6-beta)

The implementation path is now:

1. **Use AI SDK 6's native `needsApproval`** on tools
2. **Integrate with `useChat`'s `addToolApprovalResponse`** for UI
3. **Add wrapper layer** for compatibility with our `interruptOn` config pattern

## AI SDK 6 Native Tool Approval

### Basic Usage

```typescript
import { tool } from 'ai';
import { z } from 'zod';

export const weatherTool = tool({
  description: 'Get the weather in a location',
  inputSchema: z.object({
    city: z.string(),
  }),
  needsApproval: true, // Require user approval
  execute: async ({ city }) => {
    const weather = await fetchWeather(city);
    return weather;
  },
});
```

### Dynamic Approval

Make approval decisions based on tool input:

```typescript
export const paymentTool = tool({
  description: 'Process a payment',
  inputSchema: z.object({
    amount: z.number(),
    recipient: z.string(),
  }),
  // Only require approval for large transactions
  needsApproval: async ({ amount }) => amount > 1000,
  execute: async ({ amount, recipient }) => {
    return await processPayment(amount, recipient);
  },
});
```

### Client-Side Approval UI

```typescript
export function WeatherToolView({ invocation, addToolApprovalResponse }) {
  if (invocation.state === 'approval-requested') {
    return (
      <div>
        <p>Can I retrieve the weather for {invocation.input.city}?</p>
        <button
          onClick={() =>
            addToolApprovalResponse({
              id: invocation.approval.id,
              approved: true,
            })
          }
        >
          Approve
        </button>
        <button
          onClick={() =>
            addToolApprovalResponse({
              id: invocation.approval.id,
              approved: false,
            })
          }
        >
          Deny
        </button>
      </div>
    );
  }

  if (invocation.state === 'output-available') {
    return (
      <div>
        Weather: {invocation.output.weather}
        Temperature: {invocation.output.temperature}°F
      </div>
    );
  }
}
```

### Auto-Submit After Approvals

```typescript
import { useChat } from '@ai-sdk/react';
import { lastAssistantMessageIsCompleteWithApprovalResponses } from 'ai';

const { messages, addToolApprovalResponse } = useChat({
  sendAutomaticallyWhen: lastAssistantMessageIsCompleteWithApprovalResponses,
});
```

## Comparison: AI SDK 6 vs LangChain Reference

| Feature | AI SDK 6 Native | LangChain DeepAgents |
|---------|-----------------|---------------------|
| Configuration | Per-tool `needsApproval` | `interruptOn` config map |
| Dynamic approval | `needsApproval: async (args) => boolean` | Not supported |
| Decision types | Approve/Deny (binary) | Approve/Edit/Reject |
| Edit support | Not native | Yes, can modify args |
| Checkpointing | Not required | Requires `MemorySaver` |
| UI Integration | `addToolApprovalResponse` | `Command({ resume })` |
| Subagent config | Inherited via tool definition | Per-subagent `interruptOn` |

### Feature Gaps to Address

1. **Edit Decision** - AI SDK only supports approve/deny, not editing args
2. **Centralized Config** - AI SDK is per-tool, LangChain uses central `interruptOn` map
3. **Custom Descriptions** - LangChain supports custom description formatters
4. **Allowed Decisions** - LangChain can restrict to subset (e.g., only approve/reject)

## Recommended Implementation Strategy

### Phase 1: Upgrade to AI SDK 6 (Required)

Update dependencies to AI SDK 6 beta:

```bash
npm install ai@beta @ai-sdk/anthropic@beta @ai-sdk/openai@beta @ai-sdk/react@beta
```

### Phase 2: Add `needsApproval` to Built-in Tools

Modify tool creation functions to accept approval config:

```typescript
// src/tools/filesystem.ts

export function createFilesystemTools(
  state: DeepAgentState,
  options: {
    backend: BackendProtocol | BackendFactory;
    onEvent?: EventCallback;
    toolResultEvictionLimit?: number;
    // NEW: Approval configuration
    approvalConfig?: {
      write_file?: boolean | ((args: { path: string; content: string }) => boolean | Promise<boolean>);
      edit_file?: boolean | ((args: { path: string }) => boolean | Promise<boolean>);
    };
  }
): ToolSet {
  // Apply needsApproval to tools based on config
}
```

### Phase 3: Add `interruptOn` Compatibility Layer

For compatibility with reference implementation's API:

```typescript
// src/types.ts

/**
 * Configuration for tool approval (compatible with LangChain interruptOn).
 * Maps tool names to approval configurations.
 */
export type InterruptOnConfig = Record<string, boolean | {
  /** Dynamic approval function */
  shouldApprove?: (args: unknown) => boolean | Promise<boolean>;
}>;

// src/agent.ts - In CreateDeepAgentParams
export interface CreateDeepAgentParams {
  // ... existing params ...
  
  /**
   * Configuration for human-in-the-loop tool approval.
   * Internally maps to AI SDK 6's needsApproval.
   * 
   * @example
   * ```typescript
   * interruptOn: {
   *   execute: true,  // Always require approval
   *   write_file: true,
   *   edit_file: { shouldApprove: (args) => !args.path.startsWith('/tmp/') },
   * }
   * ```
   */
  interruptOn?: InterruptOnConfig;
}
```

### Phase 4: Create Tool Wrapper Utility

```typescript
// src/utils/approval.ts

import { tool, type Tool } from 'ai';

/**
 * Wrap a tool with approval configuration from interruptOn.
 */
export function withApproval<T extends Tool>(
  baseTool: T,
  config: boolean | { shouldApprove?: (args: unknown) => boolean | Promise<boolean> }
): T {
  if (config === false) return baseTool;
  
  const needsApproval = typeof config === 'object' && config.shouldApprove
    ? config.shouldApprove
    : true;
  
  return {
    ...baseTool,
    needsApproval,
  } as T;
}

/**
 * Apply interruptOn config to a toolset.
 */
export function applyInterruptConfig(
  tools: ToolSet,
  interruptOn: InterruptOnConfig
): ToolSet {
  const result: ToolSet = {};
  
  for (const [name, tool] of Object.entries(tools)) {
    const config = interruptOn[name];
    result[name] = config !== undefined ? withApproval(tool, config) : tool;
  }
  
  return result;
}
```

### Phase 5: CLI Integration

Update CLI to handle approval states:

```typescript
// src/cli/hooks/useAgent.ts

// The useChat hook from @ai-sdk/react handles approval automatically
// We need to create approval UI components

// src/cli/components/ToolApproval.tsx
export function ToolApproval({ invocation, onApprove, onDeny }) {
  return (
    <Box flexDirection="column" borderStyle="round" borderColor="yellow">
      <Text>🛑 Tool Approval Required</Text>
      <Text>Tool: {invocation.toolName}</Text>
      <Text>Args: {JSON.stringify(invocation.input, null, 2)}</Text>
      <Box gap={1}>
        <Button onClick={onApprove}>✅ Approve</Button>
        <Button onClick={onDeny}>❌ Deny</Button>
      </Box>
    </Box>
  );
}
```

### Phase 6: Subagent Support

Pass approval config through to subagents:

```typescript
// src/types.ts - Update SubAgent interface

export interface SubAgent {
  name: string;
  description: string;
  systemPrompt: string;
  tools?: ToolSet;
  model?: LanguageModel;
  /** Override interruptOn config for this subagent */
  interruptOn?: InterruptOnConfig;
}
```

## Detailed Findings

### Reference Implementation Pattern (LangChain)

For comparison, the LangChain DeepAgents implementation uses:

1. **HumanInTheLoopMiddleware** - Intercepts tool calls before execution
2. **Checkpointer** (MemorySaver) - Persists state between interrupt and resume
3. **Command Pattern** - Resume with `Command({ resume: { decisions: [...] } })`

#### Configuration Interface

```typescript
// Reference: .refs/deepagentsjs/src/agent.ts:65
interruptOn?: Record<string, boolean | InterruptOnConfig>;

// InterruptOnConfig structure
interface InterruptOnConfig {
  allowedDecisions?: ("approve" | "edit" | "reject")[];
  description?: (toolCall, state, runtime) => string;
}
```

#### Decision Types

- **approve**: Execute the tool as-is
- **edit**: Modify tool arguments before execution (requires edited args)
- **reject**: Skip tool execution, return error message to model

### Key Differences

| Aspect | Our Approach (AI SDK 6) | LangChain Reference |
|--------|------------------------|---------------------|
| Approval | `needsApproval` property | Middleware intercept |
| Resume | Auto via `sendAutomaticallyWhen` | Manual `Command({ resume })` |
| State | Handled by useChat | Requires checkpointer |
| Complexity | Low (native feature) | High (custom middleware) |

## Code References

AI SDK 6 documentation:

- [Tool Execution Approval](https://ai-sdk.dev/docs/announcing-ai-sdk-6-beta#tool-execution-approval)
- [Dynamic Approval](https://ai-sdk.dev/docs/announcing-ai-sdk-6-beta#dynamic-approval)
- [Client-Side Approval UI](https://ai-sdk.dev/docs/announcing-ai-sdk-6-beta#client-side-approval-ui)

Reference implementation files:

- `.refs/deepagentsjs/src/agent.ts:65` - `interruptOn` parameter
- `.refs/deepagentsjs/tests/integration/hitl.test.ts` - Test cases
- `.refs/deepagents/libs/deepagents-cli/deepagents_cli/agent.py:279-323` - CLI config

Current codebase integration points:

- `src/tools/filesystem.ts` - Add `needsApproval` to write/edit tools
- `src/tools/execute.ts` - Add `needsApproval` to execute tool  
- `src/agent.ts` - Add `interruptOn` param and wrapper logic
- `src/cli/hooks/useAgent.ts` - Use `@ai-sdk/react` useChat with approval

## Open Questions

1. **Edit Support**: AI SDK 6 only supports approve/deny. Should we:
   - Accept this limitation
   - Build custom edit flow on top
   - Request feature from Vercel

   ANSWER: Accept this limitation

2. **Custom Descriptions**: LangChain supports `description` formatter for approval UI.
   - Can we achieve similar with AI SDK 6's invocation state?

   ANSWER: To be determined based on the implementation of the feature

3. **Backwards Compatibility**: Our current `streamWithEvents` API may need updates for approval flow.

  ANSWER: Update the `streamWithEvents` API to support approval flow if required

## Implementation Plan Summary

| Phase | Description | Effort |
|-------|-------------|--------|
| 1 | Upgrade to AI SDK 6 beta | Low |
| 2 | Add `needsApproval` to built-in tools | Medium |
| 3 | Add `interruptOn` compatibility layer | Medium |
| 4 | Create tool wrapper utility | Low |
| 5 | CLI approval UI components | Medium |
| 6 | Subagent support | Low |

**Total Estimated Effort**: Much lower than original estimate due to native support

## Conclusion

AI SDK 6's native `needsApproval` feature dramatically simplifies HITL implementation. Instead of building custom middleware, stop conditions, and resume flows, we can:

1. **Leverage native `needsApproval`** on tools
2. **Use `useChat`'s built-in approval handling** for UI
3. **Add thin compatibility layer** for `interruptOn` config pattern

The main gap is **edit support** (LangChain allows editing tool args before approval), which AI SDK 6 doesn't provide natively. This could be a future enhancement or accepted limitation.

**Recommendation**: Upgrade to AI SDK 6 beta and use native tool approval as the primary implementation path.
