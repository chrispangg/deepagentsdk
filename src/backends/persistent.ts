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

/**
 * Generic key-value store interface for persistent storage.
 *
 * Implement this interface to use any storage backend (Redis, SQLite, etc.)
 */
export interface KeyValueStore {
  /**
   * Get a value by key.
   * @param namespace - Hierarchical namespace (e.g., ["files", "project1"])
   * @param key - The key to retrieve
   * @returns The stored value or undefined if not found
   */
  get(namespace: string[], key: string): Promise<Record<string, unknown> | undefined>;

  /**
   * Store a value by key.
   * @param namespace - Hierarchical namespace
   * @param key - The key to store
   * @param value - The value to store
   */
  put(namespace: string[], key: string, value: Record<string, unknown>): Promise<void>;

  /**
   * Delete a value by key.
   * @param namespace - Hierarchical namespace
   * @param key - The key to delete
   */
  delete(namespace: string[], key: string): Promise<void>;

  /**
   * List all keys in a namespace.
   * @param namespace - Hierarchical namespace
   * @returns Array of items with key and value
   */
  list(namespace: string[]): Promise<Array<{ key: string; value: Record<string, unknown> }>>;
}

/**
 * Simple in-memory implementation of KeyValueStore.
 * Useful for testing or single-session persistence.
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
  /** The key-value store to use */
  store: KeyValueStore;
  /** Optional namespace prefix for isolation (e.g., project ID, user ID) */
  namespace?: string;
}

/**
 * Backend that stores files in a persistent key-value store.
 *
 * This provides cross-conversation file persistence that survives
 * between agent sessions.
 */
export class PersistentBackend implements BackendProtocol {
  private store: KeyValueStore;
  private namespacePrefix: string;

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
        error: `Cannot write to ${filePath} because it already exists. Read and then make an edit, or write to a new path.`,
      };
    }

    // Create new file
    const fileData = createFileData(content);
    const storeValue = this.convertFromFileData(fileData);
    await this.store.put(namespace, filePath, storeValue);
    return { path: filePath };
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
      return { error: `Error: File '${filePath}' not found` };
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
        return { error: result };
      }

      const [newContent, occurrences] = result;
      const newFileData = updateFileData(fileData, newContent);

      // Update file in store
      const storeValue = this.convertFromFileData(newFileData);
      await this.store.put(namespace, filePath, storeValue);
      return { path: filePath, occurrences };
    } catch (e: unknown) {
      const error = e as Error;
      return { error: `Error: ${error.message}` };
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

