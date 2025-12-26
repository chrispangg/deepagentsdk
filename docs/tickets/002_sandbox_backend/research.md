---
title: "Research: SandboxBackendProtocol"
description: Documentation
---

## Overview

The SandboxBackendProtocol extends BackendProtocol with command execution capabilities. It allows agents to run shell commands in isolated environments (containers, VMs, or local processes) while maintaining the same filesystem interface.

## Reference Implementation Analysis

### Python Reference (`.refs/deepagents/libs/deepagents/deepagents/backends/`)

**Key Files:**

- `protocol.py` - Defines `SandboxBackendProtocol` extending `BackendProtocol`
- `sandbox.py` - Provides `BaseSandbox` abstract class that implements all file operations using shell commands

**SandboxBackendProtocol Interface:**

```python
class SandboxBackendProtocol(BackendProtocol):
    def execute(self, command: str) -> ExecuteResponse:
        """Execute a command in the process."""
    
    async def aexecute(self, command: str) -> ExecuteResponse:
        """Async version of execute."""
    
    @property
    def id(self) -> str:
        """Unique identifier for the sandbox backend instance."""
```

**ExecuteResponse Structure:**

```python
@dataclass
class ExecuteResponse:
    output: str           # Combined stdout and stderr
    exit_code: int | None = None  # 0 = success, non-zero = failure
    truncated: bool = False       # Whether output was truncated
```

**BaseSandbox Pattern:**

- Abstract class implementing all `BackendProtocol` methods using shell commands
- Subclasses only need to implement `execute()`, `id`, `upload_files()`, `download_files()`
- File operations (read, write, edit, ls, grep, glob) are implemented via Python scripts executed through `execute()`
- Uses base64 encoding to safely pass content through shell commands

### JavaScript Reference (`.refs/deepagentsjs/src/backends/protocol.ts`)

The JS reference doesn't have a SandboxBackendProtocol - it only has BackendProtocol. We need to add this.

### Cloud Sandbox Integrations (`.refs/deepagents/libs/deepagents-cli/deepagents_cli/integrations/`)

**Provider Implementations:**

1. **ModalBackend** - Uses Modal's sandbox API
2. **RunloopBackend** - Uses Runloop devbox API  
3. **DaytonaBackend** - Uses Daytona sandbox API

Each extends `BaseSandbox` and only implements:

- `execute()` - Runs commands via provider's API
- `id` property - Returns provider's sandbox ID
- `upload_files()` / `download_files()` - Provider-specific file transfer

**Key Pattern:** All file operations (read, write, edit, grep, glob, ls) are implemented in `BaseSandbox` using shell commands via `execute()`. This means:

- A sandbox backend can be created by just implementing `execute()`
- The same code works across Modal, Runloop, Daytona, or local

## Current Codebase Analysis

### Existing Backend Structure (`src/backends/`)

**Current Backends:**

- `StateBackend` - In-memory storage
- `FilesystemBackend` - Local disk storage
- `PersistentBackend` - Key-value store
- `CompositeBackend` - Route to multiple backends

**Current BackendProtocol (`src/types.ts`):**

```typescript
export interface BackendProtocol {
  lsInfo(path: string): FileInfo[] | Promise<FileInfo[]>;
  read(filePath: string, offset?: number, limit?: number): string | Promise<string>;
  readRaw(filePath: string): FileData | Promise<FileData>;
  grepRaw(pattern: string, path?: string | null, glob?: string | null): GrepMatch[] | string | Promise<GrepMatch[] | string>;
  globInfo(pattern: string, path?: string): FileInfo[] | Promise<FileInfo[]>;
  write(filePath: string, content: string): WriteResult | Promise<WriteResult>;
  edit(filePath: string, oldString: string, newString: string, replaceAll?: boolean): EditResult | Promise<EditResult>;
}
```

### Files to Modify

1. **`src/types.ts`** - Add `ExecuteResponse` and `SandboxBackendProtocol` interfaces
2. **`src/backends/sandbox.ts`** (NEW) - Create `BaseSandbox` abstract class
3. **`src/backends/local-sandbox.ts`** (NEW) - Create local shell execution backend
4. **`src/backends/index.ts`** - Export new types and classes
5. **`src/index.ts`** - Export from main entry point

## Dependencies

**External packages needed:**

- None for basic implementation (uses Node.js built-in `child_process`)

**Internal modules this will interact with:**

- `src/types.ts` - Type definitions
- `src/backends/utils.ts` - Utility functions (may need to add base64 helpers)

## Key Insights

### Design Decisions

1. **BaseSandbox Pattern**: Following the Python reference, we'll create an abstract `BaseSandbox` class that:
   - Implements all `BackendProtocol` methods using shell commands
   - Only requires subclasses to implement `execute()`, `id`, `uploadFiles()`, `downloadFiles()`
   - Uses base64 encoding for safe content transfer

2. **LocalSandbox Implementation**: For local development/testing, we'll create a `LocalSandbox` that:
   - Executes commands using Node.js `child_process.spawn`
   - Has configurable working directory
   - Has optional timeout support

3. **Async-First**: Unlike Python which has sync + async variants, we'll make all methods async-first since:
   - AI SDK tools are async
   - Command execution is inherently async
   - TypeScript/Node.js async patterns are well-established

### Differences from Reference

1. **No `upload_files`/`download_files` initially**: These are primarily for cloud sandboxes. We'll add the interface but LocalSandbox won't need them.

2. **Shell Commands**: Python reference uses Python scripts for file ops. We'll use shell commands that work on Unix systems (macOS, Linux) since that's the primary target.

3. **No async variants**: TypeScript methods can return `Promise<T>` directly, no need for separate `aexecute()` method.

## Questions Resolved

- **Q: How does execute() work across providers?**
  A: Each provider implements execute() differently (Modal uses `sandbox.exec()`, Runloop uses `devboxes.execute_and_await_completion()`), but all return the same `ExecuteResponse` structure.

- **Q: How are file operations implemented in sandboxes?**
  A: All file operations are implemented via shell commands in `BaseSandbox`. The `execute()` method runs Python/bash scripts that perform the actual file operations.

- **Q: Should we support Windows?**
  A: No, following the reference implementation which assumes Unix shell. Cloud sandboxes (Modal, Runloop, Daytona) all run Linux.

- **Q: What about the Execute Tool?**
  A: That's a separate feature in PROJECT-STATE.md. This feature is just the backend protocol. The execute tool will use this backend.
