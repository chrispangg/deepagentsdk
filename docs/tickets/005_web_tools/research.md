---
title: Web Tools Implementation (web_search, http_request, fetch_url)
date: 2025-12-13 15:12:00 AEDT
researcher: Claude Code
git_commit: 2664d1bf98bffc37301f2c0add4cc97877eae932
branch: main
repository: ai-sdk-deep-agent
topic: "Web Tools Implementation (web_search, http_request, fetch_url)"
tags: [research, web-tools, tavily, ai-sdk, implementation-guide]
status: complete
last_updated: 2025-12-13
last_updated_by: Claude Code
---

## Research Question

How should we implement web tools (`web_search`, `http_request`, `fetch_url`) in ai-sdk-deep-agent using Vercel AI SDK v6, based on the LangChain DeepAgents reference implementations?

## Summary

This research documents the architecture, implementation patterns, and integration strategies for three web interaction tools from the LangChain DeepAgents reference implementations. The Python CLI implementation (`.refs/deepagents/`) provides three production-ready tools using the Tavily search API and standard HTTP libraries, while the TypeScript example (`.refs/deepagentsjs/`) demonstrates LangChain-specific tool definition patterns with Zod schema validation.

**Key findings:**

- All three tools follow a consistent pattern: structured parameters, error-as-dict returns, and agent-friendly output formatting
- **Tavily API** is the recommended search provider (93.3% accuracy on SimpleQA benchmark, 1,000 free credits/month)
- **Turndown** is the recommended HTML-to-Markdown converter for TypeScript (10.5k stars, mature, well-tested)
- Our AI SDK v6 codebase uses factory functions with state sharing and event callbacks - web tools should follow this pattern
- Tool approval/HITL patterns are already implemented and should be applied to `web_search` and `fetch_url` for safety

## Detailed Findings

### 1. Python Reference Implementation

**Location**: `.refs/deepagents/libs/deepagents-cli/deepagents_cli/tools.py`

#### Tool 1: `http_request` (lines 15-87)

**Purpose**: General-purpose HTTP client for API interactions and web service requests.

**Function Signature:**

```python
def http_request(
    url: str,
    method: str = "GET",
    headers: dict[str, str] | None = None,
    data: str | dict | None = None,
    params: dict[str, str] | None = None,
    timeout: int = 30,
) -> dict[str, Any]:
```

**Key Implementation Details:**

- Uses Python `requests` library for HTTP operations
- Smart data handling: dict → JSON body, string → raw data
- Returns structured dict with `success`, `status_code`, `headers`, `content`, `url`
- Three-tier error handling: Timeout → RequestException → Generic Exception
- Never raises exceptions - always returns error dict with `status_code: 0`

**Return Structure:**

```python
# Success (status < 400)
{
    "success": True,
    "status_code": 200,
    "headers": {"Content-Type": "..."},
    "content": {...} or "text",  # JSON parsed if possible, else text
    "url": "https://final-url.com"
}

# Error
{
    "success": False,
    "status_code": 404,  # or 0 for network errors
    "headers": {},
    "content": "Error message",
    "url": "https://original-url.com"
}
```

**Dependencies:**

- `requests` - HTTP client library

#### Tool 2: `web_search` (lines 90-137)

**Purpose**: Search the web using Tavily API for current information and documentation.

**Function Signature:**

```python
def web_search(
    query: str,
    max_results: int = 5,
    topic: Literal["general", "news", "finance"] = "general",
    include_raw_content: bool = False,
) -> dict[str, Any]:
```

**Key Implementation Details:**

- Tavily client initialized at module-level: `tavily_client = TavilyClient(api_key=settings.tavily_api_key) if settings.has_tavily else None`
- Graceful degradation if API key not configured (returns error dict, doesn't crash)
- Explicit agent instructions in docstring: "MUST synthesize information", "NEVER show raw JSON"
- Returns Tavily's native response format

**Return Structure:**

```python
# Success
{
    "results": [
        {
            "title": "Page Title",
            "url": "https://example.com",
            "content": "Relevant excerpt...",
            "score": 0.85  # Relevance 0-1
        }
    ],
    "query": "original search query"
}

# Error (API key missing)
{
    "error": "Tavily API key not configured. Please set TAVILY_API_KEY environment variable.",
    "query": "..."
}

# Error (search failure)
{
    "error": "Web search error: {exception}",
    "query": "..."
}
```

**Dependencies:**

- `tavily` (`TavilyClient` from `tavily-python` package)
- Environment variable: `TAVILY_API_KEY`

**Configuration:**

```python
# config.py
tavily_api_key = os.environ.get("TAVILY_API_KEY")
has_tavily = tavily_api_key is not None
```

#### Tool 3: `fetch_url` (lines 140-183)

**Purpose**: Fetch web page content and convert HTML to clean Markdown format for analysis.

**Function Signature:**

```python
def fetch_url(url: str, timeout: int = 30) -> dict[str, Any]:
```

**Key Implementation Details:**

- Uses `requests.get()` with custom User-Agent: `"Mozilla/5.0 (compatible; DeepAgents/1.0)"`
- Converts HTML to Markdown using `markdownify()` library
- Raises HTTP errors via `raise_for_status()`, then catches in exception handler
- Returns final URL after redirects
- Single catch-all exception handler for all errors

**Return Structure:**

```python
# Success
{
    "url": "https://final-url.com",
    "markdown_content": "# Title\n\nMarkdown content...",
    "status_code": 200,
    "content_length": 1523
}

# Error
{
    "error": "Fetch URL error: {exception}",
    "url": "https://original-url.com"
}
```

**Dependencies:**

- `requests` - HTTP client
- `markdownify` - HTML to Markdown conversion

**Test Coverage** (`.refs/deepagents/libs/deepagents-cli/tests/unit_tests/tools/test_fetch_url.py`):

- Success case with HTML → Markdown validation
- HTTP 404 error handling
- Timeout handling
- Connection error handling
- Uses `responses` library for HTTP mocking with `@responses.activate` decorator

#### Common Patterns Across All Tools

1. **Error Response Consistency**: All tools return structured dicts on error, never raise exceptions
2. **Graceful Degradation**: `web_search` checks API key availability before execution
3. **Agent Guidance in Docstrings**: Both `web_search` and `fetch_url` include explicit LLM instructions
4. **Timeout Defaults**: All network operations default to 30-second timeout
5. **Module-level Initialization**: Tavily client created when module loads (not per-request)

---

### 2. TypeScript Reference Implementation

**Location**: `.refs/deepagentsjs/examples/research/research-agent.ts`

#### `internetSearch` Tool (lines 12-64)

**Purpose**: Demonstrates LangChain tool definition with Tavily integration for research workflows.

**Implementation Pattern:**

```typescript
import { tool } from "langchain";
import { z } from "zod";
import { TavilySearch } from "@langchain/tavily";

const internetSearch = tool(
  async ({ query, maxResults, topic, includeRawContent }) => {
    const tavilySearch = new TavilySearch({
      maxResults,
      tavilyApiKey: process.env.TAVILY_API_KEY,
      includeRawContent,
      topic,
    });
    const tavilyResponse = await tavilySearch._call({ query });
    return tavilyResponse;
  },
  {
    name: "internet_search",
    description: "Run a web search",
    schema: z.object({
      query: z.string().describe("The search query"),
      maxResults: z.number().optional().default(5),
      topic: z.enum(["general", "news", "finance"]).optional().default("general"),
      includeRawContent: z.boolean().optional().default(false),
    }),
  }
);
```

**Key Architectural Elements:**

1. **LangChain Tool Wrapper**: First arg = implementation function, second arg = metadata object
2. **Zod Schema Validation**: Runtime type checking with descriptions for LLM
3. **Type Safety**: TypeScript types + Zod schemas provide compile-time + runtime validation
4. **TavilySearch Class**: From `@langchain/tavily` package (devDependency)
5. **Private API Usage**: Uses `._call()` internal method (note: type suppression with `@ts-ignore`)

**Agent Integration:**

```typescript
// Main agent (line 206)
export const agent = createDeepAgent({
  model: new ChatAnthropic({ model: "claude-sonnet-4-20250514" }),
  tools: [internetSearch],  // Tool array
  systemPrompt: researchInstructions,
  subagents: [critiqueSubAgent, researchSubAgent],
});

// Research subagent (lines 72-78)
const researchSubAgent: SubAgent = {
  name: "research-agent",
  description: "Used to research more in depth questions...",
  systemPrompt: subResearchPrompt,
  tools: [internetSearch],  // Same tool shared with subagent
};
```

**Workflow Pattern**: Main agent → delegates to research subagent → subagent uses `internetSearch` → returns synthesis → main agent writes report → critique subagent reviews → iterate

**System Prompt Integration** (lines 194-197):

```markdown
## `internet_search`

Use this to run an internet search for a given query.
You can specify the number of results, the topic,
and whether raw content should be included.
```

**Dependencies** (from `package.json`):

```json
{
  "dependencies": {
    "@langchain/anthropic": "^1.0.0",
    "@langchain/core": "^1.0.0",
    "@langchain/langgraph": "^1.0.0",
    "langchain": "^1.0.4",
    "zod": "^4.1.11"
  },
  "devDependencies": {
    "@langchain/tavily": "^1.0.0"
  }
}
```

#### Comparison: Python vs TypeScript

| Aspect | TypeScript (LangChain) | Python (DeepAgents CLI) |
|--------|------------------------|-------------------------|
| **Tool wrapper** | `tool()` function from `langchain` | Direct function with docstring |
| **Type system** | Zod schema + TypeScript types | Type hints + Literal types |
| **API client** | `TavilySearch` class from `@langchain/tavily` | `TavilyClient` from `tavily-python` |
| **Error handling** | Not shown (relies on TavilySearch internals) | Explicit try/catch with error dict return |
| **Schema location** | Separate `schema` object in tool metadata | Derived from function signature + docstring |
| **Conditional inclusion** | Always included | Only added if `settings.has_tavily` |

---

### 3. Tavily API Documentation

**Source**: <https://docs.tavily.com/>

#### Overview

Tavily is a **Web Access Layer for AI Agents** providing fast, reliable search APIs optimized for LLMs and RAG applications.

**Key Highlights:**

- 800K+ developers worldwide
- **93.3% accuracy** on OpenAI's SimpleQA benchmark (vs 85.9% Perplexity, 82.2% Google)
- Free tier: **1,000 API credits/month** (no credit card required)
- Production rate limits: **1,000 requests/minute**
- Official Python and JavaScript/TypeScript SDKs

#### API Endpoints

**A. Tavily Search API** (Primary endpoint for `web_search` tool)

**Endpoint**: `POST /search`

**Core Parameters:**

| Parameter | Type | Default | Description | Cost Impact |
|-----------|------|---------|-------------|-------------|
| `query` | string | **required** | Search query | - |
| `search_depth` | enum | `basic` | `basic` or `advanced` | 1 vs 2 credits |
| `max_results` | integer | 5 | Max results (0-20) | - |
| `topic` | enum | `general` | `general`, `news`, `finance` | - |
| `include_raw_content` | bool/enum | false | Include raw HTML: `true`/`markdown`/`text` | More tokens |
| `include_answer` | bool/enum | false | LLM-generated answer: `true`/`basic`/`advanced` | - |
| `time_range` | enum | - | `day`, `week`, `month`, `year` | - |
| `include_domains` | string[] | - | Whitelist (max 300) | - |
| `exclude_domains` | string[] | - | Blacklist (max 150) | - |

**Response Structure:**

```json
{
  "query": "Who is Leo Messi?",
  "answer": "Lionel Messi... [LLM-generated summary]",
  "results": [
    {
      "title": "Lionel Messi Facts | Britannica",
      "url": "https://www.britannica.com/facts/Lionel-Messi",
      "content": "Relevant excerpt...",
      "score": 0.81025416,
      "raw_content": null
    }
  ],
  "response_time": "1.67",
  "usage": { "credits": 1 }
}
```

**B. Tavily Extract API**

Extract structured data from specified URLs (up to 20 per request).

**Cost**: 1 credit per 5 successful extractions (basic), 2 credits per 5 (advanced)

**C. Tavily Map API** (Beta)

Discover and visualize website structure.

**Cost**: 1 credit per 10 pages (regular), 2 credits per 10 pages (with instructions)

**D. Tavily Crawl API** (Invite-only Beta)

Traverse website content starting from base URL.

**Cost**: Mapping cost + Extraction cost

#### Authentication

**Method**: Bearer token

**Header Format:**

```
Authorization: Bearer tvly-YOUR_API_KEY
```

**Getting API Key:**

1. Sign up at <https://app.tavily.com/home>
2. Copy API key from dashboard
3. Free tier: 1,000 credits/month

#### Rate Limits

| Environment | Requests per Minute |
|-------------|---------------------|
| Development | 100 |
| Production | 1,000 |

#### Pricing Tiers

| Plan | Credits/Month | Monthly Price | Price per Credit |
|------|---------------|---------------|------------------|
| **Researcher** (Free) | 1,000 | Free | - |
| **Project** | 4,000 | $30 | $0.0075 |
| **Bootstrap** | 15,000 | $100 | $0.0067 |
| **Startup** | 38,000 | $220 | $0.0058 |
| **Growth** | 100,000 | $500 | $0.005 |
| **Pay-as-you-go** | Per usage | - | $0.008/credit |

**Credit Costs:**

- Basic search: **1 API credit**
- Advanced search: **2 API credits**

#### Client Libraries

**Python SDK**: `tavily-python`

```bash
pip install tavily-python
```

```python
from tavily import TavilyClient

tavily_client = TavilyClient(api_key="tvly-YOUR_API_KEY")
response = tavily_client.search("Who is Leo Messi?")
```

**JavaScript/TypeScript SDK**: `@tavily/core`

```bash
npm install @tavily/core
```

```javascript
const { tavily } = require("@tavily/core");
const tvly = tavily({ apiKey: "tvly-YOUR_API_KEY" });
const response = await tvly.search("Who is Leo Messi?");
```

#### Best Practices

1. Use `search_depth: "basic"` for cost efficiency (1 credit vs 2)
2. Enable `include_answer: "advanced"` for detailed summaries
3. Apply `time_range` filters for news/current events
4. Use `include_domains`/`exclude_domains` for targeted searches
5. Monitor credit usage via dashboard: <https://app.tavily.com>
6. Upgrade to Production keys for higher rate limits

#### Additional Resources

- **Documentation**: <https://docs.tavily.com/>
- **GitHub**: <https://github.com/tavily-ai>
- **API Reference**: <https://docs.tavily.com/documentation/api-reference/endpoint/search>
- **Community**: <https://community.tavily.com>
- **Status**: <https://status.tavily.com>

---

### 4. HTML-to-Markdown Libraries

#### Python: markdownify

**Source**: <https://github.com/matthewwithanm/python-markdownify> | <https://pypi.org/project/markdownify/>

**Usage in Reference**: Used in `fetch_url` tool (`.refs/deepagents/libs/deepagents-cli/deepagents_cli/tools.py:174`)

**Installation:**

```bash
pip install markdownify
```

**Basic Usage:**

```python
from markdownify import markdownify as md
md('<b>Yay</b> <a href="http://github.com">GitHub</a>')
# Output: '**Yay** [GitHub](http://github.com)'
```

**Key Configuration Options:**

- `strip`: List of tags to remove
- `heading_style`: `ATX` (`#`) or `SETEXT` (underlined)
- `strong_em_symbol`: `ASTERISK` or `UNDERSCORE`
- `autolinks`: Use `<url>` when link text matches href
- `escape_asterisks`, `escape_underscores`: Control character escaping

#### TypeScript: Turndown (Recommended)

**Source**: <https://github.com/mixmark-io/turndown> | <https://www.npmjs.com/package/turndown>

**Popularity**: ⭐ **10.5k stars** | 63.5k+ dependents on npm

**Why Recommended:**

- Most mature and well-tested HTML-to-Markdown converter for JavaScript
- Extensive plugin ecosystem (GFM support via `turndown-plugin-gfm`)
- Highly configurable with custom rules
- Active maintenance and large community

**Installation:**

```bash
npm install turndown
```

**Basic Usage:**

```typescript
import TurndownService from 'turndown';

const turndownService = new TurndownService();
const markdown = turndownService.turndown('<h1>Hello world!</h1>');
```

**Configuration Options:**

| Option | Values | Default |
|--------|--------|---------|
| `headingStyle` | `setext` or `atx` | `setext` |
| `bulletListMarker` | `-`, `+`, or `*` | `*` |
| `codeBlockStyle` | `indented` or `fenced` | `indented` |
| `fence` | `` ``` `` or `~~~` | `` ``` `` |
| `emDelimiter` | `_` or `*` | `_` |
| `strongDelimiter` | `**` or `__` | `**` |
| `linkStyle` | `inlined` or `referenced` | `inlined` |

**Custom Rules Example:**

```typescript
turndownService.addRule('strikethrough', {
  filter: ['del', 's', 'strike'],
  replacement: function (content) {
    return '~' + content + '~';
  }
});
```

**Methods:**

- `addRule(key, rule)`: Add custom conversion rules
- `keep(filter)`: Keep certain elements as HTML
- `remove(filter)`: Remove elements entirely
- `use(plugin)`: Apply plugins for extended functionality

#### Alternative: node-html-markdown

**Source**: <https://github.com/crosstype/node-html-markdown>

**Performance**: **~1.57x faster** than Turndown (especially with instance reuse)

**Installation:**

```bash
npm install node-html-markdown
```

**Usage:**

```typescript
import { NodeHtmlMarkdown } from 'node-html-markdown';

// Static API
NodeHtmlMarkdown.translate('<b>hello</b>');

// Instance API (faster for multiple conversions)
const nhm = new NodeHtmlMarkdown();
nhm.translate('<b>hello</b>');
```

**When to Use:**

- Speed is critical
- Processing many documents
- Need table support

#### Content Extraction: @mozilla/readability

**Source**: <https://github.com/mozilla/readability>

**Popularity**: ⭐ **10.7k stars** | 9.7k+ dependents

**Purpose**: Extract main article content from cluttered web pages (used in Firefox Reader View)

**Note**: This is NOT a markdown converter, but a **preprocessor** that extracts clean content before conversion.

**Usage:**

```javascript
const { Readability } = require('@mozilla/readability');
const { JSDOM } = require('jsdom');

const doc = new JSDOM(html, { url: baseUrl });
const article = new Readability(doc.window.document).parse();

// article.content is clean HTML
// article.textContent is plain text
```

**Output Object:**

```javascript
{
  title: "Article title",
  content: "HTML string of processed content",
  textContent: "Plain text content",
  length: 12345,
  excerpt: "Short excerpt",
  byline: "Author name"
}
```

**Recommended Pipeline for Web Scraping:**

```typescript
// 1. Fetch HTML
const response = await fetch(url);
const html = await response.text();

// 2. Parse DOM
const dom = new JSDOM(html, { url });

// 3. Extract article content (optional, for web pages)
const reader = new Readability(dom.window.document);
const article = reader.parse();

// 4. Convert to Markdown
const turndown = new TurndownService({ headingStyle: 'atx' });
const markdown = turndown.turndown(article.content);
```

#### Comparison Matrix

| Library | GitHub Stars | Speed | Tables | Extensibility | Active Maintenance |
|---------|--------------|-------|--------|---------------|-------------------|
| **turndown** | 10.5k | Good | No | High | ✅ Active |
| **node-html-markdown** | N/A | **Fastest** | Yes | High | ✅ Active |
| **@mozilla/readability** | 10.7k | Good | N/A | Low | ✅ Active (Mozilla) |
| **markdownify** (Python) | N/A | Good | Yes | High | ✅ Active |

---

### 5. AI SDK v6 Tool Patterns (Current Codebase)

**Locations**:

- `src/tools/filesystem.ts` - Filesystem tools
- `src/tools/todos.ts` - Todo management
- `src/tools/subagent.ts` - Subagent spawning
- `src/tools/execute.ts` - Shell execution
- `src/agent.ts:147-193` - Tool registration

#### Core Tool Definition Pattern

```typescript
import { tool } from "ai";
import { z } from "zod";

const myTool = tool({
  description: "Human-readable description for the LLM",
  inputSchema: z.object({
    param1: z.string().describe("Parameter description"),
    param2: z.number().default(100).describe("Optional with default"),
  }),
  execute: async ({ param1, param2 }, { toolCallId }) => {
    // Implementation
    return "Result string for the LLM";
  },
});
```

**Key Components:**

1. **Description**: Tells LLM when and how to use the tool
2. **Input Schema**: Zod object schema with `.describe()` on every field
3. **Execute Function**: Async function receiving args + context (`{ toolCallId }`)

#### Factory Function Pattern

All tools are created by factory functions, not exported directly:

```typescript
// src/tools/filesystem.ts:52-88
function createLsTool(
  state: DeepAgentState,
  backend: BackendProtocol | BackendFactory,
  onEvent?: EventCallback
) {
  return tool({
    description: LS_TOOL_DESCRIPTION,
    inputSchema: z.object({
      path: z.string().default("/").describe("Directory path to list"),
    }),
    execute: async ({ path }) => {
      const resolvedBackend = getBackend(backend, state);
      const infos = await resolvedBackend.lsInfo(path || "/");

      // Emit event if callback provided
      if (onEvent) {
        onEvent({ type: "ls", path: path || "/", count: infos.length });
      }

      return infos.map(info =>
        info.is_dir ? `${info.path} (directory)` : info.path
      ).join("\n");
    },
  });
}
```

**Pattern**: Factory accepts shared state + configuration, returns configured tool instance.

#### State Access Pattern

Tools receive shared state reference and can read/mutate it:

```typescript
// Tool creation (agent.ts:147-159)
private createTools(state: DeepAgentState, onEvent?: EventCallback): ToolSet {
  const todosTool = createTodosTool(state, onEvent);
  const filesystemTools = createFilesystemTools(state, {
    backend: this.backend,
    onEvent,
    toolResultEvictionLimit: this.toolResultEvictionLimit,
  });

  return {
    write_todos: todosTool,
    ...filesystemTools,
    ...this.userTools,
  };
}

// State mutation (todos.ts:49-75)
execute: async ({ todos, merge }) => {
  if (merge) {
    state.todos = Array.from(existingMap.values());  // Mutate shared state
  }
  return `Todo list updated successfully.`;
}
```

**Pattern**: State is scoped per agent invocation, tools share it via closure.

#### Event Emission Pattern

Tools emit events through optional callback for real-time streaming:

```typescript
// Event callback type (types.ts:1047)
export type EventCallback = (event: DeepAgentEvent) => void;

// Tool usage (filesystem.ts:64-71)
execute: async ({ path }) => {
  const infos = await resolvedBackend.lsInfo(path || "/");

  if (onEvent) {
    onEvent({
      type: "ls",
      path: path || "/",
      count: infos.length,
    });
  }

  return /* formatted result */;
}
```

**Pattern**: Emit events before returning tool result. Agent collects and yields during streaming.

#### Tool Options Pattern

Modern tools accept options objects for backward compatibility:

```typescript
// Options interface (filesystem.ts:365-372)
export interface CreateFilesystemToolsOptions {
  backend?: BackendProtocol | BackendFactory;
  onEvent?: EventCallback;
  toolResultEvictionLimit?: number;
}

// Tool creator (filesystem.ts:380-383)
export function createFilesystemTools(
  state: DeepAgentState,
  backendOrOptions?: BackendProtocol | BackendFactory | CreateFilesystemToolsOptions,
  onEvent?: EventCallback
) {
  // Handle both old and new API
  let backend: BackendProtocol | BackendFactory | undefined;
  let eventCallback: EventCallback | undefined = onEvent;
  let evictionLimit: number | undefined;

  if (backendOrOptions && typeof backendOrOptions === "object" && "backend" in backendOrOptions) {
    // New options API
    const options = backendOrOptions as CreateFilesystemToolsOptions;
    backend = options.backend;
    eventCallback = options.onEvent;
    evictionLimit = options.toolResultEvictionLimit;
  } else {
    // Old API (backend directly)
    backend = backendOrOptions as BackendProtocol | BackendFactory | undefined;
  }
}
```

#### Error Handling Pattern

Return errors as formatted strings the LLM can understand:

```typescript
// Return error strings (filesystem.ts:158-173)
execute: async ({ file_path, content }) => {
  const result = await resolvedBackend.write(file_path, content);

  if (result.error) {
    return result.error;  // Return error as string to LLM
  }

  return `Successfully wrote to '${file_path}'`;
}

// Try-catch with formatted errors (subagent.ts:193-207)
execute: async ({ description }) => {
  try {
    const result = await subagentAgent.generate({ prompt: description });
    return resultText;
  } catch (error: unknown) {
    const err = error as Error;
    const errorMessage = `Error executing subagent: ${err.message}`;

    if (onEvent) {
      onEvent({ type: "subagent-finish", result: errorMessage });
    }

    return errorMessage;  // Return error to LLM
  }
}
```

#### Tool Registration Pattern

Tools are composed into a `ToolSet` object with conditional inclusion:

```typescript
// Tool composition (agent.ts:147-193)
private createTools(state: DeepAgentState, onEvent?: EventCallback): ToolSet {
  const todosTool = createTodosTool(state, onEvent);
  const filesystemTools = createFilesystemTools(state, {
    backend: this.backend,
    onEvent,
    toolResultEvictionLimit: this.toolResultEvictionLimit,
  });

  let allTools: ToolSet = {
    write_todos: todosTool,
    ...filesystemTools,      // Spreads: ls, read_file, write_file, edit_file, glob, grep
    ...this.userTools,       // User-provided custom tools
  };

  // Conditionally add execute tool
  if (this.hasSandboxBackend) {
    const sandboxBackend = this.backend as SandboxBackendProtocol;
    allTools.execute = createExecuteTool({ backend: sandboxBackend, onEvent });
  }

  // Conditionally add subagent tool
  if (this.subagentOptions.includeGeneralPurposeAgent || /* ... */) {
    allTools.task = createSubagentTool(state, { /* ... */ });
  }

  // Apply approval configuration
  allTools = applyInterruptConfig(allTools, this.interruptOn);

  return allTools;
}
```

#### Tool Approval/HITL Pattern

Tools can be wrapped for approval before execution:

```typescript
// approval.ts:116-183
export function wrapToolsWithApproval(
  tools: ToolSet,
  interruptOn: InterruptOnConfig | undefined,
  onApprovalRequest: ApprovalCallback | undefined
): ToolSet {
  const result: ToolSet = {};

  for (const [name, existingTool] of Object.entries(tools)) {
    const config = interruptOn[name];

    if (config === undefined || config === false) {
      result[name] = existingTool;  // No wrapping needed
    } else {
      const originalExecute = existingTool.execute;

      result[name] = tool({
        description: existingTool.description,
        inputSchema: existingTool.inputSchema,
        execute: async (args, options) => {
          // Check if approval is needed
          const needsApproval = await checkNeedsApproval(config, args);

          if (needsApproval) {
            const approved = await onApprovalRequest?.({
              toolName: name,
              args,
            });

            if (!approved) {
              return `Tool execution denied by user.`;
            }
          }

          return originalExecute(args, options);
        },
      });
    }
  }

  return result;
}

// Dynamic approval configuration (types.ts:220-228)
interruptOn: {
  execute: true,        // Always require approval
  write_file: true,
  edit_file: {          // Dynamic approval based on args
    shouldApprove: (args) => !args.file_path.startsWith('/tmp/')
  },
}
```

#### Key Conventions

1. **Tool naming**: Use snake_case (`web_search`, `fetch_url`, `http_request`)
2. **Factory pattern**: Tools created by factory functions accepting state + options
3. **State sharing**: State passed as parameter, tools mutate directly
4. **Event-driven**: Tools emit events through callbacks for real-time feedback
5. **Error as strings**: Errors returned as formatted strings for LLM consumption
6. **Async by default**: All execute functions are async
7. **Descriptive schemas**: Every Zod field has `.describe()` for LLM guidance
8. **Tool context**: Use `toolCallId` from context for tracking and eviction

---

## Code References

### Python Reference Implementation

- `.refs/deepagents/libs/deepagents-cli/deepagents_cli/tools.py:15-87` - `http_request` implementation
- `.refs/deepagents/libs/deepagents-cli/deepagents_cli/tools.py:90-137` - `web_search` implementation
- `.refs/deepagents/libs/deepagents-cli/deepagents_cli/tools.py:140-183` - `fetch_url` implementation
- `.refs/deepagents/libs/deepagents-cli/deepagents_cli/tools.py:11-12` - Tavily client initialization
- `.refs/deepagents/libs/deepagents-cli/tests/unit_tests/tools/test_fetch_url.py` - Unit tests

### TypeScript Reference Implementation

- `.refs/deepagentsjs/examples/research/research-agent.ts:12-64` - `internetSearch` tool definition
- `.refs/deepagentsjs/examples/research/research-agent.ts:206` - Agent integration
- `.refs/deepagentsjs/examples/research/research-agent.ts:72-78` - Subagent configuration
- `.refs/deepagentsjs/package.json:42-57` - Dependencies

### Current Codebase Patterns

- `src/tools/filesystem.ts:52-88` - Factory function pattern (`createLsTool`)
- `src/tools/filesystem.ts:100-141` - Context usage (`toolCallId`)
- `src/tools/todos.ts:9-18` - Nested Zod schemas
- `src/tools/todos.ts:49-75` - State mutation
- `src/agent.ts:147-193` - Tool registration and composition
- `src/utils/approval.ts:116-183` - Tool wrapping for HITL

---

## Implementation Recommendations

### 1. Recommended Technology Stack

**For Web Search (`web_search`):**

- **Provider**: Tavily API (93.3% accuracy, 1,000 free credits/month)
- **Client**: `@tavily/core` npm package
- **Configuration**: Environment variable `TAVILY_API_KEY`
- **Cost**: 1 credit per basic search (5,000 free searches/month)

**For URL Fetching (`fetch_url`):**

- **HTTP Client**: Node.js built-in `fetch()` or `undici` for better control
- **HTML Parser**: `jsdom` for DOM parsing
- **Content Extraction**: `@mozilla/readability` (optional, for extracting article content)
- **Markdown Converter**: `turndown` (10.5k stars, mature, well-tested)

**For Generic HTTP (`http_request`):**

- **HTTP Client**: Node.js built-in `fetch()` or `undici`
- **Timeout**: Default 30 seconds (match Python implementation)

### 2. Implementation Structure

Create new file: `src/tools/web.ts`

```typescript
import { tool } from "ai";
import { z } from "zod";
import { tavily } from "@tavily/core";
import TurndownService from "turndown";
import { Readability } from "@mozilla/readability";
import { JSDOM } from "jsdom";

export interface CreateWebToolsOptions {
  onEvent?: EventCallback;
  toolResultEvictionLimit?: number;
  tavilyApiKey?: string;
  timeout?: number;
}

export function createWebTools(
  state: DeepAgentState,
  options?: CreateWebToolsOptions
) {
  return {
    web_search: createWebSearchTool(state, options),
    fetch_url: createFetchUrlTool(state, options),
    http_request: createHttpRequestTool(state, options),
  };
}
```

### 3. Tool Signatures

**`web_search`:**

```typescript
inputSchema: z.object({
  query: z.string().describe("The search query (be specific and detailed)"),
  max_results: z.number().default(5).describe("Number of results to return (1-20)"),
  topic: z.enum(["general", "news", "finance"]).default("general"),
  include_raw_content: z.boolean().default(false).describe("Include full page content (warning: uses more tokens)"),
})
```

**`fetch_url`:**

```typescript
inputSchema: z.object({
  url: z.string().url().describe("The URL to fetch (must be valid HTTP/HTTPS URL)"),
  timeout: z.number().default(30).describe("Request timeout in seconds"),
  extract_article: z.boolean().default(true).describe("Extract main article content using Readability"),
})
```

**`http_request`:**

```typescript
inputSchema: z.object({
  url: z.string().url().describe("Target URL"),
  method: z.enum(["GET", "POST", "PUT", "DELETE", "PATCH"]).default("GET"),
  headers: z.record(z.string()).optional().describe("HTTP headers"),
  body: z.union([z.string(), z.record(z.any())]).optional().describe("Request body (string or JSON object)"),
  params: z.record(z.string()).optional().describe("URL query parameters"),
  timeout: z.number().default(30).describe("Request timeout in seconds"),
})
```

### 4. Error Handling

Follow existing pattern: return error strings, never throw:

```typescript
execute: async ({ url, timeout }) => {
  try {
    const response = await fetch(url, {
      signal: AbortSignal.timeout(timeout * 1000),
      headers: { "User-Agent": "Mozilla/5.0 (compatible; DeepAgents/1.0)" },
    });

    if (!response.ok) {
      return `HTTP error: ${response.status} ${response.statusText}`;
    }

    const html = await response.text();
    const markdown = convertToMarkdown(html, url);

    return markdown;
  } catch (error: unknown) {
    const err = error as Error;
    if (err.name === "TimeoutError") {
      return `Request timed out after ${timeout} seconds`;
    }
    return `Error fetching URL: ${err.message}`;
  }
}
```

### 5. Event Emission

Emit events before returning for real-time feedback:

```typescript
execute: async ({ query, max_results }) => {
  if (options?.onEvent) {
    options.onEvent({
      type: "web-search-start",
      query,
      max_results,
    });
  }

  const results = await tavilyClient.search(query, { maxResults: max_results });

  if (options?.onEvent) {
    options.onEvent({
      type: "web-search-finish",
      query,
      results_count: results.results.length,
    });
  }

  return formatResults(results);
}
```

### 6. Tool Result Eviction

For large responses (HTML content), use existing eviction utility:

```typescript
import { evictToolResult } from "../utils/evict";

execute: async ({ url }, { toolCallId }) => {
  const html = await fetchHtml(url);
  const markdown = convertToMarkdown(html);

  if (options?.toolResultEvictionLimit) {
    const evictResult = await evictToolResult({
      result: markdown,
      toolCallId: toolCallId || `fetch_${Date.now()}`,
      toolName: "fetch_url",
      backend: resolvedBackend,
      tokenLimit: options.toolResultEvictionLimit,
    });
    return evictResult.content;
  }

  return markdown;
}
```

### 7. Tool Approval Configuration

Apply HITL for potentially risky operations:

```typescript
// In agent configuration
const agent = createDeepAgent({
  model: anthropic('claude-sonnet-4-20250514'),
  interruptOn: {
    web_search: true,  // Require approval for web searches
    fetch_url: true,   // Require approval for fetching URLs
    http_request: {    // Dynamic approval based on method
      shouldApprove: (args) => args.method !== "GET"
    },
  },
});
```

### 8. Conditional Tool Registration

Only add web tools if API keys configured:

```typescript
// In agent.ts
private createTools(state: DeepAgentState, onEvent?: EventCallback): ToolSet {
  let allTools: ToolSet = {
    write_todos: createTodosTool(state, onEvent),
    ...createFilesystemTools(state, { backend: this.backend, onEvent }),
  };

  // Add web tools if Tavily API key available
  if (process.env.TAVILY_API_KEY) {
    const webTools = createWebTools(state, {
      onEvent,
      toolResultEvictionLimit: this.toolResultEvictionLimit,
      tavilyApiKey: process.env.TAVILY_API_KEY,
    });
    allTools = { ...allTools, ...webTools };
  }

  return allTools;
}
```

### 9. Dependencies to Add

**package.json:**

```json
{
  "dependencies": {
    "@tavily/core": "^1.0.0",
    "turndown": "^7.2.0",
    "@mozilla/readability": "^0.5.0",
    "jsdom": "^25.0.0"
  }
}
```

### 10. Testing Strategy

Follow existing test patterns with mock libraries:

```typescript
// tests/tools/web.test.ts
import { test, expect } from "bun:test";
import { createWebTools } from "../src/tools/web";

test("fetch_url converts HTML to markdown", async () => {
  // Mock fetch response
  globalThis.fetch = async () => ({
    ok: true,
    status: 200,
    text: async () => "<html><h1>Test</h1><p>Content</p></html>",
  });

  const tools = createWebTools({} as DeepAgentState);
  const result = await tools.fetch_url.execute({
    url: "https://example.com",
    timeout: 30,
  });

  expect(result).toContain("# Test");
  expect(result).toContain("Content");
});
```

---

## Architecture Documentation

### Tool Integration Flow

```
User Input → Agent → Tool Selection → Parameter Validation (Zod)
                ↓
         Tool Approval Check (if configured)
                ↓
         Tool Execution (async)
                ↓
         Event Emission (onEvent callback)
                ↓
         Result Eviction (if large)
                ↓
         Return formatted string to LLM
```

### Web Search Workflow

```
Agent calls web_search({ query: "...", max_results: 5 })
    ↓
Check Tavily API key (fail gracefully if missing)
    ↓
Emit "web-search-start" event
    ↓
Call Tavily API: POST /search
    ↓
Receive results array with titles, URLs, content, scores
    ↓
Emit "web-search-finish" event
    ↓
Format results as markdown string
    ↓
Return to agent for synthesis
```

### Fetch URL Workflow

```
Agent calls fetch_url({ url: "...", extract_article: true })
    ↓
Emit "fetch-url-start" event
    ↓
Fetch HTML with timeout (AbortSignal)
    ↓
Parse DOM with JSDOM
    ↓
If extract_article: Apply Readability to extract main content
    ↓
Convert HTML to Markdown with Turndown
    ↓
Emit "fetch-url-finish" event
    ↓
Check eviction limit, save to filesystem if needed
    ↓
Return markdown string to agent
```

### HTTP Request Workflow

```
Agent calls http_request({ url: "...", method: "POST", body: {...} })
    ↓
Check approval (if method !== GET)
    ↓
Emit "http-request-start" event
    ↓
Build fetch options (headers, body, params, timeout)
    ↓
Execute fetch with AbortSignal
    ↓
Parse response (JSON if possible, else text)
    ↓
Emit "http-request-finish" event
    ↓
Return structured result as formatted string
```

---

## Historical Context

### Related Research

- This research builds on the existing tool architecture documented in:
  - `src/tools/filesystem.ts` - Filesystem tool patterns
  - `src/tools/todos.ts` - State management patterns
  - `src/tools/subagent.ts` - Async delegation patterns
  - `src/utils/approval.ts` - HITL implementation

### Feature Tracking

**PROJECT-STATE.md Status**:

- Currently in "To Implement → Medium Priority"
- Should be moved to "Implemented" after implementation

**Implementation Scope**:

- `web_search` - High priority (enables research capabilities)
- `http_request` - Medium priority (enables API integrations)
- `fetch_url` - Medium priority (enables web scraping)

---

## Open Questions

1. **Eviction Strategy**: Should we automatically evict all `fetch_url` results, or only when they exceed a threshold? The Python implementation doesn't have eviction, but raw HTML can be very large.

2. **Readability Optional**: Should `extract_article` be enabled by default for `fetch_url`? It adds complexity but provides cleaner output for news/blog pages.

3. **Rate Limiting**: Should we implement client-side rate limiting for Tavily to avoid hitting the 100/1000 RPM limits, or trust users to monitor their usage?

4. **Error Verbosity**: How detailed should error messages be? The Python implementation returns full exception strings, but this might leak sensitive information in some cases.

5. **Streaming Support**: Should we explore streaming responses for large `fetch_url` results instead of waiting for full response?

6. **Tool Descriptions**: Should we embed the same agent guidance from Python docstrings into our tool descriptions, or keep them in the system prompt?

7. **User-Agent Configuration**: Should the User-Agent header be configurable, or hardcoded as `"Mozilla/5.0 (compatible; DeepAgents/1.0)"`?

8. **HTTP Request Security**: Should we implement URL whitelist/blacklist for `http_request` to prevent SSRF attacks?

---

## Next Steps

1. **Install Dependencies**: Add `@tavily/core`, `turndown`, `@mozilla/readability`, `jsdom` to package.json
2. **Create Tool File**: Implement `src/tools/web.ts` following existing patterns
3. **Add Event Types**: Define `web-search-start`, `web-search-finish`, `fetch-url-start`, `fetch-url-finish`, `http-request-start`, `http-request-finish` in `src/types.ts`
4. **Update Agent**: Integrate web tools in `src/agent.ts` with conditional registration
5. **Add Tests**: Create `tests/tools/web.test.ts` with unit tests for all three tools
6. **Update Documentation**: Add web tools to `AGENTS.md` and update `PROJECT-STATE.md`
7. **Create Example**: Add `examples/web-research.ts` demonstrating web search and fetch capabilities
8. **CLI Integration**: Add web tools to CLI with approval prompts in safe mode

---

## References

- Tavily API Documentation: <https://docs.tavily.com/>
- Tavily Python SDK: <https://github.com/tavily-ai/tavily-python>
- Tavily JS SDK: <https://github.com/tavily-ai/tavily-js>
- Turndown: <https://github.com/mixmark-io/turndown>
- Mozilla Readability: <https://github.com/mozilla/readability>
- markdownify (Python): <https://github.com/matthewwithanm/python-markdownify>
- LangChain DeepAgents (Python): `.refs/deepagents/`
- LangChain DeepAgents (JS): `.refs/deepagentsjs/`
