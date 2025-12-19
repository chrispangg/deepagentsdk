/**
 * Type definitions for checkpointer support.
 */

import type { DeepAgentState, ModelMessage } from "../types";

/**
 * Data stored in a checkpoint.
 * Contains everything needed to resume an agent session.
 */
export interface Checkpoint {
  /** Unique identifier for the conversation thread */
  threadId: string;
  
  /** Step number when this checkpoint was created */
  step: number;
  
  /** Conversation history (serialized messages) */
  messages: ModelMessage[];
  
  /** Agent state (todos and StateBackend files) */
  state: DeepAgentState;
  
  /** 
   * Interrupt data if the agent was paused mid-execution.
   * Present when waiting for tool approval.
   */
  interrupt?: InterruptData;
  
  /** ISO 8601 timestamp when checkpoint was created */
  createdAt: string;
  
  /** ISO 8601 timestamp when checkpoint was last updated */
  updatedAt: string;
}

/**
 * Data about an interrupted tool execution.
 * Used to resume from approval requests.
 */
export interface InterruptData {
  /** The tool call that requires approval */
  toolCall: {
    toolCallId: string;
    toolName: string;
    args: unknown;
  };
  
  /** Step number where interrupt occurred */
  step: number;
}

/**
 * Decision to resume from an interrupt.
 */
export interface ResumeDecision {
  /** Type of decision */
  type: 'approve' | 'deny';
  
  /** Optional modified arguments (for future "edit" feature) */
  modifiedArgs?: unknown;
}

/**
 * Options for resuming from a checkpoint.
 */
export interface ResumeOptions {
  /** Decisions for pending tool approvals */
  decisions: ResumeDecision[];
}

/**
 * Interface for checkpoint storage implementations.
 * 
 * Implement this interface to use any storage backend (memory, files,
 * Redis, database, etc.) for persisting checkpoints.
 */
export interface BaseCheckpointSaver {
  /**
   * Save a checkpoint.
   * If a checkpoint for the threadId already exists, it is overwritten.
   * 
   * @param checkpoint - The checkpoint data to save
   */
  save(checkpoint: Checkpoint): Promise<void>;
  
  /**
   * Load the latest checkpoint for a thread.
   * 
   * @param threadId - The thread identifier
   * @returns The checkpoint, or undefined if not found
   */
  load(threadId: string): Promise<Checkpoint | undefined>;
  
  /**
   * List all thread IDs with saved checkpoints.
   * 
   * @returns Array of thread IDs
   */
  list(): Promise<string[]>;
  
  /**
   * Delete a checkpoint.
   * 
   * @param threadId - The thread identifier to delete
   */
  delete(threadId: string): Promise<void>;
  
  /**
   * Check if a checkpoint exists for a thread.
   * 
   * @param threadId - The thread identifier
   * @returns True if checkpoint exists
   */
  exists(threadId: string): Promise<boolean>;
}

/**
 * Options for creating a checkpoint saver.
 */
export interface CheckpointSaverOptions {
  /** Optional namespace prefix for isolation */
  namespace?: string;
}

