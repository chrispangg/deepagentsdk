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

---

## 🚧 To Implement

### Critical

- [ ] **Human-in-the-Loop (HITL)** - Interrupt agent for tool approval/rejection
- [ ] **Checkpointer Support** - Persist agent state between invocations (pause/resume)

### High Priority

- [ ] **StoreBackend** - LangGraph BaseStore adapter for cross-thread persistence
- [ ] **Async Backend Methods** - Full async variants of all backend operations
- [ ] **Middleware Architecture** - Composable wrapModel/wrapToolCall hooks

### Medium Priority

- [ ] **Cloud Sandbox Integrations** - Modal, Runloop, Daytona providers
- [ ] **Skills System** - Load pluggable capabilities from SKILL.md files
- [ ] **Agent Memory Middleware** - Long-term memory from agent.md files
- [ ] **Web Tools** - `web_search` (Tavily), `http_request`, `fetch_url`

### Lower Priority

- [ ] **Structured Output** - `responseFormat` for typed agent outputs
- [ ] **Context Schema** - Custom state types beyond default
- [ ] **Compiled Subagents** - Pre-built runnable subagent instances
- [x] **readRaw Backend Method** - Raw FileData without line formatting (implemented in all backends)
- [ ] **Custom Tool Descriptions** - Override default tool descriptions
- [ ] **Per-Subagent Interrupt Config** - Different HITL rules per subagent
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
