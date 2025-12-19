/**
 * Backends for pluggable file storage and command execution.
 */

// Standard backends (BackendProtocol)
export { StateBackend } from "./state";
export { FilesystemBackend } from "./filesystem";
export { CompositeBackend } from "./composite";
export {
  PersistentBackend,
  InMemoryStore,
  type KeyValueStore,
  type PersistentBackendOptions,
} from "./persistent";

// Sandbox backends (SandboxBackendProtocol)
export { BaseSandbox } from "./sandbox";
export { LocalSandbox, type LocalSandboxOptions } from "./local-sandbox";

// Re-export utilities
export * from "./utils";

