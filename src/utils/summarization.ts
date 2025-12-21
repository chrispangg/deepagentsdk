/**
 * Conversation summarization utility.
 *
 * Automatically summarizes older messages when approaching token limits
 * to prevent context overflow while preserving important context.
 */

import { generateText, type LanguageModel } from "ai";
import type { ModelMessage } from "../types.js";
import { estimateTokens } from "./eviction.js";

/**
 * Default token threshold before triggering summarization.
 * 170k tokens is a safe threshold for most models.
 */
export const DEFAULT_SUMMARIZATION_THRESHOLD = 170000;

/**
 * Default number of recent messages to keep intact.
 */
export const DEFAULT_KEEP_MESSAGES = 6;

/**
 * Options for summarization.
 */
export interface SummarizationOptions {
  /** Model to use for summarization (AI SDK LanguageModel instance) */
  model: LanguageModel;
  /** Token threshold to trigger summarization (default: 170000) */
  tokenThreshold?: number;
  /** Number of recent messages to keep intact (default: 6) */
  keepMessages?: number;
  /** Generation options to pass through */
  generationOptions?: any;
  /** Advanced options to pass through */
  advancedOptions?: any;
}

/**
 * Result of summarization check.
 */
export interface SummarizationResult {
  /** Whether summarization was needed */
  summarized: boolean;
  /** The processed messages (either original or with summary) */
  messages: ModelMessage[];
  /** Token count before processing */
  tokensBefore?: number;
  /** Token count after processing */
  tokensAfter?: number;
}

/**
 * Estimate total tokens in a messages array.
 */
export function estimateMessagesTokens(messages: ModelMessage[]): number {
  let total = 0;

  for (const message of messages) {
    if (typeof message.content === "string") {
      total += estimateTokens(message.content);
    } else if (Array.isArray(message.content)) {
      for (const part of message.content) {
        if (typeof part === "object" && part !== null && "text" in part) {
          total += estimateTokens(String(part.text));
        }
      }
    }
  }

  return total;
}

/**
 * Extract text content from a message.
 */
function getMessageText(message: ModelMessage): string {
  if (typeof message.content === "string") {
    return message.content;
  }

  if (Array.isArray(message.content)) {
    return message.content
      .map((part) => {
        if (typeof part === "object" && part !== null && "text" in part) {
          return String(part.text);
        }
        if (typeof part === "object" && part !== null && "type" in part) {
          if (part.type === "tool-call") {
            return `[Tool call: ${(part as { toolName?: string }).toolName || "unknown"}]`;
          }
          if (part.type === "tool-result") {
            return `[Tool result]`;
          }
        }
        return "";
      })
      .filter(Boolean)
      .join("\n");
  }

  return "";
}

/**
 * Format messages for summarization prompt.
 */
function formatMessagesForSummary(messages: ModelMessage[]): string {
  return messages
    .map((msg) => {
      const role = msg.role === "user" ? "User" : msg.role === "assistant" ? "Assistant" : "System";
      const text = getMessageText(msg);
      return `${role}: ${text}`;
    })
    .join("\n\n");
}

/**
 * Generate a summary of conversation messages.
 */
async function generateSummary(
  messages: ModelMessage[],
  model: LanguageModel,
  generationOptions?: any,
  advancedOptions?: any
): Promise<string> {
  const conversationText = formatMessagesForSummary(messages);

  const generateTextOptions: any = {
    model,
    system: `You are a conversation summarizer. Your task is to create a concise but comprehensive summary of the conversation that preserves:
1. Key decisions and conclusions
2. Important context and background information
3. Any tasks or todos mentioned
4. Technical details that may be referenced later
5. The overall flow and progression of the conversation

Keep the summary focused and avoid redundancy. The summary should allow someone to understand the conversation context without reading the full history.`,
    prompt: `Please summarize the following conversation:\n\n${conversationText}`,
  };

  // Add passthrough options
  if (generationOptions) {
    Object.assign(generateTextOptions, generationOptions);
  }
  if (advancedOptions) {
    Object.assign(generateTextOptions, advancedOptions);
  }

  const result = await generateText(generateTextOptions);
  return result.text;
}

/**
 * Summarize older messages when approaching token limits.
 *
 * This function checks if the total tokens in the messages exceed the threshold.
 * If so, it summarizes older messages while keeping recent ones intact.
 *
 * @param messages - Array of conversation messages
 * @param options - Summarization options
 * @returns Processed messages with optional summary
 *
 * @example
 * ```typescript
 * import { anthropic } from '@ai-sdk/anthropic';
 *
 * const result = await summarizeIfNeeded(messages, {
 *   model: anthropic('claude-haiku-4-5-20251001'),
 *   tokenThreshold: 170000,
 *   keepMessages: 6,
 * });
 *
 * if (result.summarized) {
 *   console.log(`Reduced from ${result.tokensBefore} to ${result.tokensAfter} tokens`);
 * }
 * ```
 */
export async function summarizeIfNeeded(
  messages: ModelMessage[],
  options: SummarizationOptions
): Promise<SummarizationResult> {
  const {
    model,
    tokenThreshold = DEFAULT_SUMMARIZATION_THRESHOLD,
    keepMessages = DEFAULT_KEEP_MESSAGES,
  } = options;

  // Estimate current token count
  const tokensBefore = estimateMessagesTokens(messages);

  // Check if summarization is needed
  if (tokensBefore < tokenThreshold) {
    return {
      summarized: false,
      messages,
      tokensBefore,
    };
  }

  // Not enough messages to summarize
  if (messages.length <= keepMessages) {
    return {
      summarized: false,
      messages,
      tokensBefore,
    };
  }

  // Split messages: older ones to summarize, recent ones to keep
  const messagesToSummarize = messages.slice(0, -keepMessages);
  const messagesToKeep = messages.slice(-keepMessages);

  // Generate summary
  const summary = await generateSummary(
    messagesToSummarize,
    model,
    options.generationOptions,
    options.advancedOptions
  );

  // Create summary message
  const summaryMessage: ModelMessage = {
    role: "system",
    content: `[Previous conversation summary]\n${summary}\n\n[End of summary - recent messages follow]`,
  } as ModelMessage;

  // Combine summary with recent messages
  const newMessages = [summaryMessage, ...messagesToKeep];
  const tokensAfter = estimateMessagesTokens(newMessages);

  return {
    summarized: true,
    messages: newMessages,
    tokensBefore,
    tokensAfter,
  };
}

/**
 * Check if messages need summarization without performing it.
 */
export function needsSummarization(
  messages: ModelMessage[],
  tokenThreshold: number = DEFAULT_SUMMARIZATION_THRESHOLD
): boolean {
  const tokens = estimateMessagesTokens(messages);
  return tokens >= tokenThreshold;
}

