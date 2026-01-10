---
date: 2026-01-11 09:00:00 AEDT
author: Claude (Opus 4.5)
git_commit: 7bb6a368b33d86c1847a9c93d381fafeccd37a9e
branch: main
repository: deepagentsdk
topic: "Sandbox Provider Integration Implementation Plan"
tags: [plan, sandbox, providers, implementation, e2b, modal, runloop, daytona]
status: ready
---

# Implementation Plan: Cloud Sandbox Provider Integration

## Overview

This plan implements cloud sandbox provider backends for deepagentsdk, enabling agents to execute code in isolated cloud environments. The implementation follows the existing `BaseSandbox` pattern and integrates with the current agent architecture.

**IMPORTANT CORRECTION**: All four providers have official TypeScript SDKs. The original plan incorrectly identified Modal, Runloop, and Daytona as requiring HTTP client wrappers.

**Provider SDK Status**:

| Provider | Package | Version | Status |
|----------|---------|---------|--------|
| **E2B** | `@e2b/code-interpreter` | 2.3.3 | ✅ Official SDK |
| **Modal** | `modal` | 0.6.0 | ✅ Official SDK |
| **Runloop** | `@runloop/api-client` | 1.0.0 | ✅ Official SDK |
| **Daytona** | `@daytonaio/sdk` | 0.129.0 | ✅ Official SDK |

**References**:

- Modal SDK: [GitHub](https://github.com/modal-labs/libmodal), [Docs](https://modal.com/docs/guide/sdk-javascript-go)
- Runloop SDK: [npm](https://www.npmjs.com/package/@runloop/api-client), [Docs](https://runloopai.github.io/api-client-ts/stable/)
- Daytona SDK: [npm](https://www.npmjs.com/package/@daytonaio/sdk), [Docs](https://www.daytona.io/docs/en/typescript-sdk/)

## Requirements Summary

| Requirement | Decision |
|-------------|----------|
| **E2B Implementation** | ✅ Include - Has official SDK |
| **Modal Implementation** | ✅ Include - Has official SDK |
| **Runloop Implementation** | ✅ Include - Has official SDK |
| **Daytona Implementation** | ✅ Include - Has official SDK |
| **Lifecycle Management** | Manual cleanup with optional `dispose()` method |
| **Usage Pattern** | Pass backend instance directly to agent |
| **Integration Tests** | ✅ Include - Gated by API keys |

---

## Phase 1: E2B Sandbox Backend

### SDK Information

- **Package**: `@e2b/code-interpreter` (v2.3.3)
- **Documentation**: <https://e2b.dev/docs>
- **GitHub**: <https://github.com/e2b-dev/code-interpreter>
- **Authentication**: `E2B_API_KEY` environment variable
- **Default Working Directory**: `/home/user`
- **Cleanup**: Automatic after 5 minutes of inactivity (configurable)

### Implementation Details

**File**: `src/backends/e2b.ts`

```typescript
import { BaseSandbox, ExecuteResponse, FileUploadResponse, FileDownloadResponse } from "./sandbox";
import { Sandbox as E2BSandbox } from "@e2b/code-interpreter";

export interface E2BBackendOptions {
  apiKey?: string;
  template?: string;
  timeout?: number;
  id?: string;  // Connect to existing sandbox
}

export class E2BBackend extends BaseSandbox {
  readonly id: string;
  private readonly _sandbox: E2BSandbox;
  private readonly _timeout: number;

  constructor(options: E2BBackendOptions = {}) {
    super();
    const apiKey = options.apiKey ?? process.env.E2B_API_KEY;
    if (!apiKey) {
      throw new Error("E2B_API_KEY environment variable must be set");
    }

    // Connect to existing or create new sandbox
    this._sandbox = options.id
      ? E2BSandbox.reconnect(options.id, { apiKey })
      : E2BSandbox.create({ apiKey, template: options.template ?? "base" });

    this.id = this._sandbox.sandboxId;
    this._timeout = options.timeout ?? 30 * 60 * 1000; // 30 minutes default
  }

  async execute(command: string): Promise<ExecuteResponse> {
    const result = await this._sandbox.process.start({
      cmd: command,
      timeoutMs: this._timeout,
    });

    return {
      output: result.stdout + (result.stderr ? "\n" + result.stderr : ""),
      exit_code: result.exitCode ?? 0,
      truncated: false,
    };
  }

  async uploadFiles(files: Array<[string, Uint8Array]>): Promise<FileUploadResponse[]> {
    const responses: FileUploadResponse[] = [];

    for (const [path, content] of files) {
      try {
        await this._sandbox.files.write(path, content);
        responses.push({ path, error: null });
      } catch (error) {
        responses.push({
          path,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }

    return responses;
  }

  async downloadFiles(paths: string[]): Promise<FileDownloadResponse[]> {
    const responses: FileDownloadResponse[] = [];

    for (const path of paths) {
      try {
        const content = await this._sandbox.files.read(path);
        responses.push({ path, content: new Uint8Array(content), error: null });
      } catch (error) {
        responses.push({
          path,
          content: null,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }

    return responses;
  }

  /**
   * Manually kill the E2B sandbox.
   * Note: E2B automatically cleans up after 5 minutes of inactivity.
   */
  async dispose(): Promise<void> {
    await this._sandbox.kill();
  }
}
```

---

## Phase 2: Modal Sandbox Backend

### SDK Information

- **Package**: `modal` (v0.6.0)
- **Documentation**: <https://modal.com/docs/guide/sdk-javascript-go>
- **GitHub**: <https://github.com/modal-labs/libmodal>
- **Authentication**: `MODAL_TOKEN_ID` + `MODAL_TOKEN_SECRET` environment variables (or `~/.modal.toml`)
- **Default Working Directory**: `/workspace`
- **Node Version**: Node 22+ required

### SDK API Examples

```typescript
import { ModalClient } from "modal";

const modal = new ModalClient();
const app = await modal.apps.fromName("my-app", { createIfMissing: true });
const image = modal.images.fromRegistry("python:3.13-slim");

// Create sandbox
const sb = await modal.sandboxes.create(app, image);
console.log("Sandbox ID:", sb.sandboxId);

// Execute command
const p = await sb.exec(["echo", "hello"], { stdout: "pipe", stderr: "pipe" });
const stdout = await p.stdout.readText();
const exitCode = await p.wait();

// File operations
const handle = await sb.open("/tmp/file.txt", "w");
await handle.write(new TextEncoder().encode("content"));
await handle.close();

const readHandle = await sb.open("/tmp/file.txt", "r");
const content = await readHandle.read();
await readHandle.close();

// Cleanup
await sb.terminate();
```

### Implementation Details

**File**: `src/backends/modal.ts`

```typescript
import { BaseSandbox, ExecuteResponse, FileUploadResponse, FileDownloadResponse } from "./sandbox";
import { ModalClient } from "modal";

export interface ModalBackendOptions {
  appName?: string;
  image?: string;
  timeout?: number;
}

export class ModalBackend extends BaseSandbox {
  readonly id: string;
  private readonly _client: ModalClient;
  private readonly _sandbox: Awaited<ReturnType<ModalClient["sandboxes"]["create"]>>;
  private readonly _timeout: number;

  constructor(options: ModalBackendOptions = {}) {
    super();

    // Initialize Modal client
    this._client = new ModalClient();

    // Get or create app
    const appName = options.appName ?? "deepagentsdk-sandbox";
    const app = await this._client.apps.fromName(appName, {
      createIfMissing: true,
    });

    // Create image
    const imageRef = options.image ?? "python:3.13-slim";
    const image = this._client.images.fromRegistry(imageRef);

    // Create sandbox
    this._sandbox = await this._client.sandboxes.create(app, image);
    this.id = this._sandbox.sandboxId;
    this._timeout = options.timeout ?? 30 * 60 * 1000;
  }

  async execute(command: string): Promise<ExecuteResponse> {
    // Parse command into arguments (simple shlex-like behavior)
    const args = command.split(/\s+/);

    const process = await this._sandbox.exec(args, {
      stdout: "pipe",
      stderr: "pipe",
    });

    const [stdout, stderr, exitCode] = await Promise.all([
      process.stdout.readText().catch(() => ""),
      process.stderr.readText().catch(() => ""),
      process.wait(),
    ]);

    return {
      output: stdout + (stderr ? "\n" + stderr : ""),
      exit_code: exitCode,
      truncated: false,
    };
  }

  async uploadFiles(files: Array<[string, Uint8Array]>): Promise<FileUploadResponse[]> {
    const responses: FileUploadResponse[] = [];

    for (const [path, content] of files) {
      try {
        const handle = await this._sandbox.open(path, "w");
        await handle.write(content);
        await handle.close();
        responses.push({ path, error: null });
      } catch (error) {
        responses.push({
          path,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }

    return responses;
  }

  async downloadFiles(paths: string[]): Promise<FileDownloadResponse[]> {
    const responses: FileDownloadResponse[] = [];

    for (const path of paths) {
      try {
        const handle = await this._sandbox.open(path, "r");
        const content = await handle.read();
        await handle.close();
        responses.push({ path, content: new Uint8Array(content), error: null });
      } catch (error) {
        responses.push({
          path,
          content: null,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }

    return responses;
  }

  async dispose(): Promise<void> {
    await this._sandbox.terminate();
  }
}
```

---

## Phase 3: Runloop Sandbox Backend

### SDK Information

- **Package**: `@runloop/api-client` (v1.0.0)
- **Documentation**: <https://runloopai.github.io/api-client-ts/stable/>
- **npm**: <https://www.npmjs.com/package/@runloop/api-client>
- **Authentication**: `RUNLOOP_API_KEY` environment variable
- **Default Working Directory**: `/home/user`

### SDK API Examples

```typescript
import { RunloopSDK } from '@runloop/api-client';

const sdk = new RunloopSDK({
  bearerToken: process.env.RUNLOOP_API_KEY,
});

// Create devbox and wait for ready
const devbox = await sdk.devbox.create();

// Execute command
const result = await devbox.cmd.exec('echo "Hello, World!"');
console.log('Output:', await result.stdout());
console.log('Exit code:', result.exitCode);

// Async command
const serverExec = await devbox.cmd.execAsync('npx http-server -p 8080');
console.log('Execution ID:', serverExec.executionId);

const state = await serverExec.getState();
console.log('Status:', state.status);

// Cleanup
await devbox.shutdown();
```

### Implementation Details

**File**: `src/backends/runloop.ts`

```typescript
import { BaseSandbox, ExecuteResponse, FileUploadResponse, FileDownloadResponse } from "./sandbox";
import { RunloopSDK } from "@runloop/api-client";

export interface RunloopBackendOptions {
  apiKey?: string;
  devboxId?: string;
  timeout?: number;
}

export class RunloopBackend extends BaseSandbox {
  readonly id: string;
  private readonly _sdk: RunloopSDK;
  private readonly _devbox: Awaited<ReturnType<RunloopSDK["devbox"]["create"]>>;
  private readonly _timeout: number;
  private readonly _owned: boolean;  // Whether we created the devbox

  constructor(options: RunloopBackendOptions = {}) {
    super();

    const apiKey = options.apiKey ?? process.env.RUNLOOP_API_KEY;
    if (!apiKey) {
      throw new Error("RUNLOOP_API_KEY environment variable must be set");
    }

    this._sdk = new RunloopSDK({ bearerToken: apiKey });
    this._timeout = options.timeout ?? 30 * 60 * 1000;

    if (options.devboxId) {
      // Connect to existing devbox
      this._devbox = await this._sdk.devbox.get(options.devboxId);
      this.id = options.devboxId;
      this._owned = false;
    } else {
      // Create new devbox (waits for it to be ready)
      this._devbox = await this._sdk.devbox.create();
      this.id = this._devbox.devboxId;
      this._owned = true;
    }
  }

  async execute(command: string): Promise<ExecuteResponse> {
    const result = await this._devbox.cmd.exec(command, {
      timeout: this._timeout / 1000,  // Runloop uses seconds
    });

    const stdout = await result.stdout();
    const stderr = await result.stderr();

    return {
      output: stdout + (stderr ? "\n" + stderr : ""),
      exit_code: result.exitCode,
      truncated: false,
    };
  }

  async uploadFiles(files: Array<[string, Uint8Array]>): Promise<FileUploadResponse[]> {
    const responses: FileUploadResponse[] = [];

    for (const [path, content] of files) {
      try {
        // Use shell command to write file (simpler than using storage API)
        const base64Content = Buffer.from(content).toString("base64");
        await this._devbox.cmd.exec(`echo "${base64Content}" | base64 -d > "${path}"`);
        responses.push({ path, error: null });
      } catch (error) {
        responses.push({
          path,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }

    return responses;
  }

  async downloadFiles(paths: string[]): Promise<FileDownloadResponse[]> {
    const responses: FileDownloadResponse[] = [];

    for (const path of paths) {
      try {
        // Read file via base64 encoding
        const result = await this._devbox.cmd.exec(`base64 "${path}"`);
        const base64Content = (await result.stdout()).trim();
        const content = Buffer.from(base64Content, "base64");
        responses.push({ path, content, error: null });
      } catch (error) {
        responses.push({
          path,
          content: null,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }

    return responses;
  }

  async dispose(): Promise<void> {
    if (this._owned) {
      await this._devbox.shutdown();
    }
  }
}
```

---

## Phase 4: Daytona Sandbox Backend

### SDK Information

- **Package**: `@daytonaio/sdk` (v0.129.0)
- **Documentation**: <https://www.daytona.io/docs/en/typescript-sdk/>
- **npm**: <https://www.npmjs.com/package/@daytonaio/sdk>
- **Authentication**: `DAYTONA_API_KEY` environment variable
- **Default Working Directory**: `/workspace`

### SDK API Examples

```typescript
import { Daytona } from '@daytonaio/sdk';

const daytona = new Daytona();

// Create sandbox
const sandbox = await daytona.create({
  language: 'typescript',
  envVars: { NODE_ENV: 'development' },
});

// Execute command
const response = await sandbox.process.executeCommand('echo "Hello, World!"');
console.log(response.result);

// File operations
await sandbox.fs.uploadFiles([
  { source: 'local.txt', destination: '/workspace/file.txt' },
]);

const files = await sandbox.fs.listFiles('/workspace');
console.log('Files:', files);

const downloads = await sandbox.fs.downloadFiles([
  { source: '/workspace/file.txt' },
]);

// Cleanup
await daytona.delete(sandbox);
```

### Implementation Details

**File**: `src/backends/daytona.ts`

```typescript
import { BaseSandbox, ExecuteResponse, FileUploadResponse, FileDownloadResponse } from "./sandbox";
import { Daytona } from "@daytonaio/sdk";

export interface DaytonaBackendOptions {
  apiKey?: string;
  language?: string;
  sandboxId?: string;
  timeout?: number;
}

export class DaytonaBackend extends BaseSandbox {
  readonly id: string;
  private readonly _daytona: Daytona;
  private readonly _sandbox: Awaited<ReturnType<Daytona["create"]>>;
  private readonly _timeout: number;
  private readonly _owned: boolean;

  constructor(options: DaytonaBackendOptions = {}) {
    super();

    const apiKey = options.apiKey ?? process.env.DAYTONA_API_KEY;
    if (!apiKey) {
      throw new Error("DAYTONA_API_KEY environment variable must be set");
    }

    this._daytona = new Daytona({ apiKey });
    this._timeout = options.timeout ?? 30 * 60 * 1000;

    if (options.sandboxId) {
      // Connect to existing sandbox
      this._sandbox = { id: options.sandboxId } as any;  // Simplified - actual API may differ
      this.id = options.sandboxId;
      this._owned = false;
    } else {
      // Create new sandbox
      this._sandbox = await this._daytona.create({
        language: options.language ?? "typescript",
      });
      this.id = this._sandbox.id;  // Adjust based on actual API
      this._owned = true;
    }
  }

  async execute(command: string): Promise<ExecuteResponse> {
    const response = await this._sandbox.process.executeCommand(
      command,
      "/workspace",
      undefined,
      this._timeout / 1000  // Daytona uses seconds
    );

    return {
      output: response.result,
      exit_code: response.exitCode ?? 0,
      truncated: false,
    };
  }

  async uploadFiles(files: Array<[string, Uint8Array]>): Promise<FileUploadResponse[]> {
    const responses: FileUploadResponse[] = [];

    for (const [path, content] of files) {
      try {
        // Daytona uses source/destination pattern for file operations
        await this._sandbox.fs.uploadFiles([{
          source: Buffer.from(content),
          destination: path,
        }]);
        responses.push({ path, error: null });
      } catch (error) {
        responses.push({
          path,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }

    return responses;
  }

  async downloadFiles(paths: string[]): Promise<FileDownloadResponse[]> {
    const responses: FileDownloadResponse[] = [];

    for (const path of paths) {
      try {
        const downloads = await this._sandbox.fs.downloadFiles([{ source: path }]);
        const fileData = downloads[0];

        if (fileData.error) {
          responses.push({
            path,
            content: null,
            error: fileData.error,
          });
        } else {
          // Handle both buffer and string results
          const content = typeof fileData.result === "string"
            ? Buffer.from(fileData.result)
            : fileData.result;
          responses.push({ path, content: new Uint8Array(content), error: null });
        }
      } catch (error) {
        responses.push({
          path,
          content: null,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }

    return responses;
  }

  async dispose(): Promise<void> {
    if (this._owned) {
      await this._daytona.delete(this._sandbox);
    }
  }
}
```

---

## Phase 5: Integration Tests

### Test Organization

All integration tests will be placed in `test-integration/backends/` and gated by API key availability:

```
test-integration/backends/
├── e2b.test.ts       (gated by E2B_API_KEY)
├── modal.test.ts     (gated by MODAL_TOKEN_ID)
├── runloop.test.ts   (gated by RUNLOOP_API_KEY)
└── daytona.test.ts   (gated by DAYTONA_API_KEY)
```

### Test Template for E2B

**File**: `test-integration/backends/e2b.test.ts`

```typescript
import { test, expect } from "bun:test";
import { E2BBackend } from "deepagentsdk";

test.runIf(!!process.env.E2B_API_KEY)("E2BBackend: execute command", async () => {
  const backend = new E2BBackend({ template: "base" });

  try {
    const result = await backend.execute("echo 'Hello from E2B!'");

    expect(result.output).toContain("Hello from E2B!");
    expect(result.exit_code).toBe(0);
  } finally {
    await backend.dispose();
  }
});

test.runIf(!!process.env.E2B_API_KEY)("E2BBackend: file operations", async () => {
  const backend = new E2BBackend();

  try {
    // Write file using inherited method from BaseSandbox
    await backend.write("/tmp/test.txt", "test content");

    // Read file
    const content = await backend.read("/tmp/test.txt");
    expect(content).toContain("test content");

    // List files
    const files = await backend.ls("/tmp");
    expect(files.some((f: any) => f.name === "test.txt")).toBe(true);

    // Download files
    const downloaded = await backend.downloadFiles(["/tmp/test.txt"]);
    expect(downloaded[0].content).toBeInstanceOf(Uint8Array);

    // Cleanup
    await backend.rm("/tmp/test.txt");
  } finally {
    await backend.dispose();
  }
});
```

---

## Dependencies

All official SDK packages to install:

```json
{
  "dependencies": {
    "@e2b/code-interpreter": "^2.3.3",
    "modal": "^0.6.0",
    "@runloop/api-client": "^1.0.0",
    "@daytonaio/sdk": "^0.129.0"
  }
}
```

**Optional Dependencies**: Users can install provider-specific packages as peer dependencies to avoid unnecessary bloat.

---

## Usage Examples

### E2B Backend

```typescript
import { createDeepAgent, E2BBackend } from "deepagentsdk";
import { anthropic } from "@ai-sdk/anthropic";

const sandbox = new E2BBackend({
  template: "base",
  timeout: 10 * 60 * 1000,
});

const agent = createDeepAgent({
  model: anthropic("claude-sonnet-4-20250514"),
  backend: sandbox,
});

const result = await agent.run("Write a Python script that calculates fibonacci");

await sandbox.dispose();
```

### Modal Backend

```typescript
import { createDeepAgent, ModalBackend } from "deepagentsdk";

const sandbox = new ModalBackend({
  appName: "my-agent-sandbox",
  image: "node:22-alpine",
});

const agent = createDeepAgent({
  model: anthropic("claude-sonnet-4-20250514"),
  backend: sandbox,
});

// ... use agent

await sandbox.dispose();
```

### Runloop Backend

```typescript
import { createDeepAgent, RunloopBackend } from "deepagentsdk";

const sandbox = new RunloopBackend({
  timeout: 15 * 60 * 1000,
});

const agent = createDeepAgent({
  model: anthropic("claude-sonnet-4-20250514"),
  backend: sandbox,
});

await sandbox.dispose();
```

### Daytona Backend

```typescript
import { createDeepAgent, DaytonaBackend } from "deepagentsdk";

const sandbox = new DaytonaBackend({
  language: "typescript",
});

const agent = createDeepAgent({
  model: anthropic("claude-sonnet-4-20250514"),
  backend: sandbox,
});

await sandbox.dispose();
```

---

## Lifecycle Management Approach

### Pattern: Manual Cleanup with dispose()

**Decision**: Use manual cleanup with a `dispose()` method for all providers.

**Rationale**:

1. **Backward compatible** - Works in all Node.js versions
2. **Explicit** - Clear when cleanup happens
3. **Flexible** - User controls lifetime
4. **Provider differences** - Each provider has different auto-cleanup behavior

**Provider Cleanup Behavior**:

| Provider | Auto Cleanup | Manual Cleanup Required |
|----------|--------------|-------------------------|
| E2B | 5 min inactivity | Optional (kill) |
| Modal | No auto | Yes (terminate) |
| Runloop | No auto | Yes (shutdown) |
| Daytona | No auto | Yes (delete) |

**Best Practice**:

```typescript
const sandbox = new E2BBackend();
try {
  // ... use sandbox
} finally {
  await sandbox.dispose();  // Always cleanup
}
```

---

## Implementation Checklist

### Phase 1: E2B

- [ ] Install `@e2b/code-interpreter` dependency
- [ ] Create `src/backends/e2b.ts`
- [ ] Add exports to `src/backends/index.ts`
- [ ] Add exports to `src/index.ts`
- [ ] Create `test-integration/backends/e2b.test.ts`
- [ ] Verify integration tests pass

### Phase 2: Modal

- [ ] Install `modal` dependency
- [ ] Create `src/backends/modal.ts`
- [ ] Add exports
- [ ] Create `test-integration/backends/modal.test.ts`
- [ ] Verify integration tests pass

### Phase 3: Runloop

- [ ] Install `@runloop/api-client` dependency
- [ ] Create `src/backends/runloop.ts`
- [ ] Add exports
- [ ] Create `test-integration/backends/runloop.test.ts`
- [ ] Verify integration tests pass

### Phase 4: Daytona

- [ ] Install `@daytonaio/sdk` dependency
- [ ] Create `src/backends/daytona.ts`
- [ ] Add exports
- [ ] Create `test-integration/backends/daytona.test.ts`
- [ ] Verify integration tests pass

### Phase 5: Documentation

- [ ] Update README.md with sandbox provider examples
- [ ] Add handbook documentation page
- [ ] Document environment variables
- [ ] Add troubleshooting guide

---

## Risk Mitigation

| Risk | Mitigation |
|------|------------|
| **SDK API changes** | Pin dependency versions, monitor changelogs |
| **Provider outages** | Document fallback behavior, error handling |
| **Cost concerns** | Document sandbox pricing, implement timeout defaults |
| **API key exposure** | Never log keys, document secure storage practices |
| **Test flakiness** | Retry logic, longer timeouts for sandbox startup |

---

## Post-Implementation Tasks

1. **Update PROJECT-STATE.md** - Move cloud sandbox integrations to "Implemented"
2. **Create blog post** - Announce multi-provider cloud sandbox support
3. **Add examples** - Example scripts for each provider
4. **Monitor adoption** - Track usage, gather feedback
