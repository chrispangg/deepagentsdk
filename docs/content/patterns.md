---
title: Common Patterns
description: Common usage patterns and code examples
---

This document contains common usage patterns and code examples for ai-sdk-deep-agent.

## Creating an Agent with Custom Backend

### FilesystemBackend

Persist files to disk for durability:

```typescript
import { anthropic } from '@ai-sdk/anthropic';
import { createDeepAgent, FilesystemBackend } from 'ai-sdk-deep-agent';

const agent = createDeepAgent({
  model: anthropic('claude-sonnet-4-20250514'),
  backend: new FilesystemBackend({ rootDir: './workspace' }),
});
```

### StateBackend (Default)

In-memory storage for ephemeral sessions:

```typescript
import { createDeepAgent, StateBackend } from 'ai-sdk-deep-agent';

const state = { todos: [], files: {} };
const agent = createDeepAgent({
  model: anthropic('claude-sonnet-4-20250514'),
  backend: new StateBackend(state),
});
```

### PersistentBackend

Cross-session persistence with a key-value store:

```typescript
import { PersistentBackend, InMemoryStore } from 'ai-sdk-deep-agent';

const store = new InMemoryStore();
const agent = createDeepAgent({
  model: anthropic('claude-sonnet-4-20250514'),
  backend: new PersistentBackend({ store, namespace: 'project-1' }),
});
```

## Using Different Providers

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

## Multi-Turn Conversation

### Using Messages Array

```typescript
let messages = [];

// First turn
for await (const event of agent.streamWithEvents({
  messages: [{ role: 'user', content: "First message" }],
})) {
  if (event.type === 'done') {
    messages = event.messages;
  }
}

// Next turn with context
for await (const event of agent.streamWithEvents({
  messages: [
    ...messages,
    { role: 'user', content: "Follow up question" }
  ],
})) {
  // Agent has full context from previous turns
}
```

### Using Checkpointers for Session Persistence

For production applications, use checkpointers to persist conversation state:

```typescript
import { FileSaver } from 'ai-sdk-deep-agent';

const agent = createDeepAgent({
  model: anthropic('claude-sonnet-4-20250514'),
  checkpointer: new FileSaver({ dir: './.checkpoints' }),
});

const threadId = 'user-session-123';

// First interaction - automatically saves checkpoint
for await (const event of agent.streamWithEvents({
  messages: [{ role: 'user', content: "Hello" }],
  threadId,
})) {
  if (event.type === 'checkpoint-saved') {
    console.log('Checkpoint saved');
  }
}

// Later session - automatically loads checkpoint
for await (const event of agent.streamWithEvents({
  messages: [{ role: 'user', content: "Follow up" }],
  threadId,
})) {
  if (event.type === 'checkpoint-loaded') {
    console.log('Restored previous session');
  }
}
```

## Adding Custom Subagents

Create specialized agents for task delegation:

```typescript
import { anthropic } from '@ai-sdk/anthropic';
import { createDeepAgent, type SubAgent } from 'ai-sdk-deep-agent';

const researchAgent: SubAgent = {
  name: 'research-agent',
  description: 'Specialized for deep research tasks',
  systemPrompt: 'You are a research specialist...',
  tools: { custom_tool: myTool },
  model: anthropic('claude-haiku-4-5-20251001'), // Optional: use different model
};

const agent = createDeepAgent({
  model: anthropic('claude-sonnet-4-20250514'),
  subagents: [researchAgent],
});
```

### Subagent with Selective Tools

Restrict which tools a subagent can access:

```typescript
import { createLsTool, createReadFileTool, write_todos } from 'ai-sdk-deep-agent';

const readonlyAgent: SubAgent = {
  name: 'reader',
  description: 'Read-only agent for file inspection',
  systemPrompt: 'You can only read files and list directories.',
  tools: [
    createLsTool,
    createReadFileTool,
    write_todos,
  ],
};
```

### Disable General-Purpose Subagent

Prevent the agent from delegating to a general-purpose subagent:

```typescript
const agent = createDeepAgent({
  model: anthropic('claude-sonnet-4-20250514'),
  includeGeneralPurposeAgent: false, // Only use defined subagents
  subagents: [researchAgent],
});
```

## Basic Usage Examples

### Simple Generation

```typescript
import { anthropic } from '@ai-sdk/anthropic';
import { createDeepAgent } from 'ai-sdk-deep-agent';

const agent = createDeepAgent({
  model: anthropic('claude-sonnet-4-20250514'),
});

const result = await agent.generate({
  prompt: "Create a plan for building a web app",
});

console.log(result.text);
console.log('State:', result.state); // Access todos and files
```

### Streaming with Events

```typescript
for await (const event of agent.streamWithEvents({
  prompt: "Build a todo app",
})) {
  switch (event.type) {
    case 'text':
      process.stdout.write(event.text);
      break;
    case 'tool-call':
      console.log(`\nUsing tool: ${event.toolName}`);
      break;
    case 'file-written':
      console.log(`\nWrote file: ${event.path}`);
      break;
    case 'done':
      console.log('\nComplete!');
      console.log('Messages:', event.messages);
      break;
  }
}
```

### With Custom Tools

```typescript
import { z } from 'zod';
import { tool } from 'ai';

const weatherTool = tool({
  description: 'Get weather for a location',
  parameters: z.object({
    location: z.string(),
  }),
  execute: async ({ location }) => {
    // Fetch weather data
    return { temp: 72, condition: 'sunny' };
  },
});

const agent = createDeepAgent({
  model: anthropic('claude-sonnet-4-20250514'),
  tools: {
    get_weather: weatherTool,
  },
});
```

## Advanced Patterns

### Backend Composition

Route files to different backends based on path prefix:

```typescript
import { FilesystemBackend, CompositeBackend, StateBackend } from 'ai-sdk-deep-agent';

const state = { todos: [], files: {} };

// Route files by path prefix
const backend = new CompositeBackend(
  new StateBackend(state), // Default: ephemeral storage
  {
    '/persistent/': new FilesystemBackend({ rootDir: './persistent' }), // Persistent files
    '/cache/': new StateBackend(state), // Cached files (ephemeral)
  }
);

const agent = createDeepAgent({
  model: anthropic('claude-sonnet-4-20250514'),
  backend,
});

// Files written to /persistent/ go to disk
// Files written elsewhere are in-memory
```

### Conditional Tool Approval

```typescript
const agent = createDeepAgent({
  model: anthropic('claude-sonnet-4-20250514'),
  interruptOn: {
    // Always require approval for execute
    execute: true,

    // Conditionally approve file writes
    write_file: {
      shouldApprove: (args) => {
        // Auto-approve writes to /tmp, require approval for others
        const filePath = (args as any).file_path;
        return !filePath?.startsWith('/tmp/');
      },
    },
  },
});

for await (const event of agent.streamWithEvents({
  prompt: "Create some files",
  onApprovalRequest: async (request) => {
    console.log(`Approve ${request.toolName} for ${JSON.stringify(request.args)}?`);
    // Implement your approval logic
    return true;
  },
})) {
  // Handle events
}
```

### Performance Optimization

```typescript
const agent = createDeepAgent({
  model: anthropic('claude-sonnet-4-20250514'),

  // Enable prompt caching (Anthropic only)
  enablePromptCaching: true,

  // Evict large tool results to filesystem
  toolResultEvictionLimit: 15000, // tokens

  // Auto-summarize long conversations
  summarization: {
    enabled: true,
    tokenThreshold: 150000, // tokens
    keepMessages: 8,
  },
});
```

### Custom Summarization Model

```typescript
import { anthropic } from '@ai-sdk/anthropic';

const agent = createDeepAgent({
  model: anthropic('claude-sonnet-4-20250514'),
  summarization: {
    enabled: true,
    model: anthropic('claude-haiku-4-5-20251001'), // Use faster model for summaries
  },
});
```

### Using Middleware

Add logging, telemetry, or custom behavior:

```typescript
import { wrapLanguageModel } from 'ai';

const loggingMiddleware = {
  wrapGenerate: async ({ doGenerate, params }) => {
    console.log('Model called with:', params.prompt);
    const result = await doGenerate();
    console.log('Model returned:', result.text);
    return result;
  },
};

const agent = createDeepAgent({
  model: anthropic('claude-sonnet-4-20250514'),
  middleware: [loggingMiddleware],
});
```

### Agent Memory Middleware

Load persistent agent-specific memory:

```typescript
import { createAgentMemoryMiddleware } from 'ai-sdk-deep-agent';

const agent = createDeepAgent({
  model: anthropic('claude-sonnet-4-20250514'),
  agentId: 'code-architect', // Loads ~/.deepagents/code-architect/agent.md
  middleware: [
    createAgentMemoryMiddleware({
      agentId: 'code-architect',
    }),
  ],
});
```

## Testing Patterns

When writing tests for code using ai-sdk-deep-agent:

```typescript
import { test, expect } from "bun:test";
import { createDeepAgent, StateBackend } from "ai-sdk-deep-agent";
import { anthropic } from "@ai-sdk/anthropic";

test("agent creates files", async () => {
  const backend = new StateBackend();
  const agent = createDeepAgent({
    model: anthropic('claude-sonnet-4-20250514'),
    backend,
  });

  await agent.generate({
    prompt: "Create a file called test.txt with 'hello'",
  });

  const files = await backend.ls('/');
  expect(files).toContain('test.txt');

  const content = await backend.read('/test.txt');
  expect(content).toContain('hello');
});
```

## Structured Output Pattern

### When to Use

Use structured output when you need:

- Type-safe agent responses
- Validated data format
- Consistent output structure
- Integration with typed systems

### Basic Pattern

```typescript
import { createDeepAgent } from 'ai-sdk-deep-agent';
import { anthropic } from '@ai-sdk/anthropic';
import { z } from 'zod';

const schema = z.object({
  field1: z.string(),
  field2: z.number(),
});

const agent = createDeepAgent({
  model: anthropic('claude-sonnet-4-20250514'),
  output: { schema },
});

const result = await agent.generate({ prompt: "..." });
// result.output is typed as { field1: string, field2: number }
```

### Advanced Patterns

#### Complex Nested Schemas

```typescript
const schema = z.object({
  summary: z.string(),
  details: z.array(z.object({
    title: z.string(),
    data: z.record(z.string(), z.unknown()),
  })),
  metadata: z.object({
    confidence: z.number(),
    sources: z.array(z.string()).optional(),
  }),
});
```

#### With Discriminated Unions

```typescript
const schema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('success'), data: z.string() }),
  z.object({ type: z.literal('error'), message: z.string() }),
]);
```

#### Combining with Other Features

```typescript
import { MemorySaver } from 'ai-sdk-deep-agent';

const agent = createDeepAgent({
  model: anthropic('claude-sonnet-4-20250514'),
  middleware: [loggingMiddleware],
  checkpointer: new MemorySaver(),
  output: { schema: mySchema },
});
```

### Subagent Structured Output

```typescript
const agent = createDeepAgent({
  model: anthropic('claude-sonnet-4-20250514'),
  subagents: [
    {
      name: 'researcher',
      description: 'Research specialist',
      systemPrompt: 'Conduct thorough research...',
      output: {
        schema: z.object({
          summary: z.string(),
          sources: z.array(z.string()),
          confidence: z.number(),
        }),
      },
    },
  ],
});

// Access structured output from events
for await (const event of agent.streamWithEvents({
  prompt: "Research AI safety",
})) {
  if (event.type === 'subagent-finish' && event.output) {
    console.log('Structured output:', event.output);
  }
}
```

### Streaming with Structured Output

```typescript
const agent = createDeepAgent({
  model: anthropic('claude-sonnet-4-20250514'),
  output: {
    schema: z.object({
      answer: z.string(),
      confidence: z.number(),
    }),
  },
});

for await (const event of agent.streamWithEvents({
  prompt: "What is the capital of France?",
})) {
  if (event.type === 'done' && event.output) {
    console.log('Answer:', event.output.answer);
    console.log('Confidence:', event.output.confidence);
  }
}
```

### Common Pitfalls

1. **Schema too strict**: LLMs may struggle with very specific constraints
2. **Missing descriptions**: Add `.describe()` to help LLM understand fields
3. **Optional vs Required**: Be explicit about what's optional

### Best Practices

1. **Start simple**: Use basic types, add complexity as needed
2. **Add descriptions**: Help the LLM understand the schema with `.describe()`
3. **Test validation**: Verify schema handles edge cases
4. **Type inference**: Let TypeScript infer types from schema

## Generation Options

Control sampling behavior and response characteristics:

```typescript
const agent = createDeepAgent({
  model: anthropic('claude-sonnet-4-20250514'),
  generationOptions: {
    temperature: 0.7,        // 0-2, higher = more creative
    topP: 0.9,              // Nucleus sampling
    maxOutputTokens: 4096,   // Limit response length
    presencePenalty: 0.5,    // -1 to 1, reduce repetition
    frequencyPenalty: 0.5,   // -1 to 1, reduce repetition
    seed: 42,                // For deterministic outputs
  },
});
```

## Advanced Loop Control

### Prepare Step Hook

Dynamically adjust settings before each step:

```typescript
const agent = createDeepAgent({
  model: anthropic('claude-sonnet-4-20250514'),
  loopControl: {
    prepareStep: async ({ stepNumber, model, messages }) => {
      // Use smaller model for later steps
      if (stepNumber > 5) {
        return {
          model: anthropic('claude-haiku-4-5-20251001'),
        };
      }
      return {};
    },
  },
});
```

### Custom Stop Conditions

```typescript
import { stepCountIs } from 'ai';

const agent = createDeepAgent({
  model: anthropic('claude-sonnet-4-20250514'),
  loopControl: {
    stopWhen: [
      stepCountIs(10), // Max 10 steps
      // Custom: stop when specific tool is called
      ({ toolCalls }) => {
        return toolCalls.some(tc => tc.toolName === 'finish_task');
      },
    ],
  },
});
```

### Step Finish Hook

React to completed steps:

```typescript
const agent = createDeepAgent({
  model: anthropic('claude-sonnet-4-20250514'),
  loopControl: {
    onStepFinish: async ({ toolCalls, toolResults }) => {
      console.log(`Step completed with ${toolCalls.length} tool calls`);
      // Log to analytics, update UI, etc.
    },
  },
});
```

## Sandbox Backend

Enable code execution with a sandbox backend:

```typescript
import { LocalSandbox } from 'ai-sdk-deep-agent';

const agent = createDeepAgent({
  model: anthropic('claude-sonnet-4-20250514'),
  backend: new LocalSandbox({
    rootDir: './sandbox',
    timeoutMs: 30000, // 30 second timeout
  }),
  // Now agent can use execute tool to run code
});
```

## Skills System

Load custom skills to extend agent capabilities:

```typescript
const agent = createDeepAgent({
  model: anthropic('claude-sonnet-4-20250514'),
  agentId: 'code-architect', // Loads skills from ~/.deepagents/code-architect/skills/
});

// Skills are automatically discovered and loaded
```

Or with a custom directory:

```typescript
const agent = createDeepAgent({
  model: anthropic('claude-sonnet-4-20250514'),
  skillsDir: './my-skills', // Deprecated: use agentId instead
});
```

## Provider-Specific Options

Pass options directly to the model provider:

```typescript
const agent = createDeepAgent({
  model: anthropic('claude-sonnet-4-20250514'),
  advancedOptions: {
    providerOptions: {
      anthropic: {
        headers: {
          'anthropic-beta': 'max-tokens-3-5-2024-01-01',
        },
      },
    },
  },
});
```

## OpenTelemetry Integration

Enable telemetry for observability:

```typescript
const agent = createDeepAgent({
  model: anthropic('claude-sonnet-4-20250514'),
  advancedOptions: {
    experimental_telemetry: {
      isEnabled: true,
      functionId: 'my-agent',
    },
  },
});
```

## See Also

- [Architecture Documentation](./architecture.md) - Core components and systems
- [Checkpointer Documentation](./checkpointers.md) - Session persistence patterns
- [Publishing Guide](https://github.com/chrispangg/ai-sdk-deep-agent/blob/main/.github/PUBLISHING.md) - Release and deployment
