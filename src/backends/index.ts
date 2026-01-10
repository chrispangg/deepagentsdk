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

// Cloud sandbox providers
export { E2BBackend, createE2BBackend, type E2BBackendOptions } from "./e2b";
export { ModalBackend, createModalBackend, type ModalBackendOptions } from "./modal";
export { RunloopBackend, type RunloopBackendOptions } from "./runloop";
export { DaytonaBackend, type DaytonaBackendOptions } from "./daytona";

// Re-export utilities
export * from "./utils";

