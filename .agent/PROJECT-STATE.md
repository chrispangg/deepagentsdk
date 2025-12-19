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

---

## 🚧 To Implement

### Critical

- [ ] **Fix `options.messages` Implementation** ⚠️ **[BUG]**
  - **Why**: `DeepAgentOptions.messages` is defined in types but NOT used in implementation; library only supports checkpoint-based persistence (threadId + checkpointer)
  - **Impact**: Users expect to pass conversation history via `messages` parameter (standard AI SDK pattern), but it's silently ignored
  - **Effort**: 1 day, add message handling to agent initialization
  - **Workaround**: Manually prepend message history to prompt or use checkpointer
  - **Note**: Should support both patterns: explicit `messages` array AND checkpoint-based persistence

### High Priority

- [ ] **ToolLoopAgent Constructor Passthrough** [in_progress]
  - **Why**: Enable full AI SDK v6 ToolLoopAgent features (custom stopWhen, maxRetries, etc.) while keeping DeepAgent harness
  - **Impact**: Better flexibility for advanced users, maintains AI SDK compatibility
  - **Effort**: 1-2 days, add passthrough options to DeepAgentOptions
  - **Note**: Should preserve DeepAgent defaults (systemPrompt, tools) but allow overrides

- [ ] **Subagent Web Tools Access** ⚠️ **[BUG]**
  - **Why**: Subagents spawned via `task` tool don't inherit web tools (`web_search`, `http_request`, `fetch_url`), limiting their capabilities
  - **Impact**: Subagents cannot perform web research or API calls, forcing parent agent to handle all web operations
  - **Effort**: 1 day, ensure web tools are passed to subagent creation in `src/tools/subagent.ts`
  - **Note**: Should respect parent's `interruptOn` config for web tool approvals

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

## Priority Rationale (Updated 2025-12-17)

**Completed Core Features (as of 2025-12-17):**

✅ **Middleware Architecture** - Implemented using AI SDK v6's `wrapLanguageModel`; enables logging, caching, RAG, and guardrails
✅ **Skills System** - Implemented with YAML frontmatter parsing and progressive disclosure pattern
✅ **Web Tools** - Implemented with Tavily search, HTTP client, and web scraping capabilities

**Current Priority:**

1. **Async Backend Methods** (Breaking, deferred to v0.2.0/v1.0.0) - Full async variants for better I/O performance
2. **Agent Memory Middleware** - Long-term memory from agent.md files (now unblocked by middleware implementation)
3. **StoreBackend** - LangGraph BaseStore adapter (lower priority, PersistentBackend sufficient for now)

**Deferred Features:**

- **Cloud Sandboxes**: Low demand, implement when users request specific providers
- **Structured Output**: Nice-to-have, can be middleware later
- **Custom Tool Descriptions**: Not needed with current Zod-based approach
