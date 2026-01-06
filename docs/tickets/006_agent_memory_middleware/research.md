---
title: 006 Agent Memory Middleware
date: 2025-12-17 09:30:00 AEDT
researcher: Claude Code
git_commit: 3a2f830e3b434aabd7b93e70e6e19ea7483c7000
branch: main
repository: deepagentsdk
topic: Agent Memory Middleware Implementation for Long-Term Persistent Context
tags: [research, agent-memory, middleware, architecture, langchain, deepagents]
status: complete
last_updated: 2025-12-17
last_updated_by: Claude Code
---

## Research Question

**How is Agent Memory Middleware implemented in LangChain's DeepAgents framework, and how can we adapt this pattern to deepagentsdk using Vercel AI SDK v6's middleware architecture?**

This research investigates:

1. LangChain's AgentMemoryMiddleware architecture and implementation
2. How agent.md files provide persistent personality and context
3. Memory loading patterns (user vs project memory)
4. System prompt injection and progressive disclosure
5. Integration with our existing middleware implementation
6. Path management and directory structure
7. Implementation pathway for deepagentsdk

## Executive Summary

**Key Finding**: LangChain DeepAgents implements Agent Memory through a middleware that loads agent.md files from two locations (user and project) and injects them into the system prompt. The agent is taught to proactively read and update these files for persistent, cross-session memory.

**Architecture Overview**:

- **User Memory**: `~/.deepagents/{agent_id}/agent.md` - Agent's personality and universal behaviors
- **Project Memory**: `[project-root]/.deepagents/agent.md` - Project-specific context and instructions
- **Progressive Disclosure**: Memory files are loaded once at startup, agent can read/update them via filesystem tools
- **Middleware Integration**: Uses `before_agent` hook to load files, `wrap_model_call` to inject into system prompt

**Recommended Approach for deepagentsdk**:

- Implement as middleware factory similar to our Skills System
- Use AI SDK v6's `wrapLanguageModel` with `transformParams` hook
- Load agent.md files during middleware initialization
- Inject memory into system prompt before each model call
- Teach agent about memory locations through comprehensive system prompt

---

## Detailed Findings

### 1. LangChain AgentMemoryMiddleware Architecture

#### 1.1 Core Implementation

**File**: `.refs/deepagents/libs/deepagents-cli/deepagents_cli/agent_memory.py:171-329`

The `AgentMemoryMiddleware` is a LangChain middleware that:

1. Loads agent.md files before agent execution
2. Stores them in agent state
3. Injects them into the system prompt on every model call

**Class Structure**:

```python
class AgentMemoryMiddleware(AgentMiddleware):
    """Middleware for loading agent-specific long-term memory."""

    state_schema = AgentMemoryState  # Extends state with user_memory, project_memory

    def __init__(
        self,
        *,
        settings: Settings,
        assistant_id: str,
        system_prompt_template: str | None = None,
    ):
        self.settings = settings
        self.assistant_id = assistant_id

        # User paths
        self.agent_dir = settings.get_agent_dir(assistant_id)
        self.agent_dir_display = f"~/.deepagents/{assistant_id}"  # For display
        self.agent_dir_absolute = str(self.agent_dir)  # For file operations

        # Project paths (from settings)
        self.project_root = settings.project_root

        self.system_prompt_template = system_prompt_template or DEFAULT_MEMORY_SNIPPET
```

**Key Design Decisions**:

- **Two path representations**: Display path (with `~`) for user-facing messages, absolute path for file operations
- **Settings injection**: Receives Settings object for centralized path management
- **Assistant ID**: Each agent has its own memory directory
- **Template customization**: System prompt template can be overridden

#### 1.2 Memory Loading Hook

**Method**: `before_agent()` - Lines 210-245

```python
def before_agent(
    self,
    state: AgentMemoryState,
    runtime: Runtime,
) -> AgentMemoryStateUpdate:
    """Load agent memory from file before agent execution.

    Loads both user agent.md and project-specific agent.md if available.
    Only loads if not already present in state.

    Dynamically checks for file existence on every call to catch user updates.
    """
    result: AgentMemoryStateUpdate = {}

    # Load user memory if not already in state
    if "user_memory" not in state:
        user_path = self.settings.get_user_agent_md_path(self.assistant_id)
        if user_path.exists():
            with contextlib.suppress(OSError, UnicodeDecodeError):
                result["user_memory"] = user_path.read_text()

    # Load project memory if not already in state
    if "project_memory" not in state:
        project_path = self.settings.get_project_agent_md_path()
        if project_path and project_path.exists():
            with contextlib.suppress(OSError, UnicodeDecodeError):
                result["project_memory"] = project_path.read_text()

    return result
```

**Key Patterns**:

- ✅ **Lazy loading**: Only loads if not in state (prevents re-loading on every agent step)
- ✅ **Dynamic checking**: Checks file existence on every `before_agent` call (catches user updates)
- ✅ **Error resilience**: Suppresses file errors (OSError, UnicodeDecodeError)
- ✅ **Optional project memory**: Project memory may not exist (not all work is in git projects)

#### 1.3 System Prompt Injection

**Method**: `wrap_model_call()` and `awrap_model_call()` - Lines 296-328

```python
def wrap_model_call(
    self,
    request: ModelRequest,
    handler: Callable[[ModelRequest], ModelResponse],
) -> ModelResponse:
    """Inject agent memory into the system prompt."""
    system_prompt = self._build_system_prompt(request)
    return handler(request.override(system_prompt=system_prompt))

async def awrap_model_call(
    self,
    request: ModelRequest,
    handler: Callable[[ModelRequest], Awaitable[ModelResponse]],
) -> ModelResponse:
    """(async) Inject agent memory into the system prompt."""
    system_prompt = self._build_system_prompt(request)
    return await handler(request.override(system_prompt=system_prompt))
```

**`_build_system_prompt()` method** - Lines 247-294:

```python
def _build_system_prompt(self, request: ModelRequest) -> str:
    """Build the complete system prompt with memory sections."""
    # Extract memory from state
    state = cast("AgentMemoryState", request.state)
    user_memory = state.get("user_memory")
    project_memory = state.get("project_memory")
    base_system_prompt = request.system_prompt

    # Build project memory info for documentation
    if self.project_root and project_memory:
        project_memory_info = f"`{self.project_root}` (detected)"
    elif self.project_root:
        project_memory_info = f"`{self.project_root}` (no agent.md found)"
    else:
        project_memory_info = "None (not in a git project)"

    # Build project deepagents directory path
    if self.project_root:
        project_deepagents_dir = str(self.project_root / ".deepagents")
    else:
        project_deepagents_dir = "[project-root]/.deepagents (not in a project)"

    # Format memory section with both memories
    memory_section = self.system_prompt_template.format(
        user_memory=user_memory if user_memory else "(No user agent.md)",
        project_memory=project_memory if project_memory else "(No project agent.md)",
    )

    system_prompt = memory_section

    if base_system_prompt:
        system_prompt += "\n\n" + base_system_prompt

    system_prompt += "\n\n" + LONGTERM_MEMORY_SYSTEM_PROMPT.format(
        agent_dir_absolute=self.agent_dir_absolute,
        agent_dir_display=self.agent_dir_display,
        project_memory_info=project_memory_info,
        project_deepagents_dir=project_deepagents_dir,
    )

    return system_prompt
```

**System Prompt Structure**:

1. **Memory section** (actual content from agent.md files)
2. **Base system prompt** (from agent configuration)
3. **LONGTERM_MEMORY_SYSTEM_PROMPT** (instructions about memory system)

---

### 2. Memory System Prompt Template

#### 2.1 Memory Content Template

**Constant**: `DEFAULT_MEMORY_SNIPPET` - Lines 162-168

```xml
<user_memory>
{user_memory}
</user_memory>

<project_memory>
{project_memory}
</project_memory>
```

**Purpose**: Wraps memory content in XML tags for clear structure

#### 2.2 Memory System Instructions

**Constant**: `LONGTERM_MEMORY_SYSTEM_PROMPT` - Lines 45-159

This is a comprehensive prompt (115 lines) that teaches the agent about its memory system. Key sections:

**1. Memory Locations**:

```text
## Long-term Memory

Your long-term memory is stored in files on the filesystem and persists across sessions.

**User Memory Location**: `{agent_dir_absolute}` (displays as `{agent_dir_display}`)
**Project Memory Location**: {project_memory_info}

Your system prompt is loaded from TWO sources at startup:
1. **User agent.md**: `{agent_dir_absolute}/agent.md` - Your personal preferences across all projects
2. **Project agent.md**: Loaded from project root if available - Project-specific instructions

Project-specific agent.md is loaded from these locations (both combined if both exist):
- `[project-root]/.deepagents/agent.md` (preferred)
- `[project-root]/agent.md` (fallback, but also included if both exist)
```

**2. When to Check/Read Memories (CRITICAL)**:

```text
**When to CHECK/READ memories (CRITICAL - do this FIRST):**
- **At the start of ANY new session**: Check both user and project memories
  - User: `ls {agent_dir_absolute}`
  - Project: `ls {project_deepagents_dir}` (if in a project)
- **BEFORE answering questions**: If asked "what do you know about X?" or "how do I do Y?", check project memories FIRST, then user
- **When user asks you to do something**: Check if you have project-specific guides or examples
- **When user references past work**: Search project memory files for related context

**Memory-first response pattern:**
1. User asks a question → Check project directory first: `ls {project_deepagents_dir}`
2. If relevant files exist → Read them with `read_file '{project_deepagents_dir}/[filename]'`
3. Check user memory if needed → `ls {agent_dir_absolute}`
4. Base your answer on saved knowledge supplemented by general knowledge
```

**3. When to Update Memories**:

```text
**When to update memories:**
- **IMMEDIATELY when the user describes your role or how you should behave**
- **IMMEDIATELY when the user gives feedback on your work** - Update memories to capture what was wrong and how to do it better
- When the user explicitly asks you to remember something
- When patterns or preferences emerge (coding styles, conventions, workflows)
- After significant work where context would help in future sessions

**Learning from feedback:**
- When user says something is better/worse, capture WHY and encode it as a pattern
- Each correction is a chance to improve permanently - don't just fix the immediate issue, update your instructions
- When user says "you should remember X" or "be careful about Y", treat this as HIGH PRIORITY - update memories IMMEDIATELY
- Look for the underlying principle behind corrections, not just the specific mistake
```

**4. Memory Scope Decision Guide**:

```text
## Deciding Where to Store Memory

When writing or updating agent memory, decide whether each fact, configuration, or behavior belongs in:

### User Agent File: `{agent_dir_absolute}/agent.md`
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

### Project Agent File: `{project_deepagents_dir}/agent.md`
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

### Project Memory Files: `{project_deepagents_dir}/*.md`
→ Use for **project-specific reference information** and structured notes.

**Store here:**
- API design documentation
- Architecture decisions and rationale
- Deployment procedures
- Common debugging patterns
- Onboarding information

**Examples:**
- `{project_deepagents_dir}/api-design.md` - REST API patterns used
- `{project_deepagents_dir}/architecture.md` - System architecture overview
- `{project_deepagents_dir}/deployment.md` - How to deploy this project
```

**5. File Operations Examples**:

```text
### File Operations:

**User memory:**
```

ls {agent_dir_absolute}                              # List user memory files
read_file '{agent_dir_absolute}/agent.md'            # Read user preferences
edit_file '{agent_dir_absolute}/agent.md' ...        # Update user preferences

```

**Project memory (preferred for project-specific information):**
```

ls {project_deepagents_dir}                          # List project memory files
read_file '{project_deepagents_dir}/agent.md'        # Read project instructions
edit_file '{project_deepagents_dir}/agent.md' ...    # Update project instructions
write_file '{project_deepagents_dir}/agent.md' ...  # Create project memory file

```

**Important**:
- Project memory files are stored in `.deepagents/` inside the project root
- Always use absolute paths for file operations
- Check project memories BEFORE user when answering project-specific questions
```

---

### 3. Settings and Path Management

#### 3.1 Settings Class Structure

**File**: `.refs/deepagents/libs/deepagents-cli/deepagents_cli/config.py`

The `Settings` class manages all path resolution and project detection:

```python
class Settings:
    """Global settings with project detection and path management."""

    def __init__(self, *, project_root: Path | None, user_deepagents_dir: Path):
        self.project_root = project_root  # Detected .git project root
        self.user_deepagents_dir = user_deepagents_dir  # ~/.deepagents/

    @classmethod
    def from_environment(cls, start_path: Path | None = None) -> "Settings":
        """Create Settings with automatic project detection."""
        # Find project root (directory containing .git)
        project_root = find_git_root(start_path or Path.cwd())

        # User directory
        user_deepagents_dir = Path.home() / ".deepagents"

        return cls(project_root=project_root, user_deepagents_dir=user_deepagents_dir)

    def get_agent_dir(self, assistant_id: str) -> Path:
        """Get user agent directory: ~/.deepagents/{assistant_id}/"""
        return self.user_deepagents_dir / assistant_id

    def get_user_agent_md_path(self, assistant_id: str) -> Path:
        """Get user agent.md path: ~/.deepagents/{assistant_id}/agent.md"""
        return self.get_agent_dir(assistant_id) / "agent.md"

    def get_project_agent_md_path(self) -> Path | None:
        """Get project agent.md path: [project-root]/.deepagents/agent.md"""
        if not self.project_root:
            return None

        # Preferred location
        preferred = self.project_root / ".deepagents" / "agent.md"
        if preferred.exists():
            return preferred

        # Fallback location
        fallback = self.project_root / "agent.md"
        if fallback.exists():
            return fallback

        return None

    def ensure_agent_dir(self, assistant_id: str) -> Path:
        """Ensure user agent directory exists, creating if necessary."""
        agent_dir = self.get_agent_dir(assistant_id)
        agent_dir.mkdir(parents=True, exist_ok=True)
        return agent_dir

    def ensure_user_skills_dir(self, assistant_id: str) -> Path:
        """Ensure user skills directory exists: ~/.deepagents/{assistant_id}/skills/"""
        skills_dir = self.get_agent_dir(assistant_id) / "skills"
        skills_dir.mkdir(parents=True, exist_ok=True)
        return skills_dir

    def get_project_skills_dir(self) -> Path | None:
        """Get project skills directory: [project-root]/.deepagents/skills/"""
        if not self.project_root:
            return None
        return self.project_root / ".deepagents" / "skills"
```

#### 3.2 Project Detection

**Function**: `find_git_root()` - Searches upward from start_path for `.git` directory

**Pattern**:

```python
def find_git_root(start_path: Path) -> Path | None:
    """Find the git root by walking up the directory tree."""
    current = start_path.resolve()

    while current != current.parent:
        if (current / ".git").exists():
            return current
        current = current.parent

    return None
```

**Key Insight**: Project root detection is git-based. No `.git` = no project memory.

#### 3.3 Directory Structure

**User-level** (agent-specific):

```
~/.deepagents/
├── {agent_id}/
│   ├── agent.md           # User memory
│   └── skills/            # User skills
│       ├── skill-1/
│       │   └── SKILL.md
│       └── skill-2/
│           └── SKILL.md
```

**Project-level** (project-specific):

```
[project-root]/
├── .git/                  # Triggers project detection
├── .deepagents/
│   ├── agent.md           # Project memory (preferred)
│   ├── architecture.md    # Additional memory files
│   ├── deployment.md
│   └── skills/            # Project skills
│       └── skill-3/
│           └── SKILL.md
└── agent.md               # Project memory (fallback)
```

---

### 4. CLI Integration

#### 4.1 Agent Creation

**File**: `.refs/deepagents/libs/deepagents-cli/deepagents_cli/agent.py:326-466`

**Function**: `create_cli_agent()`

```python
def create_cli_agent(
    model: str | BaseChatModel,
    assistant_id: str,
    *,
    tools: list[BaseTool] | None = None,
    sandbox: SandboxBackendProtocol | None = None,
    sandbox_type: str | None = None,
    system_prompt: str | None = None,
    auto_approve: bool = False,
    enable_memory: bool = True,    # NEW: Toggle memory middleware
    enable_skills: bool = True,    # NEW: Toggle skills middleware
    enable_shell: bool = True,     # NEW: Toggle shell middleware
) -> tuple[Pregel, CompositeBackend]:
    """Create a CLI-configured agent with flexible options."""

    # Setup agent directory for persistent memory (if enabled)
    if enable_memory or enable_skills:
        agent_dir = settings.ensure_agent_dir(assistant_id)
        agent_md = agent_dir / "agent.md"
        if not agent_md.exists():
            source_content = get_default_coding_instructions()
            agent_md.write_text(source_content)

    # Skills directories (if enabled)
    skills_dir = None
    project_skills_dir = None
    if enable_skills:
        skills_dir = settings.ensure_user_skills_dir(assistant_id)
        project_skills_dir = settings.get_project_skills_dir()

    # Build middleware stack based on enabled features
    agent_middleware = []

    # Add memory middleware
    if enable_memory:
        agent_middleware.append(
            AgentMemoryMiddleware(settings=settings, assistant_id=assistant_id)
        )

    # Add skills middleware
    if enable_skills:
        agent_middleware.append(
            SkillsMiddleware(
                skills_dir=skills_dir,
                assistant_id=assistant_id,
                project_skills_dir=project_skills_dir,
            )
        )

    # Add shell middleware (only in local mode)
    if enable_shell and sandbox is None:
        agent_middleware.append(
            ShellMiddleware(
                workspace_root=str(Path.cwd()),
                env=os.environ,
            )
        )

    # Create the agent
    agent = create_deep_agent(
        model=model,
        system_prompt=system_prompt,
        tools=tools,
        backend=composite_backend,
        middleware=agent_middleware,  # All middleware
        interrupt_on=interrupt_on,
        checkpointer=InMemorySaver(),
    ).with_config(config)

    return agent, composite_backend
```

**Middleware Ordering**:

1. **AgentMemoryMiddleware** - Loads and injects memory first
2. **SkillsMiddleware** - Loads and injects skills metadata
3. **ShellMiddleware** - Adds shell command execution (local only)

**Key Patterns**:

- ✅ **Feature toggles**: Each middleware can be enabled/disabled
- ✅ **Automatic directory creation**: Ensures agent directory exists
- ✅ **Default agent.md**: Creates default content if file doesn't exist
- ✅ **Settings injection**: Settings object passed to middleware for path management

#### 4.2 Default Agent Content

**File**: `.refs/deepagents/libs/deepagents-cli/deepagents_cli/config.py`

**Function**: `get_default_coding_instructions()` returns:

```markdown
You are a highly capable coding assistant with access to the filesystem and shell.

When the user asks you to work on a project:
1. First, understand the project structure (use ls, read key files like README, package.json, etc.)
2. Ask clarifying questions if the task is ambiguous
3. Write clean, well-documented code that follows the project's existing patterns
4. Test your changes when possible

Be proactive but not overwhelming. Work incrementally and communicate clearly.
```

**Purpose**: Provides baseline instructions that user can customize per-agent

---

### 5. Integration with AI SDK v6 Middleware

#### 5.1 Our Current Middleware Implementation

**File**: `src/agent.ts:124-135`

```typescript
// Wrap model with middleware if provided
if (middleware) {
  const middlewares = Array.isArray(middleware)
    ? middleware
    : [middleware];

  this.model = wrapLanguageModel({
    model: model as any, // Cast required since wrapLanguageModel expects LanguageModelV3
    middleware: middlewares,
  }) as LanguageModel;
} else {
  this.model = model;
}
```

**Key Insights**:

- ✅ Already supports middleware wrapping via `wrapLanguageModel`
- ✅ Accepts single middleware or array
- ✅ Wraps model once in constructor, used for all operations

#### 5.2 Our Skills System Pattern (Similar to Memory)

**Files**: `src/skills/load.ts`, `src/skills/types.ts`, `src/prompts.ts`

**How Skills Work** (Lines in `src/agent.ts`):

1. **Load skills metadata** (constructor, lines 146-150):

```typescript
// Load skills if directory provided
if (skillsDir) {
  this.loadSkills(skillsDir).catch(error => {
    console.warn('[DeepAgent] Failed to load skills:', error);
  });
}
```

2. **Store metadata** (class field, line 103):

```typescript
private skillsMetadata: Array<{ name: string; description: string; path: string }> = [];
```

3. **Inject into system prompt** (`buildSystemPrompt`, line 74-76):

```typescript
// Add skills prompt if skills loaded
if (skills && skills.length > 0) {
  parts.push(buildSkillsPrompt(skills));
}
```

**Skills Prompt Format** (`src/prompts.ts:buildSkillsPrompt`):

```typescript
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

**Pattern Similarity to Agent Memory**:

- ✅ Load metadata at agent creation time
- ✅ Store in agent instance
- ✅ Inject into system prompt via `buildSystemPrompt`
- ✅ Progressive disclosure (metadata shown, full content loaded on-demand)

---

### 6. AI SDK v6 Middleware Adaptation Strategy

#### 6.1 Middleware Hooks Available

From AI SDK v6 `LanguageModelMiddleware`:

```typescript
interface LanguageModelMiddleware {
  /**
   * Modify parameters before they're sent to the model
   */
  transformParams?: (params: {
    params: LanguageModelParams;
    context: Context;
  }) => Promise<LanguageModelParams>;

  /**
   * Wrap non-streaming generation calls
   */
  wrapGenerate?: (options: {
    doGenerate: () => Promise<GenerateResult>;
    params: LanguageModelParams;
    context: Context;
  }) => Promise<GenerateResult>;

  /**
   * Wrap streaming generation calls
   */
  wrapStream?: (options: {
    doStream: () => Promise<StreamResult>;
    params: LanguageModelParams;
    context: Context;
  }) => Promise<StreamResult>;
}
```

#### 6.2 Agent Memory Middleware Design

**Approach**: Create middleware factory that injects memory into system prompt

**Implementation Pattern**:

```typescript
// src/middleware/agent-memory.ts

import type { LanguageModelMiddleware } from 'ai';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import { homedir } from 'node:os';

export interface AgentMemoryOptions {
  /**
   * Agent identifier (e.g., 'coding-assistant')
   */
  agentId: string;

  /**
   * Optional project root directory for project-specific memory
   * If not provided, will attempt to find .git directory
   */
  projectRoot?: string;

  /**
   * Optional custom template for memory injection
   */
  memoryTemplate?: string;
}

/**
 * Create middleware that loads and injects agent memory from agent.md files.
 *
 * Memory is loaded from two locations:
 * 1. User memory: ~/.deepagents/{agentId}/agent.md
 * 2. Project memory: [project-root]/.deepagents/agent.md
 */
export function createAgentMemoryMiddleware(
  options: AgentMemoryOptions
): LanguageModelMiddleware {
  const { agentId, projectRoot } = options;

  // User paths
  const userAgentDir = path.join(homedir(), '.deepagents', agentId);
  const userAgentMdPath = path.join(userAgentDir, 'agent.md');

  // Project paths
  let projectAgentMdPath: string | null = null;
  let projectDeepAgentsDir: string | null = null;

  if (projectRoot) {
    projectDeepAgentsDir = path.join(projectRoot, '.deepagents');
    const preferred = path.join(projectDeepAgentsDir, 'agent.md');
    const fallback = path.join(projectRoot, 'agent.md');

    // Check preferred location first
    try {
      if (fs.access(preferred)) {
        projectAgentMdPath = preferred;
      } else if (fs.access(fallback)) {
        projectAgentMdPath = fallback;
      }
    } catch {
      // No project memory
    }
  }

  // Load memory once during middleware creation
  let userMemory: string | null = null;
  let projectMemory: string | null = null;

  return {
    // Use transformParams to inject memory into system prompt
    transformParams: async ({ params }) => {
      // Lazy load memory on first call
      if (userMemory === null) {
        try {
          userMemory = await fs.readFile(userAgentMdPath, 'utf-8');
        } catch {
          userMemory = ''; // Empty if file doesn't exist
        }
      }

      if (projectMemory === null && projectAgentMdPath) {
        try {
          projectMemory = await fs.readFile(projectAgentMdPath, 'utf-8');
        } catch {
          projectMemory = ''; // Empty if file doesn't exist
        }
      }

      // Build memory section
      const memorySection = buildMemorySection({
        userMemory,
        projectMemory,
        userAgentDir,
        projectDeepAgentsDir,
        projectRoot,
      });

      // Inject into system prompt
      const currentPrompt = params.prompt || [];

      // Find or create system message
      const systemMessageIndex = currentPrompt.findIndex(
        msg => msg.role === 'system'
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

function buildMemorySection(options: {
  userMemory: string | null;
  projectMemory: string | null;
  userAgentDir: string;
  projectDeepAgentsDir: string | null;
  projectRoot: string | null;
}): string {
  const {
    userMemory,
    projectMemory,
    userAgentDir,
    projectDeepAgentsDir,
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

  const projectDirDisplay = projectDeepAgentsDir
    ? projectDeepAgentsDir
    : '[project-root]/.deepagents (not in a project)';

  return `## Agent Memory

<user_memory>
${userMemoryDisplay}
</user_memory>

<project_memory>
${projectMemoryDisplay}
</project_memory>

## Long-term Memory

Your long-term memory is stored in files on the filesystem and persists across sessions.

**User Memory Location**: \`${userAgentDir}\`
**Project Memory Location**: ${projectInfo}

Your system prompt is loaded from TWO sources at startup:
1. **User agent.md**: \`${userAgentDir}/agent.md\` - Your personal preferences across all projects
2. **Project agent.md**: \`${projectDirDisplay}/agent.md\` - Project-specific instructions

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

### Project Agent File: \`${projectDirDisplay}/agent.md\`
→ Describes **how this specific project works** and **how the agent should behave here only.**

**Store here:**
- Project-specific architecture and design patterns
- Coding conventions specific to this codebase
- Project structure and organization
- Testing strategies for this project
- Deployment processes and workflows
- Team conventions and guidelines

### Project Memory Files: \`${projectDirDisplay}/*.md\`
→ Use for **project-specific reference information** and structured notes.

**Store here:**
- API design documentation
- Architecture decisions and rationale
- Deployment procedures
- Common debugging patterns
- Onboarding information

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

#### 6.3 Usage in deepagentsdk

```typescript
import { createDeepAgent } from 'deepagentsdk';
import { anthropic } from '@ai-sdk/anthropic';
import { createAgentMemoryMiddleware } from 'deepagentsdk/middleware';

const agent = createDeepAgent({
  model: anthropic('claude-sonnet-4-20250514'),
  middleware: [
    createAgentMemoryMiddleware({
      agentId: 'coding-assistant',
      projectRoot: process.cwd(), // or detect .git automatically
    }),
  ],
});

// Agent now has access to:
// - ~/.deepagents/coding-assistant/agent.md (user memory)
// - [project-root]/.deepagents/agent.md (project memory)
```

---

### 7. Project Root Detection

#### 7.1 Git-Based Detection

**File**: `.refs/deepagents/libs/deepagents-cli/deepagents_cli/project_utils.py`

```python
def find_git_root(start_path: Path) -> Path | None:
    """Find the git root by walking up the directory tree."""
    current = start_path.resolve()

    while current != current.parent:
        if (current / ".git").exists():
            return current
        current = current.parent

    return None
```

#### 7.2 Implementation for TypeScript

```typescript
// src/utils/project-detection.ts

import * as fs from 'node:fs/promises';
import * as path from 'node:path';

/**
 * Find the git root by walking up the directory tree.
 * Returns null if no .git directory is found.
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

---

### 8. Implementation Plan for deepagentsdk

#### 8.1 Phase 1: Core Middleware (2-3 days)

**Deliverables**:

1. Create `src/middleware/agent-memory.ts` with middleware factory
2. Create `src/utils/project-detection.ts` for git root finding
3. Add types to `src/types.ts`
4. Export from `src/index.ts`

**Files to Create**:

- `src/middleware/agent-memory.ts` - Middleware implementation
- `src/utils/project-detection.ts` - Project detection utility
- `test/middleware/agent-memory.test.ts` - Unit tests

**Files to Modify**:

- `src/types.ts` - Add AgentMemoryOptions type
- `src/index.ts` - Export middleware and utilities

#### 8.2 Phase 2: CLI Integration (1 day)

**If we have a CLI**:

1. Add `--agent-id` flag
2. Auto-detect project root
3. Initialize agent directory with default agent.md
4. Pass middleware to createDeepAgent

**Example**:

```typescript
// CLI usage
const projectRoot = await findGitRoot();
const middleware = [
  createAgentMemoryMiddleware({
    agentId: options.agentId || 'default',
    projectRoot,
  }),
];

const agent = createDeepAgent({
  model: anthropic('claude-sonnet-4-20250514'),
  middleware,
});
```

#### 8.3 Phase 3: Documentation (1 day)

**Deliverables**:

1. Create `docs/agent-memory.md` user guide
2. Update README.md with agent memory example
3. Create example: `examples/with-agent-memory.ts`
4. Update JSDoc in `src/agent.ts`

---

### 9. Test Cases

#### 9.1 Unit Tests

**File**: `test/middleware/agent-memory.test.ts`

```typescript
import { test, expect } from 'bun:test';
import { createAgentMemoryMiddleware } from '../src/middleware/agent-memory.ts';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import { tmpdir } from 'node:os';

test('agent-memory: loads user memory only (no project)', async () => {
  const tmpPath = path.join(tmpdir(), `test-${Date.now()}`);
  const userAgentDir = path.join(tmpPath, '.deepagents', 'test-agent');
  await fs.mkdir(userAgentDir, { recursive: true });

  // Create user agent.md
  const userMd = path.join(userAgentDir, 'agent.md');
  await fs.writeFile(userMd, 'User preferences');

  const middleware = createAgentMemoryMiddleware({
    agentId: 'test-agent',
    // No projectRoot
  });

  // Simulate transformParams call
  const params = { prompt: [] };
  const result = await middleware.transformParams({ params, context: {} });

  // Check that system message was injected
  expect(result.prompt[0].role).toBe('system');
  expect(result.prompt[0].content).toContain('User preferences');
  expect(result.prompt[0].content).toContain('(No project agent.md)');

  // Cleanup
  await fs.rm(tmpPath, { recursive: true });
});

test('agent-memory: loads both user and project memory', async () => {
  const tmpPath = path.join(tmpdir(), `test-${Date.now()}`);
  const userAgentDir = path.join(tmpPath, '.deepagents', 'test-agent');
  const projectRoot = path.join(tmpPath, 'project');
  const projectDeepAgents = path.join(projectRoot, '.deepagents');

  await fs.mkdir(userAgentDir, { recursive: true });
  await fs.mkdir(projectDeepAgents, { recursive: true });

  // Create user agent.md
  await fs.writeFile(path.join(userAgentDir, 'agent.md'), 'User preferences');

  // Create project agent.md
  await fs.writeFile(path.join(projectDeepAgents, 'agent.md'), 'Project context');

  const middleware = createAgentMemoryMiddleware({
    agentId: 'test-agent',
    projectRoot,
  });

  const params = { prompt: [] };
  const result = await middleware.transformParams({ params, context: {} });

  expect(result.prompt[0].content).toContain('User preferences');
  expect(result.prompt[0].content).toContain('Project context');

  await fs.rm(tmpPath, { recursive: true });
});

test('agent-memory: project fallback location', async () => {
  const tmpPath = path.join(tmpdir(), `test-${Date.now()}`);
  const projectRoot = path.join(tmpPath, 'project');
  await fs.mkdir(projectRoot, { recursive: true });

  // Create agent.md in fallback location (project root)
  await fs.writeFile(path.join(projectRoot, 'agent.md'), 'Fallback memory');

  const middleware = createAgentMemoryMiddleware({
    agentId: 'test-agent',
    projectRoot,
  });

  const params = { prompt: [] };
  const result = await middleware.transformParams({ params, context: {} });

  expect(result.prompt[0].content).toContain('Fallback memory');

  await fs.rm(tmpPath, { recursive: true });
});

test('agent-memory: handles missing files gracefully', async () => {
  const middleware = createAgentMemoryMiddleware({
    agentId: 'nonexistent-agent',
  });

  const params = { prompt: [] };
  const result = await middleware.transformParams({ params, context: {} });

  // Should still inject system prompt with "(No user agent.md)"
  expect(result.prompt[0].role).toBe('system');
  expect(result.prompt[0].content).toContain('(No user agent.md)');
  expect(result.prompt[0].content).toContain('(No project agent.md)');
});

test('agent-memory: prepends to existing system message', async () => {
  const middleware = createAgentMemoryMiddleware({
    agentId: 'test-agent',
  });

  const params = {
    prompt: [
      { role: 'system', content: 'Existing system prompt' },
      { role: 'user', content: 'Hello' },
    ],
  };

  const result = await middleware.transformParams({ params, context: {} });

  // Should prepend memory to existing system message
  expect(result.prompt[0].role).toBe('system');
  expect(result.prompt[0].content).toContain('Agent Memory');
  expect(result.prompt[0].content).toContain('Existing system prompt');
  expect(result.prompt.length).toBe(2); // Didn't add extra message
});
```

#### 9.2 Integration Tests

**File**: `test/integration/agent-memory.test.ts`

```typescript
import { test, expect } from 'bun:test';
import { createDeepAgent } from '../src/agent.ts';
import { createAgentMemoryMiddleware } from '../src/middleware/agent-memory.ts';
import { anthropic } from '@ai-sdk/anthropic';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import { tmpdir } from 'node:os';

test('integration: agent uses memory from agent.md', async () => {
  const tmpPath = path.join(tmpdir(), `test-${Date.now()}`);
  const userAgentDir = path.join(tmpPath, '.deepagents', 'test-agent');
  await fs.mkdir(userAgentDir, { recursive: true });

  // Create agent.md with personality
  await fs.writeFile(
    path.join(userAgentDir, 'agent.md'),
    'Be concise and direct. No pleasantries.'
  );

  const middleware = createAgentMemoryMiddleware({
    agentId: 'test-agent',
  });

  const agent = createDeepAgent({
    model: anthropic('claude-sonnet-4-20250514'),
    middleware: [middleware],
  });

  const result = await agent.generate({
    prompt: 'Say hello',
  });

  // Agent should follow memory instructions (be concise)
  expect(result.text.length).toBeLessThan(50);

  await fs.rm(tmpPath, { recursive: true });
});
```

---

### 10. Comparison: LangChain vs deepagentsdk

| Aspect | LangChain DeepAgents | deepagentsdk |
|--------|----------------------|-------------------|
| **Memory Loading Hook** | `before_agent` (runs once per conversation) | `transformParams` (runs before each model call) |
| **State Management** | AgentState with `user_memory`, `project_memory` fields | No state - memory loaded in closure |
| **System Prompt Injection** | `wrap_model_call` modifies request | `transformParams` modifies params |
| **Path Management** | Settings class with centralized path resolution | Inline path construction in middleware |
| **Project Detection** | find_git_root() utility | Need to implement findGitRoot() |
| **Middleware Factory** | Class-based (AgentMemoryMiddleware) | Function-based (createAgentMemoryMiddleware) |
| **Async Support** | Both sync and async hooks | Async only (Node.js pattern) |
| **Error Handling** | contextlib.suppress for file errors | try-catch for file errors |
| **Memory Caching** | State-based (loaded once, cached in state) | Closure-based (loaded once in middleware factory) |
| **Template Customization** | Constructor parameter | Factory option parameter |

**Key Insight**: LangChain uses state to cache memory; we'll use closure to cache memory (loaded once during middleware creation).

---

## Code References

### LangChain Python Implementation

- `.refs/deepagents/libs/deepagents-cli/deepagents_cli/agent_memory.py:1-329` - Complete AgentMemoryMiddleware implementation
- `.refs/deepagents/libs/deepagents-cli/deepagents_cli/config.py` - Settings class and path management
- `.refs/deepagents/libs/deepagents-cli/deepagents_cli/agent.py:326-466` - CLI integration (create_cli_agent)
- `.refs/deepagents/libs/deepagents-cli/deepagents_cli/project_utils.py` - Project detection utilities
- `.refs/deepagents/libs/deepagents-cli/tests/test_project_memory.py:1-141` - Test coverage

### deepagentsdk Current Implementation

- `src/agent.ts:124-135` - Middleware wrapping in DeepAgent constructor
- `src/agent.ts:146-150` - Skills loading pattern (similar to memory)
- `src/skills/load.ts` - Progressive disclosure pattern for skills
- `src/prompts.ts:buildSkillsPrompt` - System prompt injection pattern
- `docs/tickets/004_middleware_architecture/research.md` - Middleware architecture research
- `docs/tickets/004_middleware_architecture/plan.md` - Middleware implementation plan

---

## Architecture Diagrams

### LangChain Memory Loading Flow

```
┌─────────────────────────────────────────────────────────┐
│                  Agent Initialization                    │
└────────────────────────┬────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────┐
│  create_cli_agent(model, assistant_id, ...)             │
│  1. Ensure agent directory exists                       │
│  2. Create default agent.md if missing                  │
│  3. Build middleware stack:                             │
│     - AgentMemoryMiddleware(settings, assistant_id)     │
│     - SkillsMiddleware(...)                             │
│     - ShellMiddleware(...) [local only]                 │
└────────────────────────┬────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────┐
│              First Model Call (Step 1)                   │
└────────────────────────┬────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────┐
│  AgentMemoryMiddleware.before_agent()                   │
│  1. Check if "user_memory" in state? → NO               │
│  2. Load ~/.deepagents/{assistant_id}/agent.md          │
│  3. Store in state["user_memory"]                       │
│  4. Check if "project_memory" in state? → NO            │
│  5. Load [project-root]/.deepagents/agent.md (if exists)│
│  6. Store in state["project_memory"]                    │
│  7. Return state update                                 │
└────────────────────────┬────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────┐
│  AgentMemoryMiddleware.wrap_model_call()                │
│  1. Build memory section:                               │
│     <user_memory>{content}</user_memory>                │
│     <project_memory>{content}</project_memory>          │
│  2. Append LONGTERM_MEMORY_SYSTEM_PROMPT instructions   │
│  3. Prepend to base system prompt                       │
│  4. Call handler with modified request                  │
└────────────────────────┬────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────┐
│                   Model Receives Prompt:                 │
│  <user_memory>Be concise and direct</user_memory>       │
│  <project_memory>This is a FastAPI project</project_...>│
│                                                          │
│  ## Long-term Memory                                    │
│  Your long-term memory is stored in files...            │
│  **When to CHECK/READ memories:**                       │
│  - At the start of ANY new session...                   │
│  - BEFORE answering questions...                        │
│  ...                                                     │
│                                                          │
│  [Base System Prompt]                                   │
│  You are a coding assistant...                          │
└────────────────────────┬────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────┐
│              Subsequent Model Calls                      │
│  before_agent checks state:                             │
│  - "user_memory" in state? → YES (skip loading)         │
│  - "project_memory" in state? → YES (skip loading)      │
│  wrap_model_call still injects memory into prompt       │
└─────────────────────────────────────────────────────────┘
```

### deepagentsdk Proposed Implementation

```
┌─────────────────────────────────────────────────────────┐
│              createDeepAgent(params)                     │
│  params: {                                               │
│    model: LanguageModel,                                 │
│    middleware: [createAgentMemoryMiddleware({           │
│      agentId: 'coding-assistant',                       │
│      projectRoot: '/path/to/project'                    │
│    })]                                                   │
│  }                                                       │
└────────────────────────┬────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────┐
│  createAgentMemoryMiddleware()                          │
│  1. Compute paths:                                       │
│     - userAgentDir = ~/.deepagents/{agentId}/           │
│     - userAgentMdPath = ~/.deepagents/{agentId}/agent.md│
│     - projectAgentMdPath = [root]/.deepagents/agent.md  │
│  2. Initialize memory variables (null)                   │
│  3. Return middleware object with transformParams hook  │
└────────────────────────┬────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────┐
│  DeepAgent Constructor                                   │
│  if (middleware) {                                       │
│    this.model = wrapLanguageModel({                     │
│      model: params.model,                               │
│      middleware: Array.isArray(middleware)              │
│        ? middleware                                      │
│        : [middleware]                                    │
│    });                                                   │
│  }                                                       │
└────────────────────────┬────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────┐
│              First Model Call (generate/stream)          │
└────────────────────────┬────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────┐
│  Middleware.transformParams()                           │
│  1. Check if userMemory === null? → YES (first call)    │
│  2. Load user agent.md file:                            │
│     userMemory = fs.readFileSync(userAgentMdPath)       │
│  3. Check if projectMemory === null? → YES              │
│  4. Load project agent.md file (if exists):             │
│     projectMemory = fs.readFileSync(projectAgentMdPath) │
│  5. Build memory section using buildMemorySection()     │
│  6. Find or create system message in params.prompt      │
│  7. Prepend memory section to system message            │
│  8. Return modified params                              │
└────────────────────────┬────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────┐
│              Subsequent Model Calls                      │
│  transformParams() runs again:                          │
│  1. Check if userMemory === null? → NO (cached)         │
│  2. Check if projectMemory === null? → NO (cached)      │
│  3. Use cached memory values                            │
│  4. Build and inject memory section                     │
│  5. Return modified params                              │
└─────────────────────────────────────────────────────────┘
```

**Key Difference**: LangChain uses state for caching (before_agent loads once), we use closure variables (transformParams checks null).

---

## Progressive Disclosure Pattern

### How It Works

1. **At Startup**: Load agent.md content into memory (user + project)
2. **In System Prompt**:
   - Show full content of both agent.md files (`<user_memory>`, `<project_memory>`)
   - Teach agent WHERE memory files are located (absolute paths)
   - Teach agent WHEN to check/read/update memories
   - Teach agent HOW to decide between user vs project memory
3. **During Execution**: Agent uses filesystem tools to read/update memory files
4. **Memory-First Pattern**: Agent checks memory BEFORE relying on general knowledge

### Why This Works

- Agent sees memory content on every model call (always in context)
- Agent knows exact file paths for reading additional memory files
- Agent can update memories using standard filesystem tools (edit_file, write_file)
- Progressive: Metadata in prompt, full content loaded on-demand (for additional memory files)

### Example User Flow

**Session 1**:

```
User: "You should always use type hints in Python"
Agent: [Updates ~/.deepagents/coding-assistant/agent.md with this preference]
```

**Session 2** (new conversation):

```
User: "Write a function to calculate factorial"
Agent: [Reads memory from system prompt, sees "always use type hints"]
Agent: [Writes function with type hints]

def factorial(n: int) -> int:
    """Calculate factorial of n."""
    if n <= 1:
        return 1
    return n * factorial(n - 1)
```

**Session 3** (in a FastAPI project):

```
User: "Add an endpoint for user registration"
Agent: [Reads project memory: "This project uses FastAPI with SQLAlchemy"]
Agent: [Reads user memory: "Always use type hints"]
Agent: [Creates endpoint following project patterns with type hints]

@app.post("/register")
async def register_user(user: UserCreate, db: Session = Depends(get_db)) -> UserResponse:
    ...
```

---

## Open Questions

1. **Memory Reload Strategy**: Should we reload agent.md on every model call or cache it?
   - **LangChain**: Caches in state (loads once per conversation)
   - **Recommendation**: Cache in closure (load once in middleware factory)
   - **Trade-off**: Memory updates require restarting agent vs. always fresh

2. **Project Root Auto-Detection**: Should we auto-detect project root or require explicit parameter?
   - **LangChain**: Auto-detects via find_git_root()
   - **Recommendation**: Auto-detect by default, allow override
   - **Implementation**: Add `autoDetectProjectRoot: true` option

3. **Multiple Memory Files**: Should agent.md be the only file or support multiple?
   - **LangChain**: Supports additional .md files in .deepagents/ directory
   - **Current**: System prompt teaches agent to create additional files (architecture.md, deployment.md, etc.)
   - **Recommendation**: Keep single agent.md for now, agent can create others as needed

4. **Memory File Format**: Plain markdown or structured (YAML frontmatter)?
   - **LangChain**: Plain markdown
   - **Recommendation**: Plain markdown (simpler, more flexible)
   - **Future**: Could add optional YAML frontmatter parsing

5. **Directory Creation**: Should we auto-create directories or require manual setup?
   - **LangChain**: Auto-creates with default content
   - **Recommendation**: Auto-create user directory, not project directory
   - **Rationale**: User directory is safe to create; project directory should be explicit

6. **Integration with CLI**: Do we need a CLI or is this library-only?
   - **Current**: Library-only
   - **Future**: CLI could use agent memory for persistent personality

---

## Related Research

- `docs/tickets/004_middleware_architecture/research.md` - Middleware architecture research (completed)
- `docs/tickets/004_middleware_architecture/plan.md` - Middleware implementation plan (completed)
- `docs/PROJECT-STATE.md` - Feature parity tracking

---

## Implementation Checklist

### Phase 1: Core Implementation

- [ ] Create `src/middleware/agent-memory.ts`
  - [ ] `createAgentMemoryMiddleware()` factory
  - [ ] `buildMemorySection()` helper
  - [ ] Memory loading logic
  - [ ] System prompt injection
- [ ] Create `src/utils/project-detection.ts`
  - [ ] `findGitRoot()` function
  - [ ] Error handling
- [ ] Update `src/types.ts`
  - [ ] `AgentMemoryOptions` interface
  - [ ] Export types
- [ ] Update `src/index.ts`
  - [ ] Export `createAgentMemoryMiddleware`
  - [ ] Export `findGitRoot`

### Phase 2: Testing

- [ ] Create `test/middleware/agent-memory.test.ts`
  - [ ] Test user memory only
  - [ ] Test both user and project memory
  - [ ] Test fallback location
  - [ ] Test missing files
  - [ ] Test system message prepending
- [ ] Create `test/integration/agent-memory.test.ts`
  - [ ] Test agent using memory
  - [ ] Test memory updates
  - [ ] Test project-specific behavior

### Phase 3: Documentation

- [ ] Create `docs/agent-memory.md`
  - [ ] Usage guide
  - [ ] Directory structure
  - [ ] Best practices
  - [ ] Examples
- [ ] Create `examples/with-agent-memory.ts`
  - [ ] Basic usage
  - [ ] User memory example
  - [ ] Project memory example
- [ ] Update `README.md`
  - [ ] Add agent memory section
  - [ ] Add example
- [ ] Update JSDoc in `src/agent.ts`
  - [ ] Add middleware example

### Phase 4: Finalization

- [ ] Update `docs/PROJECT-STATE.md`
  - [ ] Mark "Agent Memory Middleware" as ✅ Implemented
  - [ ] Update priority rationale
- [ ] Run tests: `bun test`
- [ ] Type check: `bun run typecheck`
- [ ] Create example agent.md files for testing
- [ ] Manual testing with real agent

---

## Conclusion

LangChain's Agent Memory Middleware provides a robust pattern for persistent, cross-session agent memory through agent.md files. The implementation uses:

1. **Dual Memory Sources**: User-level (personality) and project-level (context)
2. **Progressive Disclosure**: Memory content in prompt, agent uses filesystem tools for updates
3. **Middleware Hooks**: `before_agent` for loading, `wrap_model_call` for injection
4. **Comprehensive Instructions**: 115-line system prompt teaching agent about memory

**For deepagentsdk**, we can adapt this pattern using:

- `transformParams` hook for system prompt injection
- Closure-based caching (load once in middleware factory)
- Similar directory structure (`~/.deepagents/{agentId}/agent.md`)
- Same progressive disclosure and memory-first response pattern

**Estimated Implementation Time**: 3-5 days (core + testing + docs)

**Risk**: Low - Non-breaking addition, follows established middleware pattern

---

## Next Steps

1. Review this research document
2. Create implementation plan (similar to middleware plan)
3. Implement Phase 1 (core middleware)
4. Implement Phase 2 (testing)
5. Implement Phase 3 (documentation)
6. Update PROJECT-STATE.md
