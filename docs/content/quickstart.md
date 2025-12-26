---
title: Quickstart
description: Get up and running with ai-sdk-deep-agent in minutes
---

# Quickstart Guide

Get up and running with **ai-sdk-deep-agent** in minutes. This guide will walk you through installation, basic usage, and key configuration options.

## Prerequisites

Before you begin, ensure you have:

- **Node.js/Bun**: This package requires [Bun](https://bun.sh) runtime (>= 1.0.0)
  ```bash
  # Install Bun if needed
  curl -fsSL https://bun.sh/install | bash
  ```

- **API Key**: Get an API key from one of these providers:
  - [Anthropic](https://console.anthropic.com/) (for Claude models)
  - [OpenAI](https://platform.openai.com/api-keys) (for GPT models)

- **TypeScript**: TypeScript 5+ (recommended but optional)

## Installation

Install the package in your project:

```bash
# Using Bun (recommended)
bun add ai-sdk-deep-agent

# Or npm
npm install ai-sdk-deep-agent
```

You'll also need the AI SDK provider packages:

```bash
# For Anthropic (Claude)
bun add @ai-sdk/anthropic

# For OpenAI (GPT)
bun add @ai-sdk/openai
```

## Your First Agent

Let's create a simple agent that can plan tasks, work with files, and respond to your requests.

### Step 1: Create an Agent

Create a file named `agent.ts`:

```typescript
import { createDeepAgent } from 'ai-sdk-deep-agent';
import { anthropic } from '@ai-sdk/anthropic';

// Create a deep agent
const agent = createDeepAgent({
  model: anthropic('claude-sonnet-4-5-20250929'),
  systemPrompt: 'You are a helpful research assistant.',
});
```

### Step 2: Generate a Response

Now let's ask the agent to do something:

```typescript
const result = await agent.generate({
  prompt: 'Plan and execute a research task about quantum computing',
  maxSteps: 10,
});

console.log(result.text);
console.log('Todos:', result.state.todos);
console.log('Files:', Object.keys(result.state.files));
```

### Step 3: Run It

Set your API key and run:

```bash
# Set your API key
export ANTHROPIC_API_KEY=sk-ant-...

# Run the agent
bun run agent.ts
```

**That's it!** Your agent just:
- Broke down the task into todos using the `write_todos` tool
- Researched the topic
- Created files in the virtual filesystem
- Provided a comprehensive response

## Basic Configuration

### Choosing a Model

Use any AI SDK provider (Anthropic, OpenAI, Azure, etc.):

```typescript
import { anthropic } from '@ai-sdk/anthropic';
import { openai } from '@ai-sdk/openai';

// Anthropic Claude
const agent1 = createDeepAgent({
  model: anthropic('claude-sonnet-4-5-20250929'),
});

// OpenAI GPT
const agent2 = createDeepAgent({
  model: openai('gpt-4o'),
});
```

### Custom System Prompt

Give your agent specific instructions:

```typescript
const agent = createDeepAgent({
  model: anthropic('claude-sonnet-4-5-20250929'),
  systemPrompt: `You are an expert software engineer.
  - Write clean, well-documented code
  - Always create tests for your code
  - Use the write_todos tool to plan your work before starting`,
});
```

### File Storage Options

By default, files are stored in memory. To persist files to disk:

```typescript
import { FilesystemBackend } from 'ai-sdk-deep-agent';

const agent = createDeepAgent({
  model: anthropic('claude-sonnet-4-5-20250929'),
  backend: new FilesystemBackend({ rootDir: './workspace' }),
});
```

## Streaming with Events

For real-time feedback on what your agent is doing, use streaming:

```typescript
console.log('🚀 Starting agent...\n');

for await (const event of agent.streamWithEvents({
  prompt: 'Create a todo list for learning TypeScript',
})) {
  switch (event.type) {
    case 'text':
      // Stream text in real-time
      process.stdout.write(event.text);
      break;

    case 'todos-changed':
      // Todo list updated
      console.log('\n📋 Todos:', event.todos.length);
      break;

    case 'file-written':
      // File created
      console.log('\n📁 Created:', event.path);
      break;

    case 'done':
      // Task complete
      console.log('\n✅ Done!');
      break;
  }
}
```

## Key Features

### 1. Planning with Todos

Agents automatically use the `write_todos` tool to plan and track tasks:

```typescript
const result = await agent.generate({
  prompt: 'Build a simple web app with HTML, CSS, and JavaScript',
});

result.state.todos.forEach(todo => {
  console.log(`[${todo.status}] ${todo.content}`);
});
```

### 2. Virtual Filesystem

Agents can create, read, and edit files:

```typescript
const result = await agent.generate({
  prompt: 'Create a file called notes.md with some content',
});

// Read the file
const notes = result.state.files['/notes.md'];
console.log(notes.content.join('\n'));
```

### 3. Structured Output

Get type-safe, validated responses alongside text:

```typescript
import { z } from 'zod';

const agent = createDeepAgent({
  model: anthropic('claude-sonnet-4-5-20250929'),
  output: {
    schema: z.object({
      summary: z.string(),
      keyPoints: z.array(z.string()),
      confidence: z.number(),
    }),
    description: 'Research findings with confidence score',
  },
});

const result = await agent.generate({
  prompt: 'Analyze the market trends',
});

console.log(result.output?.summary);      // string
console.log(result.output?.keyPoints);    // string[]
console.log(result.output?.confidence);   // number
```

### 4. Subagents

Delegate specialized work to subagents:

```typescript
const agent = createDeepAgent({
  model: anthropic('claude-sonnet-4-5-20250929'),
  subagents: [
    {
      name: 'researcher',
      description: 'Expert at researching topics',
      systemPrompt: 'You are a dedicated research specialist...',
    },
    {
      name: 'coder',
      description: 'Expert at writing code',
      systemPrompt: 'You are a software engineer...',
    },
  ],
});

// Agent can now use the task tool to delegate work
await agent.generate({
  prompt: 'Use the task tool to research this topic, then write code based on findings',
});
```

## Common Patterns

### Multi-turn Conversations

Maintain conversation history:

```typescript
let messages = [];

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
  prompt: 'What did you just create?',
  messages,
})) {
  if (event.type === 'text') {
    process.stdout.write(event.text);
  }
}
```

### Custom Tools

Add your own tools alongside built-in ones:

```typescript
import { tool } from 'ai';
import { z } from 'zod';

const weatherTool = tool({
  description: 'Get the current weather for a city',
  parameters: z.object({
    city: z.string(),
  }),
  execute: async ({ city }) => {
    // Call your weather API here
    return `The weather in ${city} is sunny and 72°F`;
  },
});

const agent = createDeepAgent({
  model: anthropic('claude-sonnet-4-5-20250929'),
  tools: { get_weather: weatherTool },
});
```

### Enable Web Tools

Add web search and HTTP request capabilities (requires Tavily API key):

```bash
# Set Tavily API key
export TAVILY_API_KEY=tvly-your-key
```

```typescript
// Web tools are automatically available when TAVILY_API_KEY is set
const agent = createDeepAgent({
  model: anthropic('claude-sonnet-4-5-20250929'),
});

await agent.generate({
  prompt: 'Search the web for recent AI news and summarize findings',
});
```

### Command Execution

Enable shell command execution with LocalSandbox:

```typescript
import { LocalSandbox } from 'ai-sdk-deep-agent';

const agent = createDeepAgent({
  model: anthropic('claude-sonnet-4-5-20250929'),
  backend: new LocalSandbox({
    cwd: './workspace',
    timeout: 60000,
  }),
});

// execute tool is automatically added
await agent.generate({
  prompt: 'Initialize a Node.js project and install dependencies',
});
```

## Environment Variables

Create a `.env` file in your project root:

```bash
# Required: API keys
ANTHROPIC_API_KEY=sk-ant-...
OPENAI_API_KEY=sk-...

# Optional: Web search
TAVILY_API_KEY=tvly-...

# Optional: Custom base URLs
ANTHROPIC_BASE_URL=https://custom-endpoint.com
```

Load and use:

```typescript
import { dotenv } from 'bun';

// Load .env file
dotenv.config();

// Now create your agent
const agent = createDeepAgent({
  model: anthropic('claude-sonnet-4-5-20250929'),
});
```

## Next Steps

### Learn More

- **[Architecture](./architecture.md)** - Deep dive into the architecture and components
- **[Patterns](./patterns.md)** - Common usage patterns and advanced examples
- **[Checkpointers](./checkpointers.md)** - Session persistence and state management
- **[Agent Memory](./agent-memory.md)** - Cross-conversation memory system

### Explore Examples

Check out the `examples/` directory for 15+ working examples:

```bash
# Basic usage
bun examples/basic.ts

# Streaming with events
bun examples/streaming.ts

# Structured output
bun examples/with-structured-output.ts

# Subagents
bun examples/with-subagents.ts

# Custom tools
bun examples/with-custom-tools.ts

# Web research
bun examples/web-research.ts

# Command execution
bun examples/with-local-sandbox.ts

# And more...
```

### Try the CLI

Experience the interactive CLI:

```bash
bunx ai-sdk-deep-agent

# With a specific model
bunx ai-sdk-deep-agent --model anthropic/claude-haiku-4-5-20251001
```

## Troubleshooting

### "Cannot find module 'ai-sdk-deep-agent'"

Make sure you've installed the package and its dependencies:

```bash
bun install
```

### "API key not found"

Set your API key as an environment variable or in a `.env` file:

```bash
export ANTHROPIC_API_KEY=sk-ant-...
```

### "Module not found: @ai-sdk/anthropic"

Install the required AI SDK provider package:

```bash
bun add @ai-sdk/anthropic
```

### Agent not using tools

Check that:
1. You're using a model that supports tool calling (Claude 3+, GPT-4)
2. The task actually requires tools (agents decide when to use them)
3. Your prompt encourages tool usage: "Use the write_todos tool to plan your work"

## Summary

In this quickstart, you learned:

- How to install and set up **ai-sdk-deep-agent**
- How to create a basic agent with planning and filesystem capabilities
- How to configure models, prompts, and storage backends
- How to use streaming with real-time events
- Key features like todos, structured output, and subagents
- Common patterns for multi-turn conversations and custom tools

You're now ready to build powerful AI agents! Explore the documentation and examples to learn more.
