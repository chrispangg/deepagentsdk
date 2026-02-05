# Deep Agent SDK

<p align="center">
  <img src="assets/www-hero.png" alt="Deep Agent SDK" width="100%" />
</p>

[![npm version](https://badge.fury.io/js/deepagentsdk.svg)](https://www.npmjs.com/package/deepagentsdk)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Ask DeepWiki](https://deepwiki.com/badge.svg)](https://deepwiki.com/chrispangg/deepagentsdk)
[![Documentation](https://img.shields.io/badge/docs-ai--sdk--deepagent-blue)](https://deepagentsdk.dev/docs)

> **Note:** This package works with both **Node.js (18+)** and **Bun**. While development uses Bun, the published npm package is fully compatible with Node.js. [See Node.js usage guide](./docs/NODEJS-USAGE.md).

A TypeScript library for building controllable AI agents using [Vercel AI SDK](https://ai-sdk.dev/). This is a reimplementation of [deepagentsjs](https://github.com/langchain-ai/deepagentsjs) without any LangChain/LangGraph dependencies.

## What is Deep Agent?

Using an LLM to call tools in a loop is the simplest form of an agent. This architecture, however, can yield agents that are "shallow" and fail to plan and act over longer, more complex tasks.

Deep Agent addresses these limitations through four core architectural components:

| Component | Purpose | Implementation |
|-----------|---------|----------------|
| **Planning Tool** | Long-term task breakdown and tracking | `write_todos` for maintaining task lists |
| **Sub Agents** | Task delegation and specialization | `task` tool for spawning specialized agents |
| **File System Access** | Persistent state and information storage | Virtual filesystem with `read_file`, `write_file`, `edit_file` |
| **Detailed Prompts** | Context-aware instructions | Sophisticated prompting strategies |

## Installation

<details>
<summary><b>Using Node.js (Recommended for production)</b></summary>

```bash
# Using npm
npm install deepagentsdk @ai-sdk/anthropic @ai-sdk/openai

# Using yarn
yarn add deepagentsdk @ai-sdk/anthropic @ai-sdk/openai

# Using pnpm
pnpm add deepagentsdk @ai-sdk/anthropic @ai-sdk/openai
```

**Run your agent:**
```bash
# With tsx (recommended)
npx tsx your-agent.ts

# Or with ts-node
npx ts-node your-agent.ts
```

📖 **[Complete Node.js Usage Guide](./docs/NODEJS-USAGE.md)** - Setup, examples, troubleshooting, and deployment.

⚡ **[Quick Reference](./NODEJS-QUICKREF.md)** - 30-second setup, common commands, and code snippets.

</details>

<details>
<summary><b>Using Bun (Faster for development)</b></summary>

```bash
# Install Bun if you haven't already
curl -fsSL https://bun.sh/install | bash

# Install the package
bun add deepagentsdk

# Or install globally for CLI usage
bun add -g deepagentsdk
```

**Run your agent:**
```bash
bun run your-agent.ts
```

</details>

**Which runtime should I use?**
- **Node.js**: Production applications, existing Node.js projects, Docker deployments
- **Bun**: Faster development iteration, contributing to the library

## Quick Start

```typescript
import { createDeepAgent } from 'deepagentsdk';
import { anthropic } from '@ai-sdk/anthropic';

const agent = createDeepAgent({
  model: anthropic('claude-sonnet-4-5-20250929'),
  systemPrompt: 'You are an expert researcher.',
});

const result = await agent.generate({
  prompt: 'Research the topic of quantum computing and write a report',
});

console.log(result.text);
console.log('Todos:', result.state.todos);
console.log('Files:', Object.keys(result.state.files));
```

## Features

### Structured Output

Deep agents can return typed, validated objects using Zod schemas alongside text responses:

```typescript
import { z } from 'zod';

const agent = createDeepAgent({
  model: anthropic('claude-sonnet-4-5-20250929'),
  output: {
    schema: z.object({
      summary: z.string(),
      keyPoints: z.array(z.string()),
    }),
    description: 'Research findings',
  },
});

const result = await agent.generate({
  prompt: "Research latest AI developments",
});

console.log(result.output?.summary);      // string
console.log(result.output?.keyPoints);    // string[]
```

### Streaming with Events

Stream responses with real-time events for tool calls, file operations, and more:

```typescript
for await (const event of agent.streamWithEvents({
  prompt: 'Build a todo app',
})) {
  switch (event.type) {
    case 'text':
      process.stdout.write(event.text);
      break;
    case 'tool-call':
      console.log(`Calling: ${event.toolName}`);
      break;
    case 'file-written':
      console.log(`Written: ${event.path}`);
      break;
  }
}
```

### Built-in Tools

- **Planning**: `write_todos` for task management
- **Filesystem**: `read_file`, `write_file`, `edit_file`, `ls`, `glob`, `grep`
- **Web**: `web_search`, `http_request`, `fetch_url` (requires Tavily API key)
- **Execute**: Shell command execution with `LocalSandbox` backend
- **Subagents**: Spawn specialized agents for complex subtasks

## Documentation

For comprehensive guides, API reference, and examples, visit **[deepagentsdk.vercel.app/docs](https://deepagentsdk.vercel.app/docs)**

### Key Documentation Sections

- **[Get Started](https://deepagentsdk.vercel.app/docs/get-started)** - Installation and basic setup
- **[Guides](https://deepagentsdk.vercel.app/docs/guides)** - In-depth tutorials on:
  - Configuration options (models, backends, middleware)
  - Custom tools and subagents
  - Agent memory and persistence
  - Prompt caching and conversation summarization
  - Web tools and API integration
- **[Reference](https://deepagentsdk.vercel.app/docs/reference)** - Complete API documentation

## CLI

The interactive CLI is built with [Ink](https://github.com/vadimdemedes/ink):

```bash
# Run without installing (recommended)
bunx deepagentsdk

# Or install globally
bun add -g deepagentsdk
deep-agent

# With options
bunx deepagentsdk --model anthropic/claude-haiku-4-5-20251001
```

**API Keys**: Load from environment variables (`ANTHROPIC_API_KEY`, `OPENAI_API_KEY`, `TAVILY_API_KEY`) or `.env` file.

## License

MIT
