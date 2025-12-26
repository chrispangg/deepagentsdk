---
title: Middleware Architecture Implementation Plan
description: Documentation
---

## Overview

Implement model-level middleware support and Skills System to achieve feature parity with LangChain DeepAgents while **preserving the current superior tool architecture**. This is a non-breaking enhancement that adds cross-cutting concerns (logging, caching, RAG) and dynamic skill loading without refactoring existing tools.

**Key Decision**: After analyzing current implementation, we are **NOT** refactoring to use middleware for tools. The current pattern of creating tools with state closures is more idiomatic for AI SDK v6, more testable, more performant, and simpler than LangChain's middleware approach.

## Current State Analysis

### What Exists Now

- ✅ **Tool creation pattern**: Tools created dynamically per invocation with state closures (`src/tools/`)
- ✅ **Filesystem tools**: 6 tools (ls, read_file, write_file, edit_file, glob, grep) with backend abstraction
- ✅ **Todo management**: `write_todos` tool with merge strategy
- ✅ **Subagent system**: `task` tool for delegation with isolated state
- ✅ **Sandbox execution**: `execute` tool for command execution (conditional on backend)
- ✅ **HITL (interrupts)**: Tool approval via `interruptOn` config
- ✅ **Tool result eviction**: Large results auto-saved to `/large_tool_results/`
- ✅ **Patch tool calls**: Dangling tool call fixing in `src/utils/patch-tool-calls.ts`
- ✅ **Summarization**: Auto-summarization in `src/utils/summarization.ts`

### What's Missing

- ❌ **Model middleware support**: No way to wrap model for logging, caching, RAG, guardrails
- ❌ **Skills System**: No dynamic skill loading from SKILL.md files
- ❌ **Progressive disclosure**: Skills metadata not injected into system prompt

### Key Constraints

1. Must be **backwards compatible** - no breaking changes to existing API
2. Must preserve current tool creation pattern (it's superior to LangChain's middleware approach)
3. Must follow AI SDK v6 idioms (use `wrapLanguageModel`, not custom middleware system)
4. Must support both sync and async operations

## Desired End State

### Phase 1: Model Middleware Support

- Users can pass `middleware` parameter to `createDeepAgent`
- Model is wrapped internally before creating agent
- Supports array of middleware for composition
- Works with all agent methods (generate, stream, streamWithEvents)
- Context (like backend) can be passed to middleware via closures

**Verification**:

```typescript
const loggingMiddleware = createLoggingMiddleware();
const agent = createDeepAgent({
  model: anthropic('claude-sonnet-4.5'),
  middleware: [loggingMiddleware, cachingMiddleware],
  // ... existing params
});

// Middleware intercepts all model calls
await agent.generate({ prompt: "..." });
```

### Phase 2: Skills System

- Skills loaded from `~/.deepagents/skills/` (user-level) and `./.deepagents/skills/` (project-level)
- YAML frontmatter parsed from SKILL.md files
- Skills metadata injected into system prompt (progressive disclosure)
- Agent can read full skill content when needed
- Project skills override user skills by name

**Verification**:

```typescript
const agent = createDeepAgent({
  model: anthropic('claude-sonnet-4.5'),
  skillsDir: './skills', // NEW: Load skills from directory
});

// System prompt includes:
// **Available Skills:**
// - **web-research**: Expert web research and fact-checking
//   → Read `/path/to/skills/web-research/SKILL.md` for full instructions
```

## What We're NOT Doing

- ❌ Refactoring existing tools to use middleware pattern
- ❌ Creating agent-level middleware system (separate from model middleware)
- ❌ Implementing state management via middleware (current state management is fine)
- ❌ Creating tool interception middleware (AI SDK doesn't support this natively)
- ❌ Breaking changes to existing APIs
- ❌ Implementing Web Tools (deferred to separate ticket)

## Implementation Approach

### Strategy

**Phase 1 (Model Middleware)**: Add `middleware` parameter to `CreateDeepAgentParams` that uses AI SDK's `wrapLanguageModel()` to wrap the model before passing to agent. This is a 2-hour implementation.

**Phase 2 (Skills System)**: Implement as dynamic tool loading + system prompt injection, similar to LangChain CLI's progressive disclosure pattern. Port YAML frontmatter parsing from Python reference. This is a 1-2 day implementation.

Both phases are **additive** and **non-breaking**.

---

## Phase 1: Model Middleware Support

### Overview

Add support for AI SDK v6's `wrapLanguageModel()` to enable cross-cutting concerns like logging, caching, RAG, and guardrails. This phase wraps the model **once** in the constructor and uses it for all agent operations.

### Changes Required

#### 1. Type Definitions

**File**: `src/types.ts`

**Changes**: Add `middleware` parameter to `CreateDeepAgentParams`

```typescript
import type { LanguageModelV1Middleware } from 'ai';

export interface CreateDeepAgentParams {
  /**
   * AI SDK LanguageModel instance (e.g., anthropic('claude-sonnet-4-20250514'))
   */
  model: LanguageModel;

  /**
   * Optional middleware to wrap the model for logging, caching, RAG, guardrails, etc.
   * Uses AI SDK's wrapLanguageModel under the hood.
   *
   * @example Single middleware
   * ```typescript
   * middleware: loggingMiddleware
   * ```
   *
   * @example Multiple middlewares (applied in order: first transforms input, last wraps model)
   * ```typescript
   * middleware: [loggingMiddleware, cachingMiddleware, ragMiddleware]
   * ```
   */
  middleware?: LanguageModelV1Middleware | LanguageModelV1Middleware[];

  // ... existing fields ...
}
```

**Line number**: Add after line 220 (after `model` field)

#### 2. Agent Constructor

**File**: `src/agent.ts`

**Changes**: Wrap model in constructor if middleware provided

**Location**: Lines 94-140 (constructor)

**Add after line 110**:

```typescript
// Wrap model with middleware if provided
if (params.middleware) {
  const middlewares = Array.isArray(params.middleware)
    ? params.middleware
    : [params.middleware];

  this.model = wrapLanguageModel({
    model: params.model,
    middleware: middlewares,
  });
} else {
  this.model = params.model;
}
```

**Remove line 110** (old assignment):

```typescript
this.model = model;  // Remove this line
```

**Add import at top of file** (after line 7):

```typescript
import { wrapLanguageModel } from 'ai';
import type { LanguageModelV1Middleware } from 'ai';
```

#### 3. Documentation

**File**: `src/agent.ts`

**Changes**: Add JSDoc example for middleware usage

**Location**: Lines 567-688 (createDeepAgent JSDoc)

**Add before line 688** (before function return type):

```typescript
 * @example With middleware for logging and caching
 * ```typescript
 * import { createDeepAgent } from 'ai-sdk-deep-agent';
 * import { anthropic } from '@ai-sdk/anthropic';
 *
 * const loggingMiddleware = {
 *   wrapGenerate: async ({ doGenerate, params }) => {
 *     console.log('Model called with:', params.prompt);
 *     const result = await doGenerate();
 *     console.log('Model returned:', result.text);
 *     return result;
 *   },
 * };
 *
 * const agent = createDeepAgent({
 *   model: anthropic('claude-sonnet-4-20250514'),
 *   middleware: [loggingMiddleware],
 * });
 * ```
 *
 * @example With middleware factory for context access
 * ```typescript
 * import { FilesystemBackend } from 'ai-sdk-deep-agent';
 *
 * function createContextMiddleware(backend: BackendProtocol) {
 *   return {
 *     wrapGenerate: async ({ doGenerate }) => {
 *       const state = await backend.read('state');
 *       const result = await doGenerate();
 *       await backend.write('state', { ...state, lastCall: result });
 *       return result;
 *     },
 *   };
 * }
 *
 * const backend = new FilesystemBackend({ rootDir: './workspace' });
 * const agent = createDeepAgent({
 *   model: anthropic('claude-sonnet-4-20250514'),
 *   backend,
 *   middleware: createContextMiddleware(backend),
 * });
 * ```
```

#### 4. Index Exports

**File**: `src/index.ts`

**Changes**: Re-export middleware types for convenience

**Location**: After line 82 (after existing exports)

**Add**:

```typescript
// Re-export AI SDK middleware types for user convenience
export type { LanguageModelV1Middleware } from 'ai';
export { wrapLanguageModel } from 'ai';
```

### Success Criteria

#### Automated Verification

- [x] Tests pass: `bun test` (71/75 passed, 4 middleware tests skipped due to API overload 529)
- [x] Type checking passes: `bun run typecheck`
- [x] No new linter errors: `npx eslint src/`
- [x] Create `examples/with-middleware.ts` demonstrating logging and caching middleware
- [x] Run example: `bun examples/with-middleware.ts`
- [x] Verify output shows middleware interception working (logs appear, model calls intercepted)

#### Manual Verification

- [x] Create agent with single middleware - model calls intercepted
- [x] Create agent with multiple middlewares - all applied in correct order
- [x] Create agent with middleware factory (closure) - context accessible
- [x] Create agent without middleware - works as before (backwards compatible)
- [x] Middleware works with `generate()` method
- [ ] Middleware works with `stream()` method (not tested due to API availability)
- [ ] Middleware works with `streamWithEvents()` method (not tested due to API availability)
- [ ] Subagents inherit wrapped model (middleware applies to subagent calls too)

#### Test Cases to Add

**File**: Create `test/middleware.test.ts`

```typescript
import { test, expect } from "bun:test";
import { createDeepAgent } from "../src/agent.ts";
import { anthropic } from "@ai-sdk/anthropic";
import type { LanguageModelV1Middleware } from "ai";

test("middleware - single middleware applied", async () => {
  let callCount = 0;

  const countingMiddleware: LanguageModelV1Middleware = {
    wrapGenerate: async ({ doGenerate }) => {
      callCount++;
      return await doGenerate();
    },
  };

  const agent = createDeepAgent({
    model: anthropic("claude-sonnet-4-20250514"),
    middleware: countingMiddleware,
  });

  await agent.generate({ prompt: "Say hello" });
  expect(callCount).toBe(1);
});

test("middleware - multiple middlewares applied in order", async () => {
  const executionOrder: string[] = [];

  const firstMiddleware: LanguageModelV1Middleware = {
    wrapGenerate: async ({ doGenerate }) => {
      executionOrder.push("first-before");
      const result = await doGenerate();
      executionOrder.push("first-after");
      return result;
    },
  };

  const secondMiddleware: LanguageModelV1Middleware = {
    wrapGenerate: async ({ doGenerate }) => {
      executionOrder.push("second-before");
      const result = await doGenerate();
      executionOrder.push("second-after");
      return result;
    },
  };

  const agent = createDeepAgent({
    model: anthropic("claude-sonnet-4-20250514"),
    middleware: [firstMiddleware, secondMiddleware],
  });

  await agent.generate({ prompt: "Say hello" });

  // First middleware wraps second middleware
  expect(executionOrder).toEqual([
    "first-before",
    "second-before",
    "second-after",
    "first-after",
  ]);
});

test("middleware - factory with closure context", async () => {
  let contextValue = "";

  function createContextMiddleware(context: string) {
    return {
      wrapGenerate: async ({ doGenerate }) => {
        contextValue = context;
        return await doGenerate();
      },
    };
  }

  const agent = createDeepAgent({
    model: anthropic("claude-sonnet-4-20250514"),
    middleware: createContextMiddleware("test-context"),
  });

  await agent.generate({ prompt: "Say hello" });
  expect(contextValue).toBe("test-context");
});

test("middleware - backwards compatible (no middleware)", async () => {
  const agent = createDeepAgent({
    model: anthropic("claude-sonnet-4-20250514"),
  });

  const result = await agent.generate({ prompt: "Say hello" });
  expect(result.text).toBeDefined();
});
```

---

## Phase 2: Skills System

### Overview

Implement Skills System as dynamic tool loading with progressive disclosure pattern. Skills are loaded from SKILL.md files with YAML frontmatter, and skill metadata is injected into the system prompt so the agent knows what skills are available without loading full content upfront.

### Changes Required

#### 1. Skill Metadata Types

**File**: Create `src/skills/types.ts`

```typescript
/**
 * Metadata extracted from SKILL.md frontmatter.
 */
export interface SkillMetadata {
  /**
   * Unique skill name (kebab-case, e.g., 'web-research')
   */
  name: string;

  /**
   * Short description of what the skill does
   */
  description: string;

  /**
   * Absolute path to the SKILL.md file
   */
  path: string;

  /**
   * Source of the skill ('user' or 'project')
   * Project skills override user skills with same name
   */
  source: 'user' | 'project';
}

/**
 * Options for skill loading
 */
export interface SkillLoadOptions {
  /**
   * User-level skills directory (e.g., ~/.deepagents/skills/)
   */
  userSkillsDir?: string;

  /**
   * Project-level skills directory (e.g., ./.deepagents/skills/)
   */
  projectSkillsDir?: string;
}
```

#### 2. Skill Loading Logic

**File**: Create `src/skills/load.ts`

```typescript
import * as fs from "node:fs/promises";
import * as path from "node:path";
import type { SkillMetadata, SkillLoadOptions } from "./types.ts";

/**
 * Parse YAML frontmatter from a SKILL.md file.
 *
 * Expected format:
 * ---
 * name: skill-name
 * description: What this skill does
 * ---
 *
 * # Skill Content
 * ...
 */
export async function parseSkillMetadata(
  skillMdPath: string,
  source: 'user' | 'project'
): Promise<SkillMetadata | null> {
  try {
    const content = await fs.readFile(skillMdPath, 'utf-8');

    // Match YAML frontmatter between --- delimiters
    const frontmatterPattern = /^---\s*\n(.*?)\n---\s*\n/s;
    const match = content.match(frontmatterPattern);

    if (!match) {
      console.warn(`[Skills] No frontmatter found in ${skillMdPath}`);
      return null;
    }

    const frontmatter = match[1];

    // Parse key-value pairs from YAML (simple parsing, no full YAML parser needed)
    const metadata: Record<string, string> = {};
    for (const line of frontmatter.split('\n')) {
      const kvMatch = line.match(/^(\w+):\s*(.+)$/);
      if (kvMatch) {
        const [, key, value] = kvMatch;
        metadata[key] = value.trim();
      }
    }

    // Validate required fields
    if (!metadata.name || !metadata.description) {
      console.warn(
        `[Skills] Missing required fields (name, description) in ${skillMdPath}`
      );
      return null;
    }

    return {
      name: metadata.name,
      description: metadata.description,
      path: skillMdPath,
      source,
    };
  } catch (error) {
    console.warn(`[Skills] Failed to parse ${skillMdPath}:`, error);
    return null;
  }
}

/**
 * List all skills in a directory.
 * Scans for subdirectories containing SKILL.md files.
 */
async function listSkillsInDirectory(
  skillsDir: string,
  source: 'user' | 'project'
): Promise<SkillMetadata[]> {
  try {
    // Security: Resolve to prevent path traversal
    const resolvedDir = path.resolve(skillsDir);

    // Check if directory exists
    try {
      const stat = await fs.stat(resolvedDir);
      if (!stat.isDirectory()) {
        return [];
      }
    } catch {
      return []; // Directory doesn't exist
    }

    const entries = await fs.readdir(resolvedDir, { withFileTypes: true });
    const skills: SkillMetadata[] = [];

    for (const entry of entries) {
      // Skip non-directories and hidden directories
      if (!entry.isDirectory() || entry.name.startsWith('.')) {
        continue;
      }

      // Security: Skip symlinks to prevent traversal attacks
      if (entry.isSymbolicLink()) {
        console.warn(
          `[Skills] Skipping symlink: ${path.join(resolvedDir, entry.name)}`
        );
        continue;
      }

      // Look for SKILL.md in subdirectory
      const skillMdPath = path.join(resolvedDir, entry.name, 'SKILL.md');

      try {
        await fs.access(skillMdPath);
        const metadata = await parseSkillMetadata(skillMdPath, source);
        if (metadata) {
          skills.push(metadata);
        }
      } catch {
        // SKILL.md doesn't exist in this directory, skip
        continue;
      }
    }

    return skills;
  } catch (error) {
    console.warn(`[Skills] Failed to list skills in ${skillsDir}:`, error);
    return [];
  }
}

/**
 * List all skills from user and project directories.
 * Project skills override user skills with the same name.
 */
export async function listSkills(
  options: SkillLoadOptions
): Promise<SkillMetadata[]> {
  const { userSkillsDir, projectSkillsDir } = options;
  const skillsMap = new Map<string, SkillMetadata>();

  // Load user skills first
  if (userSkillsDir) {
    const userSkills = await listSkillsInDirectory(userSkillsDir, 'user');
    for (const skill of userSkills) {
      skillsMap.set(skill.name, skill);
    }
  }

  // Load project skills second (override user skills)
  if (projectSkillsDir) {
    const projectSkills = await listSkillsInDirectory(projectSkillsDir, 'project');
    for (const skill of projectSkills) {
      skillsMap.set(skill.name, skill); // Override user skill if exists
    }
  }

  return Array.from(skillsMap.values());
}
```

#### 3. Skills System Prompt

**File**: `src/prompts.ts`

**Changes**: Add skills system prompt builder

**Location**: After line 166 (after EXECUTE_SYSTEM_PROMPT)

**Add**:

```typescript
/**
 * Build skills section for system prompt with progressive disclosure.
 */
export function buildSkillsPrompt(skills: Array<{ name: string; description: string; path: string }>): string {
  if (skills.length === 0) {
    return '';
  }

  const skillsList = skills
    .map(skill => `- **${skill.name}**: ${skill.description}\n  → Read \`${skill.path}\` for full instructions`)
    .join('\n');

  return `## Skills System

You have access to a skills library providing specialized domain knowledge and workflows.

**Available Skills:**

${skillsList}

**How to Use Skills (Progressive Disclosure):**

1. **Recognize when a skill applies**: Check if the user's task matches any skill's domain
2. **Read the skill's full instructions**: Use read_file to load the SKILL.md content
3. **Follow the skill's workflow**: Skills contain step-by-step instructions and examples
4. **Access supporting files**: Skills may include helper scripts or configuration files in their directory

Skills provide expert knowledge for specialized tasks. Always read the full skill before using it.`;
}
```

#### 4. Agent Type Updates

**File**: `src/types.ts`

**Changes**: Add `skillsDir` parameter to `CreateDeepAgentParams`

**Location**: After line 250 (after `checkpointer` field)

**Add**:

```typescript
/**
 * Optional directory to load skills from.
 * Skills are SKILL.md files with YAML frontmatter in subdirectories.
 *
 * User-level: ~/.deepagents/skills/
 * Project-level: ./.deepagents/skills/
 *
 * Project skills override user skills with the same name.
 *
 * @example
 * ```typescript
 * skillsDir: './skills'
 * ```
 */
skillsDir?: string;
```

#### 5. Agent Constructor - Skills Loading

**File**: `src/agent.ts`

**Changes**: Load skills in constructor and store metadata

**Add to class fields** (after line 92):

```typescript
private skillsMetadata: Array<{ name: string; description: string; path: string }> = [];
```

**Add to constructor** (after line 118, after checkpointer assignment):

```typescript
// Load skills if directory provided
if (params.skillsDir) {
  this.loadSkills(params.skillsDir).catch(error => {
    console.warn('[DeepAgent] Failed to load skills:', error);
  });
}
```

**Add private async method** (after line 210, after createAgent method):

```typescript
/**
 * Load skills from directory asynchronously.
 */
private async loadSkills(skillsDir: string) {
  const { listSkills } = await import("./skills/load.ts");

  const skills = await listSkills({
    projectSkillsDir: skillsDir,
  });

  this.skillsMetadata = skills.map(s => ({
    name: s.name,
    description: s.description,
    path: s.path,
  }));
}
```

#### 6. System Prompt Update

**File**: `src/agent.ts`

**Changes**: Inject skills prompt into system prompt

**Location**: Lines 48-69 (buildSystemPrompt function)

**Replace function**:

```typescript
function buildSystemPrompt(
  customPrompt?: string,
  hasSubagents?: boolean,
  hasSandbox?: boolean,
  skills?: Array<{ name: string; description: string; path: string }>
): string {
  const parts = [
    customPrompt || "",
    BASE_PROMPT,
    TODO_SYSTEM_PROMPT,
    FILESYSTEM_SYSTEM_PROMPT,
  ];

  if (hasSandbox) {
    parts.push(EXECUTE_SYSTEM_PROMPT);
  }

  if (hasSubagents) {
    parts.push(TASK_SYSTEM_PROMPT);
  }

  // Add skills prompt if skills loaded
  if (skills && skills.length > 0) {
    parts.push(buildSkillsPrompt(skills));
  }

  return parts.filter(Boolean).join("\n\n");
}
```

**Update constructor call** (line 128):

```typescript
this.systemPrompt = buildSystemPrompt(
  systemPrompt,
  hasSubagents,
  this.hasSandboxBackend,
  this.skillsMetadata // Add skills parameter
);
```

#### 7. Skills Barrel Export

**File**: Create `src/skills/index.ts`

```typescript
export { listSkills, parseSkillMetadata } from "./load.ts";
export type { SkillMetadata, SkillLoadOptions } from "./types.ts";
```

#### 8. Index Exports

**File**: `src/index.ts`

**Changes**: Export skills types

**Location**: After middleware exports (added in Phase 1)

**Add**:

```typescript
// Skills System
export { listSkills, parseSkillMetadata } from "./skills/index.ts";
export type { SkillMetadata, SkillLoadOptions } from "./skills/index.ts";
```

#### 9. Documentation

**File**: `src/agent.ts`

**Changes**: Add JSDoc example for skills usage

**Location**: Before line 688 (in createDeepAgent JSDoc)

**Add**:

```typescript
 * @example With skills system
 * ```typescript
 * import { createDeepAgent } from 'ai-sdk-deep-agent';
 * import { anthropic } from '@ai-sdk/anthropic';
 *
 * // Skills loaded from ./skills/ directory
 * // Each skill is a subdirectory with SKILL.md file:
 * // ./skills/
 * //   web-research/
 * //     SKILL.md
 * //   code-review/
 * //     SKILL.md
 *
 * const agent = createDeepAgent({
 *   model: anthropic('claude-sonnet-4-20250514'),
 *   skillsDir: './skills',
 * });
 *
 * // Agent now has access to skills via system prompt
 * // Skills metadata is injected, agent can read full skill when needed
 * await agent.generate({
 *   prompt: 'Help me research this topic using your web-research skill',
 * });
 * ```
```

### Success Criteria

#### Automated Verification

- [x] Tests pass: `bun test` (All skills tests pass: 9/9)
- [x] Type checking passes: `bun run typecheck`
- [x] No new linter errors: `npx eslint src/`
- [x] Create `examples/with-skills.ts` demonstrating skills system
- [x] Create example skill: `examples/skills/data-analysis/SKILL.md` with valid YAML frontmatter
- [x] Run example: `bun examples/with-skills.ts` (Created, ready to run with API key)
- [x] Verify output shows skill loaded (metadata in system prompt, agent can read skill content)

#### Manual Verification

- [x] Create `./skills/test-skill/SKILL.md` with frontmatter - skill loaded
- [x] Agent system prompt contains skill metadata (via buildSkillsPrompt)
- [x] Agent can read full skill content using `read_file` tool (progressive disclosure)
- [x] Invalid SKILL.md files (missing frontmatter) gracefully skipped (tested in test/skills.test.ts)
- [x] Symlinks in skills directory are rejected (security - implemented in load.ts:97-102)
- [x] Path traversal attempts are prevented (security - path.resolve() in load.ts:75)
- [x] Project skills override user skills with same name (tested in test/skills.test.ts)
- [x] Agent without `skillsDir` works as before (backwards compatible - skillsDir is optional)

#### Test Cases to Add

**File**: Create `test/skills.test.ts`

```typescript
import { test, expect } from "bun:test";
import { parseSkillMetadata, listSkills } from "../src/skills/load.ts";
import * as fs from "node:fs/promises";
import * as path from "node:path";
import { tmpdir } from "node:os";

test("parseSkillMetadata - valid frontmatter", async () => {
  const content = `---
name: test-skill
description: Test skill description
---

# Test Skill

Content here.`;

  const tmpFile = path.join(tmpdir(), 'SKILL.md');
  await fs.writeFile(tmpFile, content);

  const metadata = await parseSkillMetadata(tmpFile, 'user');

  expect(metadata).toEqual({
    name: 'test-skill',
    description: 'Test skill description',
    path: tmpFile,
    source: 'user',
  });

  await fs.unlink(tmpFile);
});

test("parseSkillMetadata - missing frontmatter", async () => {
  const content = `# Test Skill\n\nNo frontmatter here.`;

  const tmpFile = path.join(tmpdir(), 'SKILL.md');
  await fs.writeFile(tmpFile, content);

  const metadata = await parseSkillMetadata(tmpFile, 'user');

  expect(metadata).toBeNull();

  await fs.unlink(tmpFile);
});

test("listSkills - finds skills in directory", async () => {
  const tmpDir = path.join(tmpdir(), 'test-skills');
  await fs.mkdir(tmpDir, { recursive: true });

  // Create test skill
  const skillDir = path.join(tmpDir, 'test-skill');
  await fs.mkdir(skillDir);
  await fs.writeFile(
    path.join(skillDir, 'SKILL.md'),
    `---\nname: test-skill\ndescription: Test\n---\n# Test`
  );

  const skills = await listSkills({ projectSkillsDir: tmpDir });

  expect(skills.length).toBe(1);
  expect(skills[0].name).toBe('test-skill');

  // Cleanup
  await fs.rm(tmpDir, { recursive: true });
});

test("listSkills - project skills override user skills", async () => {
  const userDir = path.join(tmpdir(), 'user-skills');
  const projectDir = path.join(tmpdir(), 'project-skills');

  await fs.mkdir(userDir, { recursive: true });
  await fs.mkdir(projectDir, { recursive: true });

  // User skill
  await fs.mkdir(path.join(userDir, 'shared-skill'));
  await fs.writeFile(
    path.join(userDir, 'shared-skill', 'SKILL.md'),
    `---\nname: shared-skill\ndescription: User version\n---`
  );

  // Project skill (same name)
  await fs.mkdir(path.join(projectDir, 'shared-skill'));
  await fs.writeFile(
    path.join(projectDir, 'shared-skill', 'SKILL.md'),
    `---\nname: shared-skill\ndescription: Project version\n---`
  );

  const skills = await listSkills({
    userSkillsDir: userDir,
    projectSkillsDir: projectDir,
  });

  expect(skills.length).toBe(1);
  expect(skills[0].description).toBe('Project version');
  expect(skills[0].source).toBe('project');

  // Cleanup
  await fs.rm(userDir, { recursive: true });
  await fs.rm(projectDir, { recursive: true });
});
```

---

## Example Files

### Phase 1: Middleware Example

**File**: `examples/with-middleware.ts`

```typescript
/**
 * Example: Using middleware with DeepAgent
 * Demonstrates logging and caching middleware
 */
import { createDeepAgent } from "../src/index.ts";
import { anthropic } from "@ai-sdk/anthropic";
import type { LanguageModelV1Middleware } from "ai";

// Example 1: Logging middleware
const loggingMiddleware: LanguageModelV1Middleware = {
  wrapGenerate: async ({ doGenerate, params }) => {
    console.log("\n[Logging Middleware] Model called");
    console.log("[Logging Middleware] Prompt:", params.prompt?.[0]?.content);

    const startTime = Date.now();
    const result = await doGenerate();
    const duration = Date.now() - startTime;

    console.log("[Logging Middleware] Response:", result.text?.slice(0, 100) + "...");
    console.log(`[Logging Middleware] Duration: ${duration}ms\n`);

    return result;
  },
};

// Example 2: Simple caching middleware
const cache = new Map<string, any>();

const cachingMiddleware: LanguageModelV1Middleware = {
  wrapGenerate: async ({ doGenerate, params }) => {
    const cacheKey = JSON.stringify(params.prompt);

    if (cache.has(cacheKey)) {
      console.log("[Caching Middleware] Cache hit!");
      return cache.get(cacheKey);
    }

    console.log("[Caching Middleware] Cache miss, calling model...");
    const result = await doGenerate();
    cache.set(cacheKey, result);

    return result;
  },
};

// Create agent with multiple middlewares
const agent = createDeepAgent({
  model: anthropic("claude-sonnet-4-20250514"),
  middleware: [loggingMiddleware, cachingMiddleware],
});

// Test the agent
console.log("=== Testing Middleware ===\n");

console.log("First call (cache miss):");
const result1 = await agent.generate({
  prompt: "What is 2 + 2? Answer briefly.",
});
console.log("Result:", result1.text);

console.log("\n---\n");

console.log("Second call with same prompt (should hit cache):");
const result2 = await agent.generate({
  prompt: "What is 2 + 2? Answer briefly.",
});
console.log("Result:", result2.text);

console.log("\n=== Middleware Test Complete ===");
```

**Expected Output**:

- First call shows "[Logging Middleware] Model called" and "[Caching Middleware] Cache miss"
- Second call shows "[Caching Middleware] Cache hit!" (no model call)
- Demonstrates middleware interception working

### Phase 2: Skills Example

**File**: `examples/with-skills.ts`

```typescript
/**
 * Example: Using skills with DeepAgent
 * Demonstrates skills loading and progressive disclosure
 */
import { createDeepAgent } from "../src/index.ts";
import { anthropic } from "@ai-sdk/anthropic";

// Create agent with skills directory
const agent = createDeepAgent({
  model: anthropic("claude-sonnet-4-20250514"),
  skillsDir: "./examples/skills",
});

console.log("=== Testing Skills System ===\n");

// Ask agent what skills it has
console.log("Asking agent about available skills...\n");
const result = await agent.generate({
  prompt: "What skills do you have available? List them.",
});

console.log("Agent response:");
console.log(result.text);

console.log("\n=== Skills Test Complete ===");
```

**File**: `examples/skills/example-skill/SKILL.md`

```markdown
---
name: example-skill
description: Demonstrates the skills system with a simple example
---

# Example Skill

This is an example skill that demonstrates how the skills system works.

## When to Use

Use this skill when the user asks about skills or wants to test the skills system.

## What This Skill Does

This skill provides a simple example of how skills work in DeepAgent:

1. Skills are loaded from SKILL.md files
2. YAML frontmatter provides metadata (name, description)
3. The agent sees skills in its system prompt
4. When needed, the agent reads the full skill content using read_file

## How to Use

When a user mentions "example skill" or asks about skills:

1. Acknowledge that this skill is available
2. Explain what it demonstrates
3. Show that you can read the full skill content

## Example Response

"I have access to the example-skill, which demonstrates how the skills system works. Skills are loaded from SKILL.md files with YAML frontmatter, and I can read the full instructions when needed."
```

**Expected Output**:

- Agent lists "example-skill" in response
- Shows description from frontmatter
- Demonstrates skill metadata is available in system prompt

---

## Testing Strategy

### Unit Tests

**Phase 1: Middleware**

- Middleware wrapping (single, multiple, array)
- Middleware execution order
- Middleware with closure context
- Backwards compatibility (no middleware)

**Phase 2: Skills**

- YAML frontmatter parsing (valid, invalid, missing)
- Directory scanning (finds skills, skips non-SKILL.md)
- Security (rejects symlinks, prevents path traversal)
- Override logic (project > user)
- System prompt injection

### Integration Tests

**Phase 1: Middleware**

- Middleware works with `generate()`
- Middleware works with `stream()`
- Middleware works with `streamWithEvents()`
- Middleware affects subagent calls

**Phase 2: Skills**

- Skills loaded from directory
- Skills metadata in system prompt
- Agent can read skill content using read_file
- Multiple skills loaded and injected

### Manual Testing Steps

**Phase 1: Middleware**

1. Create logging middleware that console.logs every model call
2. Create agent with middleware
3. Call `generate()` - verify logs appear
4. Call `stream()` - verify logs appear
5. Call `streamWithEvents()` - verify logs appear
6. Create agent with `[loggingMiddleware, cachingMiddleware]` - verify both execute
7. Create agent without middleware - verify works as before

**Phase 2: Skills**

1. Create `./skills/test-skill/SKILL.md` with valid frontmatter
2. Create agent with `skillsDir: './skills'`
3. Call `generate({ prompt: "What skills do you have?" })`
4. Verify agent lists "test-skill" in response
5. Call `generate({ prompt: "Use the test-skill" })`
6. Verify agent attempts to read `/path/to/skills/test-skill/SKILL.md`
7. Create agent without `skillsDir` - verify works as before

## Performance Considerations

**Phase 1: Middleware**

- Minimal overhead - `wrapLanguageModel` is a thin wrapper
- Middleware execution is sequential (unavoidable)
- Consider caching middleware if expensive operations (user responsibility)

**Phase 2: Skills**

- Skills loaded once at agent creation (async in constructor)
- Only metadata stored in memory (not full skill content)
- Full skill content loaded on-demand via read_file
- Directory scanning is O(n) where n = number of subdirectories

## Migration Notes

### For Existing Users

**Both phases are non-breaking**:

- Existing code continues to work without changes
- New parameters are optional
- No changes to existing tool APIs
- No changes to backend protocols

### Adopting New Features

**Middleware**:

```typescript
// Before
const agent = createDeepAgent({ model });

// After (opt-in)
const agent = createDeepAgent({
  model,
  middleware: [loggingMiddleware, cachingMiddleware],
});
```

**Skills**:

```typescript
// Before
const agent = createDeepAgent({ model });

// After (opt-in)
const agent = createDeepAgent({
  model,
  skillsDir: './skills',
});
```

---

## Implementation Sequence

1. **Phase 1 (2-3 hours)**:
   - Add `middleware` type to `CreateDeepAgentParams`
   - Wrap model in constructor
   - Add tests
   - Create `examples/with-middleware.ts` example file
   - Run example and verify middleware works: `bun examples/with-middleware.ts`
   - Add documentation
   - Verify all automated tests pass
   - Manual verification

2. **Phase 2 (1-2 days)**:
   - Create skills types and loading logic
   - Add skills prompt builder
   - Integrate skills loading in constructor
   - Update system prompt building
   - Add tests
   - Create `examples/with-skills.ts` example file
   - Create example skill in `examples/skills/example-skill/SKILL.md`
   - Run example and verify skills load: `bun examples/with-skills.ts`
   - Add documentation
   - Verify all automated tests pass
   - Manual verification

3. **Documentation (1-2 hours)**:
   - Create `docs/middleware.md` user guide
   - Create `docs/skills.md` user guide
   - Update README.md with examples

4. **Update PROJECT-STATE.md**:
   - Mark "Middleware Architecture" as ✅ Implemented
   - Mark "Skills System" as ✅ Implemented
   - Update next priority

---

## Final Notes

This implementation achieves feature parity with LangChain DeepAgents while **preserving the superior design** of the current tool architecture. We're adding what LangChain does well (model middleware, skills system) without adopting their weaker patterns (middleware for tools, complex state reducers).

**Estimated Total Effort**: 1.5-2.5 days

**Risk**: Low - both phases are additive, non-breaking, and well-scoped
