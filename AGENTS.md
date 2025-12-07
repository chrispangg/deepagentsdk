# AGENTS.md

This file provides guidance to AI Agents i.e. Claude Code, Cursor, etc. when working with code in this repository.

## Project Overview

This is **ai-sdk-deep-agent**, a TypeScript library implementing "Deep Agents" architecture using Vercel AI SDK v6. Deep Agents extend basic LLM tool-calling with four core pillars: planning tools (`write_todos`), virtual filesystem access, subagent spawning (`task`), and detailed prompting.

**Key architectural pattern**: This library wraps AI SDK v6's `ToolLoopAgent` with a state management layer and specialized tools to enable complex, multi-step agent behaviors. The agent maintains a virtual filesystem and todo list across multiple tool-calling steps.

## Feature Parity Tracking

**IMPORTANT**: This project aims to reimplement LangChain's DeepAgents framework using Vercel AI SDK.

- **Reference implementations**: `.refs/deepagentsjs/` (JS) and `.refs/deepagents/` (Python)
- **Feature tracker**: `.agent/PROJECT-STATE.md`
- **Implementation framework**: `.agent/RPI-FRAMEWORK.md`

### Implementing New Features (RPI Framework)

**Before implementing any feature from `PROJECT-STATE.md`, you MUST read `.agent/RPI-FRAMEWORK.md`** — this document details the Research → Plan → Implement (RPI) framework used in this project.

**Quick summary of RPI**:

1. **Research** — Create `.agent/{feature-name}/research/findings.md` documenting how the system works, reference implementation analysis, and files to modify
2. **Plan** — Create `.agent/{feature-name}/plan/implementation-plan.md` with exact steps, file names, code snippets, and testing strategy
3. **Implement** — Execute the plan mechanically, validate, then update `PROJECT-STATE.md`

**Why RPI?** It prevents "AI slop" (low-quality code requiring rework) through intentional context compaction — keeping each phase focused and accurate.

**When to use full RPI**:

- Complex features spanning multiple files → Full RPI
- Simple self-contained changes → Light plan only
- Trivial fixes (typos, renames) → Direct implementation

After completing a feature:

1. Move it from "To Implement" to "Implemented" in `PROJECT-STATE.md`
2. If unsupportable due to AI SDK limitations, add to "Won't Support" with reasoning

## Development Commands

```bash
# Run tests
bun test

# Type checking
bun run typecheck

# Run CLI during development (uses parseModelString for backward compatibility)
bun run cli

# Run CLI with custom options
bun run cli -- --model anthropic/claude-haiku-4-5-20251001 --dir ./workspace

# Run examples (now use provider instances)
bun examples/basic.ts
bun examples/streaming.ts
bun examples/with-subagents.ts
bun examples/with-custom-tools.ts
```

## Architecture

### Core Components

1. **DeepAgent** (`src/agent.ts`): Main agent class that wraps `ToolLoopAgent` with state management
   - **Requires** a `LanguageModel` instance (from AI SDK providers like `anthropic()`, `openai()`, etc.)
   - Creates tools dynamically for each invocation with shared state
   - Supports three generation modes: `generate()`, `stream()`, `streamWithEvents()`
   - Handles conversation history via `messages` array for multi-turn conversations
   - Implements prompt caching (Anthropic), tool result eviction, and auto-summarization

2. **State Management** (`src/types.ts`):

   ```typescript
   interface DeepAgentState {
     todos: TodoItem[];  // Task planning/tracking
     files: Record<string, FileData>;  // Virtual filesystem
   }
   ```

3. **Backends** (`src/backends/`):
   - `StateBackend`: In-memory storage (default, ephemeral)
   - `FilesystemBackend`: Persists files to actual disk
   - `PersistentBackend`: Cross-conversation memory with key-value store
   - `CompositeBackend`: Combines multiple backends (e.g., filesystem + cloud storage)

   All backends implement `BackendProtocol` interface with methods: `read()`, `write()`, `edit()`, `ls()`, `lsInfo()`, `glob()`, `grep()`

4. **Tools** (`src/tools/`):
   - **Planning**: `write_todos` - Manages task lists with merge/replace strategies
   - **Filesystem**: `ls`, `read_file`, `write_file`, `edit_file`, `glob`, `grep`
   - **Subagents**: `task` - Spawns isolated subagents that share filesystem with parent

5. **CLI** (`src/cli/index.tsx`):
   - Built with Ink (React for CLI) - interactive terminal interface
   - Real-time streaming with event visualization
   - Slash commands: `/help`, `/todos`, `/files`, `/read <path>`, `/clear`, `/model <name>`, `/exit`
   - Feature toggles: `/cache`, `/eviction`, `/summarize`, `/features`

### Event System

The `streamWithEvents()` method emits granular events during generation:

- `text`: Streamed text chunks
- `step-start`, `step-finish`: Agent reasoning steps
- `tool-call`, `tool-result`: Tool invocations
- `todos-changed`: Todo list modifications
- `file-write-start`, `file-written`, `file-edited`: Filesystem changes
- `subagent-start`, `subagent-finish`: Subagent delegation
- `done`: Final state with conversation messages
- `error`: Error occurred

### Message Handling

**Important**: The agent uses AI SDK's `messages` array for conversation history. When streaming with events:

1. The `done` event includes `event.messages` - the updated conversation history
2. Pass this back to the next `streamWithEvents()` call to maintain context
3. The library automatically patches "dangling tool calls" (calls without results) via `patchToolCalls()`

### Performance Features

1. **Prompt Caching** (Anthropic only):
   - Caches system prompt for faster subsequent calls
   - Enabled via `enablePromptCaching: true`

2. **Tool Result Eviction**:
   - Large tool results (>20k tokens default) are evicted to virtual filesystem
   - Prevents context overflow in long agent loops
   - Controlled via `toolResultEvictionLimit` parameter

3. **Auto-Summarization**:
   - When conversation exceeds token threshold (170k default), older messages are summarized
   - Keeps recent messages (6 default) intact for context
   - Uses fast model (Haiku) for summarization by default

## Key Files

- `src/agent.ts` - DeepAgent class and createDeepAgent factory
- `src/types.ts` - TypeScript type definitions (now uses LanguageModel type)
- `src/prompts.ts` - System prompts for agent and tools
- `src/tools/filesystem.ts` - Virtual filesystem tools implementation
- `src/tools/subagent.ts` - Subagent spawning logic
- `src/tools/todos.ts` - Todo management tool
- `src/backends/` - Backend implementations for storage
- `src/utils/` - Utilities for patching, eviction, summarization, token estimation
- `src/utils/model-parser.ts` - **New**: Parses model strings to LanguageModel instances (for CLI backward compat)
- `src/cli/index.tsx` - Interactive CLI application
- `src/cli/hooks/useAgent.ts` - React hook that manages agent streaming (uses parseModelString)

## Testing Patterns

When writing tests:

- Use `bun:test` instead of Jest or Vitest
- Import from `bun:test`: `import { test, expect } from "bun:test";`
- Tests are co-located with source files (e.g., `agent.test.ts`)
- Test backend implementations separately from agent logic

## Model Specification

**Important**: The library now requires AI SDK `LanguageModel` instances instead of string-based model IDs.

```typescript
import { anthropic } from '@ai-sdk/anthropic';
import { openai } from '@ai-sdk/openai';
import { azure } from '@ai-sdk/azure';
import { createDeepAgent } from 'ai-sdk-deep-agent';

// Anthropic (recommended)
const agent1 = createDeepAgent({
  model: anthropic('claude-sonnet-4-20250514'),
});

// OpenAI
const agent2 = createDeepAgent({
  model: openai('gpt-4o'),
});

// Azure OpenAI
const agent3 = createDeepAgent({
  model: azure('gpt-4', {
    apiKey: process.env.AZURE_OPENAI_API_KEY,
    resourceName: 'my-resource',
  }),
});

// Custom configuration
const agent4 = createDeepAgent({
  model: anthropic('claude-sonnet-4-20250514', {
    apiKey: process.env.CUSTOM_API_KEY,
    baseURL: 'https://custom-endpoint.com',
  }),
});
```

**CLI Backward Compatibility**: The CLI internally uses `parseModelString()` from `src/utils/model-parser.ts` to convert string formats like `"anthropic/claude-sonnet-4-20250514"` into `LanguageModel` instances. This is only for the CLI - when using the library programmatically, always pass provider instances.

## Publishing

This package publishes TypeScript source directly (not compiled JavaScript):

- `main`, `module`, `types` all point to `./src/index.ts`
- Requires Bun runtime for consumption
- `prepublishOnly` script runs type checking before publish
- CLI entry point: `./src/cli/index.tsx`

## Important Conventions

1. **File paths in virtual filesystem**: Always relative to working directory (e.g., `/src/main.ts` or `main.ts`)
2. **Todo status flow**: `pending` → `in_progress` → `completed` or `cancelled`
3. **Backend resolution**: Backends can be instances (`BackendProtocol`) or factories (`BackendFactory`) that create instances from state
4. **Subagent isolation**: Subagents share filesystem with parent but have independent todo lists and conversation history
5. **Tool naming**: Core tools use snake_case (`write_todos`, `read_file`) following common CLI conventions
6. **Event callbacks**: Optional `onEvent` parameter in tool creation enables real-time event streaming

## Common Patterns

### Creating an agent with custom backend

```typescript
import { anthropic } from '@ai-sdk/anthropic';
import { createDeepAgent, FilesystemBackend } from 'ai-sdk-deep-agent';

const agent = createDeepAgent({
  model: anthropic('claude-sonnet-4-20250514'),
  backend: new FilesystemBackend({ rootDir: './workspace' }),
});
```

### Using different providers

```typescript
import { openai } from '@ai-sdk/openai';
import { azure } from '@ai-sdk/azure';
import { createDeepAgent } from 'ai-sdk-deep-agent';

// OpenAI
const openaiAgent = createDeepAgent({
  model: openai('gpt-4o', {
    apiKey: process.env.OPENAI_API_KEY,
  }),
});

// Azure OpenAI
const azureAgent = createDeepAgent({
  model: azure('gpt-4', {
    apiKey: process.env.AZURE_API_KEY,
    resourceName: 'my-resource',
  }),
});
```

### Multi-turn conversation

```typescript
let messages: ModelMessage[] = [];

for await (const event of agent.streamWithEvents({ prompt: "First message", messages })) {
  if (event.type === 'done') {
    messages = event.messages || [];
  }
}

// Next turn with context
for await (const event of agent.streamWithEvents({ prompt: "Follow up", messages })) {
  // Agent remembers previous context
}
```

### Adding custom subagents

```typescript
import { anthropic } from '@ai-sdk/anthropic';
import { createDeepAgent, type SubAgent } from 'ai-sdk-deep-agent';

const researchAgent: SubAgent = {
  name: 'research-agent',
  description: 'Specialized for deep research tasks',
  systemPrompt: 'You are a research specialist...',
  tools: { custom_tool: myTool },
  model: anthropic('claude-haiku-4-5-20251001'), // optional override with different model
};

const agent = createDeepAgent({
  model: anthropic('claude-sonnet-4-20250514'),
  subagents: [researchAgent],
});
```
