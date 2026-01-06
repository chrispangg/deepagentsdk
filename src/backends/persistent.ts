/**
 * PersistentBackend: Generic persistent storage backend.
 *
 * This backend provides cross-conversation file persistence using a
 * pluggable key-value store interface. It can be used with various
 * storage solutions like Redis, SQLite, or any custom implementation.
 */

import type {
  BackendProtocol,
  EditResult,
  FileData,
  FileInfo,
  GrepMatch,
  WriteResult,
} from "../types.js";
import {
  createFileData,
  fileDataToString,
  formatReadResponse,
  globSearchFiles,
  grepMatchesFromFiles,
  performStringReplacement,
  updateFileData,
} from "./utils.js";
import {
  FILE_NOT_FOUND,
  FILE_ALREADY_EXISTS,
} from "../constants/errors.js";

/**
 * Generic key-value store interface for persistent storage.
 *
 * Implement this interface to use any storage backend (Redis, SQLite, cloud storage, etc.)
 * with PersistentBackend. The interface uses hierarchical namespaces for organization.
 *
 * @example Redis implementation
 * ```typescript
 * class RedisStore implements KeyValueStore {
 *   constructor(private redis: RedisClient) {}
 *
 *   async get(namespace: string[], key: string) {
 *     const redisKey = [...namespace, key].join(':');
 *     const data = await this.redis.get(redisKey);
 *     return data ? JSON.parse(data) : undefined;
 *   }
 *
 *   async put(namespace: string[], key: string, value: Record<string, unknown>) {
 *     const redisKey = [...namespace, key].join(':');
 *     await this.redis.set(redisKey, JSON.stringify(value));
 *   }
 *
 *   async delete(namespace: string[], key: string) {
 *     const redisKey = [...namespace, key].join(':');
 *     await this.redis.del(redisKey);
 *   }
 *
 *   async list(namespace: string[]) {
 *     const prefix = [...namespace].join(':') + ':';
 *     const keys = await this.redis.keys(prefix + '*');
 *     const results = [];
 *     for (const key of keys) {
 *       const data = await this.redis.get(key);
 *       if (data) {
 *         const relativeKey = key.substring(prefix.length);
 *         results.push({ key: relativeKey, value: JSON.parse(data) });
 *       }
 *     }
 *     return results;
 *   }
 * }
 * ```
 */
export interface KeyValueStore {
  /**
   * Get a value by key from the store.
   * @param namespace - Hierarchical namespace array (e.g., ["project1", "filesystem"])
   * @param key - The key to retrieve (file path in the case of PersistentBackend)
   * @returns The stored value as a record, or undefined if not found
   */
  get(namespace: string[], key: string): Promise<Record<string, unknown> | undefined>;

  /**
   * Store a value by key in the store.
   * @param namespace - Hierarchical namespace array
   * @param key - The key to store (file path in the case of PersistentBackend)
   * @param value - The value to store (must be serializable to JSON)
   */
  put(namespace: string[], key: string, value: Record<string, unknown>): Promise<void>;

  /**
   * Delete a value by key from the store.
   * @param namespace - Hierarchical namespace array
   * @param key - The key to delete (file path in the case of PersistentBackend)
   */
  delete(namespace: string[], key: string): Promise<void>;

  /**
   * List all keys and values in a namespace.
   * @param namespace - Hierarchical namespace array
   * @returns Array of items with key and value pairs directly in this namespace
   *          (not including sub-namespaces)
   */
  list(namespace: string[]): Promise<Array<{ key: string; value: Record<string, unknown> }>>;
}

/**
 * Simple in-memory implementation of KeyValueStore.
 *
 * Useful for testing or single-session persistence. Data is stored in a Map
 * and does not persist across application restarts.
 *
 * @example Basic usage
 * ```typescript
 * const store = new InMemoryStore();
 * const backend = new PersistentBackend({ store });
 * ```
 *
 * @example For testing
 * ```typescript
 * const store = new InMemoryStore();
 * // ... run tests ...
 * store.clear(); // Clean up after tests
 * ```
 */
export class InMemoryStore implements KeyValueStore {
  private data = new Map<string, Record<string, unknown>>();

  private makeKey(namespace: string[], key: string): string {
    return [...namespace, key].join(":");
  }

  private parseKey(fullKey: string, namespace: string[]): string | null {
    const prefix = namespace.join(":") + ":";
    if (fullKey.startsWith(prefix)) {
      return fullKey.substring(prefix.length);
    }
    return null;
  }

  async get(namespace: string[], key: string): Promise<Record<string, unknown> | undefined> {
    return this.data.get(this.makeKey(namespace, key));
  }

  async put(namespace: string[], key: string, value: Record<string, unknown>): Promise<void> {
    this.data.set(this.makeKey(namespace, key), value);
  }

  async delete(namespace: string[], key: string): Promise<void> {
    this.data.delete(this.makeKey(namespace, key));
  }

  async list(namespace: string[]): Promise<Array<{ key: string; value: Record<string, unknown> }>> {
    const results: Array<{ key: string; value: Record<string, unknown> }> = [];
    const prefix = namespace.join(":") + ":";

    for (const [fullKey, value] of this.data.entries()) {
      if (fullKey.startsWith(prefix)) {
        const key = fullKey.substring(prefix.length);
        // Only include items directly in this namespace (no sub-namespaces)
        if (!key.includes(":")) {
          results.push({ key, value });
        }
      }
    }

    return results;
  }

  /**
   * Clear all data (useful for testing).
   */
  clear(): void {
    this.data.clear();
  }

  /**
   * Get the number of stored items.
   */
  size(): number {
    return this.data.size;
  }
}

/**
 * Options for creating a PersistentBackend.
 */
export interface PersistentBackendOptions {
  /** 
   * **Required.** The key-value store implementation to use.
   * 
   * You can use the built-in `InMemoryStore` for testing, or implement `KeyValueStore`
   * for custom storage (Redis, SQLite, etc.).
   * 
   * @see {@link KeyValueStore} for the interface definition
   * @see {@link InMemoryStore} for a simple in-memory implementation
   */
  store: KeyValueStore;
  /** 
   * Optional namespace prefix for isolation (e.g., project ID, user ID).
   * 
   * This allows multiple agents or projects to share the same store without conflicts.
   * Files are stored under `[namespace]/filesystem/` in the key-value store.
   * 
   * Default: "default"
   */
  namespace?: string;
}

/**
 * Backend that stores files in a persistent key-value store.
 *
 * This provides cross-conversation file persistence that survives between agent sessions.
 * Files are stored in the provided key-value store, allowing you to use any storage backend
 * (Redis, SQLite, cloud storage, etc.) by implementing the `KeyValueStore` interface.
 *
 * @example Using InMemoryStore (for testing or single-session persistence)
 * ```typescript
 * import { createDeepAgent } from 'deepagentsdk';
 * import { PersistentBackend, InMemoryStore } from 'deepagentsdk';
 * import { anthropic } from '@ai-sdk/anthropic';
 *
 * const store = new InMemoryStore();
 * const backend = new PersistentBackend({ store });
 * const agent = createDeepAgent({
 *   model: anthropic('claude-sonnet-4-20250514'),
 *   backend,
 * });
 * ```
 *
 * @example With custom namespace for project isolation
 * ```typescript
 * import { createDeepAgent } from 'deepagentsdk';
 * import { PersistentBackend, InMemoryStore } from 'deepagentsdk';
 * import { anthropic } from '@ai-sdk/anthropic';
 *
 * const store = new InMemoryStore();
 * const backend = new PersistentBackend({
 *   store,
 *   namespace: 'project-123', // Isolate files for this project
 * });
 * const agent = createDeepAgent({
 *   model: anthropic('claude-sonnet-4-20250514'),
 *   backend,
 * });
 * ```
 *
 * @example Custom KeyValueStore implementation (Redis)
 * ```typescript
 * import { createDeepAgent } from 'deepagentsdk';
 * import { PersistentBackend, type KeyValueStore } from 'deepagentsdk';
 * import { anthropic } from '@ai-sdk/anthropic';
 * import { createClient } from 'redis';
 *
 * class RedisStore implements KeyValueStore {
 *   constructor(private redis: ReturnType<typeof createClient>) {}
 *
 *   async get(namespace: string[], key: string) {
 *     const redisKey = [...namespace, key].join(':');
 *     const data = await this.redis.get(redisKey);
 *     return data ? JSON.parse(data) : undefined;
 *   }
 *
 *   async put(namespace: string[], key: string, value: Record<string, unknown>) {
 *     const redisKey = [...namespace, key].join(':');
 *     await this.redis.set(redisKey, JSON.stringify(value));
 *   }
 *
 *   async delete(namespace: string[], key: string) {
 *     const redisKey = [...namespace, key].join(':');
 *     await this.redis.del(redisKey);
 *   }
 *
 *   async list(namespace: string[]) {
 *     const prefix = [...namespace].join(':') + ':';
 *     const keys = await this.redis.keys(prefix + '*');
 *     const results = [];
 *     for (const key of keys) {
 *       const data = await this.redis.get(key);
 *       if (data) {
 *         const relativeKey = key.substring(prefix.length);
 *         results.push({ key: relativeKey, value: JSON.parse(data) });
 *       }
 *     }
 *     return results;
 *   }
 * }
 *
 * const redis = createClient();
 * await redis.connect();
 *
 * const backend = new PersistentBackend({ 
 *   store: new RedisStore(redis),
 *   namespace: 'production'
 * });
 *
 * const agent = createDeepAgent({
 *   model: anthropic('claude-sonnet-4-20250514'),
 *   backend,
 * });
 * ```
 */
export class PersistentBackend implements BackendProtocol {
  private store: KeyValueStore;
  private namespacePrefix: string;

  /**
   * Create a new PersistentBackend instance.
   *
   * @param options - Configuration options
   * @param options.store - The key-value store implementation to use
   * @param options.namespace - Optional namespace prefix for file isolation
   */
  constructor(options: PersistentBackendOptions) {
    this.store = options.store;
    this.namespacePrefix = options.namespace || "default";
  }

  /**
   * Get the namespace for store operations.
   */
  protected getNamespace(): string[] {
    return [this.namespacePrefix, "filesystem"];
  }

  /**
   * Convert a store value to FileData format.
   */
  private convertToFileData(value: Record<string, unknown>): FileData {
    if (
      !value.content ||
      !Array.isArray(value.content) ||
      typeof value.created_at !== "string" ||
      typeof value.modified_at !== "string"
    ) {
      throw new Error(
        `Store item does not contain valid FileData fields. Got keys: ${Object.keys(value).join(", ")}`
      );
    }

    return {
      content: value.content as string[],
      created_at: value.created_at,
      modified_at: value.modified_at,
    };
  }

  /**
   * Convert FileData to a value suitable for store.put().
   */
  private convertFromFileData(fileData: FileData): Record<string, unknown> {
    return {
      content: fileData.content,
      created_at: fileData.created_at,
      modified_at: fileData.modified_at,
    };
  }

  /**
   * List files and directories in the specified directory (non-recursive).
   */
  async lsInfo(path: string): Promise<FileInfo[]> {
    const namespace = this.getNamespace();
    const items = await this.store.list(namespace);
    const infos: FileInfo[] = [];
    const subdirs = new Set<string>();

    // Normalize path to have trailing slash for proper prefix matching
    const normalizedPath = path.endsWith("/") ? path : path + "/";

    for (const item of items) {
      const itemKey = item.key;

      // Check if file is in the specified directory or a subdirectory
      if (!itemKey.startsWith(normalizedPath)) {
        continue;
      }

      // Get the relative path after the directory
      const relative = itemKey.substring(normalizedPath.length);

      // If relative path contains '/', it's in a subdirectory
      if (relative.includes("/")) {
        // Extract the immediate subdirectory name
        const subdirName = relative.split("/")[0];
        subdirs.add(normalizedPath + subdirName + "/");
        continue;
      }

      // This is a file directly in the current directory
      try {
        const fd = this.convertToFileData(item.value);
        const size = fd.content.join("\n").length;
        infos.push({
          path: itemKey,
          is_dir: false,
          size: size,
          modified_at: fd.modified_at,
        });
      } catch {
        // Skip invalid items
        continue;
      }
    }

    // Add directories to the results
    for (const subdir of Array.from(subdirs).sort()) {
      infos.push({
        path: subdir,
        is_dir: true,
        size: 0,
        modified_at: "",
      });
    }

    infos.sort((a, b) => a.path.localeCompare(b.path));
    return infos;
  }

  /**
   * Read file content with line numbers.
   */
  async read(
    filePath: string,
    offset: number = 0,
    limit: number = 2000
  ): Promise<string> {
    try {
      const fileData = await this.readRaw(filePath);
      return formatReadResponse(fileData, offset, limit);
    } catch (e: unknown) {
      const error = e as Error;
      return `Error: ${error.message}`;
    }
  }

  /**
   * Read file content as raw FileData.
   */
  async readRaw(filePath: string): Promise<FileData> {
    const namespace = this.getNamespace();
    const value = await this.store.get(namespace, filePath);

    if (!value) {
      throw new Error(`File '${filePath}' not found`);
    }

    return this.convertToFileData(value);
  }

  /**
   * Create a new file with content.
   */
  async write(filePath: string, content: string): Promise<WriteResult> {
    const namespace = this.getNamespace();

    // Check if file exists
    const existing = await this.store.get(namespace, filePath);
    if (existing) {
      return {
        success: false,
        error: FILE_ALREADY_EXISTS(filePath),
      };
    }

    // Create new file
    const fileData = createFileData(content);
    const storeValue = this.convertFromFileData(fileData);
    await this.store.put(namespace, filePath, storeValue);
    return { success: true, path: filePath };
  }

  /**
   * Edit a file by replacing string occurrences.
   */
  async edit(
    filePath: string,
    oldString: string,
    newString: string,
    replaceAll: boolean = false
  ): Promise<EditResult> {
    const namespace = this.getNamespace();

    // Get existing file
    const value = await this.store.get(namespace, filePath);
    if (!value) {
      return { success: false, error: FILE_NOT_FOUND(filePath) };
    }

    try {
      const fileData = this.convertToFileData(value);
      const content = fileDataToString(fileData);
      const result = performStringReplacement(
        content,
        oldString,
        newString,
        replaceAll
      );

      if (typeof result === "string") {
        return { success: false, error: result };
      }

      const [newContent, occurrences] = result;
      const newFileData = updateFileData(fileData, newContent);

      // Update file in store
      const storeValue = this.convertFromFileData(newFileData);
      await this.store.put(namespace, filePath, storeValue);
      return { success: true, path: filePath, occurrences };
    } catch (e: unknown) {
      const error = e as Error;
      return { success: false, error: `Error: ${error.message}` };
    }
  }

  /**
   * Structured search results or error string for invalid input.
   */
  async grepRaw(
    pattern: string,
    path: string = "/",
    glob: string | null = null
  ): Promise<GrepMatch[] | string> {
    const namespace = this.getNamespace();
    const items = await this.store.list(namespace);

    const files: Record<string, FileData> = {};
    for (const item of items) {
      try {
        files[item.key] = this.convertToFileData(item.value);
      } catch {
        // Skip invalid items
        continue;
      }
    }

    return grepMatchesFromFiles(files, pattern, path, glob);
  }

  /**
   * Structured glob matching returning FileInfo objects.
   */
  async globInfo(pattern: string, path: string = "/"): Promise<FileInfo[]> {
    const namespace = this.getNamespace();
    const items = await this.store.list(namespace);

    const files: Record<string, FileData> = {};
    for (const item of items) {
      try {
        files[item.key] = this.convertToFileData(item.value);
      } catch {
        // Skip invalid items
        continue;
      }
    }

    const result = globSearchFiles(files, pattern, path);
    if (result === "No files found") {
      return [];
    }

    const paths = result.split("\n");
    const infos: FileInfo[] = [];
    for (const p of paths) {
      const fd = files[p];
      const size = fd ? fd.content.join("\n").length : 0;
      infos.push({
        path: p,
        is_dir: false,
        size: size,
        modified_at: fd?.modified_at || "",
      });
    }
    return infos;
  }

  /**
   * Delete a file.
   */
  async deleteFile(filePath: string): Promise<{ error?: string }> {
    const namespace = this.getNamespace();
    const existing = await this.store.get(namespace, filePath);

    if (!existing) {
      return { error: `File '${filePath}' not found` };
    }

    await this.store.delete(namespace, filePath);
    return {};
  }
}

