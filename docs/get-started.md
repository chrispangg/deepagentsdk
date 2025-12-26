---
title: Get Started
description: Build your first Deep Agent from installation to your first working agent
---

# Get Started with AI SDK Deep Agent

A comprehensive guide to building your first Deep Agent from installation to your first working agent.

## What are Deep Agents?

Deep Agents extend basic LLM tool-calling with four core capabilities:

1. **Planning Tool** (`write_todos`) - Break down complex tasks and track progress
2. **Virtual Filesystem** - Persistent state across tool calls
3. **Subagent Spawning** (`task`) - Delegate work to specialized agents
4. **Detailed Prompting** - Context-aware instructions and tool descriptions

This combination enables agents to handle complex, multi-step tasks that would overwhelm simpler "shallow" agents.

## Prerequisites

Before you begin, ensure you have:

- **Bun runtime** (>= 1.0.0) - This package requires Bun for TypeScript features and performance
- **Node.js** compatible environment
- **API Key** for at least one of:
  - Anthropic (Claude) - Recommended
  - OpenAI (GPT)
  - Azure OpenAI
  - Or any AI SDK v6 compatible provider

### Install Bun (if needed)

```bash
# Install Bun
curl -fsSL https://bun.sh/install | bash

# Verify installation
bun --version
```

## Installation

### For a New Project

```bash
# Create a new project
mkdir my-agent-project
cd my-agent-project
bun init -y

# Install the package
bun add ai-sdk-deep-agent

# Install AI SDK providers
bun add @ai-sdk/anthropic @ai-sdk/openai
```

### For an Existing Project

```bash
cd your-project
bun add ai-sdk-deep-agent
```

### For CLI Usage (Global)

```bash
# Install globally
bun add -g ai-sdk-deep-agent

# Now you can run from anywhere
deep-agent
```

## Configuration

### 1. Set Up API Keys

Create a `.env` file in your project root:

```bash
# Anthropic (recommended)
ANTHROPIC_API_KEY=sk-ant-your-key-here

# OpenAI (alternative)
OPENAI_API_KEY=sk-your-key-here

# Tavily (for web search tools - optional)
TAVILY_API_KEY=tvly-your-key-here
```

### 2. Choose a Model

The library requires AI SDK `LanguageModel` instances (not strings). Here are common options:

```typescript
import { anthropic } from '@ai-sdk/anthropic';
import { openai } from '@ai-sdk/openai';

// Anthropic Claude (recommended)
const model1 = anthropic('claude-sonnet-4-5-20250929');

// Anthropic Claude 3.5 Sonnet (older)
const model2 = anthropic('claude-sonnet-4-20250514');

// Anthropic Claude Haiku (faster, cheaper)
const model3 = anthropic('claude-haiku-4-5-20251001');

// OpenAI GPT-5
const model4 = openai('gpt-5');

// OpenAI GPT-4o
const model5 = openai('gpt-4o');
```

### 3. Configure TypeScript

Ensure your `tsconfig.json` has these settings:

```json
{
  "compilerOptions": {
    "target": "ESNext",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "types": ["bun-types"],
    "strict": true
  }
}
```

## Your First Agent

### Basic Example

Create a file `agent.ts`:

```typescript
import { createDeepAgent } from 'ai-sdk-deep-agent';
import { anthropic } from '@ai-sdk/anthropic';

// Create the agent
const agent = createDeepAgent({
  model: anthropic('claude-sonnet-4-5-20250929'),
  systemPrompt: 'You are a helpful research assistant.',
});

// Run the agent
const result = await agent.generate({
  prompt: 'Research the benefits of TypeScript and write a summary to /summary.md',
  maxSteps: 10,
});

// Output the results
console.log('Response:', result.text);
console.log('Todos:', result.state.todos);
console.log('Files:', Object.keys(result.state.files));
```

Run it:

```bash
ANTHROPIC_API_KEY=your-key bun run agent.ts
```

### Streaming Example

For real-time feedback, use streaming:

```typescript
import { createDeepAgent } from 'ai-sdk-deep-agent';
import { anthropic } from '@ai-sdk/anthropic';

const agent = createDeepAgent({
  model: anthropic('claude-sonnet-4-5-20250929'),
  systemPrompt: 'You are a helpful assistant.',
});

// Stream with events
for await (const event of agent.streamWithEvents({
  messages: [{ role: 'user', content: 'Create a project plan' }],
})) {
  switch (event.type) {
    case 'text':
      process.stdout.write(event.text);
      break;
    case 'tool-call':
      console.log(`\n[Tool: ${event.toolName}]`);
      break;
    case 'todos-changed':
      console.log('\n[Todos updated]');
      break;
    case 'file-written':
      console.log(`\n[File: ${event.path}]`);
      break;
    case 'done':
      console.log('\n[Done]');
      break;
  }
}
```

## Understanding Core Concepts

### 1. Todos (Planning)

The `write_todos` tool enables task planning and tracking:

```typescript
// Agent automatically uses todos when you prompt it to plan
const result = await agent.generate({
  prompt: `
    Create a plan for building a todo app:
    1. Use write_todos to break down the task
    2. Work through each task systematically
    3. Update todo status as you progress
  `,
});

// Access todo state
result.state.todos.forEach(todo => {
  console.log(`[${todo.status}] ${todo.content}`);
});
```

**Todo Status Flow:**
- `pending` - Task not started
- `in_progress` - Currently working on (only one at a time)
- `completed` - Task finished
- `cancelled` - Task abandoned

### 2. Virtual Filesystem

Agents can read, write, and edit files in a virtual filesystem:

```typescript
const agent = createDeepAgent({
  model: anthropic('claude-sonnet-4-5-20250929'),
  systemPrompt: 'You are a coding assistant.',
});

const result = await agent.generate({
  prompt: 'Create a TypeScript file at /utils/math.ts with some utility functions',
});

// Access created files
for (const [path, file] of Object.entries(result.state.files)) {
  console.log(`File: ${path}`);
  console.log(file.content.join('\n'));
}
```

**Built-in Filesystem Tools:**
- `ls` - List files in a directory
- `read_file` - Read file contents
- `write_file` - Create a new file
- `edit_file` - Replace text in existing file
- `glob` - Find files matching pattern (e.g., `**/*.ts`)
- `grep` - Search text within files

### 3. Subagents (Task Delegation)

Spawn specialized agents for complex subtasks:

```typescript
import { createDeepAgent, type SubAgent } from 'ai-sdk-deep-agent';
import { anthropic } from '@ai-sdk/anthropic';

// Define a specialized research subagent
const researchSubagent: SubAgent = {
  name: 'researcher',
  description: 'Expert in research and data gathering',
  systemPrompt: 'You are a research specialist. Gather comprehensive information.',
};

const agent = createDeepAgent({
  model: anthropic('claude-sonnet-4-5-20250929'),
  subagents: [researchSubagent],
});

// Agent can now delegate tasks to the research subagent
const result = await agent.generate({
  prompt: 'Research AI safety and compile a report',
});
```

**Subagent Benefits:**
- **Context Isolation** - Prevents main agent context bloat
- **Parallel Execution** - Multiple subagents can run simultaneously
- **Shared Filesystem** - Subagents share files with parent
- **Independent History** - Separate conversation history per subagent

## Common Setup Patterns

### Pattern 1: With Filesystem Persistence

Store files on disk for persistence across sessions:

```typescript
import { createDeepAgent, FilesystemBackend } from 'ai-sdk-deep-agent';
import { anthropic } from '@ai-sdk/anthropic';

const agent = createDeepAgent({
  model: anthropic('claude-sonnet-4-5-20250929'),
  backend: new FilesystemBackend({ rootDir: './workspace' }),
});

const result = await agent.generate({
  prompt: 'Create a project and save files',
});

// Files are now on disk at ./workspace/
```

### Pattern 2: With Checkpointing (Session Persistence)

Resume conversations across sessions:

```typescript
import { createDeepAgent, FileSaver } from 'ai-sdk-deep-agent';
import { anthropic } from '@ai-sdk/anthropic';

const agent = createDeepAgent({
  model: anthropic('claude-sonnet-4-5-20250929'),
  checkpointer: new FileSaver({ dir: './.checkpoints' }),
});

const threadId = 'user-session-123';

// First session
for await (const event of agent.streamWithEvents({
  messages: [{ role: 'user', content: 'Create a plan' }],
  threadId,
})) {
  // ... handle events
  // Checkpoint automatically saved after each step
}

// Later: Resume the session
for await (const event of agent.streamWithEvents({
  messages: [{ role: 'user', content: 'Continue from where we left off' }],
  threadId, // Same threadId restores checkpoint
})) {
  // Agent has full context from previous session
}
```

### Pattern 3: With Custom Tools

Add your own tools alongside built-in ones:

```typescript
import { createDeepAgent } from 'ai-sdk-deep-agent';
import { anthropic } from '@ai-sdk/anthropic';
import { tool } from 'ai';
import { z } from 'zod';

// Define a custom tool
const weatherTool = tool({
  description: 'Get the current weather for a location',
  parameters: z.object({
    location: z.string().describe('City name'),
  }),
  execute: async ({ location }) => {
    // Fetch weather data
    return `Weather in ${location}: 72°F, sunny`;
  },
});

const agent = createDeepAgent({
  model: anthropic('claude-sonnet-4-5-20250929'),
  tools: {
    get_weather: weatherTool,
  },
});

const result = await agent.generate({
  prompt: 'What is the weather in San Francisco?',
});
```

### Pattern 4: With Command Execution (Sandbox)

Enable shell command execution:

```typescript
import { createDeepAgent, LocalSandbox } from 'ai-sdk-deep-agent';
import { anthropic } from '@ai-sdk/anthropic';

const agent = createDeepAgent({
  model: anthropic('claude-sonnet-4-5-20250929'),
  backend: new LocalSandbox({
    cwd: './workspace',
    timeout: 60000, // 60 second timeout
  }),
  // execute tool is automatically added when using LocalSandbox!
});

const result = await agent.generate({
  prompt: 'Create a package.json and run npm install',
});
```

### Pattern 5: With Web Search

Enable web research capabilities:

```bash
# Set Tavily API key in .env
TAVILY_API_KEY=tvly-your-key-here
```

```typescript
import { createDeepAgent } from 'ai-sdk-deep-agent';
import { anthropic } from '@ai-sdk/anthropic';

// Web tools automatically enabled when TAVILY_API_KEY is set
const agent = createDeepAgent({
  model: anthropic('claude-sonnet-4-5-20250929'),
});

const result = await agent.generate({
  prompt: 'Research the latest React 19 features and summarize them',
});
```

### Pattern 6: With Agent Memory

Give your agent persistent memory across conversations:

```typescript
import { createDeepAgent, createAgentMemoryMiddleware } from 'ai-sdk-deep-agent';
import { anthropic } from '@ai-sdk/anthropic';

const agent = createDeepAgent({
  model: anthropic('claude-sonnet-4-5-20250929'),
  agentId: 'my-coding-assistant',
  // Memory auto-loaded from:
  // - ~/.deepagents/my-coding-assistant/agent.md (user-level)
  // - .deepagents/agent.md (project-level, if in git repo)
});

// Agent can read and update its own memory
const result = await agent.generate({
  prompt: 'Remember that I prefer 2-space indentation',
});
```

**Memory File Format** (`~/.deepagents/my-coding-assistant/agent.md`):

```markdown
# My Coding Assistant

## User Preferences
- Prefers 2-space indentation
- Likes comprehensive JSDoc comments

## Working Style
- Ask clarifying questions before implementing
- Consider edge cases and error handling
```

### Pattern 7: Multi-Turn Conversations

Maintain conversation history across turns:

```typescript
import { createDeepAgent, type ModelMessage } from 'ai-sdk-deep-agent';
import { anthropic } from '@ai-sdk/anthropic';

const agent = createDeepAgent({
  model: anthropic('claude-sonnet-4-5-20250929'),
});

let messages: ModelMessage[] = [];

// First turn
for await (const event of agent.streamWithEvents({
  messages: [{ role: 'user', content: 'Create a file called hello.txt' }],
})) {
  if (event.type === 'done') {
    messages = event.messages || [];
  }
}

// Second turn - agent remembers the file
for await (const event of agent.streamWithEvents({
  messages: [
    ...messages,
    { role: 'user', content: 'What file did you just create?' }
  ],
})) {
  if (event.type === 'text') {
    process.stdout.write(event.text);
  }
}
```

## Troubleshooting

### Issue 1: "Cannot find module 'ai-sdk-deep-agent'"

**Problem:** TypeScript cannot resolve the module.

**Solution:** Ensure you're using Bun runtime:

```bash
# Run with Bun (not node or tsx)
bun run your-script.ts

# Not
node your-script.ts
# or
tsx your-script.ts
```

### Issue 2: "API Key Not Found"

**Problem:** The agent cannot find your API key.

**Solutions:**

1. **Check environment variable:**
```bash
echo $ANTHROPIC_API_KEY
```

2. **Create `.env` file:**
```bash
ANTHROPIC_API_KEY=sk-ant-your-key-here
```

3. **Load .env in your code:**
```typescript
// Bun auto-loads .env, but if you have issues:
import { config } from 'dotenv';
config();

const agent = createDeepAgent({
  model: anthropic('claude-sonnet-4-5-20250929', {
    apiKey: process.env.ANTHROPIC_API_KEY,
  }),
});
```

### Issue 3: "Model Not Found" or Invalid Model

**Problem:** Using string model IDs instead of provider instances.

**Solution:** Always use provider instances:

```typescript
// ❌ Wrong - string model IDs don't work
const agent = createDeepAgent({
  model: 'claude-sonnet-4-5-20250929',
});

// ✅ Correct - use provider instance
const agent = createDeepAgent({
  model: anthropic('claude-sonnet-4-5-20250929'),
});
```

### Issue 4: Files Not Persisting

**Problem:** Files created by agent disappear between runs.

**Solution:** Use a persistent backend:

```typescript
// Default: StateBackend (in-memory, ephemeral)
const agent1 = createDeepAgent({
  model: anthropic('claude-sonnet-4-5-20250929'),
  // Files lost after agent.generate() completes
});

// Persistent: FilesystemBackend (saved to disk)
const agent2 = createDeepAgent({
  model: anthropic('claude-sonnet-4-5-20250929'),
  backend: new FilesystemBackend({ rootDir: './workspace' }),
  // Files persist on disk
});
```

### Issue 5: Agent Not Using Tools

**Problem:** Agent ignores tools or doesn't use them as expected.

**Solutions:**

1. **Explicitly instruct the agent:**
```typescript
const result = await agent.generate({
  prompt: `
    Use the write_todos tool to create a plan, then work through each task.
    Use write_file to save your results.
  `,
});
```

2. **Include tools in system prompt:**
```typescript
const agent = createDeepAgent({
  model: anthropic('claude-sonnet-4-5-20250929'),
  systemPrompt: `
    You have access to these tools:
    - write_todos: Create and update task lists
    - write_file: Create files
    - read_file: Read file contents

    Always use write_todos before starting work.
  `,
});
```

### Issue 6: Conversation Context Lost

**Problem:** Agent doesn't remember previous messages in multi-turn conversations.

**Solution:** Always pass the messages array back:

```typescript
let messages: ModelMessage[] = [];

// First turn
for await (const event of agent.streamWithEvents({
  messages: [{ role: 'user', content: 'First message' }],
})) {
  if (event.type === 'done') {
    messages = event.messages || []; // ✅ Save messages
  }
}

// Second turn
for await (const event of agent.streamWithEvents({
  messages: messages, // ✅ Pass messages back
})) {
  // Agent has context
}
```

### Issue 7: Timeout Errors

**Problem:** Agent takes too long and times out.

**Solutions:**

1. **Increase max steps:**
```typescript
const result = await agent.generate({
  prompt: 'Complex task',
  maxSteps: 100, // Default is 100, increase if needed
});
```

2. **Use streaming for real-time feedback:**
```typescript
for await (const event of agent.streamWithEvents({
  prompt: 'Complex task',
})) {
  // See progress in real-time
}
```

3. **Optimize with prompt caching (Anthropic):**
```typescript
const agent = createDeepAgent({
  model: anthropic('claude-sonnet-4-5-20250929'),
  enablePromptCaching: true, // Faster subsequent calls
});
```

### Issue 8: Web Tools Not Working

**Problem:** `web_search` tool doesn't work.

**Solution:** Set `TAVILY_API_KEY`:

```bash
# Get key from https://tavily.com/
TAVILY_API_KEY=tvly-your-key-here
```

Without this key, web tools are gracefully disabled (other tools still work).

## Next Steps

### Learn More

- **[Architecture Documentation](./architecture.md)** - Deep dive into components and internals
- **[Common Patterns](./patterns.md)** - Advanced usage patterns and examples
- **[Checkpointers](./checkpointers.md)** - Session persistence in detail
- **[Agent Memory](./agent-memory.md)** - Long-term memory for agents

### Explore Examples

Check out the `/examples` directory for working code:

```bash
# Basic usage
bun run examples/basic.ts

# Streaming with events
bun run examples/streaming.ts

# Custom tools
bun run examples/with-custom-tools.ts

# Checkpointing
bun run examples/with-checkpointer.ts

# Subagents
bun run examples/with-subagents.ts

# Web research
bun run examples/web-research.ts

# And more...
```

### Try the CLI

Interactive CLI for quick prototyping:

```bash
# Start CLI
bunx ai-sdk-deep-agent

# Or with specific model
bunx ai-sdk-deep-agent --model anthropic/claude-sonnet-4-5-20250929

# CLI Commands
/help          # Show all commands
/todos         # Show todo list
/files         # List files
/read <path>   # Read a file
/clear         # Clear conversation
/model <name>  # Change model
/exit          # Exit CLI
```

### Performance Tips

1. **Use Claude Haiku for faster responses:**
```typescript
const model = anthropic('claude-haiku-4-5-20251001');
```

2. **Enable prompt caching for Anthropic:**
```typescript
const agent = createDeepAgent({
  model: anthropic('claude-sonnet-4-5-20250929'),
  enablePromptCaching: true,
});
```

3. **Set token limits for large tool results:**
```typescript
const agent = createDeepAgent({
  model: anthropic('claude-sonnet-4-5-20250929'),
  toolResultEvictionLimit: 20000, // Evict results > 20k tokens
});
```

4. **Use structured output for type-safe responses:**
```typescript
import { z } from 'zod';

const agent = createDeepAgent({
  model: anthropic('claude-sonnet-4-5-20250929'),
  output: {
    schema: z.object({
      summary: z.string(),
      keyPoints: z.array(z.string()),
    }),
  },
});

const result = await agent.generate({ prompt: '...' });
console.log(result.output?.summary); // Fully typed!
```

## Getting Help

- **GitHub Issues**: [Report bugs or request features](https://github.com/chrispangg/ai-sdk-deep-agent/issues)
- **Examples**: Check `/examples` directory for working code
- **Documentation**: See `/docs` folder for detailed guides
- **DeepWiki**: [Ask DeepWiki](https://deepwiki.com/chrispangg/ai-sdk-deepagent)

## Summary

You now have everything you need to build your first Deep Agent:

1. ✅ Installed the package with Bun
2. ✅ Configured API keys
3. ✅ Created your first agent
4. ✅ Understood core concepts (todos, files, subagents)
5. ✅ Implemented common patterns
6. ✅ Troubleshooting common issues

**Ready to build?** Start with the basic example, then explore more advanced patterns as you need them. Happy building!
