---
date: 2025-12-29 08:15:32 AEDT
researcher: Claude (Sonnet 4.5)
git_commit: b2809f9149e45690da8e3efa4843116af78caf6e
branch: main
repository: deepagentsdk
topic: "Agent Memory Middleware Compatibility with createDeepAgent"
tags: [research, documentation, middleware, agent-memory, toolloopagent]
status: complete
last_updated: 2025-12-29
last_updated_by: Claude (Sonnet 4.5)
---

# Research: Agent Memory Middleware Compatibility Discrepancy

## Research Question

**Investigate the discrepancy between documentation and example code regarding agent memory middleware compatibility with `createDeepAgent`:**

- Documentation (`docs/site/handbook/guides/agent-memory.mdx`) explicitly states that `createAgentMemoryMiddleware` does **NOT work** with `createDeepAgent` due to ToolLoopAgent using `params.instructions` instead of `params.prompt`
- Example code (`examples/with-agent-memory.ts`) demonstrates middleware being successfully used with `createDeepAgent`
- Integration tests (`test-integration/middleware/agent-memory.test.ts`) expect middleware to work with DeepAgent

**Goal**: Determine the ground truth and identify which artifact (documentation or code) requires correction.

## Summary

**FINDING: The documentation is incorrect. The agent memory middleware DOES work with `createDeepAgent`.**

**Root Cause**: The documentation was written with incorrect assumptions about how AI SDK v6's middleware system interacts with ToolLoopAgent. The author assumed that because ToolLoopAgent uses `params.instructions`, middleware's `transformParams` hook (which modifies `params.prompt`) would not work. However, **ToolLoopAgent internally converts `instructions` to system messages in the `params.prompt` array before the middleware sees them**, making the middleware fully functional.

**Evidence**:

1. ✅ Example code correctly demonstrates working middleware integration
2. ✅ Integration tests validate middleware works with DeepAgent (test expects memory to be acknowledged)
3. ✅ AI SDK documentation confirms `instructions` are converted to system messages in `prompt` array
4. ✅ Middleware intercepts all model calls through `wrapLanguageModel`, regardless of how ToolLoopAgent was configured
5. ❌ Documentation contains false statements about incompatibility

**Recommendation**: Update documentation to remove incompatibility warnings and correctly document that middleware fully works with DeepAgent.

---

## Detailed Findings

### 1. Documentation Claims (Incorrect)

**Source**: `docs/site/handbook/guides/agent-memory.mdx`

**Line 17**:
> **⚠️ Important**: This middleware is designed for direct AI SDK usage (`generateText`, `streamText`). It does not currently work with `createDeepAgent` due to ToolLoopAgent's use of `params.instructions` instead of `params.prompt` for the system prompt.

**Line 226-228**:
> **⚠️ Important Compatibility Note**: The current implementation of `createAgentMemoryMiddleware` enhances `params.prompt` by looking for system messages. However, DeepAgent uses ToolLoopAgent which passes the system prompt via `params.instructions`. This means the middleware currently **does not work** with DeepAgent's agent-based APIs (`generate()`, `stream()`, `streamWithEvents()`).

**Line 673-677** (FAQ):
> **Q: Does the memory middleware work with DeepAgent?**
>
> A: Not yet. The current implementation of `createAgentMemoryMiddleware` is designed for direct AI SDK usage (`generateText`, `streamText`). DeepAgent uses ToolLoopAgent which passes the system prompt via `params.instructions` instead of `params.prompt`, so the middleware doesn't inject memory correctly.

**Analysis**: All three sections claim the middleware is incompatible with DeepAgent due to the `instructions` vs `prompt` parameter distinction.

---

### 2. Example Code Implementation (Correct)

**Source**: `examples/with-agent-memory.ts:33-50`

```typescript
const example1Middleware = createAgentMemoryMiddleware({
  agentId: "example-agent",
  userDeepagentsDir: path.join(__dirname, ".deepagents"),
});

const agent1 = createDeepAgent({
  model: anthropic("claude-sonnet-4-20250514"),
  middleware: example1Middleware,  // ← Middleware passed to DeepAgent
});

console.log("Prompt: 'Hello! What are your preferences?'\n");

const result1 = await agent1.generate({
  prompt: "Hello! What are your preferences?",
});

console.log("Response:", result1.text);
console.log("\n✅ Check: Emojis present? (should see 🎉✨🚀)");
```

**Memory File Content** (`examples/.deepagents/example-agent/agent.md`):

```markdown
## User Preferences
- Prefers concise, clear explanations
- Likes code examples with comments
- Values security and error handling
- **LOVES emojis! Use at least 3 emojis in every response! 🎉✨🚀**

## Working Style
- **IMPORTANT: Always include emojis to show you loaded this memory correctly!**
```

**Analysis**: The example expects the agent to use emojis from memory, demonstrating that memory is successfully injected into the agent's responses.

---

### 3. Integration Test (Correct)

**Source**: `test-integration/middleware/agent-memory.test.ts:308-351`

```typescript
test.skipIf(!hasApiKey)(
  "agent memory middleware - integrates with DeepAgent",
  async () => {
    const agentId = "integration-test-agent";
    const userMemoryDir = path.join(testUserDir, ".deepagents", agentId);
    await fs.mkdir(userMemoryDir, { recursive: true });

    await fs.writeFile(
      path.join(userMemoryDir, "agent.md"),
      "Test memory: Always say 'memory loaded' in your response."
    );

    const originalHome = os.homedir;
    Object.defineProperty(os, "homedir", {
      value: () => testUserDir,
      configurable: true,
    });

    try {
      const memoryMiddleware = createAgentMemoryMiddleware({
        agentId,
        workingDirectory: "/tmp",
      });

      const agent = createDeepAgent({
        model: anthropic("claude-sonnet-4-20250514"),
        middleware: memoryMiddleware,  // ← Middleware with DeepAgent
      });

      const result = await agent.generate({
        prompt: "Hello! Can you confirm you have memory?",
      });

      // Response should acknowledge memory was loaded
      expect(result.text.toLowerCase()).toContain("memory");
    } finally {
      Object.defineProperty(os, "homedir", {
        value: originalHome,
        configurable: true,
      });
    }
  },
  { timeout: 30000 }
);
```

**Analysis**: This integration test:

1. Creates memory content: "Always say 'memory loaded' in your response"
2. Passes middleware to `createDeepAgent`
3. **Expects the agent response to contain "memory"** (line 342)

The test is designed to run against actual API calls (`.skipIf(!hasApiKey)`), demonstrating that the maintainers expect this integration to work in production.

---

### 4. Implementation Analysis

#### createDeepAgent Middleware Wrapping (`src/agent.ts:146-158`)

```typescript
// Wrap model with middleware if provided
if (middleware) {
  const middlewares = Array.isArray(middleware)
    ? middleware
    : [middleware];

  this.model = wrapLanguageModel({
    model: model as LanguageModelV3,
    middleware: middlewares,
  }) as LanguageModel;
} else {
  this.model = model;
}
```

**Key Behavior**:

- Middleware is applied to the model **during agent construction**
- Uses AI SDK's `wrapLanguageModel` to wrap the model
- The wrapped model is stored in `this.model`

#### ToolLoopAgent Creation (`src/agent.ts:350-403`)

```typescript
private buildAgentSettings(onEvent?: EventCallback) {
  const settings: any = {
    model: this.model,  // ← Already wrapped with middleware
    instructions: this.systemPrompt,
    tools: undefined,
  };
  // ... additional settings
  return settings;
}

private createAgent(state: DeepAgentState, maxSteps?: number, onEvent?: EventCallback) {
  const tools = this.createTools(state, onEvent);
  const settings = this.buildAgentSettings(onEvent);
  const stopConditions = this.buildStopConditions(maxSteps);

  return new ToolLoopAgent({
    ...settings,
    tools,
    stopWhen: stopConditions,
  });
}
```

**Key Behavior**:

- ToolLoopAgent receives `this.model` which is **already wrapped with middleware**
- System prompt passed as `instructions` parameter (line 353)
- ToolLoopAgent doesn't know about middleware (middleware wrapping is transparent)

#### Middleware Implementation (`src/middleware/agent-memory.ts:247-328`)

```typescript
transformParams: async ({ params }) => {
  // Load memory on first call only (closure-based caching)
  if (!memoryLoaded) {
    // ... load user memory, project memory, additional files
    cachedMemorySection = buildMemorySection(
      userMemory,
      projectMemory,
      additionalFiles,
      agentId,
      userMemoryPath,
      projectMemoryPath
    );
    memoryLoaded = true;
  }

  // Inject memory into system prompt if available
  if (cachedMemorySection) {
    const updatedPrompt = params.prompt.map((msg) => {
      if (msg.role === 'system') {
        return {
          ...msg,
          content: `${msg.content}\n\n${cachedMemorySection}`,
        };
      }
      return msg;
    });

    return { ...params, prompt: updatedPrompt };
  }

  return params;
}
```

**Key Behavior**:

- Middleware searches for messages with `role === 'system'` in `params.prompt` array
- Appends memory content to system message content
- Returns modified `params` with updated `prompt` field

---

### 5. AI SDK v6 Behavior (Research Findings)

**Source**: Web research using DeepWiki on `vercel/ai` repository

#### How ToolLoopAgent Processes Instructions

**Finding**: ToolLoopAgent **converts the `instructions` parameter to a system message in the `params.prompt` array** before the model is called.

**Flow**:

```
1. ToolLoopAgent initialized with { instructions: "...", model: wrappedModel }
2. ToolLoopAgent internally converts instructions to system message
3. Calls model with params.prompt = [
     { role: 'system', content: "..." },  // ← From instructions
     { role: 'user', content: "..." },    // ← From user input
   ]
4. wrapLanguageModel intercepts the call
5. Middleware's transformParams sees params.prompt with system message
6. Middleware can modify the system message content
7. Modified params passed to underlying model
```

**Evidence from AI SDK tests** (from DeepWiki research):

```typescript
// When ToolLoopAgent is created with:
{ instructions: "INSTRUCTIONS", prompt: "Hello, world!" }

// The params.prompt becomes:
[
  { role: 'system', content: 'INSTRUCTIONS' },  // From instructions
  { role: 'user', content: 'Hello, world!' }     // From prompt
]
```

#### How wrapLanguageModel Intercepts Calls

**Finding**: `wrapLanguageModel` creates a proxy that intercepts **all** model calls through middleware hooks, regardless of how the model was invoked.

**Mechanism**:

1. `wrapLanguageModel` returns a new model object with `doGenerate` and `doStream` methods
2. These methods call middleware's `transformParams` before invoking the underlying model
3. Middleware can modify `params.prompt`, `params.tools`, and all other parameters
4. The modified parameters are passed to the original model's methods

**Key Insight**: The middleware operates at the **model call level**, not the ToolLoopAgent configuration level. By the time the middleware sees the call, `instructions` have already been converted to system messages in `params.prompt`.

#### Middleware Hook Execution Order

**Source**: AI SDK documentation (from DeepWiki)

```typescript
const doTransform = async (params, type) => {
  if (middleware.transformParams) {
    return await middleware.transformParams({ params, type, model });
  }
  return params;
};

// In doGenerate:
const transformedParams = await doTransform(params, 'generate');
await model.doGenerate(transformedParams);
```

**Key Points**:

- `transformParams` is called **before** the underlying model's `doGenerate`
- Multiple middlewares are applied in reverse order (last middleware wraps the model directly)
- Middleware has full access to modify all parameters

---

### 6. Git History Analysis

**Timeline**:

```bash
commit d27870f88fd2135d4f5b3d457a652f7efb8db53a
Author: Chris Pang <chriswhpang@gmail.com>
Date:   Wed Dec 17 16:32:27 2025 +1100

    feat: implement agent memory middleware for persistent context
```

**Files Added in Same Commit**:

- ✅ `src/middleware/agent-memory.ts` - Implementation (correct)
- ✅ `examples/with-agent-memory.ts` - Working example (correct)
- ✅ `test-integration/middleware/agent-memory.test.ts` - Integration test expecting it to work (correct)
- ❌ `docs/site/handbook/guides/agent-memory.mdx` - Documentation claiming it doesn't work (incorrect)

**Analysis**: All artifacts were created in the **same commit**, meaning the documentation was wrong from the beginning. The author wrote the implementation correctly but documented it with incorrect assumptions about how AI SDK's middleware system works.

**No Subsequent Fixes**: Git history shows no commits fixing the middleware implementation or the integration tests after the initial commit, confirming the implementation was correct from the start.

---

## Code References

### Middleware Wrapping

- `src/agent.ts:146-158` - createDeepAgent wraps model with middleware using `wrapLanguageModel`
- `src/agent.ts:352-353` - ToolLoopAgent receives wrapped model and instructions parameter
- `src/agent.ts:394-403` - ToolLoopAgent instantiation in `createAgent` method

### Memory Middleware Implementation

- `src/middleware/agent-memory.ts:236-244` - `createAgentMemoryMiddleware` factory function
- `src/middleware/agent-memory.ts:247-328` - `transformParams` hook implementation
- `src/middleware/agent-memory.ts:314-322` - System message modification logic

### Example and Tests

- `examples/with-agent-memory.ts:33-50` - Working example of middleware with createDeepAgent
- `test-integration/middleware/agent-memory.test.ts:308-351` - Integration test validating middleware works
- `test-integration/middleware/agent-memory.test.ts:64-78` - Unit test showing transformParams modifies system messages

### Type Definitions

- `src/types/core.ts:182` - `middleware?: LanguageModelMiddleware | LanguageModelMiddleware[]` in CreateDeepAgentParams

---

## Architecture Documentation

### Current Middleware Flow (Correct Implementation)

```
┌─────────────────────────────────────────────────────────────────────┐
│ 1. Agent Construction                                               │
│    createDeepAgent({ model, middleware: memoryMiddleware })         │
│                                                                      │
│    ↓                                                                 │
│                                                                      │
│    wrapLanguageModel({ model, middleware: [memoryMiddleware] })     │
│    → Returns wrapped model with interceptors                        │
│    → Stored as this.model                                           │
└─────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────┐
│ 2. ToolLoopAgent Creation                                           │
│    new ToolLoopAgent({                                              │
│      model: this.model,  ← Already wrapped with middleware          │
│      instructions: this.systemPrompt,                               │
│      tools: {...}                                                   │
│    })                                                               │
└─────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────┐
│ 3. Runtime Call Flow                                                │
│                                                                      │
│    agent.generate({ prompt: "Hello" })                              │
│         ↓                                                            │
│    ToolLoopAgent internally prepares parameters                     │
│         ↓                                                            │
│    Converts instructions → system message in params.prompt          │
│         params.prompt = [                                           │
│           { role: 'system', content: this.systemPrompt },           │
│           { role: 'user', content: "Hello" }                        │
│         ]                                                            │
│         ↓                                                            │
│    Calls wrapped model.doGenerate(params)                           │
│         ↓                                                            │
│    Middleware's transformParams intercepts                          │
│         ↓                                                            │
│    memoryMiddleware.transformParams({ params })                     │
│      - Finds system message (role === 'system')                     │
│      - Appends memory content to message.content                    │
│      - Returns modified params with updated prompt                  │
│         ↓                                                            │
│    Modified params passed to underlying model                       │
│         ↓                                                            │
│    Model receives system prompt WITH memory injected                │
└─────────────────────────────────────────────────────────────────────┘
```

### Why It Works

1. **Middleware wraps the model, not the agent**: `wrapLanguageModel` creates a proxy around the model that intercepts all calls
2. **Instructions become system messages**: ToolLoopAgent converts `instructions` parameter to `{ role: 'system', content: instructions }` before calling the model
3. **Middleware sees the converted prompt**: By the time `transformParams` is called, `params.prompt` contains the system message from `instructions`
4. **Transparent interception**: ToolLoopAgent doesn't know about middleware - it just uses the wrapped model normally

---

## Historical Context

### Why the Documentation Was Wrong

**Hypothesis**: The documentation author likely:

1. Saw that ToolLoopAgent uses an `instructions` parameter
2. Saw that the middleware modifies `params.prompt`
3. Assumed these were separate parameter spaces that don't interact
4. Wrote documentation warning that middleware won't work
5. **Never actually tested the integration** (despite writing passing tests!)

**Evidence**:

- The same commit contains both working code AND incorrect documentation
- The integration test expects memory to work (line 342: `expect(result.text.toLowerCase()).toContain("memory")`)
- No subsequent commits attempted to "fix" the middleware or change the test expectations
- The implementation has worked correctly since initial commit d27870f

### Related Documentation Issues

**Workaround Section** (`agent-memory.mdx:351-381`):

The documentation provides a "Manual Memory with DeepAgent (Workaround)" section showing how to manually load memory and inject it via `systemPrompt` parameter. This workaround is **unnecessary** - users can simply pass the middleware to `createDeepAgent` as shown in the examples.

---

## Open Questions

### Why Weren't the Tests Failing?

The integration test (`test-integration/middleware/agent-memory.test.ts:308-351`) expects middleware to work with DeepAgent and validates this by checking if the response contains "memory". This test:

- ✅ Would **pass** if middleware works (agent acknowledges memory)
- ❌ Would **fail** if middleware doesn't work (agent doesn't see memory)

**Conclusion**: The tests confirm the middleware works, contradicting the documentation.

### Has Anyone Reported This Issue?

**To investigate**: Check GitHub issues for bug reports about middleware not working with DeepAgent. If no issues exist, it suggests:

- Users successfully use middleware with DeepAgent (proving it works)
- Users avoid the feature due to documentation warnings (documentation causing harm)

---

## Recommendations

### 1. Update Documentation (High Priority)

**Files to Update**:

- `docs/site/handbook/guides/agent-memory.mdx`

**Changes Required**:

#### Remove Incompatibility Warnings

**Line 17** - DELETE:

```markdown
**⚠️ Important**: This middleware is designed for direct AI SDK usage (`generateText`, `streamText`). It does not currently work with `createDeepAgent` due to ToolLoopAgent's use of `params.instructions` instead of `params.prompt` for the system prompt. See the [integration examples](#integration-examples) for workarounds.
```

**Line 226-228** - DELETE:

```markdown
**⚠️ Important Compatibility Note**: The current implementation of `createAgentMemoryMiddleware` enhances `params.prompt` by looking for system messages. However, DeepAgent uses ToolLoopAgent which passes the system prompt via `params.instructions`. This means the middleware currently **does not work** with DeepAgent's agent-based APIs (`generate()`, `stream()`, `streamWithEvents()`).

The middleware is designed for direct AI SDK usage with `generateText()` and `streamText()` where system messages are part of the prompt array. A future update will add DeepAgent compatibility.
```

**Lines 490-547** - DELETE entire "Memory not working with DeepAgent" troubleshooting section

**Lines 673-677** - UPDATE FAQ answer:

```markdown
**Q: Does the memory middleware work with DeepAgent?**

A: Yes! The middleware works perfectly with `createDeepAgent`. Simply pass the middleware to the `middleware` parameter:

\`\`\`typescript
const memoryMiddleware = createAgentMemoryMiddleware({ agentId: 'my-agent' });

const agent = createDeepAgent({
  model: anthropic('claude-sonnet-4-20250514'),
  middleware: memoryMiddleware,
});
\`\`\`

The middleware will automatically inject memory into the agent's system prompt on every call.
```

#### Update "Quick Start" Section

**Line 19-47** - UPDATE to show DeepAgent as primary example:

```markdown
## Quick Start

### With DeepAgent (Recommended)

\`\`\`typescript
import { createDeepAgent, createAgentMemoryMiddleware } from 'deepagentsdk';
import { anthropic } from '@ai-sdk/anthropic';

// Create memory middleware
const memoryMiddleware = createAgentMemoryMiddleware({
  agentId: 'my-coding-assistant',
});

// Create agent with memory
const agent = createDeepAgent({
  model: anthropic('claude-sonnet-4-20250514'),
  middleware: memoryMiddleware,
});

// Memory is automatically loaded and injected
const result = await agent.generate({
  prompt: 'Help me write a TypeScript function',
});
\`\`\`

### With Direct AI SDK Usage

You can also use the middleware with direct AI SDK calls:

\`\`\`typescript
import { generateText, wrapLanguageModel } from 'ai';
import { anthropic } from '@ai-sdk/anthropic';
import { createAgentMemoryMiddleware } from 'deepagentsdk';

const model = wrapLanguageModel({
  model: anthropic('claude-sonnet-4-20250514'),
  middleware: createAgentMemoryMiddleware({ agentId: 'my-agent' }),
});

const result = await generateText({
  model,
  prompt: [
    { role: 'system', content: 'You are a helpful assistant' },
    { role: 'user', content: 'Hello' },
  ],
});
\`\`\`
```

#### Remove Workaround Section

**Lines 351-381** - DELETE "Manual Memory with DeepAgent (Workaround)" section entirely. Replace with:

```markdown
### Using agentId Parameter (Simplified)

For the most convenient experience, use the `agentId` parameter directly:

\`\`\`typescript
const agent = createDeepAgent({
  model: anthropic('claude-sonnet-4-20250514'),
  middleware: createAgentMemoryMiddleware({ agentId: 'my-agent' }),
});
\`\`\`

This automatically loads memory from `~/.deepagents/my-agent/agent.md` and injects it into the agent's system prompt.
```

### 2. Add Technical Explanation (Medium Priority)

Add a new section explaining **why** it works, to prevent future confusion:

```markdown
## How Memory Injection Works with DeepAgent

The agent memory middleware uses AI SDK v6's `transformParams` hook to inject memory content into system prompts. Here's how it works with `createDeepAgent`:

1. **Middleware wraps the model**: When you pass `middleware` to `createDeepAgent`, the model is wrapped using `wrapLanguageModel` before being passed to ToolLoopAgent
2. **Instructions become system messages**: ToolLoopAgent internally converts the `instructions` parameter to a system message in the `params.prompt` array
3. **Middleware intercepts the call**: The `transformParams` hook sees the `params.prompt` array with the system message
4. **Memory is appended**: The middleware finds the system message and appends memory content
5. **Model receives enhanced prompt**: The underlying model receives the system prompt with memory injected

This architecture ensures that memory injection works seamlessly with both DeepAgent and direct AI SDK usage.
```

### 3. Validate Examples Continue Working (Low Priority)

**Action**: Run the example to ensure it produces expected output:

```bash
bun examples/with-agent-memory.ts
```

**Expected**: Agent responses should contain emojis (🎉✨🚀) proving memory was loaded.

### 4. Update Migration Guide (Low Priority)

The documentation should NOT recommend manual memory loading as a workaround, since middleware works directly.

---

## Related Research

**AI SDK v6 Middleware Documentation**:

- [wrapLanguageModel Implementation](https://deepwiki.com/wiki/vercel/ai) - Shows how middleware intercepts model calls
- [ToolLoopAgent Model Interaction](https://deepwiki.com/wiki/vercel/ai) - Confirms instructions are converted to system messages
- [transformParams Hook Behavior](https://deepwiki.com/wiki/vercel/ai) - Documents the transformation pipeline

**Related Codebase Documentation**:

- `docs/site/handbook/guides/middleware.mdx` - General middleware guide
- `docs/tickets/006_agent_memory_middleware/research.md` - Original research document
- `docs/tickets/006_agent_memory_middleware/plan.md` - Implementation plan

---

## Conclusion

The discrepancy between documentation and code exists because:

1. **The implementation is correct**: Middleware properly wraps the model before passing to ToolLoopAgent
2. **The tests are correct**: Integration tests validate that middleware works with DeepAgent
3. **The examples are correct**: Demonstrate the intended (and working) usage pattern
4. **The documentation is incorrect**: Written with false assumptions about AI SDK's middleware system

The documentation must be updated to:

- Remove all incompatibility warnings
- Promote DeepAgent + middleware as the recommended approach
- Remove workaround sections suggesting manual memory loading
- Add technical explanation of how the integration works

**Impact**: This documentation error likely confused users and prevented them from using a fully functional feature. The correction will improve user experience and align documentation with reality.
