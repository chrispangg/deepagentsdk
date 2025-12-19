/**
 * File-based checkpoint saver for local development.
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync, unlinkSync, readdirSync } from "node:fs";
import { join } from "node:path";
import type { Checkpoint, BaseCheckpointSaver } from "./types";

/**
 * Options for FileSaver.
 */
export interface FileSaverOptions {
  /** Directory to store checkpoint files */
  dir: string;
}

/**
 * File-based checkpoint saver.
 * 
 * Stores checkpoints as JSON files in a directory. Each thread gets
 * its own file named `{threadId}.json`.
 * 
 * @example
 * ```typescript
 * const saver = new FileSaver({ dir: './.checkpoints' });
 * const agent = createDeepAgent({
 *   model: anthropic('claude-sonnet-4-20250514'),
 *   checkpointer: saver,
 * });
 * ```
 */
export class FileSaver implements BaseCheckpointSaver {
  private dir: string;

  constructor(options: FileSaverOptions) {
    this.dir = options.dir;
    
    // Ensure directory exists
    if (!existsSync(this.dir)) {
      mkdirSync(this.dir, { recursive: true });
    }
  }

  private getFilePath(threadId: string): string {
    // Sanitize threadId to be safe for filenames
    const safeId = threadId.replace(/[^a-zA-Z0-9_-]/g, '_');
    return join(this.dir, `${safeId}.json`);
  }

  async save(checkpoint: Checkpoint): Promise<void> {
    const filePath = this.getFilePath(checkpoint.threadId);
    const data = {
      ...checkpoint,
      updatedAt: new Date().toISOString(),
    };
    writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf-8');
  }

  async load(threadId: string): Promise<Checkpoint | undefined> {
    const filePath = this.getFilePath(threadId);
    
    if (!existsSync(filePath)) {
      return undefined;
    }
    
    try {
      const content = readFileSync(filePath, 'utf-8');
      return JSON.parse(content) as Checkpoint;
    } catch {
      return undefined;
    }
  }

  async list(): Promise<string[]> {
    if (!existsSync(this.dir)) {
      return [];
    }
    
    const files = readdirSync(this.dir);
    return files
      .filter(f => f.endsWith('.json'))
      .map(f => f.replace('.json', ''));
  }

  async delete(threadId: string): Promise<void> {
    const filePath = this.getFilePath(threadId);
    
    if (existsSync(filePath)) {
      unlinkSync(filePath);
    }
  }

  async exists(threadId: string): Promise<boolean> {
    const filePath = this.getFilePath(threadId);
    return existsSync(filePath);
  }
}

