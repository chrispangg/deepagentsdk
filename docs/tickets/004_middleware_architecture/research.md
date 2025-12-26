---
title: 004 Middleware Architecture
date: 2025-12-15 08:18:07 AEDT
researcher: Claude Code
git_commit: ea8a5d7fdcf9a014298385c4fac47acb69d81155
branch: main
repository: ai-sdk-deep-agent
topic: Middleware Architecture Implementation for Deep Agents
tags: [research, middleware, architecture, ai-sdk-v6, langchain, deep-agents]
status: complete
last_updated: 2025-12-15
last_updated_by: Claude Code
---

## Research Question

**How should middleware architecture be implemented in ai-sdk-deep-agent to enable composable hooks for model wrapping, tool call transformation, and message processing?**

This research investigates:

1. Reference implementations in `.refs/deepagentsjs/` (TypeScript/LangChain.js) and `.refs/deepagents/` (Python/LangChain)
2. Core middleware types: `wrapModel`, `wrapToolCall`, `transformMessages`
3. Integration patterns with AI SDK v6's Agent class (formerly ToolLoopAgent)
4. Concrete use cases: logging, retry logic, Agent Memory, Skills System
5. API design considerations for backwards-compatible implementation

## Executive Summary

**Key Finding**: AI SDK v6 already provides robust middleware support via `wrapLanguageModel()` with three primary hooks (`transformParams`, `wrapGenerate`, `wrapStream`). The Agent class also offers extension points (`prepareStep`, `stopWhen`, lifecycle callbacks) that complement model-level middleware.

**Recommended Approach**:

- **Phase 1 (Non-breaking)**: Add optional `middleware` parameter to `DeepAgentConfig` that wraps the model internally
- **Phase 2**: Implement agent-level middleware using `prepareStep` for dynamic tool/model selection
- **Phase 3**: Build Skills System and Agent Memory as middleware plugins

**Impact**: Enables production-ready features (logging, monitoring, retry logic) and unlocks Skills System and Agent Memory without breaking existing APIs.

---

## Detailed Findings

### 1. LangChain Middleware Architecture (Reference Implementations)

#### 1.1 Middleware Protocol/Interface

**LangChain.js** (`.refs/deepagentsjs/src/middleware/`)

The middleware system uses LangChain's `createMiddleware()` factory with lifecycle hooks:

```typescript
interface AgentMiddleware {
  name: string;
  tools?: StructuredTool[];              // Additional tools to register
  stateSchema?: ZodSchema;                // State schema with reducers
  beforeAgent?: (state) => StateUpdate;   // Pre-process state
  wrapModelCall?: (request, handler) => ModelResponse;  // Intercept LLM calls
  wrapToolCall?: (request, handler) => ToolMessage | Command;  // Intercept tool execution
}
```

**Key Files**:

- `.refs/deepagentsjs/src/middleware/index.ts` - Middleware exports
- `.refs/deepagentsjs/src/middleware/fs.ts` (567 lines) - Filesystem middleware with 6 tools
- `.refs/deepagentsjs/src/middleware/subagents.ts` (480 lines) - Subagent delegation via `task` tool
- `.refs/deepagentsjs/src/middleware/patch_tool_calls.ts` (83 lines) - Fixes dangling tool calls

**LangChain Python** (`.refs/deepagents/libs/deepagents/deepagents/middleware/`)

```python
class AgentMiddleware:
    state_schema: AgentState                    # State extension
    tools: list[BaseTool]                       # Additional tools

    def before_agent(self, state, runtime) -> dict | None:
        """Pre-process state before agent execution"""

    def wrap_model_call(self, request, handler) -> ModelResponse:
        """Sync hook: Intercept model calls"""

    async def awrap_model_call(self, request, handler) -> ModelResponse:
        """Async hook: Intercept model calls"""

    def wrap_tool_call(self, request, handler) -> ToolMessage | Command:
        """Sync hook: Intercept tool execution"""

    async def awrap_tool_call(self, request, handler) -> ToolMessage | Command:
        """Async hook: Intercept tool execution"""
```

**Key Files**:

- `.refs/deepagents/libs/deepagents/deepagents/middleware/__init__.py` - Middleware exports
- `.refs/deepagents/libs/deepagents/deepagents/middleware/filesystem.py` (1089 lines) - FilesystemMiddleware class
- `.refs/deepagents/libs/deepagents/deepagents/middleware/subagents.py` (485 lines) - SubAgentMiddleware class
- `.refs/deepagents/libs/deepagents/deepagents/middleware/patch_tool_calls.py` (45 lines) - PatchToolCallsMiddleware

#### 1.2 Filesystem Middleware Deep Dive

**Purpose**: Provides virtual filesystem with 7 tools: `ls`, `read_file`, `write_file`, `edit_file`, `glob`, `grep`, `execute`

**Key Features**:

1. **Backend Abstraction**: Works with StateBackend, FilesystemBackend, CompositeBackend
2. **Large Result Eviction**: Auto-saves results > 20k tokens to `/large_tool_results/`
3. **State Management**: Custom reducer for file merging with deletion support (null values)
4. **System Prompt Injection**: Appends filesystem instructions via `wrapModelCall`
5. **Dynamic Tool Filtering**: Removes `execute` tool if backend doesn't support it

**Implementation Pattern** (TypeScript):

```typescript
// .refs/deepagentsjs/src/middleware/fs.ts:413-567
export function createFilesystemMiddleware(options: {
  backend?: BackendProtocol | BackendFactory;
  systemPrompt?: string | null;
  customToolDescriptions?: Record<string, string> | null;
  toolTokenLimitBeforeEvict?: number | null;  // Default: 20000 tokens
}) {
  const systemPrompt = options.systemPrompt || FILESYSTEM_SYSTEM_PROMPT;

  // Create all 6 tools with backend closure
  const tools = [
    createLsTool(backend),
    createReadFileTool(backend),
    createWriteFileTool(backend),
    createEditFileTool(backend),
    createGlobTool(backend),
    createGrepTool(backend),
  ];

  // State schema with custom reducer
  const FilesystemStateSchema = z3.object({
    files: withLangGraph(z3.record(z3.string(), FileDataSchema).default({}), {
      reducer: {
        fn: fileDataReducer,  // Supports deletions via null values
        schema: z3.record(z3.string(), FileDataSchema.nullable()),
      },
    }),
  });

  return createMiddleware({
    name: "FilesystemMiddleware",
    stateSchema: FilesystemStateSchema,
    tools,

    // Hook 1: Inject system prompt
    wrapModelCall: async (request, handler) => {
      const newSystemPrompt = currentSystemPrompt
        ? `${currentSystemPrompt}\n\n${systemPrompt}`
        : systemPrompt;
      return handler({ ...request, systemPrompt: newSystemPrompt });
    },

    // Hook 2: Evict large tool results
    wrapToolCall: async (request, handler) => {
      const result = await handler(request);

      if (result.content.length > toolTokenLimitBeforeEvict * 4) {
        const evictPath = `/large_tool_results/${sanitizedId}`;
        await backend.write(evictPath, result.content);

        return new Command({
          update: {
            files: { [evictPath]: fileData },
            messages: [new ToolMessage({
              content: `Result too large. Saved to ${evictPath}`,
              tool_call_id: result.tool_call_id,
            })],
          },
        });
      }

      return result;
    },
  });
}
```

**Python Equivalent** (`.refs/deepagents/libs/deepagents/deepagents/middleware/filesystem.py:801-1089`):

- Uses class-based approach: `FilesystemMiddleware(AgentMiddleware)`
- Provides both sync and async hooks: `wrap_model_call`, `awrap_model_call`, `wrap_tool_call`, `awrap_tool_call`
- Identical logic for tool generation, backend resolution, and result eviction

#### 1.3 Subagent Middleware Deep Dive

**Purpose**: Enables spawning ephemeral subagents for isolated, complex tasks via `task` tool

**Key Features**:

1. **Subagent Registry**: Define custom agents with name, description, system prompt, tools, middleware
2. **General-Purpose Agent**: Optional default agent for miscellaneous tasks
3. **State Isolation**: Subagents receive filtered state (excludes `messages`, `todos`, `jumpTo`)
4. **State Sharing**: Filesystem and custom state fields shared with parent
5. **Middleware Composition**: Subagents have their own middleware stacks
6. **Result Extraction**: Returns only final message from subagent

**Implementation Pattern** (TypeScript):

```typescript
// .refs/deepagentsjs/src/middleware/subagents.ts:438-480
export function createSubAgentMiddleware(options: {
  defaultModel: LanguageModelLike;
  defaultTools?: StructuredTool[];
  defaultMiddleware?: AgentMiddleware[] | null;  // Applied to ALL subagents
  defaultInterruptOn?: Record<string, boolean | InterruptOnConfig> | null;
  subagents?: (SubAgent | CompiledSubAgent)[];
  systemPrompt?: string | null;
  generalPurposeAgent?: boolean;
  taskDescription?: string | null;
}) {
  const taskTool = createTaskTool({
    ...options,
    // createTaskTool compiles subagent registry
  });

  return createMiddleware({
    name: "subAgentMiddleware",
    tools: [taskTool],

    wrapModelCall: async (request, handler) => {
      if (systemPrompt !== null) {
        const newPrompt = currentPrompt
          ? `${currentPrompt}\n\n${systemPrompt}`
          : systemPrompt;
        return handler({ ...request, systemPrompt: newPrompt });
      }
      return handler(request);
    },
  });
}

// Subagent creation with middleware composition
function getSubagents(options) {
  for (const agentParams of options.subagents) {
    // Compose middleware: default + custom
    const middleware = agentParams.middleware
      ? [...defaultMiddleware, ...agentParams.middleware]
      : [...defaultMiddleware];

    // Add interrupt middleware if needed
    if (interruptOn) {
      middleware.push(humanInTheLoopMiddleware({ interruptOn }));
    }

    // Create subagent with composed middleware
    agents[agentParams.name] = createAgent({
      model: agentParams.model ?? defaultModel,
      systemPrompt: agentParams.systemPrompt,
      tools: agentParams.tools ?? defaultTools,
      middleware,  // <-- Composed middleware array
    });
  }
}
```

**State Filtering Pattern**:

```typescript
// .refs/deepagentsjs/src/middleware/subagents.ts:208-243
const EXCLUDED_STATE_KEYS = ["messages", "todos", "jumpTo"];

function filterStateForSubagent(state: Record<string, unknown>) {
  const filtered: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(state)) {
    if (!EXCLUDED_STATE_KEYS.includes(key)) {
      filtered[key] = value;  // Files, custom state
    }
  }
  return filtered;
}

function returnCommandWithStateUpdate(result, toolCallId) {
  const stateUpdate = filterStateForSubagent(result);  // Filter again
  const lastMessage = result.messages[result.messages.length - 1];

  return new Command({
    update: {
      ...stateUpdate,  // Files, custom state
      messages: [
        new ToolMessage({
          content: lastMessage.content,
          tool_call_id: toolCallId,
          name: "task",
        }),
      ],
    },
  });
}
```

#### 1.4 Patch Tool Calls Middleware

**Purpose**: Fixes "dangling tool calls" - when AI message contains `tool_calls` but subsequent messages don't include corresponding `ToolMessage` responses

**Implementation** (TypeScript):

```typescript
// .refs/deepagentsjs/src/middleware/patch_tool_calls.ts:30-82
export function createPatchToolCallsMiddleware(): AgentMiddleware {
  return createMiddleware({
    name: "patchToolCallsMiddleware",

    beforeAgent: async (state) => {
      const messages = state.messages;
      const patchedMessages: any[] = [];

      for (let i = 0; i < messages.length; i++) {
        const msg = messages[i];
        patchedMessages.push(msg);

        // Check AI messages with tool calls
        if (AIMessage.isInstance(msg) && msg.tool_calls != null) {
          for (const toolCall of msg.tool_calls) {
            // Look for corresponding ToolMessage
            const correspondingToolMsg = messages
              .slice(i)
              .find(m =>
                ToolMessage.isInstance(m) &&
                m.tool_call_id === toolCall.id
              );

            // Inject cancellation message if missing
            if (!correspondingToolMsg) {
              patchedMessages.push(
                new ToolMessage({
                  content: `Tool call ${toolCall.name} was cancelled`,
                  name: toolCall.name,
                  tool_call_id: toolCall.id,
                })
              );
            }
          }
        }
      }

      // Replace entire history
      return {
        messages: [
          new RemoveMessage({ id: REMOVE_ALL_MESSAGES }),
          ...patchedMessages,
        ],
      };
    },
  });
}
```

**Python Equivalent** (`.refs/deepagents/libs/deepagents/deepagents/middleware/patch_tool_calls.py:11-44`):

- Uses `Overwrite` wrapper instead of `RemoveMessage` to replace messages
- Identical logic for detecting and patching dangling tool calls

#### 1.5 Skills Middleware (CLI Extension)

**Purpose**: Implements progressive disclosure pattern for agent skills

**Pattern**:

1. Parse YAML frontmatter from SKILL.md files at session start
2. Inject skills metadata (name + description) into system prompt
3. Agent reads full SKILL.md content when relevant to a task

**Implementation** (Python):

```python
# .refs/deepagents/libs/deepagents-cli/deepagents_cli/skills/middleware.py:102-241
class SkillsMiddleware(AgentMiddleware):
    state_schema = SkillsState  # Adds skills_metadata to state

    def before_agent(self, state, runtime):
        """Load skills metadata before agent execution."""
        skills = list_skills(
            user_skills_dir=self.skills_dir,
            project_skills_dir=self.project_skills_dir,
        )
        return SkillsStateUpdate(skills_metadata=skills)

    def wrap_model_call(self, request, handler):
        """Inject skills documentation into system prompt."""
        skills_metadata = request.state.get("skills_metadata", [])

        # Format skills list
        skills_section = f"""
**User Skills:**
- **skill-name**: description
  → Read `path/to/SKILL.md` for full instructions
        """

        system_prompt = request.system_prompt + "\n\n" + skills_section
        return handler(request.override(system_prompt=system_prompt))
```

**Progressive Disclosure Benefits**:

- Reduces token usage by not loading all skill content upfront
- Agent has context to decide which skills are relevant
- Skills can be updated without restarting agent session

---

### 2. Middleware Composition and Ordering

#### 2.1 Standard Middleware Stack

**JavaScript** (`.refs/deepagentsjs/src/agent.ts:121-174`):

```typescript
const middleware: AgentMiddleware[] = [
  // 1. TodoListMiddleware - innermost for model calls
  todoListMiddleware(),

  // 2. FilesystemMiddleware - adds filesystem tools
  createFilesystemMiddleware({ backend: filesystemBackend }),

  // 3. SubAgentMiddleware - adds task tool with nested middleware
  createSubAgentMiddleware({
    defaultModel: model,
    defaultTools: tools,
    defaultMiddleware: [  // Applied to ALL subagents
      todoListMiddleware(),
      createFilesystemMiddleware({ backend: filesystemBackend }),
      summarizationMiddleware({ model, trigger: { tokens: 170_000 } }),
      anthropicPromptCachingMiddleware({ unsupportedModelBehavior: "ignore" }),
      createPatchToolCallsMiddleware(),
    ],
    subagents,
  }),

  // 4. SummarizationMiddleware - auto-compress when > 170k tokens
  summarizationMiddleware({ model, trigger: { tokens: 170_000 } }),

  // 5. AnthropicPromptCachingMiddleware - add cache breakpoints
  anthropicPromptCachingMiddleware({ unsupportedModelBehavior: "ignore" }),

  // 6. PatchToolCallsMiddleware - fix dangling tool calls
  createPatchToolCallsMiddleware(),
];

// 7. HumanInTheLoopMiddleware - conditionally added
if (interruptOn) {
  middleware.push(humanInTheLoopMiddleware({ interruptOn }));
}

// 8. Custom middleware - always appended last
middleware.push(...customMiddleware);
```

**Python** (`.refs/deepagents/libs/deepagents/deepagents/graph.py:113-147`) - Identical ordering

#### 2.2 Execution Flow

**Model Call Flow**:

```
User Input
  ↓
[PatchToolCallsMiddleware.beforeAgent] → Fix dangling tool calls
  ↓
[Custom Middleware.wrapModelCall] (outermost wrapper)
  ↓
[HITL Middleware.wrapModelCall]
  ↓
[Caching Middleware.wrapModelCall]
  ↓
[Summarization Middleware.wrapModelCall]
  ↓
[SubAgent Middleware.wrapModelCall] → Inject task instructions
  ↓
[Filesystem Middleware.wrapModelCall] → Inject filesystem instructions, filter tools
  ↓
[Todo Middleware.wrapModelCall] → Inject todo instructions
  ↓
ACTUAL MODEL CALL (with merged tools and composed system prompt)
  ↓
Response propagates back through chain
```

**Tool Execution Flow**:

```
Tool Call
  ↓
[Custom Middleware.wrapToolCall] (outermost)
  ↓
[HITL Middleware.wrapToolCall]
  ↓
[Filesystem Middleware.wrapToolCall] → Check result size
  ↓
ACTUAL TOOL EXECUTION
  ↓
[Filesystem Middleware] → Evict if > 20k tokens
  ↓
[Filesystem Reducer] → Merge file updates into state
  ↓
ToolMessage or Command returned
```

**Key Insight**: Middleware wraps in **reverse order** for hooks (last middleware wraps first), but `beforeAgent` runs in **forward order**.

---

### 3. AI SDK v6 Middleware Capabilities

#### 3.1 Model-Level Middleware (`wrapLanguageModel`)

**Core API**:

```typescript
import { wrapLanguageModel } from 'ai';

const wrappedModel = wrapLanguageModel({
  model: anthropic('claude-sonnet-4.5'),
  middleware: {
    // Hook 1: Transform parameters before model call
    transformParams: async ({ params, context }) => {
      console.log('Original params:', params);
      return {
        ...params,
        temperature: params.temperature * 0.9,  // Adjust temperature
        headers: { 'X-Custom-Header': 'value' },
      };
    },

    // Hook 2: Wrap non-streaming generation
    wrapGenerate: async ({ doGenerate, params, context }) => {
      const startTime = Date.now();
      const result = await doGenerate();
      const duration = Date.now() - startTime;

      console.log('Generation completed:', { duration, tokens: result.usage });
      return result;
    },

    // Hook 3: Wrap streaming generation
    wrapStream: async ({ doStream, params, context }) => {
      const { stream, ...rest } = await doStream();

      return {
        stream: stream.pipeThrough(
          new TransformStream({
            transform(chunk, controller) {
              // Intercept and modify streaming chunks
              console.log('Chunk:', chunk);
              controller.enqueue(chunk);
            },
          })
        ),
        ...rest,
      };
    },
  },
});
```

**Middleware Composition**:

```typescript
// Multiple middleware can be chained
const wrappedModel = wrapLanguageModel({
  model: baseModel,
  middleware: [logMiddleware, cacheMiddleware, ragMiddleware],
});

// Each middleware wraps the previous
// Execution: ragMiddleware → cacheMiddleware → logMiddleware → baseModel
```

**Built-in Middleware Examples**:

1. **Reasoning Extraction** (`experimental_extractReasoningMiddleware`):

   ```typescript
   import { anthropic } from '@ai-sdk/anthropic';
   import { experimental_extractReasoningMiddleware as extractReasoningMiddleware } from 'ai';

   const model = wrapLanguageModel({
     model: anthropic('claude-sonnet-4-20250514'),
     middleware: extractReasoningMiddleware(),
   });
   ```

2. **Streaming Simulation** (`experimental_simulateStreamingMiddleware`):

   ```typescript
   import { experimental_simulateStreamingMiddleware as simulateStreamingMiddleware } from 'ai';

   const model = wrapLanguageModel({
     model: openai('gpt-4o'),
     middleware: simulateStreamingMiddleware({ delayInMs: 10 }),
   });
   ```

3. **Default Settings** (`experimental_defaultModelSettingsMiddleware`):

   ```typescript
   import { experimental_defaultModelSettingsMiddleware as defaultModelSettingsMiddleware } from 'ai';

   const model = wrapLanguageModel({
     model: anthropic('claude-sonnet-4.5'),
     middleware: defaultModelSettingsMiddleware({ temperature: 0.7 }),
   });
   ```

#### 3.2 Agent Extension Points

Beyond model middleware, the Agent class provides:

**1. prepareStep Hook** - Modify settings before each step:

```typescript
import { Agent, createAgent } from 'ai';

const agent = createAgent({
  model,
  prepareStep: async ({ stepNumber, messages, steps }) => {
    // Dynamic model selection
    if (stepNumber > 5) {
      return { model: cheaperModel };
    }

    // Dynamic tool selection
    if (messages.some(m => m.content.includes('search'))) {
      return { tools: [...defaultTools, searchTool] };
    }

    // Context window management
    const totalTokens = estimateTokens(messages);
    if (totalTokens > 100_000) {
      return {
        messages: await summarizeMessages(messages),
      };
    }

    return {};
  },
});
```

**2. Custom Stop Conditions**:

```typescript
import { stepCountIs, createAgent } from 'ai';

const agent = createAgent({
  model,
  stopWhen: [
    stepCountIs(20),  // Stop after 20 steps

    // Custom budget condition
    ({ steps }) => {
      const totalCost = steps.reduce((sum, step) =>
        sum + (step.usage?.totalTokens || 0) * COST_PER_TOKEN, 0
      );
      return totalCost > MAX_BUDGET;
    },

    // Custom answer detection
    ({ steps }) => {
      const lastStep = steps[steps.length - 1];
      return lastStep.text.includes('FINAL_ANSWER:');
    },
  ],
});
```

**3. Lifecycle Callbacks**:

```typescript
const agent = createAgent({
  model,

  onStepStart: ({ stepNumber, messages }) => {
    console.log(`Starting step ${stepNumber}`);
  },

  onStepFinish: async ({ step }) => {
    // Log each step
    await logStepToDatabase(step);

    // Track token usage
    trackTokenUsage(step.usage);
  },

  onFinish: async ({ steps, text, usage }) => {
    // Final logging
    console.log('Agent completed:', { stepCount: steps.length, usage });
  },
});
```

**4. Stream Transformations** (`experimental_transform`):

```typescript
const agent = createAgent({
  model,
  experimental_transform: (stream) =>
    stream.pipeThrough(
      new TransformStream({
        transform(chunk, controller) {
          // Intercept streaming events
          if (chunk.type === 'tool-call') {
            console.log('Tool called:', chunk.toolName);
          }
          controller.enqueue(chunk);
        },
      })
    ),
});
```

#### 3.3 Real-World Middleware Examples

**Example 1: Logging Middleware**

```typescript
const logMiddleware = {
  transformParams: async ({ params }) => {
    console.log('[Middleware] Params:', JSON.stringify(params, null, 2));
    return params;
  },

  wrapGenerate: async ({ doGenerate, params }) => {
    console.log('[Middleware] Calling model (generate)...');
    const result = await doGenerate();
    console.log('[Middleware] Result:', {
      text: result.text,
      usage: result.usage,
    });
    return result;
  },

  wrapStream: async ({ doStream, params }) => {
    console.log('[Middleware] Calling model (stream)...');
    const { stream, ...rest } = await doStream();

    let chunks = 0;
    return {
      stream: stream.pipeThrough(
        new TransformStream({
          transform(chunk, controller) {
            chunks++;
            controller.enqueue(chunk);
          },
          flush() {
            console.log('[Middleware] Streamed chunks:', chunks);
          },
        })
      ),
      ...rest,
    };
  },
};
```

**Example 2: Caching Middleware (Redis-backed)**

```typescript
import { createHash } from 'crypto';
import { redis } from './redis-client';

const cacheMiddleware = {
  wrapGenerate: async ({ doGenerate, params }) => {
    // Generate cache key from params
    const cacheKey = createHash('sha256')
      .update(JSON.stringify(params))
      .digest('hex');

    // Check cache
    const cached = await redis.get(`model:${cacheKey}`);
    if (cached) {
      console.log('Cache hit!');
      return JSON.parse(cached);
    }

    // Cache miss - call model
    const result = await doGenerate();

    // Store in cache (expire after 1 hour)
    await redis.setex(`model:${cacheKey}`, 3600, JSON.stringify(result));

    return result;
  },
};
```

**Example 3: RAG Middleware (Vector Search Injection)**

```typescript
import { embed } from 'ai';
import { openai } from '@ai-sdk/openai';
import { vectorDB } from './vector-db';

const ragMiddleware = {
  transformParams: async ({ params }) => {
    // Only inject context for user messages
    const userMessage = params.prompt?.find(
      msg => msg.role === 'user'
    );

    if (!userMessage) return params;

    // Generate embedding for user query
    const { embedding } = await embed({
      model: openai.embedding('text-embedding-3-small'),
      value: userMessage.content,
    });

    // Search vector database
    const relevantDocs = await vectorDB.search(embedding, { topK: 5 });

    // Inject context into system message
    const contextMessage = {
      role: 'system',
      content: `Relevant context:\n${relevantDocs.map(d => d.content).join('\n\n')}`,
    };

    return {
      ...params,
      prompt: [contextMessage, ...params.prompt],
    };
  },
};
```

**Example 4: Guardrails Middleware (Content Filtering)**

```typescript
const guardrailsMiddleware = {
  transformParams: async ({ params }) => {
    // Check user input for harmful content
    const userMessages = params.prompt?.filter(m => m.role === 'user') || [];

    for (const msg of userMessages) {
      if (await containsHarmfulContent(msg.content)) {
        throw new Error('Content policy violation detected');
      }
    }

    return params;
  },

  wrapGenerate: async ({ doGenerate }) => {
    const result = await doGenerate();

    // Check model output
    if (await containsHarmfulContent(result.text)) {
      throw new Error('Model generated harmful content');
    }

    return result;
  },
};
```

---

### 4. Integration Strategy for ai-sdk-deep-agent

#### 4.1 Recommended Implementation Phases

**Phase 1: Model-Level Middleware Support (Non-breaking, 2-3 days)**

Add optional `middleware` parameter to `DeepAgentConfig`:

```typescript
// src/types.ts
import type { LanguageModelV2Middleware } from 'ai';

export interface DeepAgentConfig {
  model: LanguageModel;
  backend?: BackendProtocol | BackendFactory;
  middleware?: LanguageModelV2Middleware | LanguageModelV2Middleware[];  // NEW
  // ... existing params
}
```

Wrap model internally if middleware provided:

```typescript
// src/agent.ts
import { wrapLanguageModel } from 'ai';

export function createDeepAgent(config: DeepAgentConfig) {
  const { model, middleware, ...rest } = config;

  // Wrap model if middleware provided
  const effectiveModel = middleware
    ? wrapLanguageModel({
        model,
        middleware: Array.isArray(middleware) ? middleware : [middleware],
      })
    : model;

  // Use wrapped model for agent
  return createToolLoopAgent({
    model: effectiveModel,
    ...rest,
  });
}
```

**Benefits**:

- ✅ Non-breaking change (middleware optional)
- ✅ Users can leverage existing AI SDK middleware ecosystem
- ✅ Enables logging, caching, RAG, guardrails out of the box

**Phase 2: Agent Extension Points (Non-breaking, 1-2 days)**

Expose `prepareStep` and `stopWhen` in `DeepAgentConfig`:

```typescript
export interface DeepAgentConfig {
  // ... existing params
  prepareStep?: PrepareStepFunction;
  stopWhen?: StopWhenCondition | StopWhenCondition[];
  onStepStart?: OnStepStartFunction;
  onStepFinish?: OnStepFinishFunction;
  onFinish?: OnFinishFunction;
}
```

**Benefits**:

- ✅ Dynamic model/tool selection
- ✅ Context window management
- ✅ Custom stopping conditions
- ✅ Step-level observability

**Phase 3: Skills System and Agent Memory (2-3 days each)**

Build as middleware plugins:

```typescript
// Skills Middleware
const skillsMiddleware = {
  transformParams: async ({ params, context }) => {
    // Load skills metadata from SKILL.md files
    const skills = await loadSkillsMetadata(context.skillsDir);

    // Inject skills list into system prompt
    const skillsSection = formatSkillsList(skills);
    const systemMessage = {
      role: 'system',
      content: skillsSection,
    };

    return {
      ...params,
      prompt: [systemMessage, ...params.prompt],
    };
  },
};

// Agent Memory Middleware
const agentMemoryMiddleware = {
  transformParams: async ({ params, context }) => {
    // Load agent memory from agent.md
    const memory = await loadAgentMemory(context.agentId);

    // Inject memory into system prompt
    const memoryMessage = {
      role: 'system',
      content: `## Agent Memory\n${memory}`,
    };

    return {
      ...params,
      prompt: [memoryMessage, ...params.prompt],
    };
  },
};
```

#### 4.2 Migration Path

**Current**: No middleware support

```typescript
const agent = createDeepAgent({
  model: anthropic('claude-sonnet-4.5'),
  backend: new StateBackend(),
});
```

**Phase 1**: Add model middleware

```typescript
const agent = createDeepAgent({
  model: anthropic('claude-sonnet-4.5'),
  backend: new StateBackend(),
  middleware: [logMiddleware, cacheMiddleware],  // NEW
});
```

**Phase 2**: Add agent extension points

```typescript
const agent = createDeepAgent({
  model: anthropic('claude-sonnet-4.5'),
  backend: new StateBackend(),
  middleware: [logMiddleware, cacheMiddleware],
  prepareStep: async ({ stepNumber }) => {  // NEW
    if (stepNumber > 10) return { model: cheaperModel };
    return {};
  },
  stopWhen: [stepCountIs(20)],  // NEW
});
```

**Phase 3**: Add skills/memory middleware

```typescript
const agent = createDeepAgent({
  model: anthropic('claude-sonnet-4.5'),
  backend: new StateBackend(),
  middleware: [
    logMiddleware,
    cacheMiddleware,
    createSkillsMiddleware({ skillsDir: './skills' }),  // NEW
    createAgentMemoryMiddleware({ agentId: 'my-agent' }),  // NEW
  ],
  prepareStep: dynamicContextManager,
  stopWhen: [stepCountIs(20), budgetCondition],
});
```

#### 4.3 API Design Considerations

**1. Middleware Ordering**: Should we enforce a specific order?

- **Recommendation**: Let users control order, provide documentation on best practices
- **Rationale**: Flexibility is key (e.g., cache before/after RAG?)

**2. Backend Access in Middleware**: How should middleware access backends?

- **Recommendation**: Pass backend via `context` parameter in middleware hooks
- **Example**:

  ```typescript
  const fsMiddleware = {
    transformParams: async ({ params, context }) => {
      const { backend } = context;
      const files = await backend.ls('/');
      // ... use files
    },
  };

  // In createDeepAgent:
  const wrappedModel = wrapLanguageModel({
    model,
    middleware,
    context: { backend },  // Pass backend to all middleware
  });
  ```

**3. State Management**: Should middleware modify DeepAgent state?

- **Recommendation**: State modification via backend only (not direct state access)
- **Rationale**: Keeps state management centralized and predictable

**4. Breaking Changes**: When to introduce async backend methods?

- **Recommendation**: Defer to v0.2.0 or v1.0.0 (as noted in PROJECT-STATE.md)
- **Rationale**: Focus on non-breaking middleware support first

---

### 5. Comparison: LangChain vs AI SDK v6 Middleware

| Feature | LangChain | AI SDK v6 |
|---------|-----------|-----------|
| **Model Call Interception** | `wrapModelCall` | `transformParams`, `wrapGenerate`, `wrapStream` |
| **Tool Call Interception** | `wrapToolCall` | Not built-in (use `prepareStep` to modify tools) |
| **State Management** | `stateSchema` with reducers | Not built-in (use backend) |
| **Message History Modification** | `beforeAgent` hook | Use `prepareStep` to modify messages |
| **Tool Registration** | `tools` array in middleware | Use `prepareStep` to add tools dynamically |
| **Async Support** | Both sync and async hooks | Async by default |
| **Streaming Support** | `wrapStream` hook | `wrapStream` hook |
| **Composition** | Middleware array | Middleware array |
| **Built-in Middleware** | Minimal | Reasoning, streaming simulation, default settings |

**Key Differences**:

1. **LangChain**: State-centric (middleware extends state schema)
2. **AI SDK v6**: Model-centric (middleware wraps model, agent handles state)
3. **LangChain**: Tool interception via `wrapToolCall`
4. **AI SDK v6**: Tool modification via `prepareStep` (no direct interception)

**Recommendation**: Use **AI SDK v6 model middleware** for cross-cutting concerns (logging, caching, RAG), and **Agent extension points** for agent-specific logic (tool selection, context management).

---

### 6. Gaps and Limitations

#### 6.1 Missing Features in AI SDK v6

1. **No Direct Tool Call Interception**: Cannot intercept tool execution results
   - **Workaround**: Wrap tool functions manually before passing to agent
   - **Example**:

     ```typescript
     const wrappedTool = tool({
       ...originalTool,
       execute: async (args, context) => {
         const result = await originalTool.execute(args, context);
         // Intercept and modify result
         if (result.length > 20000) {
           await saveToFile(result);
           return 'Result saved to file';
         }
         return result;
       },
     });
     ```

2. **No State Schema Extension**: Cannot declaratively extend agent state
   - **Workaround**: Use backend for custom state management
   - **Example**: Store additional state in backend with custom prefix (e.g., `/state/custom/`)

3. **No Message History Interception**: Cannot modify message history before agent step
   - **Workaround**: Use `prepareStep` to modify messages array
   - **Limitation**: Runs per-step, not per-model-call

4. **No Middleware Context Propagation**: Cannot easily pass context (backend, config) to middleware
   - **Workaround**: Create middleware factory that closes over context
   - **Example**:

     ```typescript
     function createFsMiddleware(backend: BackendProtocol) {
       return {
         transformParams: async ({ params }) => {
           const files = await backend.ls('/');
           // Use files...
         },
       };
     }

     const agent = createDeepAgent({
       model: wrapLanguageModel({
         model: baseModel,
         middleware: createFsMiddleware(backend),
       }),
       backend,
     });
     ```

#### 6.2 Recommended Feature Requests to AI SDK Team

1. **Tool Call Interception Hook**: `wrapToolCall` equivalent
2. **Context Propagation**: Pass custom context to middleware
3. **State Management Primitives**: Optional state schema extension

---

## Code References

### LangChain.js Reference Implementation

- [`src/agent.ts:87-187`](https://github.com/langchain-ai/deepagentsjs/blob/5cb547e31697bce1216eefd2ebc5ece0bb0a1f5a/src/agent.ts#L87-L187) - createDeepAgent with middleware assembly
- [`src/middleware/index.ts:1-12`](https://github.com/langchain-ai/deepagentsjs/blob/5cb547e31697bce1216eefd2ebc5ece0bb0a1f5a/src/middleware/index.ts#L1-L12) - Middleware exports
- [`src/middleware/fs.ts:413-567`](https://github.com/langchain-ai/deepagentsjs/blob/5cb547e31697bce1216eefd2ebc5ece0bb0a1f5a/src/middleware/fs.ts#L413-L567) - FilesystemMiddleware factory
- [`src/middleware/subagents.ts:438-480`](https://github.com/langchain-ai/deepagentsjs/blob/5cb547e31697bce1216eefd2ebc5ece0bb0a1f5a/src/middleware/subagents.ts#L438-L480) - SubAgentMiddleware factory
- [`src/middleware/patch_tool_calls.ts:30-82`](https://github.com/langchain-ai/deepagentsjs/blob/5cb547e31697bce1216eefd2ebc5ece0bb0a1f5a/src/middleware/patch_tool_calls.ts#L30-L82) - PatchToolCallsMiddleware

### LangChain Python Reference Implementation

- [`libs/deepagents/deepagents/graph.py:40-162`](https://github.com/langchain-ai/deepagents/blob/9cdb42f821dd96483a94c16a27bdec0f128b2ca0/libs/deepagents/deepagents/graph.py#L40-L162) - create_deep_agent with middleware
- [`libs/deepagents/deepagents/middleware/__init__.py:3-11`](https://github.com/langchain-ai/deepagents/blob/9cdb42f821dd96483a94c16a27bdec0f128b2ca0/libs/deepagents/deepagents/middleware/__init__.py#L3-L11) - Middleware exports
- [`libs/deepagents/deepagents/middleware/filesystem.py:801-1089`](https://github.com/langchain-ai/deepagents/blob/9cdb42f821dd96483a94c16a27bdec0f128b2ca0/libs/deepagents/deepagents/middleware/filesystem.py#L801-L1089) - FilesystemMiddleware class
- [`libs/deepagents/deepagents/middleware/subagents.py:377-485`](https://github.com/langchain-ai/deepagents/blob/9cdb42f821dd96483a94c16a27bdec0f128b2ca0/libs/deepagents/deepagents/middleware/subagents.py#L377-L485) - SubAgentMiddleware class
- [`libs/deepagents/deepagents/middleware/patch_tool_calls.py:11-44`](https://github.com/langchain-ai/deepagents/blob/9cdb42f821dd96483a94c16a27bdec0f128b2ca0/libs/deepagents/deepagents/middleware/patch_tool_calls.py#L11-L44) - PatchToolCallsMiddleware

### Tests

- [`tests/unit/middleware.test.ts:55-78`](https://github.com/langchain-ai/deepagentsjs/blob/5cb547e31697bce1216eefd2ebc5ece0bb0a1f5a/tests/unit/middleware.test.ts#L55-L78) - Multiple middleware composition test
- [`tests/unit_tests/test_middleware.py:33-62`](https://github.com/langchain-ai/deepagents/blob/9cdb42f821dd96483a94c16a27bdec0f128b2ca0/libs/deepagents/tests/unit_tests/test_middleware.py#L33-L62) - Python middleware tests
- [`tests/integration_tests/test_filesystem_middleware.py:35-61`](https://github.com/langchain-ai/deepagents/blob/9cdb42f821dd96483a94c16a27bdec0f128b2ca0/libs/deepagents/tests/integration_tests/test_filesystem_middleware.py#L35-L61) - Backend integration tests

---

## Architecture Diagrams

### Middleware Execution Flow

```
┌─────────────────────────────────────────────────────────────────┐
│                         User Input                               │
└────────────────────────────┬────────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│  beforeAgent Hooks (forward order)                              │
│  1. PatchToolCallsMiddleware → Fix dangling tool calls          │
└────────────────────────────┬────────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│  wrapModelCall Hooks (reverse order - innermost to outermost)  │
│  8. Custom Middleware                                            │
│  7. HITL Middleware                                              │
│  6. Caching Middleware                                           │
│  5. Summarization Middleware                                     │
│  4. SubAgent Middleware → Inject task instructions              │
│  3. Filesystem Middleware → Inject FS instructions, filter tools│
│  2. Todo Middleware → Inject todo instructions                  │
│  1. [INNERMOST]                                                  │
└────────────────────────────┬────────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│                    ACTUAL MODEL CALL                             │
│  - Merged tools from all middleware                              │
│  - Composed system prompt (todos + FS + task + custom)          │
│  - Merged state schemas (files, todos, custom)                  │
└────────────────────────────┬────────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│                      Model Response                              │
│                     (tool calls, text)                           │
└────────────────────────────┬────────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│  Tool Execution (if tool calls present)                         │
└────────────────────────────┬────────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│  wrapToolCall Hooks (reverse order)                             │
│  3. Custom Middleware                                            │
│  2. HITL Middleware                                              │
│  1. Filesystem Middleware → Check size, evict if > 20k tokens   │
└────────────────────────────┬────────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│  State Reducers (merge updates)                                 │
│  - fileDataReducer → Merge file updates (null = deletion)       │
│  - todoReducer → Merge todo updates                             │
│  - Custom reducers                                               │
└────────────────────────────┬────────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│                    ToolMessage / Command                         │
│                   (returned to agent loop)                       │
└─────────────────────────────────────────────────────────────────┘
```

### AI SDK v6 Integration Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                   createDeepAgent(config)                        │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │  config: {                                                │  │
│  │    model: LanguageModel                                   │  │
│  │    middleware?: LanguageModelV2Middleware[]  ← NEW       │  │
│  │    backend?: BackendProtocol                              │  │
│  │    prepareStep?: PrepareStepFunction         ← NEW       │  │
│  │    stopWhen?: StopWhenCondition[]            ← NEW       │  │
│  │  }                                                        │  │
│  └──────────────────────────────────────────────────────────┘  │
└────────────────────────────┬────────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│  Wrap Model with Middleware (if provided)                       │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │  wrappedModel = wrapLanguageModel({                      │  │
│  │    model,                                                 │  │
│  │    middleware: [                                          │  │
│  │      logMiddleware,                                       │  │
│  │      cacheMiddleware,                                     │  │
│  │      ragMiddleware,                                       │  │
│  │      guardrailsMiddleware,                                │  │
│  │      ...config.middleware,                                │  │
│  │    ],                                                     │  │
│  │    context: { backend },  ← Pass backend to middleware   │  │
│  │  });                                                      │  │
│  └──────────────────────────────────────────────────────────┘  │
└────────────────────────────┬────────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│  Create Agent with Extension Points                             │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │  agent = createAgent({                                    │  │
│  │    model: wrappedModel,  ← Use wrapped model             │  │
│  │    tools: [...defaultTools, ...config.tools],            │  │
│  │    prepareStep: config.prepareStep,  ← Dynamic behavior  │  │
│  │    stopWhen: config.stopWhen,        ← Custom stopping   │  │
│  │    onStepFinish: config.onStepFinish,                    │  │
│  │  });                                                      │  │
│  └──────────────────────────────────────────────────────────┘  │
└────────────────────────────┬────────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│                         Agent Loop                               │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │  For each step:                                           │  │
│  │    1. prepareStep → Modify model/tools/messages          │  │
│  │    2. Model Call (via wrappedModel)                      │  │
│  │       ├─ transformParams → Modify parameters             │  │
│  │       ├─ wrapGenerate/wrapStream → Intercept calls       │  │
│  │       └─ Return response                                  │  │
│  │    3. Execute tools (if tool calls present)               │  │
│  │    4. onStepFinish → Log, track, modify                  │  │
│  │    5. Check stopWhen conditions                           │  │
│  │    6. Continue or stop                                    │  │
│  └──────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
```

---

## Open Questions

1. **Tool Call Interception**: How to intercept tool execution in AI SDK v6 without wrapping every tool function?
   - **Investigation**: Check if `prepareStep` can modify tool responses (unlikely)
   - **Workaround**: Tool wrapper factory that applies eviction logic

2. **State Management**: Should ai-sdk-deep-agent introduce state management beyond backend?
   - **Trade-off**: Flexibility vs. complexity
   - **Recommendation**: Start with backend-only state, add state schemas if needed

3. **Middleware Context**: How to pass backend/config to middleware without creating closures?
   - **AI SDK v6 Feature Request**: Support `context` parameter in `wrapLanguageModel`

4. **Breaking Changes**: When to introduce async backend methods?
   - **Recommendation**: Defer to v0.2.0 as per PROJECT-STATE.md

---

## Related Research

- `.agent/PROJECT-STATE.md` - Feature parity tracking with priorities
- `docs/architecture.md` - Detailed architecture documentation
- `docs/patterns.md` - Common usage patterns

---

## Additional Resources

### Official Documentation

- [Vercel AI SDK - Model Middleware](https://sdk.vercel.ai/docs/ai-sdk-core/middleware)
- [Vercel AI SDK - Agent Extension Points](https://sdk.vercel.ai/docs/ai-sdk-agent/overview#extension-points)
- [LangChain.js Middleware](https://js.langchain.com/docs/concepts/middleware)

### GitHub Repositories

- [Vercel AI SDK Examples](https://github.com/vercel/ai/tree/main/examples)
- [LangChain.js DeepAgents](https://github.com/langchain-ai/deepagentsjs)
- [LangChain Python DeepAgents](https://github.com/langchain-ai/deepagents)

### Community Resources

- [AI SDK Discord](https://discord.gg/vercel)
- [LangChain Discord](https://discord.gg/langchain)

---

## Conclusion

The middleware architecture is the **foundational piece** for production-ready ai-sdk-deep-agent. AI SDK v6's built-in middleware support via `wrapLanguageModel()` provides a robust starting point, complemented by Agent extension points for dynamic behavior.

**Next Steps**:

1. Implement Phase 1 (model middleware support) - **2-3 days**
2. Document middleware patterns in `docs/middleware.md` - **1 day**
3. Add tests for middleware composition - **1 day**
4. Implement Phase 2 (agent extension points) - **1-2 days**
5. Build Skills System as middleware plugin - **2-3 days**
6. Build Agent Memory as middleware plugin - **2-3 days**

**Total Estimated Effort**: 9-15 days for complete middleware system with Skills and Agent Memory.
