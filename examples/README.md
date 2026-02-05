# Deep Agent SDK Examples

This directory contains example code demonstrating various features of the Deep Agent SDK.

## Running Examples

All examples work with both **Node.js** and **Bun** runtimes.

### Prerequisites

1. **Set up API keys** in a `.env` file at the project root:

```bash
ANTHROPIC_API_KEY=sk-ant-your-key-here
# or
OPENAI_API_KEY=sk-your-key-here

# Optional: for web search tools
TAVILY_API_KEY=tvly-your-key-here
```

2. **Install dependencies:**

<details>
<summary>Using Node.js</summary>

```bash
# Install the package from npm
npm install deepagentsdk @ai-sdk/anthropic @ai-sdk/openai

# Install additional dependencies for examples
npm install dotenv express

# Install development tools
npm install --save-dev tsx typescript @types/node @types/express
```

</details>

<details>
<summary>Using Bun</summary>

```bash
# Install dependencies
bun install
```

</details>

### Running Examples

<details>
<summary><b>With Node.js</b></summary>

Use `tsx` to run TypeScript files directly:

```bash
# Quick start example
npx tsx examples/nodejs-quickstart.ts

# Streaming example
npx tsx examples/nodejs-streaming.ts

# Express API example
npx tsx examples/nodejs-express-api.ts

# Other examples
npx tsx examples/basic.ts
npx tsx examples/streaming.ts
npx tsx examples/with-custom-tools.ts
```

**Using ts-node (alternative):**

```bash
npx ts-node examples/basic.ts
```

</details>

<details>
<summary><b>With Bun</b></summary>

```bash
# Run any example directly
bun examples/basic.ts
bun examples/streaming.ts
bun examples/with-custom-tools.ts

# Node.js-specific examples also work
bun examples/nodejs-quickstart.ts
bun examples/nodejs-streaming.ts
```

</details>

## Example Files

### Core Examples

| File | Description | Node.js | Bun |
|------|-------------|---------|-----|
| [`nodejs-quickstart.ts`](./nodejs-quickstart.ts) | Quick start for Node.js users | ✅ | ✅ |
| [`nodejs-streaming.ts`](./nodejs-streaming.ts) | Streaming example for Node.js | ✅ | ✅ |
| [`nodejs-express-api.ts`](./nodejs-express-api.ts) | Express.js integration | ✅ | ✅ |
| [`basic.ts`](./basic.ts) | Basic agent usage | ✅ | ✅ |
| [`streaming.ts`](./streaming.ts) | Streaming responses | ✅ | ✅ |

### Advanced Examples

| File | Description | Node.js | Bun |
|------|-------------|---------|-----|
| [`with-custom-tools.ts`](./with-custom-tools.ts) | Adding custom tools | ✅ | ✅ |
| [`with-subagents.ts`](./with-subagents.ts) | Using subagents | ✅ | ✅ |
| [`with-checkpointer.ts`](./with-checkpointer.ts) | Session persistence | ✅ | ✅ |
| [`with-agent-memory.ts`](./with-agent-memory.ts) | Long-term memory | ✅ | ✅ |
| [`with-structured-output.ts`](./with-structured-output.ts) | Typed responses | ✅ | ✅ |
| [`with-middleware.ts`](./with-middleware.ts) | Custom middleware | ✅ | ✅ |
| [`web-research.ts`](./web-research.ts) | Web search tools | ✅ | ✅ |

### Sandbox & Execution

| File | Description | Node.js | Bun |
|------|-------------|---------|-----|
| [`with-local-sandbox.ts`](./with-local-sandbox.ts) | Local command execution | ✅ | ✅ |
| [`with-e2b-sandbox.ts`](./with-e2b-sandbox.ts) | E2B cloud sandbox | ✅ | ✅ |

### Integration Examples

| File | Description | Node.js | Bun |
|------|-------------|---------|-----|
| [`with-langfuse.ts`](./with-langfuse.ts) | Langfuse observability | ✅ | ✅ |
| [`with-provider-options.ts`](./with-provider-options.ts) | Provider configuration | ✅ | ✅ |

### Walkthrough Series

The `walkthrough/` directory contains a progressive tutorial:

1. `01-basic-agent.ts` - Your first agent
2. `02-streaming.ts` - Real-time responses
3. `03-todos.ts` - Task planning
4. `04-filesystem.ts` - File operations
5. `05-subagents.ts` - Task delegation
6. `06-filesystem-backend.ts` - Persistent storage
7. `07-checkpointing.ts` - Session persistence
8. `08-custom-tools.ts` - Custom tools
9. `09-multi-turn.ts` - Conversations
10. `10-state-backend.ts` - State management
11. `11-persistent-backend.ts` - Cross-session memory
12. `12-composite-backend.ts` - Multiple backends
13. `13-subagent-advanced.ts` - Advanced delegation
14. `14-memory-saver.ts` - In-memory checkpointing
15. `15-file-saver.ts` - File-based checkpointing
16. `16-kv-store-saver.ts` - Key-value checkpointing
17. `17-structured-output.ts` - Typed responses
18. `18-tool-eviction.ts` - Token management

Run them in order to learn progressively:

```bash
# Node.js
npx tsx examples/walkthrough/01-basic-agent.ts
npx tsx examples/walkthrough/02-streaming.ts
# ... and so on

# Bun
bun examples/walkthrough/01-basic-agent.ts
bun examples/walkthrough/02-streaming.ts
# ... and so on
```

## Node.js-Specific Tips

### 1. Environment Variables

Always load environment variables in Node.js:

```typescript
import 'dotenv/config';
```

Bun loads `.env` automatically, but Node.js requires `dotenv`.

### 2. File Paths

Use `path.join()` for cross-platform compatibility:

```typescript
import path from 'path';

const workspaceDir = path.join(process.cwd(), 'workspace');
```

### 3. Top-Level Await

Ensure `"type": "module"` is in your `package.json`:

```json
{
  "type": "module"
}
```

Or wrap your code:

```typescript
async function main() {
  // Your agent code here
}

main().catch(console.error);
```

### 4. Express Dependencies

For the Express example, install:

```bash
npm install express
npm install --save-dev @types/express
```

## Testing Examples

### Quick Test

Run the quickstart to verify your setup:

```bash
# Node.js
npx tsx examples/nodejs-quickstart.ts

# Bun
bun examples/nodejs-quickstart.ts
```

You should see:
- Agent creating a plan
- Todos being listed
- Success message

### API Test

Start the Express server:

```bash
npx tsx examples/nodejs-express-api.ts
```

In another terminal:

```bash
curl -X POST http://localhost:3000/api/agent \
  -H "Content-Type: application/json" \
  -d '{"prompt": "Create a plan for a TypeScript project"}'
```

### Streaming Test

Run the streaming example:

```bash
npx tsx examples/nodejs-streaming.ts
```

You should see text streaming in real-time.

## Troubleshooting

### "Cannot find module 'deepagentsdk'"

Make sure you've installed the package:

```bash
npm install deepagentsdk
```

### "API Key not found"

1. Create a `.env` file in the project root
2. Add your API key: `ANTHROPIC_API_KEY=sk-ant-...`
3. Make sure you have `import 'dotenv/config';` at the top

### "Top-level await" error

Add to your `package.json`:

```json
{
  "type": "module"
}
```

### Express types not found

Install the types:

```bash
npm install --save-dev @types/express @types/node
```

## Next Steps

1. **Read the full documentation**: See `/docs/NODEJS-USAGE.md`
2. **Explore the API**: Check out `/docs/site/handbook/`
3. **Build your own**: Start with `nodejs-quickstart.ts` and modify it
4. **Join the community**: Report issues or share your creations

## Additional Resources

- **Node.js Guide**: `/docs/NODEJS-USAGE.md` - Complete Node.js setup and patterns
- **Get Started**: `/docs/site/handbook/get-started/index.mdx` - Full tutorial
- **Architecture**: `/docs/site/handbook/reference/architecture.mdx` - How it works
- **Patterns**: `/docs/site/handbook/reference/patterns.mdx` - Best practices

## Questions?

- Open an issue: [GitHub Issues](https://github.com/chrispangg/deepagentsdk/issues)
- Check docs: [Documentation](https://deepagentsdk.dev)
- Ask DeepWiki: [DeepWiki](https://deepwiki.com/chrispangg/deepagentsdk)

Happy building! 🚀
