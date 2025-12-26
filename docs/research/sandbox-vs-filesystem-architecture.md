---
title: Sandbox vs Filesystem Architecture Research
date: 2025-12-24 06:11:49 AEDT
researcher: claude
git_commit: 45f2b563d7e4fb2ebec766cc5571886ac496654a
branch: main
repository: chrispangg/ai-sdk-deepagent
topic: "Sandbox vs Filesystem and LocalSandbox vs execute() - Architecture and Relationships"
tags: [research, codebase, architecture, backends, tools]
status: complete
last_updated: 2025-12-24
last_updated_by: claude
---

## Research Question

**User's Query:** "help me understand the codebase/ framework we built - what's the differences/relationship between sandbox and filesystem? and localsandbox and execute()?"

## Summary

This research documents the architecture and relationships between four key components in the ai-sdk-deep-agent codebase:

1. **Filesystem** - Virtual file storage backends (FilesystemBackend, StateBackend) that implement `BackendProtocol`
2. **Sandbox** - Command-execution-capable backends (BaseSandbox, LocalSandbox) that implement `SandboxBackendProtocol` (which extends `BackendProtocol`)
3. **LocalSandbox** - A concrete sandbox implementation that executes commands locally using Node.js `child_process`
4. **execute()** - Has two meanings: (1) the `execute()` method on sandbox backends, and (2) the `createExecuteTool()` function that wraps this method as an AI SDK tool

**Key Relationships:**

- **All sandboxes ARE filesystems** (SandboxBackendProtocol extends BackendProtocol), but not all filesystems are sandboxes
- **LocalSandbox implements execute()**; **createExecuteTool() wraps** that method as an LLM-callable tool
- **Filesystems provide file operations**; **sandboxes add shell command execution** on top of file operations

---

## Detailed Findings

### 1. Filesystem Component (Storage Backends)

**Purpose:** Provides virtual file storage operations (read, write, edit, list, search) for AI agents.

**Key Implementations:**

#### FilesystemBackend ([`src/backends/filesystem.ts:57`](https://github.com/chrispangg/ai-sdk-deepagent/blob/45f2b56/src/backends/filesystem.ts#L57))

- **Storage:** Disk-based file I/O
- **Purpose:** Persistent file storage with security controls
- **Key Features:**
  - Path traversal prevention (blocks `..` and `~`)
  - Symlink protection using `O_NOFOLLOW` flag
  - File size limits (prevents memory issues)
  - Uses `fast-glob` for pattern matching
  - Tries `ripgrep` for search, falls back to regex

#### StateBackend ([`src/backends/state.ts:56`](https://github.com/chrispangg/ai-sdk-deepagent/blob/45f2b56/src/backends/state.ts#L56))

- **Storage:** In-memory (`DeepAgentState.files`)
- **Purpose:** Ephemeral file storage (default backend)
- **Key Features:**
  - Stores files in `state.files: Record<string, FileData>`
  - No persistence across sessions
  - Fast, no disk I/O
  - Formats files with line numbers

#### CompositeBackend ([`src/backends/composite.ts:51`](https://github.com/chrispangg/ai-sdk-deepagent/blob/45f2b56/src/backends/composite.ts#L51))

- **Storage:** Routing backend
- **Purpose:** Routes operations to different backends based on path prefix
- **Key Features:**
  - `routes: Record<string, BackendProtocol>` - Path prefix → backend mapping
  - Routes sorted by length (longest first) for correct matching
  - Aggregates listings from multiple backends

**Common Interface (BackendProtocol)** ([`src/types/backend.ts:85`](https://github.com/chrispangg/ai-sdk-deepagent/blob/45f2b56/src/types/backend.ts#L85))

```typescript
interface BackendProtocol {
  lsInfo(path: string): FileInfo[] | Promise<FileInfo[]>;
  read(filePath: string, offset?: number, limit?: number): string | Promise<string>;
  readRaw(filePath: string): FileData | Promise<FileData>;
  grepRaw(pattern: string, path?: string, glob?: string): GrepMatch[] | Promise<...>;
  globInfo(pattern: string, path?: string): FileInfo[] | Promise<FileInfo[]>;
  write(filePath: string, content: string): WriteResult | Promise<WriteResult>;
  edit(filePath: string, oldString: string, newString: string, replaceAll?: boolean): EditResult | Promise<EditResult>;
}
```

**Tool Layer** ([`src/tools/filesystem.ts`](https://github.com/chrispangg/ai-sdk-deepagent/blob/45f2b56/src/tools/filesystem.ts))

- Wraps backend operations as AI SDK tools
- Six tools: `ls`, `read_file`, `write_file`, `edit_file`, `glob`, `grep`
- Created via `createFilesystemTools(state, backend, onEvent)`

---

### 2. Sandbox Component (Command-Execution Backends)

**Purpose:** Extends filesystem backends with shell command execution capabilities.

**Architecture:**

```
BackendProtocol (filesystem operations only)
    ↓ extends
SandboxBackendProtocol (adds execute() + id)
    ↓ implements via
BaseSandbox (abstract class)
    ↓ extends
LocalSandbox (concrete implementation)
```

#### BaseSandbox ([`src/backends/sandbox.ts:71`](https://github.com/chrispangg/ai-sdk-deepagent/blob/45f2b56/src/backends/sandbox.ts#L71))

- **Type:** Abstract class
- **Purpose:** Template method pattern - implements all filesystem operations using the abstract `execute()` method
- **Key Methods (all implemented via shell commands):**
  - `abstract execute(command: string): Promise<ExecuteResponse>` - **Must be implemented by subclasses**
  - `abstract readonly id: string` - **Must be implemented by subclasses**
  - `lsInfo(path)` - Lists files using inline Node.js script
  - `read(filePath, offset, limit)` - Reads file using inline Node.js script
  - `write(filePath, content)` - Writes file using inline Node.js script
  - `edit(filePath, old, new, replaceAll)` - Edits file using inline Node.js script
  - `grepRaw(pattern, path, glob)` - Searches using inline Node.js script
  - `globInfo(pattern, path)` - Finds files using inline Node.js script

**How BaseSandbox Works:**

- Every filesystem operation builds an inline Node.js script
- Script is embedded in a shell command: `node -e "..." <base64 args>`
- Script is executed via `execute()` (implemented by subclass)
- Output is parsed and returned

**Example - BaseSandbox.read()** ([`src/backends/sandbox.ts:134-183`](https://github.com/chrispangg/ai-sdk-deepagent/blob/45f2b56/src/backends/sandbox.ts#L134-L183)):

```typescript
async read(filePath: string, offset: number = 0, limit: number = 2000): Promise<string> {
  const pathB64 = toBase64(filePath);
  const script = `
const fs = require("fs");
const filePath = Buffer.from("__PATH__", "base64").toString("utf-8");
const content = fs.readFileSync(filePath, "utf-8");
// ... format with line numbers
`;
  const result = await this.execute(buildNodeScript(script, { PATH: pathB64, ... }));
  return result.output.trimEnd();
}
```

#### LocalSandbox ([`src/backends/local-sandbox.ts:85`](https://github.com/chrispangg/ai-sdk-deepagent/blob/45f2b56/src/backends/local-sandbox.ts#L85))

- **Type:** Concrete class (extends BaseSandbox)
- **Purpose:** Executes commands locally using Node.js `child_process.spawn()`
- **Key Properties:**
  - `cwd: string` - Working directory for command execution
  - `timeout: number` - Command timeout in milliseconds (default: 30000)
  - `env: Record<string, string>` - Additional environment variables
  - `maxOutputSize: number` - Output size limit before truncation (default: 1MB)

**Key Method - execute()** ([`src/backends/local-sandbox.ts:130-173`](https://github.com/chrispangg/ai-sdk-deepagent/blob/45f2b56/src/backends/local-sandbox.ts#L130-L173)):

```typescript
async execute(command: string): Promise<ExecuteResponse> {
  return new Promise((resolve) => {
    const child = spawn("bash", ["-c", command], {
      cwd: this.cwd,
      env: { ...process.env, ...this.env },
      timeout: this.timeout,
    });

    let output = "";
    let truncated = false;

    child.stdout.on("data", (data: Buffer) => {
      if (output.length < this.maxOutputSize) {
        output += data.toString();
      } else {
        truncated = true;
      }
    });

    child.stderr.on("data", (data: Buffer) => {
      if (output.length < this.maxOutputSize) {
        output += data.toString();
      } else {
        truncated = true;
      }
    });

    child.on("close", (code) => {
      resolve({
        output,
        exitCode: code,
        truncated,
      });
    });
  });
}
```

#### SandboxBackendProtocol Interface ([`src/types/backend.ts:155`](https://github.com/chrispangg/ai-sdk-deepagent/blob/45f2b56/src/types/backend.ts#L155-L165))

```typescript
export interface SandboxBackendProtocol extends BackendProtocol {
  execute(command: string): Promise<ExecuteResponse>;
  readonly id: string;
}
```

**Type Guard** ([`src/types/backend.ts:170`](https://github.com/chrispangg/ai-sdk-deepagent/blob/45f2b56/src/types/backend.ts#L170-L177)):

```typescript
export function isSandboxBackend(
  backend: BackendProtocol
): backend is SandboxBackendProtocol {
  return (
    typeof (backend as SandboxBackendProtocol).execute === "function" &&
    typeof (backend as SandboxBackendProtocol).id === "string"
  );
}
```

---

### 3. execute() - The Tool

**Purpose:** Wraps the backend's `execute()` method as an AI SDK tool, making it callable by LLMs.

**Location:** [`src/tools/execute.ts`](https://github.com/chrispangg/ai-sdk-deepagent/blob/45f2b56/src/tools/execute.ts)

#### createExecuteTool() Function ([`src/tools/execute.ts:79`](https://github.com/chrispangg/ai-sdk-deepagent/blob/45f2b56/src/tools/execute.ts#L79-L137))

```typescript
export function createExecuteTool(options: CreateExecuteToolOptions) {
  const { backend, onEvent, description } = options;

  return tool({
    description: description || EXECUTE_TOOL_DESCRIPTION,
    inputSchema: z.object({
      command: z.string().describe("The shell command to execute"),
    }),
    execute: async ({ command }) => {
      // Emit execute-start event
      if (onEvent) {
        onEvent({
          type: "execute-start",
          command,
          sandboxId: backend.id,
        });
      }

      // Execute the command using the backend
      const result = await backend.execute(command);

      // Emit execute-finish event
      if (onEvent) {
        onEvent({
          type: "execute-finish",
          command,
          exitCode: result.exitCode,
          truncated: result.truncated,
          sandboxId: backend.id,
        });
      }

      // Format response
      const parts: string[] = [];
      if (result.output) {
        parts.push(result.output);
      }
      parts.push(`\n[Exit code: ${result.exitCode}]`);
      if (result.truncated) {
        parts.push(`[Output truncated due to size limit]`);
      }
      return parts.join("");
    },
  });
}
```

**ExecuteResponse Type** ([`src/types/backend.ts:143`](https://github.com/chrispangg/ai-sdk-deepagent/blob/45f2b56/src/types/backend.ts#L143-L150)):

```typescript
export interface ExecuteResponse {
  output: string;           // Combined stdout and stderr
  exitCode: number | null;  // 0 = success, null = unknown/timeout
  truncated: boolean;       // Whether output was truncated
}
```

---

### 4. Agent Integration

**Automatic Tool Creation** ([`src/agent.ts:196`](https://github.com/chrispangg/ai-sdk-deepagent/blob/45f2b56/src/agent.ts#L196-L264))

When a DeepAgent is created with a sandbox backend, the `execute` tool is automatically added:

```typescript
// Detection at initialization (agent.ts:196)
this.hasSandboxBackend = typeof backend !== "function" &&
                        backend !== undefined &&
                        isSandboxBackend(backend);

// Tool creation (agent.ts:252-263)
private createExecuteToolSet(onEvent?: EventCallback): ToolSet {
  if (!this.hasSandboxBackend) {
    return {};
  }
  const sandboxBackend = this.backend as SandboxBackendProtocol;
  return {
    execute: createExecuteTool({
      backend: sandboxBackend,
      onEvent,
    }),
  };
}
```

**System Prompt Addition** ([`src/agent.ts:77-78`](https://github.com/chrispangg/ai-sdk-deepagent/blob/45f2b56/src/agent.ts#L77-L78)):

```typescript
if (hasSandbox) {
  parts.push(EXECUTE_SYSTEM_PROMPT);  // Adds execute tool instructions
}
```

---

### 5. Key Differences and Relationships

#### Sandbox vs Filesystem

| Aspect | Filesystem (FilesystemBackend, StateBackend) | Sandbox (BaseSandbox, LocalSandbox) |
|--------|---------------------------------------------|-------------------------------------|
| **Protocol** | Implements `BackendProtocol` | Implements `SandboxBackendProtocol` (extends `BackendProtocol`) |
| **Capabilities** | File operations only (read, write, edit, ls, grep, glob) | File operations + **command execution** via `execute()` |
| **Use Case** | Storage and file management | Running shell commands (build, test, scripts) + file operations |
| **File Operations** | Direct implementation (disk I/O or memory) | Implemented via shell commands using `execute()` |
| **Example** | `new FilesystemBackend({ rootDir: './workspace' })` | `new LocalSandbox({ cwd: './workspace' })` |

**Key Relationship:**

```
All sandboxes ARE filesystems (SandboxBackendProtocol extends BackendProtocol)
BUT not all filesystems are sandboxes (no execute() method)
```

#### LocalSandbox vs execute()

| Aspect | LocalSandbox | execute() |
|--------|-------------|-----------|
| **Type** | Class (backend implementation) | Method (on sandbox backends) + Tool (wrapper) |
| **Purpose** | Local command execution backend | Run shell commands |
| **Implementation** | `extends BaseSandbox` | `execute()` method calls `spawn("bash", ["-c", command])` |
| **Tool** | Becomes backend for agent | `createExecuteTool()` wraps `backend.execute()` as AI SDK tool |
| **ID** | Has unique `id: string` (format: `local-{timestamp}-{random}`) | Tool references `backend.id` in events |

**Two Meanings of "execute()":**

1. **Method on Sandbox Backends:**

   ```typescript
   const sandbox = new LocalSandbox({ cwd: './workspace' });
   const result = await sandbox.execute('echo hello');  // Direct method call
   ```

2. **Tool Created by createExecuteTool():**

   ```typescript
   const executeTool = createExecuteTool({ backend: sandbox });
   // When LLM calls this tool, it invokes sandbox.execute()
   ```

**Key Relationship:**

```
LocalSandbox implements execute() method
         ↓
createExecuteTool() wraps it as AI SDK tool
         ↓
DeepAgent detects sandbox backend and auto-adds execute tool
         ↓
LLM can call execute tool → calls backend.execute() → runs bash command
```

---

## Code References

### Core Backend Files

- **BaseSandbox:** [`src/backends/sandbox.ts:71-510`](https://github.com/chrispangg/ai-sdk-deepagent/blob/45f2b56/src/backends/sandbox.ts#L71) - Abstract class implementing filesystem operations via `execute()`
- **LocalSandbox:** [`src/backends/local-sandbox.ts:85-173`](https://github.com/chrispangg/ai-sdk-deepagent/blob/45f2b56/src/backends/local-sandbox.ts#L85) - Concrete implementation using `child_process.spawn()`
- **FilesystemBackend:** [`src/backends/filesystem.ts:57-695`](https://github.com/chrispangg/ai-sdk-deepagent/blob/45f2b56/src/backends/filesystem.ts#L57) - Disk-based storage with security controls
- **StateBackend:** [`src/backends/state.ts:56-204`](https://github.com/chrispangg/ai-sdk-deepagent/blob/45f2b56/src/backends/state.ts#L56) - In-memory storage
- **CompositeBackend:** [`src/backends/composite.ts:51-254`](https://github.com/chrispangg/ai-sdk-deepagent/blob/45f2b56/src/backends/composite.ts#L51) - Routing backend

### Type Definitions

- **BackendProtocol:** [`src/types/backend.ts:85-133`](https://github.com/chrispangg/ai-sdk-deepagent/blob/45f2b56/src/types/backend.ts#L85) - Filesystem operations interface
- **SandboxBackendProtocol:** [`src/types/backend.ts:155-165`](https://github.com/chrispangg/ai-sdk-deepagent/blob/45f2b56/src/types/backend.ts#L155) - Extends BackendProtocol with `execute()` and `id`
- **ExecuteResponse:** [`src/types/backend.ts:143-150`](https://github.com/chrispangg/ai-sdk-deepagent/blob/45f2b56/src/types/backend.ts#L143) - Response from `execute()` method
- **Type Guard:** [`src/types/backend.ts:170-177`](https://github.com/chrispangg/ai-sdk-deepagent/blob/45f2b56/src/types/backend.ts#L170) - `isSandboxBackend()` function

### Tool Creation

- **Execute Tool:** [`src/tools/execute.ts:79-137`](https://github.com/chrispangg/ai-sdk-deepagent/blob/45f2b56/src/tools/execute.ts#L79) - `createExecuteTool()` function
- **Filesystem Tools:** [`src/tools/filesystem.ts:370-410`](https://github.com/chrispangg/ai-sdk-deepagent/blob/45f2b56/src/tools/filesystem.ts#L370) - `createFilesystemTools()` function

### Agent Integration

- **Sandbox Detection:** [`src/agent.ts:196`](https://github.com/chrispangg/ai-sdk-deepagent/blob/45f2b56/src/agent.ts#L196) - `isSandboxBackend()` check
- **Execute Tool Creation:** [`src/agent.ts:252-264`](https://github.com/chrispangg/ai-sdk-deepagent/blob/45f2b56/src/agent.ts#L252) - `createExecuteToolSet()` method
- **System Prompt:** [`src/agent.ts:77-78`](https://github.com/chrispangg/ai-sdk-deepagent/blob/45f2b56/src/agent.ts#L77) - Adds `EXECUTE_SYSTEM_PROMPT`

### Usage Examples

- **LocalSandbox Example:** [`examples/with-local-sandbox.ts:34-169`](https://github.com/chrispangg/ai-sdk-deepagent/blob/45f2b56/examples/with-local-sandbox.ts#L34) - Full example with agent creation
- **Direct execute() Calls:** [`examples/with-local-sandbox.ts:192-213`](https://github.com/chrispangg/ai-sdk-deepagent/blob/45f2b56/examples/with-local-sandbox.ts#L192) - Direct sandbox method usage
- **FilesystemBackend Example:** [`examples/streaming.ts:9-17`](https://github.com/chrispangg/ai-sdk-deepagent/blob/45f2b56/examples/streaming.ts#L9) - Backend configuration

### Tests

- **LocalSandbox Tests:** [`test/backends/local-sandbox.test.ts:16-212`](https://github.com/chrispangg/ai-sdk-deepagent/blob/45f2b56/test/backends/local-sandbox.test.ts#L16) - Comprehensive execute() tests
- **Filesystem Integration Tests:** [`test-integration/architecture/architectural-refactoring.test.ts:147-168`](https://github.com/chrispangg/ai-sdk-deepagent/blob/45f2b56/test-integration/architecture/architectural-refactoring.test.ts#L147) - Backend integration tests

---

## Architecture Documentation

### Data Flow: File Read Operation

```
User/LLM Request
    ↓
Agent Tool Call: read_file({ file_path: "/test.txt" })
    ↓
createReadFileTool().execute() (tools/filesystem.ts:119)
    ↓
getBackend() resolves factory or instance (tools/filesystem.ts:40)
    ↓
backend.read(file_path, offset, limit)
    ↓
┌─────────────────┬─────────────────┬──────────────────┐
│ StateBackend    │ FilesystemBackend│ CompositeBackend │
│ (state.ts:124)  │ (filesystem.ts:198)│ Routes to child│
│ Formats with    │ Reads from disk  │ backend          │
│ line numbers    │ with O_NOFOLLOW  │                  │
└─────────────────┴─────────────────┴──────────────────┘
    ↓
Returns formatted content or error string
```

### Data Flow: Command Execution

```
User/LLM Request
    ↓
Agent Tool Call: execute({ command: "npm install" })
    ↓
createExecuteTool().execute() (tools/execute.ts:89)
    ↓
Emit Event: execute-start
    ↓
backend.execute(command) → [BaseSandbox.execute()]
    ↓
LocalSandbox Implementation (local-sandbox.ts:130)
    ↓
spawn("bash", ["-c", command], { cwd, env, timeout })
    ↓
Capture stdout + stderr
    ↓
Emit Event: execute-finish
    ↓
Return ExecuteResponse { output, exitCode, truncated }
```

### Protocol Hierarchy

```
BackendProtocol (filesystem operations)
├── Methods: lsInfo, read, readRaw, grepRaw, globInfo, write, edit
├── Implementations:
│   ├── StateBackend (memory)
│   ├── FilesystemBackend (disk)
│   └── CompositeBackend (routing)
│
└── SandboxBackendProtocol (extends BackendProtocol)
    ├── Adds: execute(command), id
    └── BaseSandbox (abstract)
        └── LocalSandbox (concrete)
```

### Tool Layer Architecture

```
DeepAgent (agent.ts)
│
├── createCoreTools(state, onEvent)
│   └── createFilesystemTools(state, backend, onEvent)
│       └── Returns: { ls, read_file, write_file, edit_file, glob, grep }
│
└── createExecuteToolSet(onEvent)
    └── createExecuteTool({ backend, onEvent })
        └── Returns: { execute }  (only if isSandboxBackend(backend))
```

---

## Historical Context

No existing research documents found in `docs/` directory regarding this specific topic. This is the first comprehensive documentation of the sandbox/filesystem architecture.

---

## Related Research

- **Backend Implementations:** See `src/backends/` directory for all backend implementations
- **Tool System:** See `src/tools/` directory for tool creation patterns
- **Agent Architecture:** See `src/agent.ts` for complete agent implementation
- **Type System:** See `src/types/` directory for complete type definitions

---

## Open Questions

None - The architecture and relationships between these components are well-defined and documented in the codebase.

---

## Key Takeaways

`★ Insight ─────────────────────────────────────`
**1. Protocol Extension Pattern:**
`SandboxBackendProtocol` extends `BackendProtocol` - this is a classic interface extension pattern. All sandboxes are filesystems (inherit file operations), but sandboxes add the `execute()` method for shell command execution. This allows the agent to detect backend capabilities at runtime using `isSandboxBackend()`.

**2. Template Method Pattern in BaseSandbox:**
BaseSandbox implements all filesystem operations using the abstract `execute()` method. Each operation (read, write, edit, etc.) builds an inline Node.js script and executes it via `execute()`. Subclasses like LocalSandbox only need to implement `execute()` - they get all filesystem operations for free. This is the Template Method design pattern in action.

**3. Dual Meaning of "execute()":**
The term "execute()" refers to two related but distinct concepts:

- The **method** on sandbox backends that executes shell commands
- The **tool** (`createExecuteTool()`) that wraps this method for LLM calling

When you create a DeepAgent with a LocalSandbox backend, the agent automatically detects the sandbox capability and adds the execute tool to the tool set.
`─────────────────────────────────────────────────`
