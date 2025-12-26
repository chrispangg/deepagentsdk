---
title: Subagent Web Tools Access - Investigation and Analysis
date: 2025-12-20
researcher: Research Agent
git_commit: 071941a2fcde7bcf803aa29632c5dec9bbda5630
branch: main
repository: ai-sdk-deep-agent
topic: "Subagent Web Tools Access - Investigation and Analysis"
tags: [research, subagent, web-tools, tool-inheritance, bug-analysis]
status: complete
last_updated: 2025-12-20
last_updated_by: Research Agent
---

## Research Question

Review `.agent/PROJECT-STATE.md` on **Subagent Web Tools Access** - is it true that subagents don't have access to web tools? If not, what tools do they have available? In our `.deepagents/agents/example-agent.md` file, we should be able to pass in a set of tools that the subagent can use, similar to the claudecode agents.

## Summary

**The PROJECT-STATE.md bug report is ACCURATE**: Subagents spawned via the `task` tool do **NOT** inherit web tools (`web_search`, `http_request`, `fetch_url`) from their parent agent. This is a confirmed bug that limits subagent capabilities.

### Key Findings

1. **Bug Confirmed**: Subagents only inherit `userTools` (custom tools provided by the user), NOT the complete parent toolset including web tools
2. **Root Cause**: `src/agent.ts:256` only passes `this.userTools` to subagents, excluding built-in tools like web tools
3. **Current Subagent Tools**: Subagents receive:
   - `write_todos` (fresh instance)
   - Filesystem tools (`ls`, `read_file`, `write_file`, `edit_file`, `glob`, `grep`)
   - Parent's custom tools (if any)
   - **NOT**: Web tools, execute tool, or other conditional tools

4. **Agent Configuration Pattern**: The `.deepagents/agent.md` files currently store personality/instructions, NOT tool configurations
5. **Solution Path**: Requires changes to tool inheritance mechanism in `src/agent.ts` and `src/tools/subagent.ts`

## Detailed Findings

### Subagent Tool Inheritance Architecture

The tool inheritance system follows a layered approach where different types of tools are handled separately:

**Parent Agent Tool Assembly** (`src/agent.ts:214-273`):

- Built-in tools: `write_todos`, filesystem tools
- Conditional tools: Web tools (if TAVILY_API_KEY), execute tool (for sandboxes)
- User tools: Custom tools provided via `createDeepAgent({ tools: {...} })`
- Subagent tool: The `task` tool for spawning subagents

**Subagent Tool Inheritance Gap** (`src/agent.ts:256`):

```typescript
const subagentTool = createSubagentTool(state, {
  defaultTools: this.userTools,  // ❌ ONLY passes user tools, not web tools
  // ...
});
```

**Subagent Tool Creation** (`src/tools/subagent.ts:177-185`):

```typescript
let allTools: ToolSet = {
  write_todos: todosTool,        // ✅ Fresh instance
  ...filesystemTools,            // ✅ Fresh instances
  ...subagentConfig.tools,       // ✅ Parent's user tools or subagent-specific tools
};
// ❌ Missing: Web tools, execute tool, other conditional tools
```

### Web Tools Implementation Analysis

**Web Tools Registration** (`src/agent.ts:228-237`):

```typescript
const webTools = createWebTools(state, {
  backend: this.backend,
  onEvent,
  toolResultEvictionLimit: this.toolResultEvictionLimit,
});
if (Object.keys(webTools).length > 0) {
  allTools = { ...allTools, ...webTools };  // Added to parent
}
// ❌ But NOT stored for inheritance by subagents
```

**Available Web Tools** (`src/tools/web.ts`):

1. `web_search` - Uses Tavily API for web search
2. `http_request` - Generic HTTP client for API calls
3. `fetch_url` - Fetches web pages and converts to Markdown

These tools are automatically added to agents when `TAVILY_API_KEY` environment variable is present, but are not passed to subagents.

### Current .deepagents Configuration Pattern

**Existing Structure**:

```
.deepagents/
├── {agentId}/
│   ├── agent.md          # Personality and preferences (plain markdown)
│   ├── decisions.md      # Additional memory files
│   └── *.md             # Other context files
└── skills/              # Project-level skills
    └── {skill-name}/
        └── SKILL.md      # Skill definitions with YAML frontmatter
```

**Current Limitations**:

- Agent files contain only personality/instructions, no tool configuration
- Skills are instructional, not functional tools
- Tool configuration is purely programmatic in TypeScript

### Comparison with Claude Code Agent Pattern

**Claude Code Agent Pattern** (from `.claude/agents/`):

```yaml
---
name: codebase-analyzer
description: Analyzes codebase implementation details
tools: Read, Grep, Glob, LS
model: claude-haiku-4-5-20251001
---
```

**Current ai-sdk-deep-agent Pattern**:

- No YAML frontmatter in agent.md files
- Tools specified programmatically, not in configuration files
- No mechanism to configure tool sets per agent type

## Code References

### Core Files Involved

1. **`src/agent.ts:256`** - Root cause: Only passes `this.userTools` to subagents
2. **`src/tools/subagent.ts:114`** - Subagent tool inheritance: `subagent.tools || defaultTools`
3. **`src/tools/subagent.ts:177-185`** - Subagent tool assembly logic
4. **`src/tools/web.ts:548`** - Web tools creation function
5. **`src/agent.ts:228-237`** - Web tools registration in parent agent

### Example Code Showing the Bug

```typescript
// Parent agent with web tools
const agent = createDeepAgent({
  model: anthropic("claude-sonnet-4-20250514"),
  // TAVILY_API_KEY present → parent gets web_search, http_request, fetch_url
});

// Parent can use web tools ✅
await agent.generate({ prompt: "Search the web for AI news" });

// Subagent spawned via task tool ❌
await agent.generate({ prompt: "Use the task tool to search the web" });
// Subagent receives: write_todos + filesystem + user tools
// Subagent does NOT receive: web_search, http_request, fetch_url
```

## Architecture Documentation

### Tool Inheritance Flow

```
Parent Agent Creation:
├── Built-in tools (todos, filesystem)
├── Conditional tools
│   ├── Web tools (if API key) ❌ Not inherited
│   ├── Execute tool (if sandbox) ❌ Not inherited
│   └── Other conditional tools ❌ Not inherited
├── User tools ✅ Inherited
└── Subagent tool

Subagent Creation:
├── write_todos (new instance) ✅
├── filesystem tools (new instances) ✅
├── Parent's user tools ✅
└── Subagent-specific tools (if configured) ✅
```

### Tool Storage Architecture

```typescript
class DeepAgent {
  private userTools: ToolSet;              // ✅ Stored and passed to subagents
  // Missing: private allTools: ToolSet;   // ❌ Not stored for inheritance
  // Missing: private webTools: ToolSet;   // ❌ Not stored for inheritance
}
```

## Historical Context

From the codebase analysis:

1. **Feature Implementation**: Web tools were implemented as listed in PROJECT-STATE.md (line 26)
2. **Subagent Spawning**: Subagent tool creation was implemented (line 12)
3. **Missing Integration**: The connection between parent's web tools and subagent inheritance was overlooked
4. **Design Gap**: The architecture assumed only user-defined tools needed inheritance

## Related Research

- **Web Tools Usage Example**: `examples/web-research.ts` - Shows parent agent using web tools
- **Custom Tools Pattern**: `examples/with-custom-tools.ts` - Shows how user tools are inherited
- **Agent Memory System**: `src/middleware/agent-memory.ts` - Current .deepagents implementation focuses on personality, not tools

## Open Questions

1. **Scope of Inheritance**: Should subagents inherit ALL parent tools or only specific categories?
2. **Performance Impact**: Web tools require API keys and external services - should subagent access be controlled?
3. **Configuration Approach**: Should tool sets be configurable in `.deepagents/agent.md` files?
4. **Backward Compatibility**: How to ensure existing code doesn't break when fixing this?

## Potential Solutions

### Option 1: Full Tool Inheritance (Simplest)

Store complete parent toolset and pass to subagents:

```typescript
// In DeepAgent constructor
private allTools: ToolSet;

// Pass complete toolset to subagents
defaultTools: this.allTools
```

### Option 2: Selective Tool Inheritance

Add configuration for which tool categories to inherit:

```typescript
subagentOptions: {
  inheritWebTools: boolean;
  inheritExecuteTool: boolean;
  // ...
}
```

### Option 3: YAML Configuration in agent.md

Extend `.deepagents/agent.md` with tool configuration:

```yaml
---
name: research-agent
tools: [web_search, http_request, fetch_url, filesystem]
inherit_parent_tools: true
---
```

## Recommended Implementation Path

1. **Immediate Fix** (Option 1): Store complete toolset and pass to subagents
2. **Enhancement** (Option 3): Add YAML frontmatter support for tool configuration
3. **Backward Compatibility**: Ensure existing code continues to work

This would resolve the bug while enabling the desired functionality of configuring tool sets in `.deepagents/agent.md` files similar to Claude Code agents.
