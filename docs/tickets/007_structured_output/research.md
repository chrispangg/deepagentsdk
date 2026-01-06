---
title: How should we implement Structured Output (responseFormat) support in deepagentsdk?
date: 2025-12-19 08:15:00 AEDT
researcher: Research Agent
git_commit: 0a93689550e65e096523f25cba0c36c87e7a74a1
branch: main
repository: ai-sdk-deepagent
topic: "How should we implement Structured Output (responseFormat) support in deepagentsdk?"
tags: [research, codebase, structured-output, ai-sdk, langchain, types, validation]
status: complete
last_updated: 2025-12-19
last_updated_by: Research Agent
last_updated_note: "Corrected with ToolLoopAgent native output parsing support"
---

## Research Question

How should we implement Structured Output (responseFormat) support in deepagentsdk?

**Objectives:**

1. Document how LangChain's DeepAgents framework implements structured output
2. Document AI SDK v6's native structured output capabilities
3. Analyze our codebase's current type and validation patterns
4. Identify implementation approach for our framework

---

## Summary

### Key Findings

1. **✅ AI SDK v6 ToolLoopAgent Native Support** (CORRECTED):
   - **ToolLoopAgent natively supports structured output** via `output.schema` parameter
   - Works alongside tools using the `output` configuration option
   - Provides full TypeScript type inference from Zod schemas
   - **Reference**: <https://v6.ai-sdk.dev/docs/reference/ai-sdk-core/tool-loop-agent#agent-with-output-parsing>
   - **This invalidates the initial "mutually exclusive" assumption**

2. **LangChain DeepAgents Implementation** (Python only):
   - Supports `response_format` parameter using LangChain's `ToolStrategy(schema=PydanticModel)`
   - Returns structured data in `response["structured_response"]` alongside message history
   - **JavaScript version is non-functional** per test comments in `.refs/deepagentsjs/`
   - Acts as pass-through to underlying LangChain functionality (not DeepAgents-specific)

3. **Our Codebase Patterns**:
   - Strong Zod-based input validation in all tools
   - TypeScript interfaces for backend return types
   - Event-driven side effects with typed events
   - No output schema validation currently

4. **Recommended Implementation Strategy** (UPDATED):
   - **Native ToolLoopAgent Integration**: Pass `output.schema` to ToolLoopAgent constructor
   - Add optional `outputSchema` parameter to `CreateDeepAgentParams`
   - Return parsed structured output in `result.output` (alongside `result.text`)
   - Simpler than terminal tool pattern—no custom tool needed

---

## Detailed Findings

### 1. AI SDK v6 ToolLoopAgent Native Output Parsing

#### 1.1 Discovery and Correction

**Initial Assumption (INCORRECT)**: Research initially concluded that tool-calling and structured output were mutually exclusive based on general LLM patterns.

**Correction**: AI SDK v6's `ToolLoopAgent` **natively supports structured output parsing** alongside tools via the `output` configuration parameter.

**Reference Documentation**: <https://v6.ai-sdk.dev/docs/reference/ai-sdk-core/tool-loop-agent#agent-with-output-parsing>

---

#### 1.2 ToolLoopAgent Output Parsing API

**Constructor Signature**:

```typescript
new ToolLoopAgent({
  model: LanguageModel,
  tools?: ToolSet,
  output?: {
    schema: z.ZodType<any>,
    description?: string,
  },
  // ... other options
})
```

**Example from Documentation**:

```typescript
import { z } from 'zod';

const analysisAgent = new ToolLoopAgent({
  model: "anthropic/claude-sonnet-4.5",
  output: {
    schema: z.object({
      sentiment: z.enum(['positive', 'negative', 'neutral']),
      score: z.number(),
      summary: z.string(),
    }),
  },
});

const result = await analysisAgent.generate({
  prompt: 'Analyze this review: "The product exceeded my expectations!"',
});

console.log(result.output);
// Typed as { sentiment: 'positive' | 'negative' | 'neutral', score: number, summary: string }
```

**Key Features**:

1. **Type Inference**: `result.output` is fully typed based on the Zod schema
2. **Alongside Tools**: Can be used with `tools` parameter simultaneously
3. **Optional Description**: Can provide description for the output structure
4. **Validation**: Automatically validates output against schema

---

#### 1.3 Integration with DeepAgent

**Current DeepAgent Architecture** (src/agent.ts:258-266):

```typescript
private createAgent(state: DeepAgentState, maxSteps?: number, onEvent?: EventCallback) {
  const tools = this.createTools(state, onEvent);

  return new ToolLoopAgent({
    model: this.model,
    instructions: this.systemPrompt,
    tools,
    stopWhen: stepCountIs(maxSteps ?? this.maxSteps),
  });
}
```

**Proposed Change**: Add `output` parameter when `outputSchema` is provided:

```typescript
return new ToolLoopAgent({
  model: this.model,
  instructions: this.systemPrompt,
  tools,
  stopWhen: stepCountIs(maxSteps ?? this.maxSteps),
  ...(this.outputSchema ? {
    output: {
      schema: this.outputSchema,
      description: this.outputDescription,
    }
  } : {}),
});
```

---

### 2. LangChain DeepAgents Structured Output Implementation

#### 1.1 Python Implementation (Fully Functional)

**File**: `.refs/deepagents/libs/deepagents/deepagents/graph.py`

**API Signature** (Lines 42-48):

```python
def create_deep_agent(
    model: str | BaseChatModel | None = None,
    tools: Sequence[BaseTool | Callable | dict[str, Any]] | None = None,
    *,
    response_format: ResponseFormat | None = None,  # Line 47
    # ... other params
) -> CompiledStateGraph:
```

**Import** (Line 10):

```python
from langchain.agents.structured_output import ResponseFormat
```

**Pass-through Architecture** (Line 154):

```python
return create_agent(
    model,
    system_prompt=system_prompt + "\n\n" + BASE_AGENT_PROMPT if system_prompt else BASE_AGENT_PROMPT,
    tools=tools,
    middleware=deepagent_middleware,
    response_format=response_format,  # Passed directly to LangChain
    # ... other params
)
```

**Key Insight**: DeepAgents doesn't implement structured output itself—it just passes the parameter to LangChain's `create_agent()`.

---

#### 1.2 Usage Pattern from Tests

**File**: `.refs/deepagents/libs/deepagents/tests/integration_tests/test_deepagents.py:158-165`

```python
def test_response_format_tool_strategy(self):
    class StructuredOutput(BaseModel):
        pokemon: list[str]

    agent = create_deep_agent(
        response_format=ToolStrategy(schema=StructuredOutput)
    )

    response = agent.invoke({
        "messages": [{"role": "user", "content": "Who are all of the Kanto starters?"}]
    })

    structured_output = response["structured_response"]
    assert len(structured_output.pokemon) == 3
```

**Output Structure**:

```python
{
    "messages": [...],                    # Standard message history
    "structured_response": StructuredOutput(...),  # Typed response
    "todos": [...],                       # Todo list state
    "files": {...},                       # Filesystem state
}
```

**Integration**: Works alongside all middleware (todos, filesystem, subagents) without interference.

---

#### 1.3 JavaScript Implementation (Non-Functional)

**File**: `.refs/deepagentsjs/src/agent.ts`

**API Signature** (Line 49):

```typescript
export interface CreateDeepAgentParams<ContextSchema> {
  model?: BaseLanguageModel | string;
  tools?: StructuredTool[];
  responseFormat?: any;  // Type is complex, using any for now
  // ... other params
}
```

**Status Comment** (Test file lines 315-316):

```typescript
// response_format with ToolStrategy is not yet available in LangChain TS v1
```

**Conclusion**: Parameter exists but is **not functional** in JavaScript/TypeScript version.

---

### 2. AI SDK v6 Structured Output Capabilities

**Note**: This section is based on web research and AI SDK documentation, as the `ai` package doesn't expose internal implementation in our local node_modules.

#### 2.1 Core APIs

##### `generateObject()` API

**Purpose**: Generate a typed object that conforms to a Zod schema.

**Type Signature**:

```typescript
import { generateObject } from 'ai';
import { z } from 'zod';

const result = await generateObject({
  model: anthropic('claude-sonnet-4-20250514'),
  schema: z.object({
    recipe: z.object({
      name: z.string(),
      ingredients: z.array(z.object({
        name: z.string(),
        amount: z.string(),
      })),
      steps: z.array(z.string()),
    }),
  }),
  prompt: 'Generate a lasagna recipe.',
});

// result.object is fully typed: { recipe: { name: string, ... } }
```

**Returns**:

- `object`: Fully typed object matching the schema
- `usage`: Token usage statistics
- `finishReason`: Why generation stopped

---

##### `streamObject()` API

**Purpose**: Stream partial objects as they're generated.

**Type Signature**:

```typescript
import { streamObject } from 'ai';
import { z } from 'zod';

const { partialObjectStream } = streamObject({
  model: anthropic('claude-sonnet-4-20250514'),
  schema: z.object({
    recipe: z.object({
      name: z.string(),
      ingredients: z.array(z.object({
        name: z.string(),
        amount: z.string(),
      })),
      steps: z.array(z.string()),
    }),
  }),
  prompt: 'Generate a lasagna recipe.',
});

for await (const partialObject of partialObjectStream) {
  console.log(partialObject);
  // Progressive updates: { recipe: { name: "Las..." } }
  //                      { recipe: { name: "Lasagna", ingredients: [...] } }
}
```

**Streaming Behavior**:

- Yields partial objects as fields are completed
- Final object is guaranteed to match the schema
- Full type safety throughout the stream

---

#### 2.2 Critical Limitation: Tool-Calling vs Structured Output

**Key Finding**: Most LLMs cannot simultaneously use tools AND produce structured output.

**Why**: This is an LLM architectural constraint, not an AI SDK limitation:

- Tool-calling uses function-call formats (e.g., OpenAI function calling)
- Structured output uses JSON mode or constrained generation
- These are typically mutually exclusive LLM modes

**Impact on Deep Agents**:

- `ToolLoopAgent` relies on tool-calling for todos, filesystem, subagents
- **Cannot simply add `schema` parameter to existing `generate()` method**
- Need alternative integration strategy

---

#### 2.3 Integration Patterns for Agents

##### Pattern 1: Post-Processing

**Approach**: Agent completes with tools → Convert final text to structured format

```typescript
const agent = createDeepAgent({ model, tools });
const result = await agent.generate({ prompt: "Research topic X" });

// Post-process the text output
const structured = await generateObject({
  model,
  schema: mySchema,
  prompt: `Convert this to structured format: ${result.text}`,
});
```

**Pros**: Simple, works with existing agent
**Cons**: Extra LLM call, potential information loss

---

##### Pattern 2: Terminal Tool (Recommended)

**Approach**: Add a `submit_result` tool that agent calls with structured data

```typescript
const agent = createDeepAgent({
  model,
  responseSchema: z.object({ findings: z.array(z.string()) }),
  // Auto-generates submit_result tool with schema validation
});

// Agent uses tools, then calls submit_result({ findings: [...] }) to finish
const result = await agent.generate({ prompt: "Research topic X" });
// result.structuredOutput contains validated data
```

**Pros**:

- Agent can use all tools normally
- Structured output validated by schema
- Single LLM invocation
- Clear completion signal

**Cons**:

- Agent must learn to call the terminal tool
- Requires prompt engineering

---

##### Pattern 3: Middleware Wrapper

**Approach**: Middleware intercepts final step and converts to structured format

```typescript
const agent = createDeepAgent({
  model,
  middleware: [
    structuredOutputMiddleware({
      schema: mySchema,
      triggerOnFinish: true,
    }),
  ],
});
```

**Pros**: Transparent to agent
**Cons**: Complex, requires middleware architecture understanding

---

### 3. Our Codebase Type and Validation Patterns

#### 3.1 Current Return Types from Agent Methods

**File**: `src/agent.ts`

##### `generate()` (Lines 292-311)

```typescript
async generate(options: { prompt: string; maxSteps?: number }): Promise<
  ToolLoopAgentGenerateResult & { state: DeepAgentState }
>
```

Returns:

- AI SDK's `ToolLoopAgent.generate()` result
- `state` property added via `Object.defineProperty()`
- Includes: `result.text`, `result.usage`, `state`

---

##### `streamWithEvents()` (Lines 401-629)

```typescript
async *streamWithEvents(
  options: StreamWithEventsOptions
): AsyncGenerator<DeepAgentEvent, void, unknown>
```

Final `DoneEvent` contains (Lines 603-608):

```typescript
yield {
  type: "done",
  state: DeepAgentState,
  text?: string,
  messages?: ModelMessage[],  // Updated conversation history
};
```

**Key Pattern**: This is the primary method for conversation state management.

---

#### 3.2 Zod Schema Usage in Tools

**Pattern**: All tools use Zod for input validation, TypeScript for output types

**Example: Todo Tool** (`src/tools/todos.ts`, Lines 9-48)

```typescript
const TodoItemSchema = z.object({
  id: z.string().describe("Unique identifier for the todo item"),
  content: z.string().max(100).describe("The description/content..."),
  status: z.enum(["pending", "in_progress", "completed", "cancelled"]),
});

inputSchema: z.object({
  todos: z.array(TodoItemSchema).min(1).describe("Array of todo items"),
  merge: z.boolean().default(true).describe("Whether to merge..."),
})
```

**Output**: Returns formatted string, no Zod validation

---

**Example: Filesystem Tools** (`src/tools/filesystem.ts`, Lines 100-142)

```typescript
read_file: tool({
  inputSchema: z.object({
    file_path: z.string().describe("Path to the file to read"),
    offset: z.number().default(0).describe("Line offset..."),
    limit: z.number().default(2000).describe("Maximum number of lines"),
  }),
  execute: async (args) => {
    const result = backend.read(file_path, offset, limit);
    // Optional: Evict large results to file
    return typeof result === 'string' ? result : JSON.stringify(result);
  }
})
```

**Pattern**: Tools can return direct results or file references (if evicted).

---

#### 3.3 Backend Return Types (Structured)

**File**: `src/types.ts`

**WriteResult** (Lines 98-103):

```typescript
export interface WriteResult {
  error?: string;   // Error message on failure
  path?: string;    // File path on success
}
```

**EditResult** (Lines 108-115):

```typescript
export interface EditResult {
  error?: string;      // Error message on failure
  path?: string;       // File path on success
  occurrences?: number; // Number of replacements made
}
```

**FileInfo** (Lines 72-81):

```typescript
export interface FileInfo {
  path: string;
  is_dir?: boolean;
  size?: number;
  modified_at?: string; // ISO 8601 timestamp
}
```

**Pattern**: Backend methods use TypeScript interfaces for structured returns, but tools convert these to strings before returning to LLM.

---

#### 3.4 Event Types

**File**: `src/types.ts` (Lines 849-1200)

**DoneEvent** (Lines 1100-1106):

```typescript
export interface DoneEvent {
  type: "done";
  state: DeepAgentState;
  text?: string;
  messages?: ModelMessage[];  // Only event that returns messages
}
```

**StepFinishEvent** (Lines 869-877):

```typescript
export interface StepFinishEvent {
  type: "step-finish";
  stepNumber: number;
  toolCalls: Array<{
    toolName: string;
    args: unknown;      // No validation
    result: unknown;    // No validation
  }>;
}
```

**Pattern**: Tool args/results are `unknown` - no runtime validation, just passthrough.

---

#### 3.5 Existing Patterns to Build Upon

##### Pattern A: Tool Result Transformation

**File**: `src/utils/eviction.ts`

**Current Use**: Transforms large tool results into file references

```typescript
if (shouldEvict(result, tokenLimit)) {
  return evictToolResult({ result, toolCallId, backend });
}
```

**Could Extend To**: Schema-based transformations, type coercion, validation

---

##### Pattern B: Event-Based Side Effects

**Current Use**: Tools emit typed events via `onEvent(event)` callback

```typescript
if (onEvent) {
  onEvent({ type: "todos-changed", todos: state.todos });
}
```

**Could Extend To**: Structured output events, schema validation events

---

##### Pattern C: Dynamic Tool Creation

**File**: `src/agent.ts` (Lines 193-250)

```typescript
private createTools(state: DeepAgentState, onEvent?: EventCallback): ToolSet {
  const todosTool = createTodosTool(state, onEvent);
  const filesystemTools = createFilesystemTools(state, { backend, onEvent });

  // Conditionally add execute tool if sandbox backend
  if (this.hasSandboxBackend) {
    allTools.execute = createExecuteTool({ backend, onEvent });
  }

  // Conditionally add subagent tool if configured
  if (this.subagentOptions.includeGeneralPurposeAgent || ...) {
    allTools.task = createSubagentTool(state, { ... });
  }

  return allTools;
}
```

**Could Extend To**: Dynamically add `submit_result` tool when `responseSchema` provided

---

### 4. Implementation Approach (CORRECTED)

#### 4.1 Recommended Strategy: Native ToolLoopAgent Integration

**Why This Approach** (Updated based on ToolLoopAgent native support):

1. **Simplest**: Leverages existing AI SDK functionality—no custom tools needed
2. **Type-Safe**: Full TypeScript type inference from Zod schema
3. **Non-Breaking**: Optional parameter, backward compatible
4. **Well-Supported**: Uses documented AI SDK feature
5. **Performant**: Native implementation, no extra LLM calls or custom parsing

---

#### 4.2 Proposed API Design (Updated)

**Type Additions to `CreateDeepAgentParams`** (`src/types.ts`):

```typescript
export interface CreateDeepAgentParams {
  // ... existing params

  /**
   * Optional configuration for structured output parsing.
   * When provided, the agent's final output will be parsed and validated against the schema.
   *
   * @example
   * ```typescript
   * const agent = createDeepAgent({
   *   model: anthropic('claude-sonnet-4-20250514'),
   *   output: {
   *     schema: z.object({
   *       findings: z.array(z.string()),
   *       confidence: z.number().min(0).max(1),
   *     }),
   *     description: 'Research findings with confidence score',
   *   },
   * });
   * ```
   */
  output?: {
    schema: z.ZodType<any>;
    description?: string;
  };
}
```

**Return Type Additions**:

For `generate()` method:

```typescript
async generate(options: { prompt: string; maxSteps?: number }): Promise<
  ToolLoopAgentGenerateResult & {
    state: DeepAgentState;
    output?: z.infer<typeof schema>;  // Typed based on schema
  }
>
```

For `DoneEvent` in `streamWithEvents()`:

```typescript
export interface DoneEvent {
  type: "done";
  state: DeepAgentState;
  text?: string;
  messages?: ModelMessage[];
  output?: unknown;  // Parsed structured output if schema provided
}
```

---

#### 4.3 Implementation Steps (Simplified)

**Step 1**: Add `output` field to DeepAgent class

**File**: `src/agent.ts` (in class properties)

```typescript
export class DeepAgent {
  private model: LanguageModel;
  private systemPrompt: string;
  private userTools: ToolSet;
  private maxSteps: number;
  private backend: BackendProtocol | BackendFactory;
  // ... existing properties
  private outputConfig?: { schema: z.ZodType<any>; description?: string };  // NEW

  constructor(params: CreateDeepAgentParams) {
    // ... existing constructor code
    this.outputConfig = params.output;  // NEW
  }
}
```

---

**Step 2**: Pass `output` to ToolLoopAgent constructor

**File**: `src/agent.ts` (in `createAgent()` method, lines 258-266)

```typescript
private createAgent(state: DeepAgentState, maxSteps?: number, onEvent?: EventCallback) {
  const tools = this.createTools(state, onEvent);

  return new ToolLoopAgent({
    model: this.model,
    instructions: this.systemPrompt,
    tools,
    stopWhen: stepCountIs(maxSteps ?? this.maxSteps),
    // NEW: Add output configuration if provided
    ...(this.outputConfig ? { output: this.outputConfig } : {}),
  });
}
```

---

**Step 3**: Expose `output` in `generate()` return value

**File**: `src/agent.ts` (in `generate()` method, lines 292-311)

```typescript
async generate(options: { prompt: string; maxSteps?: number }) {
  const state: DeepAgentState = {
    todos: [],
    files: {},
  };

  const agent = this.createAgent(state, options.maxSteps);
  const result = await agent.generate({ prompt: options.prompt });

  // Attach state as before
  Object.defineProperty(result, 'state', {
    value: state,
    enumerable: true,
    writable: false,
  });

  // NEW: Attach output if present
  if ('output' in result && result.output !== undefined) {
    Object.defineProperty(result, 'output', {
      value: result.output,
      enumerable: true,
      writable: false,
    });
  }

  return result as typeof result & {
    state: DeepAgentState;
    output?: any;  // Typed by ToolLoopAgent
  };
}
```

**Note**: ToolLoopAgent's `generate()` already returns `result.output` when schema is provided. We just need to preserve it.

---

**Step 4**: Emit `output` in `streamWithEvents()` `DoneEvent`

**File**: `src/agent.ts` (in `streamWithEvents()`, around line 603-608)

```typescript
// For streamText, we'll need to manually extract the output
// The ToolLoopAgent's stream doesn't directly expose output in streaming mode
// We may need to call result.output after streaming completes

// Get final text
const finalText = await result.text;

// Build updated messages
const updatedMessages: ModelMessage[] = [
  ...inputMessages,
  { role: "assistant", content: finalText } as ModelMessage,
];

// NEW: Check if output exists (from ToolLoopAgent)
const output = 'output' in result ? await (result as any).output : undefined;

// Yield done event
yield {
  type: "done",
  state,
  text: finalText,
  messages: updatedMessages,
  ...(output !== undefined ? { output } : {}),  // NEW
};
```

**Note**: May require investigation of ToolLoopAgent's streaming API to determine if `output` is available during streaming or only after completion.

---

#### 4.4 Usage Example (Updated)

**Example 1: Using `generate()` method**

```typescript
import { createDeepAgent } from 'deepagentsdk';
import { anthropic } from '@ai-sdk/anthropic';
import { z } from 'zod';

const agent = createDeepAgent({
  model: anthropic('claude-sonnet-4-20250514'),
  output: {
    schema: z.object({
      summary: z.string().describe("Brief summary of findings"),
      keyPoints: z.array(z.string()).describe("Main takeaways"),
      confidence: z.number().min(0).max(1).describe("Confidence score"),
      sources: z.array(z.object({
        url: z.string(),
        title: z.string(),
      })).optional(),
    }),
    description: 'Research findings with key points and confidence',
  },
});

const result = await agent.generate({
  prompt: "Research the latest developments in AI agents",
});

console.log('Text response:', result.text);
console.log('Structured output:', result.output);
// result.output is fully typed based on schema!
// { summary: string, keyPoints: string[], confidence: number, sources?: ... }
```

**Example 2: Using `streamWithEvents()` method**

```typescript
for await (const event of agent.streamWithEvents({
  prompt: "Research the latest developments in AI agents",
})) {
  if (event.type === 'text') {
    process.stdout.write(event.text);
  }

  if (event.type === 'done') {
    console.log('\n\nStructured output:', event.output);
    // Fully typed based on schema!
  }
}
```

---

#### 4.5 Advantages of This Approach (Updated)

1. **Native Support**: Uses AI SDK's built-in ToolLoopAgent functionality—no custom implementation
2. **Simplest**: No custom tools, prompts, or complex logic required
3. **Type-Safe**: Full TypeScript type inference from Zod schema
4. **Non-Breaking**: Optional parameter, backward compatible with existing code
5. **Validated**: Automatic Zod validation by AI SDK
6. **Performant**: Native implementation, no extra LLM calls
7. **Well-Documented**: Official AI SDK feature with documentation and examples

---

#### 4.6 Alternative Approaches Considered (Outdated)

**Note**: These alternatives were considered before discovering ToolLoopAgent's native output parsing support. They are no longer recommended.

##### Alternative 1: Terminal Tool Pattern (Superseded)

Custom `submit_result` tool that agent calls with structured data.

**Why Superseded**:

- More complex than native ToolLoopAgent support
- Requires custom tool creation, prompt engineering
- Agent must learn to call the tool
- Native support is simpler and better supported

---

##### Alternative 2: Post-Processing (Rejected)

Call `generateObject()` after agent completes to convert text to structured format.

**Rejected Because**:

- Extra LLM call (cost + latency)
- Potential information loss in conversion
- Not idiomatic for agent frameworks

---

##### Alternative 3: Middleware-Based (Future Consideration)

Middleware intercepts final step and converts to structured format.

**Pros**: Transparent to agent
**Cons**: Complex, requires deep middleware integration, harder to debug

**Status**: Native ToolLoopAgent support makes this unnecessary

---

## Code References

### LangChain Reference Files

- `.refs/deepagents/libs/deepagents/deepagents/graph.py:47` - `response_format` parameter
- `.refs/deepagents/libs/deepagents/deepagents/graph.py:154` - Pass-through to LangChain
- `.refs/deepagents/libs/deepagents/tests/integration_tests/test_deepagents.py:158-165` - Usage example
- `.refs/deepagentsjs/src/agent.ts:49` - TypeScript parameter (non-functional)
- `.refs/deepagentsjs/tests/integration/deepagents.test.ts:315-316` - Status comment

### Our Codebase Files

- `src/types.ts:288-495` - CreateDeepAgentParams interface
- `src/types.ts:1100-1106` - DoneEvent interface
- `src/types.ts:869-877` - StepFinishEvent with unknown types
- `src/agent.ts:292-311` - generate() method
- `src/agent.ts:401-629` - streamWithEvents() method
- `src/agent.ts:193-250` - createTools() method
- `src/tools/todos.ts:9-48` - Zod schema example
- `src/tools/filesystem.ts:100-142` - Tool with backend integration
- `src/utils/eviction.ts` - Result transformation pattern

---

## External References

**AI SDK v6 Documentation**:

- [ToolLoopAgent with Output Parsing](https://v6.ai-sdk.dev/docs/reference/ai-sdk-core/tool-loop-agent#agent-with-output-parsing) - **Primary reference for implementation**
- [Generating Structured Data](https://sdk.vercel.ai/docs/ai-sdk-core/generating-structured-data) - Official guide
- [generateObject() API Reference](https://sdk.vercel.ai/docs/reference/ai-sdk-core/generate-object) - API details
- [streamObject() API Reference](https://sdk.vercel.ai/docs/reference/ai-sdk-core/stream-object) - Streaming API
- [Tool Calling Guide](https://sdk.vercel.ai/docs/ai-sdk-core/tools-and-tool-calling) - Tool usage patterns

**LangChain Documentation**:

- [Structured Output Documentation](https://python.langchain.com/docs/how_to/structured_output/) - Python guide
- [ResponseFormat Types](https://python.langchain.com/api_reference/langchain/agents/langchain.agents.structured_output.ResponseFormat.html) - API reference

---

## Open Questions (Updated)

1. **Streaming Behavior**: How does ToolLoopAgent expose `output` during streaming?
   - **Investigation Needed**: Check if `streamText` result has `output` property or if it's only available after completion
   - **Impact**: Determines when we can emit `output` in `DoneEvent`

2. **TypeScript Type Inference**: Can we provide full type inference for `result.output` and `event.output`?
   - **Challenge**: Generic type parameter propagation through async generators
   - **Possible**: May need generic type parameter on `createDeepAgent<T>()` where `T` is schema type
   - **Example**: `createDeepAgent<z.infer<typeof mySchema>>({ output: { schema: mySchema } })`

3. **Subagent Structured Output**: Should subagents also support `output` configuration?
   - **Use Case**: Subagent returns structured data to parent agent
   - **Implementation**: Pass `output` config to subagent's ToolLoopAgent
   - **Benefit**: Structured results from delegated tasks

4. **Backward Compatibility**: Does adding `output` to ToolLoopAgent constructor break anything?
   - **Risk Assessment**: Low—it's an optional parameter
   - **Testing**: Need to verify existing tests pass with updated code

5. **Stream vs Generate**: Does `output` work with both `agent.generate()` and `agent.stream()`?
   - **Documentation Check**: AI SDK docs may clarify this
   - **Fallback**: If streaming doesn't support output, document this limitation

---

## Related Research

- `docs/tickets/004_middleware_architecture/research.md` - Middleware implementation patterns
- `docs/PROJECT-STATE.md` - Feature tracking and priorities

---

## Conclusion (CORRECTED)

Structured output support can be effectively added to `deepagentsdk` using **ToolLoopAgent's native output parsing**:

### Implementation Summary

1. Add optional `output: { schema, description? }` parameter to `CreateDeepAgentParams`
2. Store config in DeepAgent class
3. Pass `output` to ToolLoopAgent constructor when provided
4. Expose `result.output` in `generate()` return value
5. Emit `output` in `streamWithEvents()` `DoneEvent`

### Key Advantages

- **Simplest**: Uses AI SDK's built-in functionality—no custom tools or prompts
- **Well-Supported**: Official AI SDK feature with documentation
- **Type-Safe**: Full TypeScript inference from Zod schema
- **Non-Breaking**: Optional parameter, backward compatible
- **Performant**: Native implementation by AI SDK

### Corrected Understanding

**Initial research incorrectly assumed** that tool-calling and structured output were mutually exclusive. This was based on general LLM patterns but **does not apply to AI SDK v6's ToolLoopAgent**, which explicitly supports both via the `output` parameter.

**Reference**: <https://v6.ai-sdk.dev/docs/reference/ai-sdk-core/tool-loop-agent#agent-with-output-parsing>

### Implementation Effort

**Estimated**: 4-6 hours for core implementation + tests (significantly less than initial estimate due to native support)

**Priority**: Medium (per PROJECT-STATE.md line 59: "Nice-to-have, can be middleware later")

**Complexity**: Low (simple pass-through to existing AI SDK functionality)
