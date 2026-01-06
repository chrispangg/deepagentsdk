---
title: Agent Memory Middleware Implementation Plan
description: Documentation
---

## Overview

Implement Agent Memory Middleware to provide persistent, cross-session memory for agents using `agent.md` files. Memory is loaded from two locations (user and project) and injected into the system prompt, enabling agents to learn from feedback and maintain context across sessions.

**Key Design Decision**: Use `.deepagents/` directory structure for feature parity with LangChain DeepAgents.

## Current State Analysis

### What Exists Now

- ✅ **Middleware infrastructure**: AI SDK v6 `wrapLanguageModel` support (ticket 004)
- ✅ **Skills System**: Loads skills from `skillsDir` parameter (currently project-specific)
- ✅ **Filesystem tools**: `read_file`, `write_file`, `edit_file` for agent to manage files
- ✅ **System prompt building**: `buildSystemPrompt()` composes prompts from multiple sources
- ✅ **Project structure reference**: `.claude/` folder with `agents/`, `commands/`, `skills/`

### What's Missing

- ❌ **Agent memory loading**: No mechanism to load `agent.md` files
- ❌ **User-level directory**: No `.deepagents/` directory for per-agent configuration
- ❌ **Project-level directory**: No `.deepagents/` in project root for project-specific memory
- ❌ **Memory system prompt**: No instructions teaching agent about memory
- ❌ **Skills migration**: Skills currently loaded from parameter, not from `.deepagents/` directory

### Key Constraints

1. Must be **backwards compatible** - existing code continues to work
2. Must **not break existing skills system** - migrate smoothly
3. Skills must load from **`.deepagents/{agentId}/skills/`** going forward
4. Agent files are **plain markdown** (no YAML frontmatter needed)
5. Commands and settings.json are **out of scope**

## Desired End State

### Directory Structure

**User-level** (cross-project):

```
~/.deepagents/
├── {agentId}/           # e.g., "coding-assistant"
│   ├── agent.md         # User memory (YAML frontmatter + markdown)
│   └── skills/          # User-level skills
│       ├── skill-1/
│       │   └── SKILL.md
│       └── skill-2/
│           └── SKILL.md
```

**Project-level** (project-specific):

```
[project-root]/
├── .git/                # Triggers project detection
├── .deepagents/
│   ├── agent.md         # Project memory (preferred location)
│   ├── architecture.md  # Additional memory files
│   ├── deployment.md
│   └── skills/          # Project skills
│       └── skill-3/
│           └── SKILL.md
└── agent.md             # Project memory (fallback location)
```

### Agent File Format (Plain Markdown)

Agent.md files are **plain markdown** with no required structure. The agent can organize content however makes sense.

**Example** (`~/.deepagents/coding-assistant/agent.md`):

```markdown
# Coding Assistant Memory

## Personality

- Be concise and direct
- No unnecessary pleasantries
- Focus on practical solutions

## Universal Preferences

- Always use type hints in Python
- Prefer functional programming patterns
- Write tests before implementation (TDD)

## Workflows

When asked to implement a feature:
1. Read existing code to understand patterns
2. Write tests first (TDD)
3. Implement incrementally
4. Verify tests pass
```

**Note**: Unlike `.claude/agents/*.md` files (which use YAML frontmatter for configuration), agent.md files are pure content - no frontmatter needed.

### Verification Criteria

**Automated**:

- [ ] Tests pass: `bun test`
- [ ] Type checking passes: `bun run typecheck`
- [ ] Skills load from `.deepagents/{agentId}/skills/`
- [ ] Memory middleware works with existing middleware

**Manual**:

- [ ] Agent can read user memory from `~/.deepagents/{agentId}/agent.md`
- [ ] Agent can read project memory from `[project]/.deepagents/agent.md`
- [ ] Agent can update memories using filesystem tools
- [ ] Agent asks for approval before creating project `.deepagents/` directory
- [ ] Agent can create additional .md files in `.deepagents/` directory
- [ ] Skills load from new `.deepagents/` location
- [ ] Backwards compatible: existing code works without changes
- [ ] CLI works by default (no special configuration needed)

## What We're NOT Doing

- ❌ Implementing `commands/` directory support (out of scope)
- ❌ Implementing `settings.json` configuration (out of scope)
- ❌ Auto-creating project `.deepagents/` directory (requires user approval)
- ❌ Migrating existing user data (users manually move if needed)
- ❌ Web-based UI for managing memories
- ❌ Cloud sync for memories
- ❌ YAML frontmatter parsing for agent.md (it's plain markdown)
- ❌ Memory file watching/hot-reload (memory loaded once on startup)

## Implementation Approach

### Strategy

**Phase 1**: Core middleware implementation with `.deepagents/` structure

- Create middleware factory that loads agent.md files
- Implement project detection (find `.git` directory)
- Build comprehensive memory system prompt
- Inject memory into system prompt via `transformParams` hook

**Phase 2**: Skills migration to `.deepagents/` directory

- Update skills loading to check `.deepagents/{agentId}/skills/` first
- Maintain backwards compatibility with `skillsDir` parameter
- Deprecate `skillsDir` parameter (warn but still support)

**Phase 3**: Testing and documentation

- Unit tests for middleware
- Integration tests with agent
- Update documentation
- Create examples

---

## Phase 1: Core Middleware Implementation

### Overview

Implement `createAgentMemoryMiddleware()` factory that loads agent.md files from user and project `.deepagents/` directories, following the same pattern as our skills system but with YAML frontmatter parsing.

### Changes Required

#### 1. Project Detection Utility

**File**: Create `src/utils/project-detection.ts`

**Purpose**: Find git root directory for project-level memory

```typescript
import * as fs from 'node:fs/promises';
import * as path from 'node:path';

/**
 * Find the git root by walking up the directory tree.
 * Returns null if no .git directory is found.
 *
 * @param startPath - Starting directory (defaults to process.cwd())
 * @returns Absolute path to git root, or null if not in a git repository
 */
export async function findGitRoot(startPath?: string): Promise<string | null> {
  let current = path.resolve(startPath || process.cwd());
  const root = path.parse(current).root;

  while (current !== root) {
    try {
      const gitPath = path.join(current, '.git');
      const stat = await fs.stat(gitPath);

      if (stat.isDirectory()) {
        return current;
      }
    } catch {
      // .git doesn't exist at this level, continue upward
    }

    // Move up one directory
    current = path.dirname(current);
  }

  return null;
}
```

**Why**: Git-based project detection is simple, reliable, and matches LangChain's pattern.

#### 2. Agent Memory Middleware Types

**File**: Create `src/middleware/agent-memory.ts` (types section)

**Purpose**: Define options and interfaces for agent memory

```typescript
import type { LanguageModelMiddleware } from 'ai';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import { homedir } from 'node:os';
import { findGitRoot } from '../utils/project-detection.ts';

/**
 * Options for creating agent memory middleware.
 */
export interface AgentMemoryOptions {
  /**
   * Agent identifier (e.g., 'coding-assistant').
   * Used to locate user memory at ~/.deepagents/{agentId}/agent.md
   */
  agentId: string;

  /**
   * Optional project root directory for project-specific memory.
   * If not provided, will attempt to auto-detect via findGitRoot().
   */
  projectRoot?: string;

  /**
   * Whether to auto-detect project root if not provided.
   * Default: true
   */
  autoDetectProject?: boolean;

  /**
   * Optional custom template for memory section.
   * Default: XML tags for user_memory and project_memory
   */
  memoryTemplate?: string;
}
```

#### 3. Memory Loading Helper

**File**: `src/middleware/agent-memory.ts` (helper section)

**Purpose**: Load agent.md files as plain text (no parsing needed)

```typescript
/**
 * Load agent.md file content.
 * Agent.md files are plain markdown - no YAML frontmatter or special structure.
 *
 * @param filePath - Absolute path to agent.md file
 * @returns File content as string, or empty string if file doesn't exist
 */
async function loadAgentMemory(filePath: string): Promise<string> {
  try {
    return await fs.readFile(filePath, 'utf-8');
  } catch (error) {
    // File doesn't exist or can't be read - return empty string
    return '';
  }
}
```

**Why**: Agent.md is plain markdown content, unlike skills (which use YAML frontmatter for metadata). Simpler = better.

#### 4. Memory Section Builder

**File**: `src/middleware/agent-memory.ts` (builder section)

**Purpose**: Build memory section for injection into system prompt

```typescript
/**
 * Build the memory section to inject into system prompt.
 */
function buildMemorySection(options: {
  userMemory: string | null;
  projectMemory: string | null;
  userAgentDir: string;
  projectAgentsDir: string | null;
  projectRoot: string | null;
}): string {
  const {
    userMemory,
    projectMemory,
    userAgentDir,
    projectAgentsDir,
    projectRoot,
  } = options;

  // Format memory content
  const userMemoryDisplay = userMemory || '(No user agent.md)';
  const projectMemoryDisplay = projectMemory || '(No project agent.md)';

  // Build project info
  let projectInfo: string;
  if (projectRoot && projectMemory) {
    projectInfo = `\`${projectRoot}\` (detected)`;
  } else if (projectRoot) {
    projectInfo = `\`${projectRoot}\` (no agent.md found)`;
  } else {
    projectInfo = 'None (not in a git project)';
  }

  const projectDirDisplay = projectAgentsDir
    ? projectAgentsDir
    : '[project-root]/.agents (not in a project)';

  const userAgentDirDisplay = userAgentDir.replace(homedir(), '~');

  return `## Agent Memory

<user_memory>
${userMemoryDisplay}
</user_memory>

<project_memory>
${projectMemoryDisplay}
</project_memory>

## Long-term Memory

Your long-term memory is stored in files on the filesystem and persists across sessions.

**User Memory Location**: \`${userAgentDir}\` (displays as \`${userAgentDirDisplay}\`)
**Project Memory Location**: ${projectInfo}

Your system prompt is loaded from TWO sources at startup:
1. **User agent.md**: \`${userAgentDir}/agent.md\` - Your personal preferences across all projects
2. **Project agent.md**: \`${projectDirDisplay}/agent.md\` - Project-specific instructions

Project-specific agent.md is loaded from these locations (both combined if both exist):
- \`[project-root]/.deepagents/agent.md\` (preferred)
- \`[project-root]/agent.md\` (fallback, compatible with older convention)

**When to CHECK/READ memories (CRITICAL - do this FIRST):**
- **At the start of ANY new session**: Check both user and project memories
  - User: \`ls ${userAgentDir}\`
  - Project: \`ls ${projectDirDisplay}\` (if in a project)
- **BEFORE answering questions**: If asked "what do you know about X?", check project memories FIRST
- **When user asks you to do something**: Check if you have project-specific guides
- **When user references past work**: Search project memory files for related context

**Memory-first response pattern:**
1. User asks a question → Check project directory first: \`ls ${projectDirDisplay}\`
2. If relevant files exist → Read them with \`read_file\`
3. Check user memory if needed → \`ls ${userAgentDir}\`
4. Base your answer on saved knowledge supplemented by general knowledge

**When to update memories:**
- **IMMEDIATELY when the user describes your role or how you should behave**
- **IMMEDIATELY when the user gives feedback on your work**
- When the user explicitly asks you to remember something
- When patterns or preferences emerge (coding styles, conventions, workflows)
- After significant work where context would help in future sessions

**Learning from feedback:**
- When user says something is better/worse, capture WHY and encode it as a pattern
- Each correction is a chance to improve permanently - update your instructions
- When user says "you should remember X", treat this as HIGH PRIORITY - update memories IMMEDIATELY
- Look for the underlying principle behind corrections, not just the specific mistake

## Deciding Where to Store Memory

### User Agent File: \`${userAgentDir}/agent.md\`
→ Describes the agent's **personality, style, and universal behavior** across all projects.

**Store here:**
- Your general tone and communication style
- Universal coding preferences (formatting, comment style, etc.)
- General workflows and methodologies you follow
- Tool usage patterns that apply everywhere
- Personal preferences that don't change per-project

**Examples:**
- "Be concise and direct in responses"
- "Always use type hints in Python"
- "Prefer functional programming patterns"

### Project Agent File: \`${projectDirDisplay}/agent.md\`
→ Describes **how this specific project works** and **how the agent should behave here only.**

**Store here:**
- Project-specific architecture and design patterns
- Coding conventions specific to this codebase
- Project structure and organization
- Testing strategies for this project
- Deployment processes and workflows
- Team conventions and guidelines

**Examples:**
- "This project uses FastAPI with SQLAlchemy"
- "Tests go in tests/ directory mirroring src/ structure"
- "All API changes require updating OpenAPI spec"

### Project Memory Files: \`${projectDirDisplay}/*.md\`
→ Use for **project-specific reference information** and structured notes.

**Store here:**
- API design documentation
- Architecture decisions and rationale
- Deployment procedures
- Common debugging patterns
- Onboarding information

**Examples:**
- \`${projectDirDisplay}/api-design.md\` - REST API patterns used
- \`${projectDirDisplay}/architecture.md\` - System architecture overview
- \`${projectDirDisplay}/deployment.md\` - How to deploy this project

**Note**: The agent can create additional .md files in the .deepagents/ directory as needed. There's no limit - organize project knowledge however makes sense.

**File Operations:**

User memory:
\`\`\`
ls ${userAgentDir}                        # List user memory files
read_file '${userAgentDir}/agent.md'      # Read user preferences
edit_file '${userAgentDir}/agent.md' ...  # Update user preferences
\`\`\`

Project memory:
\`\`\`
ls ${projectDirDisplay}                           # List project memory files
read_file '${projectDirDisplay}/agent.md'         # Read project instructions
edit_file '${projectDirDisplay}/agent.md' ...     # Update project instructions
write_file '${projectDirDisplay}/guide.md' ...   # Create project memory file
\`\`\`

**Important**:
- Project memory files are stored in \`.deepagents/\` inside the project root
- Always use absolute paths for file operations
- Check project memories BEFORE user when answering project-specific questions`;
}
```

**Why**: Comprehensive instructions teach agent how to use memory system effectively.

**Important Note**: The system prompt mentions project memory locations, but the middleware does NOT auto-create the `.deepagents/` directory in the project. The agent is instructed to ask for user approval before creating project-level directories.

**Agent Instruction** (to be added to memory section):
```
Before creating project memory files, ask the user:
"I'd like to create a .deepagents/ directory in this project to store project-specific memory. Is that okay?"

Only proceed if the user approves.
```

#### 5. Middleware Factory

**File**: `src/middleware/agent-memory.ts` (factory section)

**Purpose**: Create middleware that loads and injects agent memory

```typescript
/**
 * Create middleware that loads and injects agent memory from agent.md files.
 *
 * Memory is loaded from two locations:
 * 1. User memory: ~/.deepagents/{agentId}/agent.md
 * 2. Project memory: [project-root]/.deepagents/agent.md
 *
 * Memory is loaded once during middleware creation (cached in closure).
 * Use transformParams hook to inject into system prompt before each model call.
 *
 * @example
 * ```typescript
 * const middleware = createAgentMemoryMiddleware({
 *   agentId: 'coding-assistant',
 *   projectRoot: '/path/to/project', // or omit for auto-detection
 * });
 *
 * const agent = createDeepAgent({
 *   model: anthropic('claude-sonnet-4-5-20250514'),
 *   middleware: [middleware],
 * });
 * ```
 */
export function createAgentMemoryMiddleware(
  options: AgentMemoryOptions
): LanguageModelMiddleware {
  const {
    agentId,
    projectRoot,
    autoDetectProject = true,
    memoryTemplate,
  } = options;

  // User paths
  const userAgentDir = path.join(homedir(), '.deepagents', agentId);
  const userAgentMdPath = path.join(userAgentDir, 'agent.md');

  // Project paths (will be resolved async)
  let resolvedProjectRoot: string | null = null;
  let projectAgentsDir: string | null = null;
  let projectAgentMdPath: string | null = null;

  // Memory cache (loaded once)
  let userMemory: string | null = null;
  let projectMemory: string | null = null;
  let initialized = false;

  /**
   * Initialize memory paths and load memory files.
   * Called once on first transformParams invocation.
   */
  async function initialize(): Promise<void> {
    if (initialized) return;
    initialized = true;

    // Ensure user agent directory exists (auto-create)
    // This is safe to do - it's the user's home directory
    try {
      await fs.mkdir(userAgentDir, { recursive: true });
    } catch (error) {
      // Ignore errors - will fail later if truly inaccessible
    }

    // Resolve project root
    if (projectRoot) {
      resolvedProjectRoot = path.resolve(projectRoot);
    } else if (autoDetectProject) {
      resolvedProjectRoot = await findGitRoot();
    }

    // Set project paths if project detected
    if (resolvedProjectRoot) {
      projectAgentsDir = path.join(resolvedProjectRoot, '.agents');
      const preferredPath = path.join(projectAgentsDir, 'agent.md');
      const fallbackPath = path.join(resolvedProjectRoot, 'agent.md');

      // Check preferred location first
      try {
        await fs.access(preferredPath);
        projectAgentMdPath = preferredPath;
      } catch {
        // Try fallback location
        try {
          await fs.access(fallbackPath);
          projectAgentMdPath = fallbackPath;
        } catch {
          // No project memory
          projectAgentMdPath = null;
        }
      }
    }

    // Load user memory (plain markdown)
    userMemory = await loadAgentMemory(userAgentMdPath);

    // Load project memory (plain markdown)
    if (projectAgentMdPath) {
      projectMemory = await loadAgentMemory(projectAgentMdPath);
    } else {
      projectMemory = '';
    }
  }

  return {
    specificationVersion: 'v3',
    transformParams: async ({ params }) => {
      // Lazy initialization on first call
      await initialize();

      // Build memory section
      const memorySection = buildMemorySection({
        userMemory,
        projectMemory,
        userAgentDir,
        projectAgentsDir,
        projectRoot: resolvedProjectRoot,
      });

      // Inject into system prompt
      const currentPrompt = params.prompt || [];

      // Find or create system message
      const systemMessageIndex = currentPrompt.findIndex(
        (msg) => msg.role === 'system'
      );

      if (systemMessageIndex >= 0) {
        // Prepend to existing system message
        const systemMsg = currentPrompt[systemMessageIndex];
        currentPrompt[systemMessageIndex] = {
          ...systemMsg,
          content: `${memorySection}\n\n${systemMsg.content}`,
        };
      } else {
        // Add new system message at beginning
        currentPrompt.unshift({
          role: 'system',
          content: memorySection,
        });
      }

      return {
        ...params,
        prompt: currentPrompt,
      };
    },
  };
}
```

**Why**: Closure-based caching is simpler than state-based caching for our middleware pattern.

#### 6. Types Export

**File**: `src/types.ts`

**Changes**: Add agent memory types for export

**Add after existing middleware types** (around line 250):

```typescript
/**
 * Options for creating agent memory middleware.
 * See createAgentMemoryMiddleware() documentation for details.
 */
export type { AgentMemoryOptions } from './middleware/agent-memory.ts';
```

#### 7. Index Exports

**File**: `src/index.ts`

**Changes**: Export agent memory middleware and utilities

**Add after existing middleware exports**:

```typescript
// Agent Memory Middleware
export { createAgentMemoryMiddleware } from './middleware/agent-memory.ts';
export type { AgentMemoryOptions } from './middleware/agent-memory.ts';

// Project Detection Utility
export { findGitRoot } from './utils/project-detection.ts';
```

### Success Criteria

#### Automated Verification

- [ ] Tests pass: `bun test`
- [ ] Type checking passes: `bun run typecheck`
- [ ] Memory middleware compiles without errors
- [ ] Project detection utility works

#### Manual Verification

- [ ] Create `~/.deepagents/test-agent/agent.md` with plain markdown content
- [ ] Middleware loads user memory correctly (no parsing errors)
- [ ] Create `.deepagents/agent.md` in project root
- [ ] Middleware loads project memory correctly
- [ ] Missing files handled gracefully (no errors)
- [ ] Memory section appears in system prompt
- [ ] Project detection finds `.git` directory
- [ ] Fallback location (`agent.md` in project root) works
- [ ] Additional .md files in `.deepagents/` are accessible to agent

---

## Phase 2: Skills Migration to .deepagents Directory

### Overview

Update skills loading to check `.deepagents/{agentId}/skills/` directory in addition to the current `skillsDir` parameter. This maintains backwards compatibility while establishing the new standard location.

### Changes Required

#### 1. Update Skills Loading Logic

**File**: `src/skills/load.ts`

**Changes**: Add support for `.deepagents/{agentId}/skills/` directory

**Modify `listSkills()` function** (around line 568):

```typescript
import { homedir } from 'node:os';
import { findGitRoot } from '../utils/project-detection.ts';

/**
 * List all skills from user and project directories.
 * Project skills override user skills with the same name.
 *
 * NEW: Also checks ~/.deepagents/{agentId}/skills/ if agentId is provided.
 */
export async function listSkills(
  options: SkillLoadOptions
): Promise<SkillMetadata[]> {
  const { userSkillsDir, projectSkillsDir, agentId } = options;
  const skillsMap = new Map<string, SkillMetadata>();

  // NEW: Load from ~/.deepagents/{agentId}/skills/ if agentId provided
  if (agentId) {
    const agentSkillsDir = path.join(homedir(), '.deepagents', agentId, 'skills');
    const agentSkills = await listSkillsInDirectory(agentSkillsDir, 'agent');
    for (const skill of agentSkills) {
      skillsMap.set(skill.name, skill);
    }
  }

  // Load user skills (legacy, if provided)
  if (userSkillsDir) {
    const userSkills = await listSkillsInDirectory(userSkillsDir, 'user');
    for (const skill of userSkills) {
      // Warn if agentId provided (new pattern preferred)
      if (agentId) {
        console.warn(
          `[Skills] userSkillsDir is deprecated. Skills should be in ~/.deepagents/${agentId}/skills/`
        );
      }
      skillsMap.set(skill.name, skill);
    }
  }

  // Load project skills (from .deepagents/skills/ in project root)
  if (projectSkillsDir) {
    const projectSkills = await listSkillsInDirectory(projectSkillsDir, 'project');
    for (const skill of projectSkills) {
      skillsMap.set(skill.name, skill); // Override agent/user skills
    }
  } else {
    // NEW: Auto-detect project skills from .deepagents/skills/
    const projectRoot = await findGitRoot();
    if (projectRoot) {
      const autoProjectSkillsDir = path.join(projectRoot, '.deepagents', 'skills');
      const projectSkills = await listSkillsInDirectory(autoProjectSkillsDir, 'project');
      for (const skill of projectSkills) {
        skillsMap.set(skill.name, skill);
      }
    }
  }

  return Array.from(skillsMap.values());
}
```

#### 2. Update SkillLoadOptions Type

**File**: `src/skills/types.ts`

**Changes**: Add `agentId` parameter

```typescript
/**
 * Options for skill loading
 */
export interface SkillLoadOptions {
  /**
   * Agent identifier (e.g., 'coding-assistant').
   * If provided, skills will be loaded from ~/.deepagents/{agentId}/skills/
   *
   * NEW: This is the preferred pattern going forward.
   */
  agentId?: string;

  /**
   * User-level skills directory (e.g., ~/skills/)
   *
   * @deprecated Use agentId parameter instead. Skills should be in ~/.deepagents/{agentId}/skills/
   */
  userSkillsDir?: string;

  /**
   * Project-level skills directory (e.g., ./.deepagents/skills/)
   *
   * If not provided, will auto-detect from project root/.deepagents/skills/
   */
  projectSkillsDir?: string;
}

/**
 * Metadata extracted from SKILL.md frontmatter.
 */
export interface SkillMetadata {
  name: string;
  description: string;
  path: string;
  source: 'agent' | 'user' | 'project'; // NEW: 'agent' source
}
```

#### 3. Update DeepAgent Constructor

**File**: `src/agent.ts`

**Changes**: Pass agentId to skills loading

**Modify loadSkills() method** (around line 258):

```typescript
/**
 * Load skills from directory asynchronously.
 * NEW: Supports loading from .deepagents/{agentId}/skills/
 */
private async loadSkills(skillsDir: string, agentId?: string) {
  const { listSkills } = await import("./skills/load.ts");

  const skills = await listSkills({
    agentId, // NEW: Pass agentId if available
    projectSkillsDir: skillsDir,
  });

  this.skillsMetadata = skills.map(s => ({
    name: s.name,
    description: s.description,
    path: s.path,
  }));
}
```

**Modify CreateDeepAgentParams type** (src/types.ts):

```typescript
export interface CreateDeepAgentParams {
  // ... existing fields ...

  /**
   * Optional agent identifier for loading skills from ~/.deepagents/{agentId}/skills/
   * and memory from ~/.deepagents/{agentId}/agent.md
   *
   * NEW: This enables the .deepagents/ directory pattern for both skills and memory.
   */
  agentId?: string;

  /**
   * Optional directory to load skills from.
   *
   * @deprecated Use agentId parameter instead. Skills should be in ~/.deepagents/{agentId}/skills/
   */
  skillsDir?: string;
}
```

**Modify DeepAgent constructor** (around line 105):

```typescript
constructor(params: CreateDeepAgentParams) {
  const {
    model,
    middleware,
    tools = {},
    systemPrompt,
    subagents = [],
    backend,
    maxSteps = 100,
    includeGeneralPurposeAgent = true,
    toolResultEvictionLimit,
    enablePromptCaching = false,
    summarization,
    interruptOn,
    checkpointer,
    skillsDir,
    agentId, // NEW
  } = params;

  // ... existing middleware wrapping ...

  // Load skills if agentId or skillsDir provided
  if (agentId || skillsDir) {
    if (skillsDir && agentId) {
      console.warn('[DeepAgent] Both agentId and skillsDir provided. agentId takes precedence.');
    }
    this.loadSkills(skillsDir || '', agentId).catch(error => {
      console.warn('[DeepAgent] Failed to load skills:', error);
    });
  }

  // ... rest of constructor ...
}
```

### Success Criteria

#### Automated Verification

- [ ] Tests pass: `bun test`
- [ ] Type checking passes: `bun run typecheck`
- [ ] Skills load from `~/.deepagents/{agentId}/skills/`
- [ ] Skills load from `[project]/.deepagents/skills/` (auto-detected)
- [ ] Backwards compatibility: `skillsDir` parameter still works

#### Manual Verification

- [ ] Create `~/.deepagents/test-agent/skills/test-skill/SKILL.md`
- [ ] Skills load from new location with `agentId` parameter
- [ ] Create `.deepagents/skills/project-skill/SKILL.md` in project
- [ ] Project skills override agent skills
- [ ] Deprecation warning shown when using `skillsDir` with `agentId`
- [ ] Agent without `agentId` still works (no regressions)

---

## Phase 3: Testing and Documentation

### Overview

Comprehensive testing and documentation to ensure agent memory works correctly and users understand how to use it.

### Unit Tests

**File**: Create `test/middleware/agent-memory.test.ts`

```typescript
import { test, expect } from 'bun:test';
import { createAgentMemoryMiddleware } from '../../src/middleware/agent-memory.ts';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import { tmpdir } from 'node:os';

test('agent-memory: loads user memory only (no project)', async () => {
  const tmpPath = path.join(tmpdir(), `test-${Date.now()}`);
  const userAgentDir = path.join(tmpPath, '.agents', 'test-agent');
  await fs.mkdir(userAgentDir, { recursive: true });

  // Create user agent.md with YAML frontmatter
  const userMd = path.join(userAgentDir, 'agent.md');
  await fs.writeFile(
    userMd,
    `---
name: test-agent
description: Test agent
---

Be concise and direct.`
  );

  // Mock homedir to use tmpPath
  const middleware = createAgentMemoryMiddleware({
    agentId: 'test-agent',
    autoDetectProject: false, // No project
  });

  // Simulate transformParams call
  const params = { prompt: [] };
  const result = await (middleware.transformParams as any)({ params });

  // Check that system message was injected
  expect(result.prompt[0].role).toBe('system');
  expect(result.prompt[0].content).toContain('Be concise and direct');
  expect(result.prompt[0].content).toContain('(No project agent.md)');

  // Cleanup
  await fs.rm(tmpPath, { recursive: true });
});

test('agent-memory: loads both user and project memory', async () => {
  // ... similar test for both memories ...
});

test('agent-memory: project fallback location', async () => {
  // ... test for fallback agent.md in project root ...
});

test('agent-memory: handles missing files gracefully', async () => {
  // ... test error handling ...
});

test('agent-memory: additional memory files accessible', async () => {
  // ... test that agent can read other .md files in .deepagents/ ...
});
```

**File**: Create `test/skills/agent-dir-loading.test.ts`

```typescript
import { test, expect } from 'bun:test';
import { listSkills } from '../../src/skills/load.ts';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import { tmpdir } from 'node:os';

test('skills: loads from .deepagents/{agentId}/skills/', async () => {
  const tmpPath = path.join(tmpdir(), `test-${Date.now()}`);
  const agentSkillsDir = path.join(tmpPath, '.deepagents', 'test-agent', 'skills');
  await fs.mkdir(path.join(agentSkillsDir, 'test-skill'), { recursive: true });

  // Create SKILL.md
  await fs.writeFile(
    path.join(agentSkillsDir, 'test-skill', 'SKILL.md'),
    `---
name: test-skill
description: Test skill from .agents
---

# Test Skill`
  );

  const skills = await listSkills({
    agentId: 'test-agent',
  });

  expect(skills.length).toBe(1);
  expect(skills[0].name).toBe('test-skill');
  expect(skills[0].source).toBe('agent');

  await fs.rm(tmpPath, { recursive: true });
});

test('skills: project skills override agent skills', async () => {
  // ... test override logic ...
});

test('skills: backwards compatibility with skillsDir', async () => {
  // ... test deprecated parameter still works ...
});
```

### Integration Tests

**File**: Create `test/integration/agent-memory.test.ts`

```typescript
import { test, expect } from 'bun:test';
import { createDeepAgent } from '../../src/agent.ts';
import { createAgentMemoryMiddleware } from '../../src/middleware/agent-memory.ts';
import { anthropic } from '@ai-sdk/anthropic';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import { tmpdir } from 'node:os';

test('integration: agent uses memory from agent.md', async () => {
  const tmpPath = path.join(tmpdir(), `test-${Date.now()}`);
  const userAgentDir = path.join(tmpPath, '.deepagents', 'test-agent');
  await fs.mkdir(userAgentDir, { recursive: true });

  // Create agent.md with plain markdown personality
  await fs.writeFile(
    path.join(userAgentDir, 'agent.md'),
    `# Test Agent

Be extremely concise. No pleasantries. One sentence answers only.`
  );

  const middleware = createAgentMemoryMiddleware({
    agentId: 'test-agent',
    autoDetectProject: false,
  });

  const agent = createDeepAgent({
    model: anthropic('claude-haiku-4-5-20251001'), // Use cheap model for tests
    middleware: [middleware],
  });

  const result = await agent.generate({
    prompt: 'Say hello',
  });

  // Agent should follow memory instructions (be concise)
  expect(result.text.length).toBeLessThan(50);

  await fs.rm(tmpPath, { recursive: true });
});

test('integration: agent can update memory', async () => {
  // ... test agent writing to agent.md ...
});

test('integration: skills and memory work together', async () => {
  // ... test both systems integrated ...
});
```

### Documentation

**File**: Create `docs/agent-memory.md`

```markdown
# Agent Memory

Agent Memory enables persistent, cross-session memory for agents using `agent.md` files stored in the `.deepagents/` directory.

## Directory Structure

**User-level** (cross-project):
\`\`\`
~/.deepagents/
└── {agentId}/
    ├── agent.md         # User memory
    └── skills/          # User-level skills
\`\`\`

**Project-level** (project-specific):
\`\`\`
[project-root]/
└── .deepagents/
    ├── agent.md         # Project memory
    └── skills/          # Project skills
\`\`\`

## Quick Start

### 1. Create Agent Memory Directory

\`\`\`bash
mkdir -p ~/.deepagents/my-agent
\`\`\`

### 2. Create agent.md File (Plain Markdown)

\`\`\`bash
cat > ~/.deepagents/my-agent/agent.md << 'EOF'
# My Agent

## Personality
- Be concise and direct
- Focus on practical solutions

## Preferences
- Always use type hints in Python
- Prefer functional programming patterns

## Workflows
When implementing features:
1. Read existing code first
2. Write tests (TDD)
3. Implement incrementally
EOF
\`\`\`

### 3. Use Agent with Memory

\`\`\`typescript
import { createDeepAgent } from 'deepagentsdk';
import { createAgentMemoryMiddleware } from 'deepagentsdk/middleware';
import { anthropic } from '@ai-sdk/anthropic';

const agent = createDeepAgent({
  model: anthropic('claude-sonnet-4-5-20250514'),
  middleware: [
    createAgentMemoryMiddleware({
      agentId: 'my-agent',
    }),
  ],
});

// Agent now has access to memory!
const result = await agent.generate({
  prompt: 'Write a Python function to calculate factorial',
});
// Agent will use type hints (from memory)
\`\`\`

## How It Works

1. **Memory Loading**: Middleware loads `agent.md` files at startup (plain markdown, no frontmatter)
2. **System Prompt Injection**: Memory content injected into every model call
3. **Progressive Disclosure**: Agent knows file locations and can read/update
4. **Two Memory Levels**:
   - **User memory**: Personality and universal preferences (~/.deepagents/{agentId}/)
   - **Project memory**: Project-specific context ([project]/.deepagents/)
5. **Directory Creation**:
   - User directory auto-created (~/.deepagents/{agentId}/)
   - Project directory requires user approval (agent will ask first)

## Memory Scope

### User Memory (~/.deepagents/{agentId}/agent.md)

**Purpose**: Agent's personality and universal behaviors

**Store here**:
- General tone and communication style
- Universal coding preferences
- General workflows and methodologies

### Project Memory ([project]/.deepagents/agent.md)

**Purpose**: Project-specific context and instructions

**Store here**:
- Project architecture and design patterns
- Coding conventions for this codebase
- Testing strategies
- Deployment procedures

**Note**: Agent will ask for approval before creating `.deepagents/` directory in project root.

### Additional Memory Files

You can create additional .md files in `.deepagents/` directory for organized documentation:
- `architecture.md` - System architecture
- `api-design.md` - API patterns
- `deployment.md` - Deployment procedures
- `troubleshooting.md` - Common issues

The agent can read all .md files in the `.deepagents/` directory.

## API Reference

See TypeScript documentation for `createAgentMemoryMiddleware()` and `AgentMemoryOptions`.
\`\`\`

**File**: Create `examples/with-agent-memory.ts`

```typescript
/**
 * Example: Using agent memory for persistent personality
 */
import { createDeepAgent } from '../src/index.ts';
import { createAgentMemoryMiddleware } from '../src/middleware/agent-memory.ts';
import { anthropic } from '@ai-sdk/anthropic';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import { homedir } from 'node:os';

// Setup: Create agent memory directory and file
const agentId = 'demo-agent';
const agentDir = path.join(homedir(), '.deepagents', agentId);
const agentMdPath = path.join(agentDir, 'agent.md');

// Create directory
await fs.mkdir(agentDir, { recursive: true });

// Create agent.md (plain markdown, no frontmatter)
await fs.writeFile(
  agentMdPath,
  `# Demo Agent Memory

## Personality

- Be concise and direct
- No unnecessary pleasantries
- Focus on practical solutions

## Coding Preferences

- Always use type hints in Python
- Prefer functional programming patterns
- Write tests before implementation`
);

console.log(`Created agent memory at: ${agentMdPath}\n`);

// Create agent with memory middleware
const agent = createDeepAgent({
  model: anthropic('claude-sonnet-4-5-20250514'),
  middleware: [
    createAgentMemoryMiddleware({
      agentId,
    }),
  ],
});

// Test: Agent should follow memory preferences
console.log('=== Testing Agent Memory ===\n');

const result = await agent.generate({
  prompt: 'Write a Python function to calculate factorial',
});

console.log('Agent response:');
console.log(result.text);

console.log('\n=== Agent Memory Demo Complete ===');
```

**File**: Update `README.md`

Add section after "Middleware Architecture":

```markdown
### Agent Memory

Enable persistent memory for agents using `agent.md` files:

\`\`\`typescript
import { createAgentMemoryMiddleware } from 'deepagentsdk/middleware';

const agent = createDeepAgent({
  model: anthropic('claude-sonnet-4-5-20250514'),
  middleware: [
    createAgentMemoryMiddleware({
      agentId: 'coding-assistant',
    }),
  ],
});

// Agent loads memory from:
// - ~/.deepagents/coding-assistant/agent.md (user memory)
// - [project]/.deepagents/agent.md (project memory)
\`\`\`

See [Agent Memory Guide](docs/agent-memory.md) for details.
\`\`\`

### Success Criteria

#### Automated Verification

- [ ] All tests pass: `bun test`
- [ ] Type checking passes: `bun run typecheck`
- [ ] Example runs successfully: `bun examples/with-agent-memory.ts`
- [ ] Documentation builds without errors

#### Manual Verification

- [ ] Follow Quick Start guide - works end-to-end
- [ ] Create agent with memory - memory loads correctly
- [ ] Create project memory - project memory loads
- [ ] Update memory files - agent uses new content
- [ ] Skills and memory work together
- [ ] README example is accurate

---

## Testing Strategy

### Unit Test Coverage

**Memory Middleware**:
- User memory only (no project)
- Both user and project memory
- Project fallback location (agent.md in root)
- Missing files (graceful handling)
- Plain markdown loading (no frontmatter)
- System message prepending

**Skills Loading**:
- Load from `.deepagents/{agentId}/skills/`
- Load from project `.deepagents/skills/`
- Override logic (project > agent > user)
- Backwards compatibility with `skillsDir`
- Deprecation warnings

**Project Detection**:
- Find `.git` directory
- Walk up directory tree
- Return null if no git root
- Handle permission errors

### Integration Test Coverage

- Agent uses memory from agent.md
- Agent can update memories
- Skills and memory work together
- Multi-turn conversation with memory
- Project-specific behavior

### Manual Testing Checklist

1. **Setup**
   - [ ] Create `~/.deepagents/test-agent/agent.md`
   - [ ] Add personality preferences
   - [ ] Create test project with `.deepagents/agent.md`

2. **User Memory**
   - [ ] Agent loads user memory
   - [ ] Agent follows personality instructions
   - [ ] Agent updates user memory when asked

3. **Project Memory**
   - [ ] Agent loads project memory
   - [ ] Project memory overrides user memory (where applicable)
   - [ ] Agent uses project-specific knowledge

4. **Skills Integration**
   - [ ] Skills load from `.deepagents/{agentId}/skills/`
   - [ ] Project skills override agent skills
   - [ ] Skills and memory work together

5. **Edge Cases**
   - [ ] Missing agent.md (no errors)
   - [ ] Empty agent.md files (graceful handling)
   - [ ] No project (user memory only)
   - [ ] Permission errors (logged, not crashed)

---

## Performance Considerations

**Memory Loading**:
- Memory files loaded once (on first transformParams call)
- Cached in closure (no re-reading)
- Async initialization (non-blocking)

**Project Detection**:
- Git root search walks up directory tree
- Cached after first detection
- Fast for typical project depths (<10 levels)

**System Prompt Size**:
- User memory + project memory = ~1-5KB typical
- Comprehensive instructions = ~3KB
- Total injection: ~4-8KB per model call
- Acceptable for modern context windows (200K+ tokens)

**Optimization Opportunities** (not implemented now):
- Reload memory on file change (watch mode)
- Compress memory for very long agent.md files
- Cache parsed YAML frontmatter

---

## Migration Notes

### For Existing Users

**No breaking changes**:
- Existing code continues to work
- `skillsDir` parameter still supported (deprecated)
- No automatic migration required

### Adopting New Pattern

**Step 1**: Create `.deepagents/` directory
\`\`\`bash
mkdir -p ~/.deepagents/my-agent
\`\`\`

**Step 2**: Move skills (optional)
\`\`\`bash
mv ~/my-skills ~/.deepagents/my-agent/skills
\`\`\`

**Step 3**: Create agent.md (plain markdown)
\`\`\`bash
cat > ~/.deepagents/my-agent/agent.md << 'EOF'
# My Agent

[Your personality, preferences, and workflows here]
EOF
\`\`\`

**Step 4**: Update code
\`\`\`typescript
// Before
const agent = createDeepAgent({
  model,
  skillsDir: '~/my-skills',
});

// After
const agent = createDeepAgent({
  model,
  agentId: 'my-agent', // Skills auto-load from ~/.deepagents/my-agent/skills/
  middleware: [
    createAgentMemoryMiddleware({ agentId: 'my-agent' }),
  ],
});
\`\`\`

### Deprecation Timeline

- **v0.3.x**: `skillsDir` parameter deprecated (warning logged)
- **v0.4.x**: `skillsDir` parameter still works (warning persists)
- **v1.0.0**: `skillsDir` parameter removed (breaking change)

---

## Implementation Checklist

### Phase 1: Core Middleware
- [ ] Create `src/utils/project-detection.ts`
  - [ ] `findGitRoot()` function
  - [ ] Error handling
  - [ ] Tests
- [ ] Create `src/middleware/agent-memory.ts`
  - [ ] `AgentMemoryOptions` interface
  - [ ] `parseAgentMemory()` function
  - [ ] `buildMemorySection()` function
  - [ ] `createAgentMemoryMiddleware()` factory
  - [ ] YAML frontmatter parsing
  - [ ] Memory loading logic
  - [ ] System prompt injection
- [ ] Update `src/types.ts`
  - [ ] Export agent memory types
- [ ] Update `src/index.ts`
  - [ ] Export middleware and utils

### Phase 2: Skills Migration
- [ ] Update `src/skills/types.ts`
  - [ ] Add `agentId` parameter
  - [ ] Deprecate `userSkillsDir`
  - [ ] Add 'agent' source type
- [ ] Update `src/skills/load.ts`
  - [ ] Load from `.deepagents/{agentId}/skills/`
  - [ ] Auto-detect project skills
  - [ ] Deprecation warnings
- [ ] Update `src/agent.ts`
  - [ ] Add `agentId` parameter
  - [ ] Pass to skills loading
  - [ ] Update constructor

### Phase 3: Testing & Documentation
- [ ] Create `test/middleware/agent-memory.test.ts`
  - [ ] All unit tests passing
- [ ] Create `test/skills/agent-dir-loading.test.ts`
  - [ ] Skills migration tests
- [ ] Create `test/integration/agent-memory.test.ts`
  - [ ] Integration tests
- [ ] Create `docs/agent-memory.md`
  - [ ] User guide
- [ ] Create `examples/with-agent-memory.ts`
  - [ ] Working example
- [ ] Update `README.md`
  - [ ] Agent memory section
- [ ] Update `docs/PROJECT-STATE.md`
  - [ ] Mark as implemented

### Phase 4: Finalization
- [ ] Run all tests: `bun test`
- [ ] Type check: `bun run typecheck`
- [ ] Run example: `bun examples/with-agent-memory.ts`
- [ ] Manual testing (full checklist)
- [ ] Test CLI integration (works by default with library)
- [ ] Code review
- [ ] Documentation review

---

## Estimated Effort

**Phase 1: Core Middleware**
- Project detection: 2 hours
- Middleware implementation: 4 hours
- YAML parsing: 1 hour
- System prompt building: 2 hours
- **Total: 9 hours (1-1.5 days)**

**Phase 2: Skills Migration**
- Update skills loading: 3 hours
- Add agentId support: 2 hours
- Deprecation warnings: 1 hour
- **Total: 6 hours (0.5-1 day)**

**Phase 3: Testing & Documentation**
- Unit tests: 4 hours
- Integration tests: 3 hours
- Documentation: 4 hours
- Examples: 2 hours
- **Total: 13 hours (1.5-2 days)**

**Phase 4: Finalization**
- Manual testing: 2 hours
- Code review iterations: 2 hours
- Polish and fixes: 2 hours
- **Total: 6 hours (0.5-1 day)**

**Grand Total: 34 hours (4-5.5 days)**

**Risk**: Low - Non-breaking, incremental changes following established patterns

---

## Success Metrics

**Technical**:
- ✅ All tests pass
- ✅ No type errors
- ✅ No regressions in existing functionality
- ✅ Skills load from `.deepagents/` directory
- ✅ Memory loads and injects correctly

**User Experience**:
- ✅ Clear documentation
- ✅ Working examples
- ✅ Intuitive directory structure
- ✅ Helpful error messages
- ✅ Backwards compatible

**Code Quality**:
- ✅ Follows existing patterns
- ✅ Well-tested (>80% coverage)
- ✅ Clear comments
- ✅ Consistent naming
- ✅ Proper error handling
