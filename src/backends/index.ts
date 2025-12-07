/**
 * Backends for pluggable file storage and command execution.
 */

// Standard backends (BackendProtocol)
export { StateBackend } from "./state.ts";
export { FilesystemBackend } from "./filesystem.ts";
export { CompositeBackend } from "./composite.ts";
export {
  PersistentBackend,
  InMemoryStore,
  type KeyValueStore,
  type PersistentBackendOptions,
} from "./persistent.ts";

// Sandbox backends (SandboxBackendProtocol)
export { BaseSandbox } from "./sandbox.ts";
export { LocalSandbox, type LocalSandboxOptions } from "./local-sandbox.ts";

// Re-export utilities
export * from "./utils.ts";

