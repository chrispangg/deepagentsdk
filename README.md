# AI SDK Deep Agent

<p align="center">
  <img src="assets/ai-sdk-deep-agent.png" alt="AI SDK Deep Agent" width="380" />
</p>

[![npm version](https://badge.fury.io/js/ai-sdk-deep-agent.svg)](https://www.npmjs.com/package/ai-sdk-deep-agent)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

> **Note:** This package requires [Bun](https://bun.sh) runtime. It uses Bun-specific features and TypeScript imports.

A TypeScript library for building controllable AI agents using [Vercel AI SDK](https://ai-sdk.dev/). This is a reimplementation of [deepagentsjs](https://github.com/langchain-ai/deepagentsjs) without any LangChain/LangGraph dependencies.

## What are Deep Agents?

Using an LLM to call tools in a loop is the simplest form of an agent. This architecture, however, can yield agents that are "shallow" and fail to plan and act over longer, more complex tasks.

Deep Agents address these limitations through four core architectural components:

| Component | Purpose | Implementation |
|-----------|---------|----------------|
| **Planning Tool** | Long-term task breakdown and tracking | `write_todos` for maintaining task lists |
| **Sub Agents** | Task delegation and specialization | `task` tool for spawning specialized agents |
| **File System Access** | Persistent state and information storage | Virtual filesystem with `read_file`, `write_file`, `edit_file` |
| **Detailed Prompts** | Context-aware instructions | Sophisticated prompting strategies |

## Installation

This package requires Bun runtime:

```bash
# Install Bun if you haven't already
curl -fsSL https://bun.sh/install | bash

# Install the package
bun add ai-sdk-deep-agent

# Or install globally for CLI usage
bun add -g ai-sdk-deep-agent
```

**Why Bun?** This package publishes TypeScript source directly and uses Bun-specific optimizations for better performance.

## Quick Start

```typescript
import { createDeepAgent } from 'ai-sdk-deep-agent';
import { anthropic } from '@ai-sdk/anthropic';

const agent = createDeepAgent({
  model: anthropic('claude-sonnet-4-20250514'),
  systemPrompt: 'You are an expert researcher.',
});

const result = await agent.generate({
  prompt: 'Research the topic of quantum computing and write a report',
});

console.log(result.text);
console.log('Todos:', result.state.todos);
console.log('Files:', Object.keys(result.state.files));
```

## Configuration

### Model

Specify the model using AI SDK provider instances (supports any provider from the Vercel AI SDK ecosystem):

```typescript
import { anthropic } from '@ai-sdk/anthropic';
import { openai } from '@ai-sdk/openai';
import { azure } from '@ai-sdk/azure';

// Anthropic
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

// With custom configuration
const agent4 = createDeepAgent({
  model: anthropic('claude-sonnet-4-20250514', {
    apiKey: process.env.CUSTOM_API_KEY,
    baseURL: 'https://custom-endpoint.com',
  }),
});
```

This approach allows you to:

- Configure API keys, base URLs, and timeouts per provider
- Use any AI SDK-compatible provider (Anthropic, OpenAI, Azure, Bedrock, Groq, etc.)
- Mix and match models for main agent vs. subagents

### Custom Tools

Add your own tools alongside the built-in ones:

```typescript
import { tool } from 'ai';
import { z } from 'zod';

const weatherTool = tool({
  description: 'Get the weather in a location',
  parameters: z.object({
    city: z.string(),
  }),
  execute: async ({ city }) => {
    return `The weather in ${city} is sunny.`;
  },
});

const agent = createDeepAgent({
  tools: { weather: weatherTool },
});
```

### Subagents

Define specialized subagents for task delegation:

```typescript
import { createDeepAgent, type SubAgent } from 'ai-sdk-deep-agent';
import { anthropic } from '@ai-sdk/anthropic';

const researchSubagent: SubAgent = {
  name: 'research-agent',
  description: 'Used for in-depth research on specific topics',
  systemPrompt: 'You are a dedicated researcher...',
  // Optional: use a different model for this subagent
  model: anthropic('claude-haiku-4-5-20251001'),
};

const agent = createDeepAgent({
  model: anthropic('claude-sonnet-4-20250514'),
  subagents: [researchSubagent],
});
```

### Backends

Choose how files are stored:

```typescript
import { createDeepAgent, StateBackend, FilesystemBackend, PersistentBackend, InMemoryStore } from 'ai-sdk-deep-agent';
import { anthropic } from '@ai-sdk/anthropic';

// Default: In-memory (ephemeral)
const agent1 = createDeepAgent({
  model: anthropic('claude-sonnet-4-20250514'),
});

// Filesystem: Persist to disk
const agent2 = createDeepAgent({
  model: anthropic('claude-sonnet-4-20250514'),
  backend: new FilesystemBackend({ rootDir: './agent-workspace' }),
});

// Persistent: Cross-conversation memory with custom store
const store = new InMemoryStore(); // Or implement KeyValueStore for Redis, SQLite, etc.
const agent3 = createDeepAgent({
  model: anthropic('claude-sonnet-4-20250514'),
  backend: new PersistentBackend({ store, namespace: 'my-project' }),
});
```

### Prompt Caching (Anthropic)

Enable prompt caching for improved performance with Anthropic models:

```typescript
import { anthropic } from '@ai-sdk/anthropic';

const agent = createDeepAgent({
  model: anthropic('claude-sonnet-4-20250514'),
  enablePromptCaching: true, // Caches system prompt for faster subsequent calls
});
```

### Tool Result Eviction

Automatically evict large tool results to prevent context overflow:

```typescript
const agent = createDeepAgent({
  toolResultEvictionLimit: 20000, // Evict results > 20k tokens to filesystem
});
```

### Conversation Summarization

Automatically summarize older messages when approaching token limits:

```typescript
import { anthropic } from '@ai-sdk/anthropic';

const agent = createDeepAgent({
  model: anthropic('claude-sonnet-4-20250514'),
  summarization: {
    enabled: true,
    tokenThreshold: 170000, // Trigger summarization at 170k tokens
    keepMessages: 6, // Keep last 6 messages intact
    model: anthropic('claude-haiku-4-5-20251001'), // Use fast model for summarization
  },
});
```

## Built-in Tools

### Planning: `write_todos`

Manages a task list for complex multi-step operations:

```
- Track tasks with statuses: pending, in_progress, completed, cancelled
- Merge or replace existing todos
- Only one task should be in_progress at a time
```

### Filesystem Tools

| Tool | Description |
|------|-------------|
| `ls` | List files in a directory |
| `read_file` | Read file contents with line numbers |
| `write_file` | Create a new file |
| `edit_file` | Replace text in an existing file |
| `glob` | Find files matching a pattern |
| `grep` | Search for text within files |

### Subagent: `task`

Spawn isolated subagents for complex subtasks:

```
- Context isolation prevents main agent context bloat
- Parallel execution for independent tasks
- Shares filesystem with parent agent
```

## Streaming with Events

Stream responses with real-time events for tool calls, file operations, and more:

```typescript
import { anthropic } from '@ai-sdk/anthropic';

const agent = createDeepAgent({
  model: anthropic('claude-sonnet-4-20250514'),
});

// Stream with events
for await (const event of agent.streamWithEvents({ prompt: 'Build a todo app' })) {
  switch (event.type) {
    case 'text':
      process.stdout.write(event.text);
      break;
    case 'tool-call':
      console.log(`Calling tool: ${event.toolName}`);
      break;
    case 'tool-result':
      console.log(`Tool result: ${event.toolName}`);
      break;
    case 'file-written':
      console.log(`File written: ${event.path}`);
      break;
    case 'todos-changed':
      console.log('Todos updated:', event.todos);
      break;
    case 'done':
      console.log('Final state:', event.state);
      break;
  }
}
```

### Event Types

| Event | Description |
|-------|-------------|
| `text` | Streamed text chunk |
| `step-start` | Agent step started |
| `step-finish` | Agent step completed with tool results |
| `tool-call` | Tool being called |
| `tool-result` | Tool returned a result |
| `todos-changed` | Todo list was modified |
| `file-write-start` | File write starting (for preview) |
| `file-written` | File was written |
| `file-edited` | File was edited |
| `subagent-start` | Subagent spawned |
| `subagent-finish` | Subagent completed |
| `done` | Generation complete |
| `error` | Error occurred |

## Multi-turn Conversations

Maintain conversation history across multiple turns:

```typescript
import { createDeepAgent, type ModelMessage } from 'ai-sdk-deep-agent';
import { anthropic } from '@ai-sdk/anthropic';

const agent = createDeepAgent({
  model: anthropic('claude-sonnet-4-20250514'),
});

let messages: ModelMessage[] = [];

// First turn
for await (const event of agent.streamWithEvents({ 
  prompt: 'Create a file called hello.txt',
  messages,
})) {
  if (event.type === 'done') {
    messages = event.messages || [];
  }
}

// Second turn - agent remembers the file
for await (const event of agent.streamWithEvents({ 
  prompt: 'What file did you just create?',
  messages,
})) {
  if (event.type === 'text') {
    process.stdout.write(event.text);
  }
}
```

## Utilities

### Patch Dangling Tool Calls

Fix incomplete tool calls in conversation history:

```typescript
import { patchToolCalls, hasDanglingToolCalls } from 'ai-sdk-deep-agent';

// Check if messages have dangling tool calls
if (hasDanglingToolCalls(messages)) {
  // Patch them with synthetic "cancelled" results
  const patchedMessages = patchToolCalls(messages);
}
```

### Token Estimation

Estimate tokens for planning:

```typescript
import { estimateTokens, estimateMessagesTokens } from 'ai-sdk-deep-agent';

const textTokens = estimateTokens('Some text content');
const messageTokens = estimateMessagesTokens(messages);
```

## API Reference

### `createDeepAgent(params)`

Creates a new Deep Agent instance.

**Parameters:**

- `model: LanguageModel` - **Required.** AI SDK LanguageModel instance (e.g., `anthropic('claude-sonnet-4-20250514')`)
- `tools?: ToolSet` - Custom tools to add
- `systemPrompt?: string` - Custom system prompt
- `subagents?: SubAgent[]` - Subagent specifications (each can have its own `model`)
- `backend?: BackendProtocol | BackendFactory` - Storage backend
- `maxSteps?: number` - Maximum tool call steps (default: 100)
- `includeGeneralPurposeAgent?: boolean` - Include default subagent (default: true)
- `enablePromptCaching?: boolean` - Enable prompt caching (default: false, Anthropic only)
- `toolResultEvictionLimit?: number` - Token limit for tool result eviction
- `summarization?: SummarizationConfig` - Conversation summarization settings

**Returns:** `DeepAgent` instance

### `DeepAgent.generate(options)`

Generate a response (non-streaming).

```typescript
const result = await agent.generate({
  prompt: 'Your task here',
  maxSteps: 50, // Optional override
});

// result.text - Final response text
// result.state.todos - Task list
// result.state.files - Virtual filesystem
```

### `DeepAgent.stream(options)`

Stream a response.

```typescript
const result = agent.stream({
  prompt: 'Your task here',
});

for await (const chunk of result.textStream) {
  process.stdout.write(chunk);
}
```

### `DeepAgent.streamWithEvents(options)`

Stream with detailed events.

```typescript
for await (const event of agent.streamWithEvents({
  prompt: 'Your task here',
  messages: [], // Optional conversation history
  state: { todos: [], files: {} }, // Optional initial state
  abortSignal: controller.signal, // Optional abort signal
})) {
  // Handle events
}
```

## CLI

The interactive CLI is built with [Ink](https://github.com/vadimdemedes/ink) and requires Bun:

```bash
# Run without installing (recommended)
bunx ai-sdk-deep-agent

# Or install globally and run
bun add -g ai-sdk-deep-agent
deep-agent

# Or install locally in a project
bun add ai-sdk-deep-agent
bunx deep-agent

# During development, run from source
bun run cli

# With options
bunx ai-sdk-deep-agent --model anthropic/claude-haiku-4-5-20251001 --work-dir ./my-project
```

### CLI Commands

| Command | Description |
|---------|-------------|
| `/help` | Show available commands |
| `/todos` | Show current todo list |
| `/files` | List files in workspace |
| `/read <path>` | Read a file |
| `/clear` | Clear conversation history |
| `/model <name>` | Change the model |
| `/exit` | Exit the CLI |

## License

MIT
