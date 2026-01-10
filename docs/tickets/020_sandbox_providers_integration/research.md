---
date: 2026-01-11 07:31:57 AEDT
researcher: Claude (Opus 4.5)
git_commit: 7bb6a368b33d86c1847a9c93d381fafeccd37a9e
branch: main
repository: deepagentsdk
topic: "Sandbox Provider Integration Patterns from LangChain DeepAgents"
tags: [research, sandbox, providers, modal, runloop, daytona, architecture]
status: complete
last_updated: 2026-01-11
last_updated_by: Claude (Opus 4.5)
---

# Research: Sandbox Provider Integration Patterns

## Research Question

How does LangChain's DeepAgents framework integrate with sandbox providers, and how can these patterns be applied to the deepagentsdk codebase?

## Summary

LangChain's DeepAgents framework (both Python and JavaScript versions) implements a **layered sandbox architecture** where:

1. **Protocol Layer** - `SandboxBackendProtocol` extends `BackendProtocol` with `execute()` method
2. **Abstract Base** - `BaseSandbox` implements all file operations via shell commands
3. **Concrete Providers** - Minimal implementations (Modal, Runloop, Daytona) only implement `execute()`, `upload_files()`, `download_files()`
4. **Factory Pattern** - Context managers handle lifecycle (creation, setup, teardown)

**Key Finding**: deepagentsdk already has a complete sandbox infrastructure (`BaseSandbox`, `LocalSandbox`, execute tool). The missing piece is **cloud provider integrations** (Modal, Runloop, Daytona, E2B).

## Detailed Findings

### LangChain Python Architecture

#### Protocol Definition (`protocol.py`)

```python
# SandboxBackendProtocol extends BackendProtocol
class SandboxBackendProtocol(BackendProtocol):
    def execute(self, command: str) -> ExecuteResponse:
        """Execute a command in the sandbox."""

    @property
    def id(self) -> str:
        """Unique identifier for the sandbox backend instance."""
```

Key types:

- `ExecuteResponse`: `{ output: str, exit_code: int | None, truncated: bool }`
- `FileUploadResponse`: `{ path: str, error: FileOperationError | None }`
- `FileDownloadResponse`: `{ path: str, content: bytes | None, error: FileOperationError | None }`

**Location**: `.refs/deepagents/libs/deepagents/deepagents/backends/protocol.py:423-456`

#### Base Sandbox Implementation (`sandbox.py`)

The `BaseSandbox` abstract class implements ALL `BackendProtocol` methods using shell commands:

```python
class BaseSandbox(SandboxBackendProtocol, ABC):
    """Base sandbox implementation with execute() as abstract method."""

    @abstractmethod
    def execute(self, command: str) -> ExecuteResponse:
        """Execute a command in the sandbox."""

    @property
    @abstractmethod
    def id(self) -> str:
        """Unique identifier for the sandbox backend."""

    @abstractmethod
    def upload_files(self, files: list[tuple[str, bytes]]) -> list[FileUploadResponse]:
        """Upload multiple files to the sandbox."""

    @abstractmethod
    def download_files(self, paths: list[str]) -> list[FileDownloadResponse]:
        """Download multiple files from the sandbox."""
```

**Key Pattern**: File operations (read, write, edit, ls, grep, glob) are implemented using Python command templates executed via `execute()`:

```python
_READ_COMMAND_TEMPLATE = """python3 -c "
import os
import sys

file_path = '{file_path}'
offset = {offset}
limit = {limit}

# ... implementation
" 2>&1"""
```

**Location**: `.refs/deepagents/libs/deepagents/deepagents/backends/sandbox.py:1-361`

#### Provider Implementations

Each provider only implements 4 methods:

1. `__init__()` - Store provider SDK instance
2. `id` property - Return provider-specific ID
3. `execute()` - Run command via provider API
4. `upload_files()` / `download_files()` - Provider-specific file I/O

##### Modal Backend (`modal.py`)

```python
class ModalBackend(BaseSandbox):
    def __init__(self, sandbox: modal.Sandbox) -> None:
        self._sandbox = sandbox
        self._timeout = 30 * 60  # 30 minutes

    @property
    def id(self) -> str:
        return self._sandbox.object_id

    def execute(self, command: str) -> ExecuteResponse:
        process = self._sandbox.exec("bash", "-c", command, timeout=self._timeout)
        process.wait()
        stdout = process.stdout.read()
        stderr = process.stderr.read()
        output = stdout or ""
        if stderr:
            output += "\n" + stderr if output else stderr
        return ExecuteResponse(output=output, exit_code=process.returncode, truncated=False)

    def download_files(self, paths: list[str]) -> list[FileDownloadResponse]:
        responses = []
        for path in paths:
            with self._sandbox.open(path, "rb") as f:
                content = f.read()
            responses.append(FileDownloadResponse(path=path, content=content, error=None))
        return responses

    def upload_files(self, files: list[tuple[str, bytes]]) -> list[FileUploadResponse]:
        responses = []
        for path, content in files:
            with self._sandbox.open(path, "wb") as f:
                f.write(content)
            responses.append(FileUploadResponse(path=path, error=None))
        return responses
```

**Location**: `.refs/deepagents/libs/deepagents-cli/deepagents_cli/integrations/modal.py:1-127`

##### Runloop Backend (`runloop.py`)

```python
class RunloopBackend(BaseSandbox):
    def __init__(self, devbox_id: str, client: Runloop | None = None, api_key: str | None = None):
        # Client initialization with fallback to env var
        self._client = client or Runloop(bearer_token=api_key or os.environ.get("RUNLOOP_API_KEY"))
        self._devbox_id = devbox_id
        self._timeout = 30 * 60

    @property
    def id(self) -> str:
        return self._devbox_id

    def execute(self, command: str) -> ExecuteResponse:
        result = self._client.devboxes.execute_and_await_completion(
            devbox_id=self._devbox_id, command=command, timeout=self._timeout
        )
        output = result.stdout or ""
        if result.stderr:
            output += "\n" + result.stderr if output else result.stderr
        return ExecuteResponse(output=output, exit_code=result.exit_status, truncated=False)
```

**Location**: `.refs/deepagents/libs/deepagents-cli/deepagents_cli/integrations/runloop.py:1-125`

##### Daytona Backend (`daytona.py`)

```python
class DaytonaBackend(BaseSandbox):
    def __init__(self, sandbox: Sandbox) -> None:
        self._sandbox = sandbox
        self._timeout = 30 * 60

    @property
    def id(self) -> str:
        return self._sandbox.id

    def execute(self, command: str) -> ExecuteResponse:
        result = self._sandbox.process.exec(command, timeout=self._timeout)
        return ExecuteResponse(output=result.result, exit_code=result.exit_code, truncated=False)

    # Uses Daytona's batch file APIs for upload/download
    def download_files(self, paths: list[str]) -> list[FileDownloadResponse]:
        from daytona import FileDownloadRequest
        download_requests = [FileDownloadRequest(source=path) for path in paths]
        daytona_responses = self._sandbox.fs.download_files(download_requests)
        return [FileDownloadResponse(path=resp.source, content=resp.result, error=None)
                for resp in daytona_responses]
```

**Location**: `.refs/deepagents/libs/deepagents-cli/deepagents_cli/integrations/daytona.py:1-118`

#### Sandbox Factory (`sandbox_factory.py`)

Uses **context managers** for lifecycle management:

```python
@contextmanager
def create_sandbox(
    provider: str,
    *,
    sandbox_id: str | None = None,
    setup_script_path: str | None = None,
) -> Generator[SandboxBackendProtocol, None, None]:
    """Create or connect to a sandbox of the specified provider."""
    if provider not in _SANDBOX_PROVIDERS:
        raise ValueError(f"Unknown sandbox provider: {provider}")

    sandbox_provider = _SANDBOX_PROVIDERS[provider]
    with sandbox_provider(sandbox_id=sandbox_id, setup_script_path=setup_script_path) as backend:
        yield backend

_SANDBOX_PROVIDERS = {
    "modal": create_modal_sandbox,
    "runloop": create_runloop_sandbox,
    "daytona": create_daytona_sandbox,
}

_PROVIDER_TO_WORKING_DIR = {
    "modal": "/workspace",
    "runloop": "/home/user",
    "daytona": "/home/daytona",
}
```

Each provider factory handles:

1. **SDK initialization** with API keys from environment
2. **Sandbox creation** with polling until ready
3. **Setup script execution** (optional)
4. **Cleanup on exit** (termination/deletion)

**Location**: `.refs/deepagents/libs/deepagents-cli/deepagents_cli/integrations/sandbox_factory.py:1-349`

### LangChain JavaScript Architecture

The JS implementation mirrors Python with TypeScript syntax:

#### Protocol (`protocol.ts`)

```typescript
export interface SandboxBackendProtocol extends BackendProtocol {
  execute(command: string): MaybePromise<ExecuteResponse>;
  readonly id: string;
}

export function isSandboxBackend(backend: BackendProtocol): backend is SandboxBackendProtocol {
  return typeof (backend as SandboxBackendProtocol).execute === "function" &&
         typeof (backend as SandboxBackendProtocol).id === "string";
}
```

**Location**: `.refs/deepagentsjs/src/backends/protocol.ts:259-285`

#### BaseSandbox (`sandbox.ts`)

Uses Node.js command templates instead of Python:

```typescript
export abstract class BaseSandbox implements SandboxBackendProtocol {
  abstract readonly id: string;
  abstract execute(command: string): MaybePromise<ExecuteResponse>;
  abstract uploadFiles(files: Array<[string, Uint8Array]>): MaybePromise<FileUploadResponse[]>;
  abstract downloadFiles(paths: string[]): MaybePromise<FileDownloadResponse[]>;

  // File operations implemented via Node.js scripts
  async read(filePath: string, offset = 0, limit = 2000): Promise<string> {
    const command = buildReadCommand(filePath, offset, limit);
    const result = await this.execute(command);
    // ...
  }
}
```

**Location**: `.refs/deepagentsjs/src/backends/sandbox.ts:315-546`

#### Example: LocalShellSandbox

The JS reference implementation provides a `LocalShellSandbox` example that:

- Spawns bash processes for command execution
- Uses direct filesystem operations for upload/download
- Handles timeouts and output truncation

**Location**: `.refs/deepagentsjs/examples/sandbox/local-sandbox.ts:42-222`

### deepagentsdk Current Implementation

#### What Already Exists

**1. Protocol Definition** (`src/types/backend.ts:155-177`)

```typescript
export interface SandboxBackendProtocol extends BackendProtocol {
  execute(command: string): Promise<ExecuteResponse>;
  readonly id: string;
}

export function isSandboxBackend(backend: BackendProtocol): backend is SandboxBackendProtocol {
  return typeof (backend as SandboxBackendProtocol).execute === "function" &&
         typeof (backend as SandboxBackendProtocol).id === "string";
}
```

**2. BaseSandbox Abstract Class** (`src/backends/sandbox.ts`)

- Implements all BackendProtocol methods via Node.js shell commands
- Requires subclasses to implement: `execute()`, `id`, `uploadFiles()`, `downloadFiles()`

**3. LocalSandbox Implementation** (`src/backends/local-sandbox.ts`)

```typescript
export class LocalSandbox extends BaseSandbox {
  readonly id: string;

  constructor(options: { cwd?: string; timeout?: number; env?: Record<string, string> }) {
    // Initialize with working directory, timeout, environment
  }

  async execute(command: string): Promise<ExecuteResponse> {
    // Spawns bash process, captures output, handles timeout
  }
}
```

**4. Execute Tool** (`src/tools/execute.ts`)

- Requires `SandboxBackendProtocol` instance
- Emits events for streaming
- Handles timeout and truncation

**5. Agent Integration** (`src/agent.ts:193-195`)

```typescript
this.hasSandboxBackend = typeof backend !== "function" &&
                         backend !== undefined &&
                         isSandboxBackend(backend);
```

#### What Does NOT Exist

1. **Cloud Provider Backends** - No Modal, Runloop, Daytona, E2B implementations
2. **Sandbox Factory** - No unified creation interface
3. **Provider-specific File Upload/Download** - LocalSandbox doesn't need these (uses filesystem directly)

## Architecture Documentation

### Pattern Comparison

| Aspect | LangChain Python | LangChain JS | deepagentsdk |
|--------|-----------------|--------------|--------------|
| Base Class | `BaseSandbox` | `BaseSandbox` | `BaseSandbox` |
| Abstract Methods | `execute`, `id`, `upload_files`, `download_files` | Same | Same |
| File Ops | Python3 templates | Node.js templates | Node.js templates |
| Type Guard | Yes | Yes | Yes |
| Local Sandbox | N/A (in CLI) | `LocalShellSandbox` example | `LocalSandbox` |
| Modal | Yes | No | No |
| Runloop | Yes | No | No |
| Daytona | Yes | No | No |
| E2B | No | No | No |
| Factory | Context managers | N/A | N/A |

### Integration Points for Cloud Providers

To add a cloud provider (e.g., Modal), deepagentsdk needs:

**1. Provider Backend Class** (e.g., `src/backends/modal.ts`)

```typescript
import { BaseSandbox, ExecuteResponse, FileUploadResponse, FileDownloadResponse } from "./sandbox";

export interface ModalBackendOptions {
  sandbox: ModalSandbox; // From @modal/sdk
  timeout?: number;
}

export class ModalBackend extends BaseSandbox {
  readonly id: string;
  private readonly _sandbox: ModalSandbox;
  private readonly _timeout: number;

  constructor(options: ModalBackendOptions) {
    super();
    this._sandbox = options.sandbox;
    this._timeout = options.timeout ?? 30 * 60 * 1000;
    this.id = this._sandbox.objectId;
  }

  async execute(command: string): Promise<ExecuteResponse> {
    // Use Modal SDK's exec API to run command
    // Return structured ExecuteResponse
  }

  async uploadFiles(files: Array<[string, Uint8Array]>): Promise<FileUploadResponse[]> {
    // Use Modal SDK's file write API
  }

  async downloadFiles(paths: string[]): Promise<FileDownloadResponse[]> {
    // Use Modal SDK's file read API
  }
}
```

**2. Factory Function** (e.g., `src/backends/sandbox-factory.ts`)

```typescript
export type SandboxProvider = "local" | "modal" | "runloop" | "daytona" | "e2b";

export interface CreateSandboxOptions {
  provider: SandboxProvider;
  sandboxId?: string;
  setupScript?: string;
  workingDirectory?: string;
  timeout?: number;
}

export async function createSandbox(options: CreateSandboxOptions): Promise<SandboxBackendProtocol> {
  switch (options.provider) {
    case "local":
      return new LocalSandbox({ cwd: options.workingDirectory, timeout: options.timeout });
    case "modal":
      // Import Modal SDK, create sandbox, return ModalBackend
    // ... other providers
  }
}

export async function* useSandbox(options: CreateSandboxOptions): AsyncGenerator<SandboxBackendProtocol, void, void> {
  const sandbox = await createSandbox(options);
  try {
    yield sandbox;
  } finally {
    // Cleanup logic
  }
}
```

## Code References

### LangChain Python

- `protocol.py:423-456` - SandboxBackendProtocol definition
- `sandbox.py:141-361` - BaseSandbox implementation
- `modal.py:18-127` - Modal backend
- `runloop.py:19-125` - Runloop backend
- `daytona.py:18-118` - Daytona backend
- `sandbox_factory.py:49-315` - Factory context managers

### LangChain JavaScript

- `protocol.ts:259-285` - SandboxBackendProtocol interface
- `sandbox.ts:315-546` - BaseSandbox class
- `local-sandbox.ts:42-222` - LocalShellSandbox example

### deepagentsdk (Current)

- `src/types/backend.ts:155-177` - SandboxBackendProtocol interface
- `src/backends/sandbox.ts` - BaseSandbox class
- `src/backends/local-sandbox.ts` - LocalSandbox implementation
- `src/tools/execute.ts` - Execute tool
- `src/agent.ts:193-195` - Sandbox detection

## Historical Context (from docs/)

- `docs/tickets/002_sandbox_backend/research.md` - Previous research on SandboxBackendProtocol design
- `docs/research/sandbox-vs-filesystem-architecture.md` - Architecture comparison
- `docs/PROJECT-STATE.md:123` - Cloud sandbox integrations listed as "not implemented"

## Open Questions

1. **Which providers to prioritize?**
   - E2B is popular in the AI agent ecosystem
   - Modal has official TypeScript SDK
   - Runloop and Daytona are also viable options

2. **SDK availability and maturity?**
   - Need to verify TypeScript SDK availability for each provider
   - Modal: `@modal/sdk` (official)
   - E2B: `@e2b/code-interpreter` (official)
   - Runloop: May need HTTP client wrapper
   - Daytona: May need HTTP client wrapper

3. **Lifecycle management pattern?**
   - Python uses context managers
   - TypeScript options: AsyncDisposable, manual cleanup, or factory functions

4. **Integration with existing agent API?**
   - Current: Pass sandbox backend directly to agent
   - Consider: Factory functions that create sandbox + agent together

5. **Testing strategy?**
   - Unit tests: Mock SDK calls
   - Integration tests: Require API keys, run against real providers

## Recommended Next Steps

1. **Create provider priority list** based on SDK availability and community demand
2. **Implement E2B or Modal first** (best TypeScript SDK support)
3. **Add sandbox factory** for unified creation interface
4. **Document provider-specific setup** (API keys, configuration)
5. **Add integration tests** (gated by API key availability)

## Related Research

- [E2B Documentation](https://e2b.dev/docs)
- [Modal Documentation](https://modal.com/docs)
- [Runloop Documentation](https://runloop.ai/docs)
- [Daytona Documentation](https://daytona.io/docs)
