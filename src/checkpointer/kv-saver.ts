/**
 * Checkpoint saver using KeyValueStore interface.
 * 
 * Allows using existing KeyValueStore implementations (Redis, etc.)
 * for checkpoint storage.
 */

import type { KeyValueStore } from "../backends/persistent";
import type { Checkpoint, BaseCheckpointSaver, CheckpointSaverOptions } from "./types";

/**
 * Options for KeyValueStoreSaver.
 */
export interface KeyValueStoreSaverOptions extends CheckpointSaverOptions {
  /** The KeyValueStore implementation to use */
  store: KeyValueStore;
}

/**
 * Checkpoint saver using KeyValueStore interface.
 * 
 * This adapter allows using any KeyValueStore implementation (Redis,
 * database, cloud storage, etc.) for checkpoint storage.
 * 
 * @example
 * ```typescript
 * import { InMemoryStore } from 'deepagentsdk';
 * 
 * const store = new InMemoryStore();
 * const saver = new KeyValueStoreSaver({ store });
 * const agent = createDeepAgent({
 *   model: anthropic('claude-sonnet-4-20250514'),
 *   checkpointer: saver,
 * });
 * ```
 * 
 * @example With Redis
 * ```typescript
 * const redisStore = new RedisStore(redisClient); // Your implementation
 * const saver = new KeyValueStoreSaver({ store: redisStore });
 * ```
 */
export class KeyValueStoreSaver implements BaseCheckpointSaver {
  private store: KeyValueStore;
  private namespace: string[];

  constructor(options: KeyValueStoreSaverOptions) {
    this.store = options.store;
    this.namespace = [options.namespace || "default", "checkpoints"];
  }

  async save(checkpoint: Checkpoint): Promise<void> {
    const data = {
      ...checkpoint,
      updatedAt: new Date().toISOString(),
    };
    await this.store.put(this.namespace, checkpoint.threadId, data as unknown as Record<string, unknown>);
  }

  async load(threadId: string): Promise<Checkpoint | undefined> {
    const data = await this.store.get(this.namespace, threadId);
    if (!data) {
      return undefined;
    }
    return data as unknown as Checkpoint;
  }

  async list(): Promise<string[]> {
    const items = await this.store.list(this.namespace);
    return items.map(item => item.key);
  }

  async delete(threadId: string): Promise<void> {
    await this.store.delete(this.namespace, threadId);
  }

  async exists(threadId: string): Promise<boolean> {
    const data = await this.store.get(this.namespace, threadId);
    return data !== undefined;
  }
}

