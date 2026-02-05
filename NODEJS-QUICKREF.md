# Node.js Quick Reference

> **TL;DR**: Deep Agent SDK works perfectly with Node.js 18+. Just use `npm` instead of `bun`.

## 30-Second Setup

```bash
# 1. Install
npm install deepagentsdk @ai-sdk/anthropic dotenv
npm install --save-dev tsx

# 2. Create .env
echo "ANTHROPIC_API_KEY=your-key-here" > .env

# 3. Create agent.ts
cat > agent.ts << 'EOF'
import 'dotenv/config';
import { createDeepAgent } from 'deepagentsdk';
import { anthropic } from '@ai-sdk/anthropic';

const agent = createDeepAgent({
  model: anthropic('claude-sonnet-4-5-20250929'),
});

const result = await agent.generate({
  prompt: 'Create a plan for a TypeScript project',
});

console.log(result.text);
EOF

# 4. Run
npx tsx agent.ts
```

## Quick Commands

| Task | Command |
|------|---------|
| Install package | `npm install deepagentsdk` |
| Install providers | `npm install @ai-sdk/anthropic @ai-sdk/openai` |
| Install TypeScript runner | `npm install --save-dev tsx` |
| Run TypeScript file | `npx tsx your-file.ts` |
| Run example | `npx tsx examples/basic.ts` |
| Install CLI globally | `npm install -g deepagentsdk` |
| Run CLI | `npx deepagentsdk` |

## Essential Code Snippets

### Import with Dotenv

```typescript
import 'dotenv/config'; // Load .env file (required for Node.js)
import { createDeepAgent } from 'deepagentsdk';
import { anthropic } from '@ai-sdk/anthropic';
```

### Create Agent

```typescript
const agent = createDeepAgent({
  model: anthropic('claude-sonnet-4-5-20250929'),
  systemPrompt: 'You are a helpful assistant.',
});
```

### Generate Response

```typescript
const result = await agent.generate({
  prompt: 'Your prompt here',
  maxSteps: 10,
});

console.log(result.text);
console.log(result.state.todos);
console.log(result.state.files);
```

### Stream Response

```typescript
for await (const event of agent.streamWithEvents({ prompt: '...' })) {
  if (event.type === 'text') {
    process.stdout.write(event.text);
  }
}
```

### Express API

```typescript
import express from 'express';

const app = express();
app.use(express.json());

app.post('/api/agent', async (req, res) => {
  const result = await agent.generate({ prompt: req.body.prompt });
  res.json({ response: result.text });
});

app.listen(3000);
```

## Package.json Setup

```json
{
  "type": "module",
  "scripts": {
    "dev": "tsx watch src/index.ts",
    "start": "node dist/index.js"
  },
  "dependencies": {
    "deepagentsdk": "latest",
    "@ai-sdk/anthropic": "^3.0.9",
    "dotenv": "^16.4.5"
  },
  "devDependencies": {
    "tsx": "^4.7.0",
    "typescript": "^5.3.3",
    "@types/node": "^20.11.0"
  }
}
```

## tsconfig.json

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "node",
    "esModuleInterop": true,
    "strict": true
  }
}
```

## Common Issues & Fixes

| Issue | Fix |
|-------|-----|
| Module not found | `npm install deepagentsdk` |
| API key not found | Add `import 'dotenv/config';` |
| Top-level await error | Add `"type": "module"` to package.json |
| TypeScript errors | Install `@types/node` |

## Feature Compatibility

| Feature | Node.js | Notes |
|---------|---------|-------|
| Core agent | ✅ | Fully compatible |
| Streaming | ✅ | Works perfectly |
| File operations | ✅ | Uses Node.js fs |
| Custom tools | ✅ | No limitations |
| Subagents | ✅ | Full support |
| Checkpointing | ✅ | File-based |
| LocalSandbox | ✅ | Uses child_process |
| CLI | ⚠️ | Works but slower |

## Resources

- **Complete Guide**: [/docs/NODEJS-USAGE.md](./docs/NODEJS-USAGE.md)
- **Examples**: [/examples/README.md](./examples/README.md)
- **Get Started**: [/docs/site/handbook/get-started/](./docs/site/handbook/get-started/index.mdx)
- **GitHub**: [Issues & Discussions](https://github.com/chrispangg/deepagentsdk)

## Next Steps

1. ✅ Install: `npm install deepagentsdk @ai-sdk/anthropic dotenv`
2. ✅ Create `.env` with your API key
3. ✅ Run: `npx tsx examples/nodejs-quickstart.ts`
4. ✅ Read: `/docs/NODEJS-USAGE.md` for production patterns
5. ✅ Build: Start with basic example and modify

**Node.js 18+** | **Production Ready** | **Full Feature Support**

---

Need help? Check [/docs/NODEJS-USAGE.md](./docs/NODEJS-USAGE.md) or open an issue.
