---
title: Subagent Selective Builtin Tools Implementation Plan
description: Documentation
---

## Overview

Implement support for selectively passing specific builtin tools to subagents on a per-agent basis. Users will be able to import individual builtin tools and configure which ones subagents can access, with each subagent receiving fresh tool instances.

## Current State Analysis

- Subagents currently only inherit `userTools` (custom tools)
- Builtin tools (web, filesystem, todos, execute) are created in parent but not passed to subagents
- Tool factories exist but individual tools aren't exported for direct import
- Subagent configuration is done at parent level, not per subagent type

## Desired End State

```typescript
import {
  createDeepAgent,
  web_search,
  http_request,
  fetch_url,
  read_file,
  write_file,
  ls,
  write_todos
} from 'ai-sdk-deep-agent';

const agent = createDeepAgent({
  model: anthropic('claude-sonnet-4-20250514'),
  subagents: {
    subagents: [
      {
        name: 'web-researcher',
        description: 'Handles web research tasks',
        systemPrompt: 'You are a web research specialist...',
        tools: [web_search, http_request, fetch_url] // Individual builtin tools
      },
      {
        name: 'file-analyzer',
        description: 'Analyzes files in the workspace',
        tools: [read_file, write_file, ls] // Only specific filesystem tools
      },
      {
        name: 'task-planner',
        description: 'Plans and tracks tasks',
        tools: [write_todos] // Only todo management
      }
    ]
  }
});
```

## What We're NOT Doing

- Changing the default behavior (no builtin tools by default)
- Implementing preset tool categories
- Adding global tool inheritance configuration
- Sharing tool instances between parent and subagents

## Implementation Approach

1. Export individual builtin tools alongside factory functions
2. Extend SubAgent type to accept individual tools in tools array
3. Modify subagent creation to handle mixed tool types (factories + individual tools)
4. Update type definitions for better TypeScript support
5. Add comprehensive tests and examples

## Phase 1: Export Individual Builtin Tools

### Overview

Make individual builtin tools importable by users while maintaining backward compatibility with existing factory functions.

### Changes Required

#### 1. Tool Export Updates

**File**: `src/tools/web.ts`
**Changes**: Export individual web tools alongside factory function

```typescript
// Add these exports at the bottom of the file
export { web_search, http_request, fetch_url };

// Also need to export the tool creation functions
export { createWebSearchTool, createHttpRequestTool, createFetchUrlTool };
```

**Implementation Detail**: The tools are currently created inside `createWebTools()` with closures. We need to refactor so they can be created independently:

```typescript
// Refactor to expose creator functions
export function createWebSearchTool(
  state: DeepAgentState,
  options: CreateWebToolsOptions = {}
) {
  // Existing web_search tool implementation
}

export function createHttpRequestTool(
  state: DeepAgentState,
  options: CreateWebToolsOptions = {}
) {
  // Existing http_request tool implementation
}

export function createFetchUrlTool(
  state: DeepAgentState,
  options: CreateWebToolsOptions = {}
) {
  // Existing fetch_url tool implementation
}
```

#### 2. Filesystem Tools

**File**: `src/tools/filesystem.ts`
**Changes**: Export individual filesystem tools

```typescript
export {
  ls,
  read_file,
  write_file,
  edit_file,
  glob,
  grep
};

// And their creators
export {
  createLsTool,
  createReadFileTool,
  createWriteFileTool,
  createEditFileTool,
  createGlobTool,
  createGrepTool
};
```

#### 3. Other Tools

**File**: `src/tools/todos.ts`
**Changes**: Export todos tool

```typescript
export { write_todos, createTodosTool }; // Already exists
```

**File**: `src/tools/execute.ts`
**Changes**: Export execute tool

```typescript
export { execute, createExecuteTool }; // Already exists
```

#### 4. Update Central Exports

**File**: `src/tools/index.ts`
**Changes**: Add individual tool exports

```typescript
// Individual tool exports
export { web_search, http_request, fetch_url } from './web';
export { ls, read_file, write_file, edit_file, glob, grep } from './filesystem';
export { write_todos } from './todos';
export { execute } from './execute';

// Tool creators (for internal use)
export {
  createWebSearchTool,
  createHttpRequestTool,
  createFetchUrlTool
} from './web';
export {
  createLsTool,
  createReadFileTool,
  createWriteFileTool,
  createEditFileTool,
  createGlobTool,
  createGrepTool
} from './filesystem';
```

#### 5. Update Main Package Exports

**File**: `src/index.ts`
**Changes**: Re-export individual tools

```typescript
// Individual builtin tools
export {
  web_search,
  http_request,
  fetch_url,
  ls,
  read_file,
  write_file,
  edit_file,
  glob,
  grep,
  write_todos,
  execute
} from './tools/index';
```

### Success Criteria

#### Automated Verification

- [x] All individual tools export correctly
- [x] TypeScript types are inferred correctly
- [x] No circular dependencies
- [x] Existing tests pass

#### Manual Verification

- [x] Can import individual tools: `import { web_search } from 'ai-sdk-deep-agent'`
- [x] Existing factory functions still work
- [x] IDE auto-completion shows available tools

---

## Phase 2: Update Type Definitions

### Overview

Extend TypeScript types to support individual builtin tools in subagent configuration.

### Changes Required

#### 1. Tool Type Union

**File**: `src/types.ts`
**Changes**: Create union type for subagent tools

```typescript
// Add after existing ToolSet type
export type BuiltinTool =
  | ReturnType<typeof createWebSearchTool>
  | ReturnType<typeof createHttpRequestTool>
  | ReturnType<typeof createFetchUrlTool>
  | ReturnType<typeof createLsTool>
  | ReturnType<typeof createReadFileTool>
  | ReturnType<typeof createWriteFileTool>
  | ReturnType<typeof createEditFileTool>
  | ReturnType<typeof createGlobTool>
  | ReturnType<typeof createGrepTool>
  | ReturnType<typeof createTodosTool>
  | ReturnType<typeof createExecuteTool>;

// Update SubAgent interface
export interface SubAgent {
  name: string;
  description: string;
  systemPrompt: string;
  tools?: (ToolSet | BuiltinTool)[]; // Allow array of individual tools
  model?: LanguageModel;
  output?: z.ZodSchema<any>;
}
```

#### 2. Tool Creation Context

**File**: `src/types.ts`
**Changes**: Add context for tool creation

```typescript
// Add for passing tool creation context
export interface ToolCreationContext {
  state: DeepAgentState;
  backend?: BackendProtocol;
  onEvent?: EventCallback;
  toolResultEvictionLimit?: number;
}
```

### Success Criteria

#### Automated Verification

- [x] TypeScript compilation passes
- [x] Type checking works for mixed tool arrays
- [x] Intellisense shows available builtin tools

#### Manual Verification

- [x] Can configure subagent with mixed tools without type errors
- [x] Tool parameters are correctly typed

---

## Phase 3: Implement Tool Instantiation Logic

### Overview

Create logic to instantiate individual tools with proper state and options when configuring subagents.

### Changes Required

#### 1. Tool Instantiation Helper

**File**: `src/tools/subagent.ts`
**Changes**: Add function to handle tool instantiation

```typescript
// Add after imports
import {
  createWebSearchTool,
  createHttpRequestTool,
  createFetchUrlTool,
  createLsTool,
  createReadFileTool,
  createWriteFileTool,
  createEditFileTool,
  createGlobTool,
  createGrepTool,
  createTodosTool,
  createExecuteTool,
  type ToolCreationContext
} from './index';

// Add helper function
function instantiateBuiltinTool(
  tool: BuiltinTool,
  context: ToolCreationContext
): ToolSet {
  // Check tool type and create with proper context
  if (isWebSearchTool(tool)) {
    return createWebSearchTool(context.state, {
      backend: context.backend,
      onEvent: context.onEvent,
      toolResultEvictionLimit: context.toolResultEvictionLimit
    });
  }
  // Similar checks for other tool types...

  throw new Error(`Unknown builtin tool type: ${tool}`);
}

// Type guards for tool identification
function isWebSearchTool(tool: any): tool is ReturnType<typeof createWebSearchTool> {
  return tool?.description?.includes('Search the web');
}
```

#### 2. Update Subagent Creation

**File**: `src/tools/subagent.ts`
**Changes**: Modify tool handling in createSubagentTool

```typescript
// Update the subagent tool creation logic (around line 110-119)
for (const subagent of subagents) {
  let subagentTools: ToolSet = {};

  if (subagent.tools) {
    if (Array.isArray(subagent.tools)) {
      // Handle array of individual tools
      for (const tool of subagent.tools) {
        if (isBuiltinTool(tool)) {
          // Instantiate builtin tool with fresh context
          const instantiated = instantiateBuiltinTool(tool, {
            state: subagentState,
            backend,
            onEvent,
            toolResultEvictionLimit
          });
          subagentTools = { ...subagentTools, ...instantiated };
        } else {
          // Handle ToolSet objects (existing behavior)
          subagentTools = { ...subagentTools, ...tool };
        }
      }
    } else {
      // Handle ToolSet object (existing behavior)
      subagentTools = subagent.tools;
    }
  }

  subagentRegistry[subagent.name] = {
    systemPrompt: buildSubagentSystemPrompt(subagent.systemPrompt),
    tools: subagentTools || defaultTools,
    model: subagent.model || defaultModel,
    output: subagent.output,
  };
}
```

#### 3. Add Type Helper

**File**: `src/tools/subagent.ts`
**Changes**: Add helper to check tool types

```typescript
// Add type guard
function isBuiltinTool(tool: any): tool is BuiltinTool {
  // Check for known builtin tool properties
  return tool && typeof tool === 'object' && 'execute' in tool && 'description' in tool;
}
```

### Success Criteria

#### Automated Verification

- [x] All tests pass
- [x] Memory usage is acceptable (fresh instances don't leak)
- [x] Tools receive proper state and options

#### Manual Verification

- [x] Subagents receive specified tools only
- [x] Tools work correctly in subagents
- [x] Events are properly emitted from subagent tools

---

## Phase 4: Update Examples and Documentation

### Overview

Create examples demonstrating the new selective tool configuration feature.

### Changes Required

#### 1. Example File

**File**: `examples/subagent-selective-tools.ts`
**Changes**: Create comprehensive example

```typescript
import {
  createDeepAgent,
  anthropic,
  web_search,
  http_request,
  read_file,
  write_file,
  ls,
  write_todos,
  execute
} from 'ai-sdk-deep-agent';

// Example: Subagents with selective tool access
const agent = createDeepAgent({
  model: anthropic('claude-sonnet-4-20250514'),
  subagents: {
    subagents: [
      {
        name: 'web-researcher',
        description: 'Researches topics on the web',
        systemPrompt: 'You are a research assistant. Use web_search to find information.',
        tools: [web_search, http_request] // Only web tools
      },
      {
        name: 'file-manager',
        description: 'Manages workspace files',
        systemPrompt: 'You help with file operations. Read and write files as needed.',
        tools: [read_file, write_file, ls] // Only filesystem tools
      },
      {
        name: 'task-planner',
        description: 'Creates and manages task plans',
        systemPrompt: 'You create and track task plans using todos.',
        tools: [write_todos] // Only todo management
      },
      {
        name: 'full-stack-agent',
        description: 'Can do everything',
        systemPrompt: 'You have access to all tools.',
        tools: [web_search, read_file, write_file, write_todos, execute]
      }
    ]
  }
});

// Test the subagents
async function testSubagents() {
  console.log('Testing web researcher...');
  await agent.generate({
    prompt: 'Use the task tool to search for latest AI news'
  });

  console.log('Testing file manager...');
  await agent.generate({
    prompt: 'Use the task tool to list files in the current directory'
  });
}

testSubagents();
```

#### 2. Update Documentation

**File**: `docs/patterns.md`
**Changes**: Add section on selective subagent tools

```markdown
## Subagent Tool Configuration

### Selective Builtin Tools

You can configure subagents with specific builtin tools by importing them individually:

```typescript
import {
  createDeepAgent,
  web_search,
  http_request,
  read_file,
  write_file
} from 'ai-sdk-deep-agent';

const agent = createDeepAgent({
  model: anthropic('claude-sonnet-4-20250514'),
  subagents: {
    subagents: [
      {
        name: 'researcher',
        description: 'Web research specialist',
        systemPrompt: 'You research topics using web tools.',
        tools: [web_search, http_request] // Only web tools
      }
    ]
  }
});
```

Each subagent receives fresh instances of the specified tools, ensuring isolation.

```

### Success Criteria

#### Automated Verification
- [x] Example compiles and runs
- [x] Documentation is accurate
- [x] All tool imports work in examples

#### Manual Verification
- [x] Example demonstrates different tool combinations
- [x] Documentation is clear and helpful

---

## Testing Strategy

### Unit Tests

**File**: `test/tools/subagent-tools.test.ts`
- Test individual tool exports
- Test tool instantiation with context
- Test mixed tool arrays (ToolSet + BuiltinTool)
- Test error handling for unknown tools

**File**: `test/types/subagent-tools.test.ts`
- Test TypeScript type inference
- Test tool type guards

### Integration Tests

**File**: `test/integration/selective-subagent-tools.test.ts`
- Test subagent with web tools only
- Test subagent with filesystem tools only
- Test subagent with mixed custom and builtin tools
- Test tool isolation (separate state)

### Manual Testing Steps

1. Import individual builtin tools
2. Configure subagent with specific tools
3. Verify subagent can only use configured tools
4. Verify tools work correctly with fresh instances
5. Test multiple subagents with different tool sets
6. Verify no memory leaks or shared state issues

## Performance Considerations

- Each tool instance maintains its own state
- Consider lazy loading for expensive tools (web tools with API connections)
- Monitor memory usage with many subagents
- Tool instantiation should be fast and non-blocking

## Migration Notes

### Backward Compatibility

- Existing code using `tools: { customTool }` continues to work
- Existing code using `subagent.tools` as ToolSet continues to work
- Default behavior (no builtin tools) unchanged

### Breaking Changes

- None - this is purely additive functionality

### Recommended Usage

```typescript
// Old way (still supported)
const agent = createDeepAgent({
  subagents: {
    subagents: [{
      name: 'agent',
      tools: { custom_tool: myTool } // ToolSet object
    }]
  }
});

// New way
const agent = createDeepAgent({
  subagents: {
    subagents: [{
      name: 'agent',
      tools: [web_search, read_file] // Array of builtin tools
    }]
  }
});
```
