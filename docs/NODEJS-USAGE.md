# Using Deep Agent SDK with Node.js

> **TL;DR**: The published npm package works perfectly with Node.js (18+). You only need Bun if you're developing/contributing to the library itself.

## Overview

While this project uses **Bun** for development (testing, building, CLI development), the **published npm package** is fully compatible with **Node.js** runtime. The library is transpiled to both CommonJS and ESM formats during the build process.

## Requirements

- **Node.js** >= 18.0.0 (LTS recommended)
- **npm**, **yarn**, or **pnpm** for package management
- API key for at least one AI provider (Anthropic, OpenAI, etc.)

## Installation

### Option 1: Using npm

```bash
# Create a new project
mkdir my-agent-project
cd my-agent-project
npm init -y

# Install the package
npm install deepagentsdk

# Install AI SDK providers
npm install @ai-sdk/anthropic @ai-sdk/openai
```

### Option 2: Using yarn

```bash
yarn add deepagentsdk @ai-sdk/anthropic @ai-sdk/openai
```

### Option 3: Using pnpm

```bash
pnpm add deepagentsdk @ai-sdk/anthropic @ai-sdk/openai
```

## TypeScript Configuration

Ensure your `tsconfig.json` has these settings for Node.js:

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "node",
    "esModuleInterop": true,
    "strict": true,
    "skipLibCheck": true,
    "resolveJsonModule": true
  }
}
```

## Quick Start with Node.js

### 1. Create Your First Agent

Create a file `agent.ts` (or `agent.js` for JavaScript):

```typescript
import { createDeepAgent } from 'deepagentsdk';
import { anthropic } from '@ai-sdk/anthropic';

// Create the agent
const agent = createDeepAgent({
  model: anthropic('claude-sonnet-4-5-20250929'),
  systemPrompt: 'You are a helpful research assistant.',
});

// Run the agent
const result = await agent.generate({
  prompt: 'Research the benefits of TypeScript and write a summary',
  maxSteps: 10,
});

// Output the results
console.log('Response:', result.text);
console.log('Todos:', result.state.todos);
console.log('Files:', Object.keys(result.state.files));
```

### 2. Set Up Environment Variables

Create a `.env` file:

```bash
ANTHROPIC_API_KEY=sk-ant-your-key-here
# or
OPENAI_API_KEY=sk-your-key-here
```

### 3. Load Environment Variables

Install `dotenv` to load environment variables:

```bash
npm install dotenv
```

Add this to the top of your file:

```typescript
import 'dotenv/config';
import { createDeepAgent } from 'deepagentsdk';
// ... rest of your code
```

### 4. Run Your Agent

#### TypeScript with ts-node

```bash
# Install ts-node
npm install --save-dev ts-node

# Run your agent
npx ts-node agent.ts
```

#### TypeScript with tsx (recommended)

```bash
# Install tsx
npm install --save-dev tsx

# Run your agent
npx tsx agent.ts
```

#### JavaScript (ESM)

Make sure your `package.json` has `"type": "module"`:

```json
{
  "type": "module"
}
```

Then run:

```bash
node agent.js
```

## Common Node.js Patterns

### Pattern 1: Using with Express.js

```typescript
import express from 'express';
import { createDeepAgent } from 'deepagentsdk';
import { anthropic } from '@ai-sdk/anthropic';

const app = express();
app.use(express.json());

const agent = createDeepAgent({
  model: anthropic('claude-sonnet-4-5-20250929'),
  systemPrompt: 'You are a helpful API assistant.',
});

app.post('/api/agent', async (req, res) => {
  try {
    const { prompt } = req.body;
    
    const result = await agent.generate({
      prompt,
      maxSteps: 10,
    });
    
    res.json({
      response: result.text,
      todos: result.state.todos,
      files: Object.keys(result.state.files),
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.listen(3000, () => {
  console.log('Agent API running on http://localhost:3000');
});
```

### Pattern 2: Streaming with Node.js

```typescript
import { createDeepAgent } from 'deepagentsdk';
import { anthropic } from '@ai-sdk/anthropic';

const agent = createDeepAgent({
  model: anthropic('claude-sonnet-4-5-20250929'),
});

async function runAgent() {
  for await (const event of agent.streamWithEvents({
    prompt: 'Create a project plan',
  })) {
    switch (event.type) {
      case 'text':
        process.stdout.write(event.text);
        break;
      case 'tool-call':
        console.log(`\n[Tool: ${event.toolName}]`);
        break;
      case 'file-written':
        console.log(`\n[File: ${event.path}]`);
        break;
      case 'done':
        console.log('\n[Done]');
        break;
    }
  }
}

runAgent();
```

### Pattern 3: With Filesystem Backend

```typescript
import { createDeepAgent, FilesystemBackend } from 'deepagentsdk';
import { anthropic } from '@ai-sdk/anthropic';
import path from 'path';

const agent = createDeepAgent({
  model: anthropic('claude-sonnet-4-5-20250929'),
  backend: new FilesystemBackend({ 
    rootDir: path.join(process.cwd(), 'workspace') 
  }),
});

const result = await agent.generate({
  prompt: 'Create a Node.js project with package.json',
});

console.log('Files created in ./workspace/');
```

### Pattern 4: Next.js API Route

```typescript
// app/api/agent/route.ts
import { createDeepAgent } from 'deepagentsdk';
import { anthropic } from '@ai-sdk/anthropic';
import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  const { prompt } = await request.json();
  
  const agent = createDeepAgent({
    model: anthropic('claude-sonnet-4-5-20250929'),
  });
  
  const result = await agent.generate({ prompt });
  
  return NextResponse.json({
    response: result.text,
    todos: result.state.todos,
  });
}
```

### Pattern 5: Streaming in Next.js

```typescript
// app/api/agent/stream/route.ts
import { createDeepAgent } from 'deepagentsdk';
import { anthropic } from '@ai-sdk/anthropic';

export async function POST(request: Request) {
  const { prompt } = await request.json();
  
  const agent = createDeepAgent({
    model: anthropic('claude-sonnet-4-5-20250929'),
  });
  
  const stream = new ReadableStream({
    async start(controller) {
      for await (const event of agent.streamWithEvents({ prompt })) {
        if (event.type === 'text') {
          controller.enqueue(
            new TextEncoder().encode(`data: ${JSON.stringify(event)}\n\n`)
          );
        }
      }
      controller.close();
    },
  });
  
  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    },
  });
}
```

## Package Scripts Setup

Add these scripts to your `package.json`:

```json
{
  "name": "my-agent-project",
  "type": "module",
  "scripts": {
    "dev": "tsx watch src/agent.ts",
    "start": "node dist/agent.js",
    "build": "tsc",
    "type-check": "tsc --noEmit"
  },
  "dependencies": {
    "deepagentsdk": "latest",
    "@ai-sdk/anthropic": "^3.0.9",
    "@ai-sdk/openai": "^3.0.7",
    "dotenv": "^16.4.5"
  },
  "devDependencies": {
    "@types/node": "^20.11.0",
    "tsx": "^4.7.0",
    "typescript": "^5.3.3"
  }
}
```

## CLI Usage with Node.js

The CLI tool uses Ink (React for terminal) which works best with Bun, but you can still use it with Node.js:

```bash
# Using npx
npx deepagentsdk

# Or install globally
npm install -g deepagentsdk
deep-agent
```

**Note:** If you encounter issues with the CLI on Node.js, consider using the programmatic API instead (recommended for Node.js users).

## Troubleshooting Node.js Specific Issues

### Issue: "Cannot find module 'deepagentsdk'"

**Solution 1:** Ensure you have the package installed:
```bash
npm list deepagentsdk
# If not installed:
npm install deepagentsdk
```

**Solution 2:** Check your `tsconfig.json` has correct module resolution:
```json
{
  "compilerOptions": {
    "moduleResolution": "node"
  }
}
```

### Issue: "Top-level await is not available"

**Solution:** Add `"type": "module"` to your `package.json`:
```json
{
  "type": "module"
}
```

Or wrap your code in an async function:
```typescript
async function main() {
  const agent = createDeepAgent({ /* ... */ });
  const result = await agent.generate({ /* ... */ });
  console.log(result);
}

main().catch(console.error);
```

### Issue: Environment variables not loading

**Solution:** Install and configure dotenv:
```bash
npm install dotenv
```

```typescript
import 'dotenv/config'; // At the top of your file
```

### Issue: TypeScript import errors

**Solution:** Use ESM imports consistently:
```typescript
// ✅ Correct
import { createDeepAgent } from 'deepagentsdk';

// ❌ Avoid
const { createDeepAgent } = require('deepagentsdk');
```

### Issue: Path resolution for FilesystemBackend

**Solution:** Use `path.join()` with `process.cwd()`:
```typescript
import path from 'path';

const backend = new FilesystemBackend({
  rootDir: path.join(process.cwd(), 'workspace')
});
```

## Feature Compatibility Matrix

| Feature | Node.js 18+ | Node.js 16 | Notes |
|---------|-------------|------------|-------|
| Core Agent | ✅ | ✅ | Fully compatible |
| Streaming | ✅ | ✅ | Works with async iterators |
| Filesystem Backend | ✅ | ✅ | Uses Node's `fs` module |
| Custom Tools | ✅ | ✅ | No limitations |
| Subagents | ✅ | ✅ | Fully supported |
| Checkpointing | ✅ | ✅ | File-based persistence |
| LocalSandbox | ✅ | ✅ | Uses Node's `child_process` |
| Web Tools | ✅ | ✅ | HTTP requests work fine |
| CLI | ⚠️ | ⚠️ | Works but Bun recommended |

✅ = Fully supported | ⚠️ = Works with caveats

## Performance Considerations

### Node.js vs Bun Performance

- **Bun**: Faster startup time, faster test execution
- **Node.js**: Mature ecosystem, better production stability

For production applications, **Node.js is the recommended choice** due to its maturity and extensive deployment experience.

### Optimization Tips for Node.js

1. **Use Node.js 18+ or 20 LTS** for best performance
2. **Enable HTTP/2** for AI provider connections
3. **Use streaming** for long-running operations
4. **Implement connection pooling** for multiple agents
5. **Consider Redis** for distributed checkpointing

## Testing with Node.js

### Using Vitest

```bash
npm install --save-dev vitest
```

```typescript
// agent.test.ts
import { describe, it, expect } from 'vitest';
import { createDeepAgent, StateBackend } from 'deepagentsdk';
import { anthropic } from '@ai-sdk/anthropic';

describe('Deep Agent', () => {
  it('should create todos', async () => {
    const agent = createDeepAgent({
      model: anthropic('claude-haiku-4-5-20251001'),
      backend: new StateBackend(),
    });
    
    const result = await agent.generate({
      prompt: 'Create a plan with 3 todos',
      maxSteps: 5,
    });
    
    expect(result.state.todos.length).toBeGreaterThan(0);
  });
});
```

### Using Jest

```bash
npm install --save-dev jest @types/jest ts-jest
```

```typescript
// agent.test.ts
import { createDeepAgent } from 'deepagentsdk';

describe('Deep Agent', () => {
  test('generates response', async () => {
    const agent = createDeepAgent({ /* ... */ });
    const result = await agent.generate({ prompt: 'Hello' });
    expect(result.text).toBeTruthy();
  });
});
```

## Docker Deployment

Create a `Dockerfile` for your Node.js agent:

```dockerfile
FROM node:20-alpine

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci --only=production

# Copy application code
COPY . .

# Build TypeScript
RUN npm run build

# Set environment variables
ENV NODE_ENV=production

# Run the agent
CMD ["node", "dist/agent.js"]
```

Build and run:

```bash
docker build -t my-agent .
docker run -e ANTHROPIC_API_KEY=your-key my-agent
```

## Production Deployment Checklist

- [ ] Use Node.js 18+ or 20 LTS
- [ ] Set `NODE_ENV=production`
- [ ] Use environment variables for API keys (never hardcode)
- [ ] Implement proper error handling
- [ ] Add logging (e.g., Winston, Pino)
- [ ] Use checkpointing for conversation persistence
- [ ] Implement rate limiting for agent endpoints
- [ ] Monitor token usage and costs
- [ ] Set up health checks
- [ ] Configure graceful shutdown

## Example Projects

### Minimal Node.js Project

```
my-agent/
├── package.json
├── tsconfig.json
├── .env
├── src/
│   └── agent.ts
└── README.md
```

### Full-Stack Next.js Project

```
next-agent-app/
├── package.json
├── .env.local
├── app/
│   ├── api/
│   │   └── agent/
│   │       ├── route.ts
│   │       └── stream/route.ts
│   └── page.tsx
└── lib/
    └── agent.ts
```

## Migration from Bun to Node.js

If you have existing code using Bun, here are the key changes:

### 1. Package Manager Commands

```bash
# Bun → Node.js
bun install    → npm install
bun add pkg    → npm install pkg
bun run script → npm run script
bunx command   → npx command
```

### 2. Script Execution

```bash
# Bun → Node.js
bun src/agent.ts     → npx tsx src/agent.ts
bun run examples.ts  → npx tsx examples.ts
```

### 3. Environment Variables

```typescript
// Bun (auto-loads .env)
const key = process.env.API_KEY;

// Node.js (needs dotenv)
import 'dotenv/config';
const key = process.env.API_KEY;
```

### 4. File Paths

```typescript
// Bun
const dir = './workspace';

// Node.js (more explicit)
import path from 'path';
const dir = path.join(process.cwd(), 'workspace');
```

## Summary

✅ **Deep Agent SDK works perfectly with Node.js!**

Key points:
- Install with `npm`, `yarn`, or `pnpm`
- Use `tsx` or `ts-node` to run TypeScript files
- Add `dotenv` for environment variables
- All core features are fully compatible
- Production-ready for Node.js deployments

**When to use Bun:**
- Contributing to the library (development/testing)
- Want faster script execution
- Building the library from source

**When to use Node.js:**
- Production applications (recommended)
- Existing Node.js projects
- Team familiarity with Node.js ecosystem
- Docker/Kubernetes deployments

## Getting Help

- **Issues**: [GitHub Issues](https://github.com/chrispangg/deepagentsdk/issues)
- **Examples**: Check `/examples` directory (run with `npx tsx`)
- **Discord**: [Join our community](https://discord.gg/your-invite)

## Next Steps

1. Follow the Quick Start guide above
2. Explore the [examples directory](../examples/)
3. Read the [full documentation](./site/handbook/get-started/index.mdx)
4. Build your first agent!

Happy building with Node.js! 🚀
