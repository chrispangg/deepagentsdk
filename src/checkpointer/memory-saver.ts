/**
 * In-memory checkpoint saver for testing and single-session use.
 */

import type { Checkpoint, BaseCheckpointSaver, CheckpointSaverOptions } from "./types";

/**
 * In-memory checkpoint saver.
 * 
 * Stores checkpoints in a Map. Data is lost when the process exits.
 * Useful for testing or single-session applications.
 * 
 * @example
 * ```typescript
 * const saver = new MemorySaver();
 * const agent = createDeepAgent({
 *   model: anthropic('claude-sonnet-4-20250514'),
 *   checkpointer: saver,
 * });
 * ```
 */
export class MemorySaver implements BaseCheckpointSaver {
  private checkpoints = new Map<string, Checkpoint>();
  private namespace: string;

  constructor(options: CheckpointSaverOptions = {}) {
    this.namespace = options.namespace || "default";
  }

  private getKey(threadId: string): string {
    return `${this.namespace}:${threadId}`;
  }

  async save(checkpoint: Checkpoint): Promise<void> {
    const key = this.getKey(checkpoint.threadId);
    this.checkpoints.set(key, {
      ...checkpoint,
      updatedAt: new Date().toISOString(),
    });
  }

  async load(threadId: string): Promise<Checkpoint | undefined> {
    const key = this.getKey(threadId);
    return this.checkpoints.get(key);
  }

  async list(): Promise<string[]> {
    const prefix = `${this.namespace}:`;
    const threadIds: string[] = [];
    for (const key of this.checkpoints.keys()) {
      if (key.startsWith(prefix)) {
        threadIds.push(key.substring(prefix.length));
      }
    }
    return threadIds;
  }

  async delete(threadId: string): Promise<void> {
    const key = this.getKey(threadId);
    this.checkpoints.delete(key);
  }

  async exists(threadId: string): Promise<boolean> {
    const key = this.getKey(threadId);
    return this.checkpoints.has(key);
  }

  /**
   * Clear all checkpoints (useful for testing).
   */
  clear(): void {
    this.checkpoints.clear();
  }

  /**
   * Get the number of stored checkpoints.
   */
  size(): number {
    return this.checkpoints.size;
  }
}

