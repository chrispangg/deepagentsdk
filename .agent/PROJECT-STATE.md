# PROJECT-STATE.md

Tracks feature parity with LangChain's DeepAgents framework. Reference implementations in `.refs/`.

---

## ✅ Implemented

- [x] **DeepAgent Core** - Main agent class with generate/stream/streamWithEvents
- [x] **Todo Planning Tool** - `write_todos` with merge/replace strategies
- [x] **Filesystem Tools** - `ls`, `read_file`, `write_file`, `edit_file`, `glob`, `grep`
- [x] **Subagent Spawning** - `task` tool for delegating to specialized agents
- [x] **StateBackend** - In-memory ephemeral file storage
- [x] **FilesystemBackend** - Persist files to actual disk
- [x] **PersistentBackend** - Cross-conversation memory via key-value store
- [x] **CompositeBackend** - Route files to different backends by path prefix
- [x] **Prompt Caching** - Anthropic cache control support
- [x] **Tool Result Eviction** - Large results saved to filesystem to prevent overflow
- [x] **Auto-Summarization** - Compress old messages when approaching token limits
- [x] **Event Streaming** - Granular events for tool calls, file ops, subagents
- [x] **CLI Interface** - Interactive terminal with Ink (React)
- [x] **SandboxBackendProtocol** - Execute shell commands in isolated environments (`BaseSandbox`, `LocalSandbox`)
- [x] **Execute Tool** - Run commands via sandbox backend (auto-added for sandbox backends)
- [x] **Human-in-the-Loop (HITL)** - Interrupt agent for tool approval/rejection via `interruptOn` config; CLI supports Safe/Auto-approve modes
- [x] **Checkpointer Support** - Persist agent state between invocations (pause/resume); includes `MemorySaver`, `FileSaver`, `KeyValueStoreSaver`; CLI session management via `--session` flag
- [x] **Web Tools** - `web_search` (Tavily API), `http_request`, `fetch_url` with HTML → Markdown conversion; follows LangChain approval pattern (approval required for `web_search` and `fetch_url` only)
- [x] **Middleware Architecture** - AI SDK v6 `wrapLanguageModel` support for logging, caching, RAG, guardrails; supports single or array of middleware; non-breaking addition via optional `middleware` parameter
- [x] **Skills System** - Dynamic skill loading from SKILL.md files with YAML frontmatter; progressive disclosure pattern (metadata in system prompt, full content loaded on-demand); supports user-level and project-level skills with override logic
- [x] **Agent Memory Middleware** - Long-term memory from agent.md files (plain markdown); two-tier system (user: `~/.deepagents/{agentId}/agent.md`, project: `[git-root]/.deepagents/agent.md`); closure-based caching for performance; auto-creates user directory, requests approval for project directory; supports additional .md files for specialized context; skills also load from `.deepagents/{agentId}/skills/`
- [x] **readRaw Backend Method** - Raw FileData without line formatting (implemented in all backends)
- [x] **Per-Subagent Interrupt Config** - Different HITL rules per subagent (via `SubAgent.interruptOn`)
- [x] **Structured Output** - `output` parameter for typed agent responses via Zod schemas
  - Uses ToolLoopAgent's native output parsing
  - Full TypeScript type inference
  - Works alongside all existing features
  - Non-breaking optional parameter
  - Supports subagent structured output delegation
- [x] **Fix `options.messages` Implementation** ⚠️ **[BUG]**
  - **Why**: `DeepAgentOptions.messages` is defined in types but NOT used in implementation; library only supports checkpoint-based persistence (threadId + checkpointer)
  - **Impact**: Users expect to pass conversation history via `messages` parameter (standard AI SDK pattern), but it's silently ignored
  - **Effort**: 1 day, add message handling to agent initialization
  - **Workaround**: Manually prepend message history to prompt or use checkpointer
  - **Note**: Should support both patterns: explicit `messages` array AND checkpoint-based persistence
- [x] **ToolLoopAgent Constructor Passthrough**
  - **Why**: Enable full AI SDK v6 ToolLoopAgent features (custom stopWhen, maxRetries, etc.) while keeping DeepAgent harness
  - **Impact**: Better flexibility for advanced users, maintains AI SDK compatibility
  - **Effort**: 1-2 days, add passthrough options to DeepAgentOptions
  - **Note**: Should preserve DeepAgent defaults (systemPrompt, tools) but allow overrides
- [x] **Subagent Web Tools Access** ⚠️ **[BUG]**
  - **Why**: Subagents spawned via `task` tool don't inherit web tools (`web_search`, `http_request`, `fetch_url`), limiting their capabilities
  - **Impact**: Subagents cannot perform web research or API calls, forcing parent agent to handle all web operations
  - **Effort**: 1 day, ensure web tools are passed to subagent creation in `src/tools/subagent.ts`
  - **Note**: Should respect parent's `interruptOn` config for web tool approvals
- [x] **Provider Options Passthrough** - Support AI SDK provider-specific options
  - **Why**: Enable provider-specific features (e.g., Anthropic's thinking mode, OpenAI's reasoning effort, etc.) without hardcoding in DeepAgent
  - **Impact**: Better flexibility for advanced users, maintains compatibility with AI SDK provider features
  - **Effort**: 1 day, add `providerOptions` parameter to `CreateDeepAgentParams` and pass through to ToolLoopAgent
  - **Note**: Should work alongside existing `generationOptions` and `loopControl` passthrough

---

## 🚧 To Implement

### Critical

### High Priority

- [ ] **Async Backend Methods** ⚠️ **[BREAKING]** - Full async variants of all backend operations
  - **Why**: Current sync methods block event loop, limits scalability
  - **Impact**: Better performance for I/O-heavy operations
  - **Effort**: 2-3 days, requires refactoring all backends + tests
  - **Note**: Schedule for next major version (v0.2.0 or v1.0.0)

- [ ] **Remove `as any` Type Assertions** - Eliminate unsafe type casts throughout codebase
  - **Why**: `as any` bypasses TypeScript's type safety, hiding potential bugs and reducing code quality
  - **Impact**: Better type safety, fewer runtime errors, improved developer experience
  - **Effort**: 1-2 days, audit all files and replace with proper types/generics
  - **Note**: Focus on `src/` directory first, then examples and tests

### Medium Priority

- [ ] **StoreBackend** - LangGraph BaseStore adapter for cross-thread persistence
  - **Note**: Lower priority since PersistentBackend already handles similar use cases

- [ ] **Cloud Sandbox Integrations** - Modal, Runloop, Daytona providers
  - **Note**: Wait for user demand before implementing

### Lower Priority

- [ ] **Context Schema** - Custom state types beyond default
- [ ] **Compiled Subagents** - Pre-built runnable subagent instances
- [ ] **Custom Tool Descriptions** - Override default tool descriptions
- [ ] **Cache Support** - Response caching via BaseCache

---

## 📋 Future Architectural Improvements

### High Impact (Future Major Release)

- [ ] **Event System Refactor** - Implement scalable event bus with metadata support
  - **Why**: Current event system (120+ usages across 8 files) creates complex data flows that are hard to trace; tools directly call `onEvent` callback creating tight coupling
  - **Impact**: Better debugging, filtering, and extensibility for complex multi-agent interactions
  - **Approach**: Hybrid Event Bus + Metadata pattern:
    - Centralised `EventBus` to decouple producers/consumers
    - Type-safe subscriptions per event type (`subscribeToType<T>`)
    - Event metadata with `correlationId` for tracing subagent interactions
    - Lightweight context (source, stepNumber) without full event sourcing overhead
  - **Effort**: 3-4 days, significant refactoring of event handling throughout codebase
  - **Reference**: See `docs/tickets/012_architectural_health_assessment/research.md` for detailed options analysis

- [ ] **Enhanced Skills Ecosystem** - Align with Agent Skills open standard
  - **Why**: Current skills system only parses `name` and `description` from YAML frontmatter; doesn't support optional fields or resource directories
  - **Impact**: Full spec compliance enables interoperability with other Agent Skills-compatible tools
  - **Approach**: Implement [agentskills.io](https://agentskills.io/specification) specification:
    - Add optional fields: `license`, `compatibility`, `metadata`, `allowed-tools`
    - Support resource directories: `scripts/`, `references/`, `assets/`
    - Implement progressive disclosure: metadata (~100 tokens) → instructions (<5000 tokens) → resources (on-demand)
    - Add skill validation (name format: lowercase, hyphens, 1-64 chars)
  - **Effort**: 3-4 days, extend `SkillMetadata` type and `listSkills` implementation
  - **Reference**: <https://agentskills.io/specification>, <https://agentskills.io/integrate-skills>

- [ ] **Split types.ts** - Decompose 1,670-line monolithic type file by domain
  - **Why**: Large file creates navigation challenges and mixes unrelated types (backend, events, CLI)
  - **Impact**: Better onboarding experience, easier navigation, domain-focused types
  - **Approach**: Split into domain-specific files:
    - `src/types/core.ts` - Core agent types (DeepAgentState, DeepAgentOptions, etc.)
    - `src/types/backend.ts` - Backend protocol and implementation types
    - `src/types/events.ts` - Event system types (DeepAgentEvent, EventCallback, etc.)
    - `src/types/cli.ts` - CLI-specific types (moved to `src/cli/types.ts`)
  - **Effort**: 2-3 days, mostly moving code with careful import updates
  - **Reference**: See `docs/tickets/012_architectural_health_assessment/research.md`

- [ ] **Break Down streamWithEvents()** - Decompose ~300 line method into focused functions
  - **Why**: Single method handles checkpoint loading, validation, tool creation, approval logic, streaming, and checkpoint saving
  - **Impact**: Better testability, reduced cognitive complexity, clearer responsibilities
  - **Approach**: Extract into smaller functions:
    - `loadCheckpointState()` - Handle checkpoint restoration
    - `prepareToolsWithApproval()` - Tool creation and approval wrapping
    - `buildStreamOptions()` - Construct streamText configuration
    - `processEventQueue()` - Handle event processing during streaming
  - **Effort**: 2 days, internal refactoring with test updates

### Medium Impact (Future Enhancements)

- [ ] **Type System Cleanup** - Remove all `as any` type assertions and fix wrapper/adapter pattern type handling
  - **Why**: `as any` bypasses TypeScript's type safety; wrapper pattern requires casting (e.g., `model as LanguageModelV3`)
  - **Impact**: Better compile-time guarantees, fewer runtime errors, type-safe middleware
  - **Approach**:
    - Audit all `as any` and `as Type` assertions in `src/`
    - Add proper generics where type narrowing is needed
    - Fix `wrapLanguageModel` integration to avoid casting
  - **Note**: Already tracked in High Priority "Remove `as any` Type Assertions"

- [ ] **Configuration Builder Pattern** - Simplify complex CreateDeepAgentParams
  - **Why**: 17+ optional properties create overwhelming configuration surface
  - **Impact**: Better developer experience, clearer API
  - **Approach**: Fluent builder pattern with logical grouping

- [ ] **Error Handling Standardisation** - Consistent error patterns across modules
  - **Why**: Mix of throwing vs returning error objects creates inconsistency
  - **Impact**: Predictable error handling, better debugging experience
  - **Approach**:
    - Define error type hierarchy (e.g., `DeepAgentError`, `BackendError`, `ToolError`)
    - Standardise on throwing for exceptional cases, returning `Result<T, E>` for expected failures
    - Add error codes for programmatic handling
  - **Effort**: 2-3 days, cross-cutting refactor

- [ ] **Consistent Naming Conventions** - Standardise factory function names
  - **Why**: Mix of `createXTool` vs `createX` reduces predictability
  - **Impact**: Better developer experience, easier to discover APIs
  - **Approach**: Adopt consistent pattern (prefer `createXTool` for tools, `createX` for non-tools)

---

## ❌ Won't Support (AI SDK Limitations)

- **LangGraph State Reducers** - AI SDK doesn't have annotated state schemas with custom reducers
- **LangGraph Command Pattern** - No direct equivalent for `Command({ update: {...} })`
- **Native Graph Compilation** - AI SDK uses ToolLoopAgent, not compiled state graphs
- **Thread-level Store Namespacing** - Would require custom implementation

---

## Notes

- Reference JS implementation: `.refs/deepagentsjs/`
- Reference Python implementation: `.refs/deepagents/`
- AI SDK v6 primitive: `ToolLoopAgent` from `ai` package

## Priority Rationale (Updated 2025-12-21)

**Completed Core Features (as of 2025-12-21):**

✅ **Middleware Architecture** - Implemented using AI SDK v6's `wrapLanguageModel`; enables logging, caching, RAG, and guardrails
✅ **Skills System** - Implemented with YAML frontmatter parsing and progressive disclosure pattern
✅ **Web Tools** - Implemented with Tavily search, HTTP client, and web scraping capabilities
✅ **Provider Options Passthrough** - Support for provider-specific options (thinking mode, reasoning effort, etc.)

**Architectural Health Assessment (2025-12-21):**

Completed comprehensive codebase analysis (see `docs/tickets/012_architectural_health_assessment/research.md`). Key findings:

- Layered architecture is sound with good separation of concerns
- Event system complexity identified as scalability concern (Hybrid Event Bus pattern recommended)
- Skills system should align with [agentskills.io](https://agentskills.io/specification) open standard
- types.ts (1,670 lines) should be split by domain
- streamWithEvents() (~300 lines) should be decomposed

**Current Priority:**

1. **Async Backend Methods** (Breaking, deferred to v0.2.0/v1.0.0) - Full async variants for better I/O performance
2. **Type System Cleanup** - Remove `as any` assertions and fix wrapper pattern type handling

**Future Architectural Work (Deferred):**

- **Event System Refactor**: Implement Event Bus pattern for scalability (when complex multi-agent interactions needed)
- **Enhanced Skills Ecosystem**: Full agentskills.io spec compliance (when interoperability required)
- **Split types.ts / Break down streamWithEvents()**: Schedule alongside related refactoring work

**Deferred Features:**

- **Cloud Sandboxes**: Low demand, implement when users request specific providers
- **Custom Tool Descriptions**: Not needed with current Zod-based approach
