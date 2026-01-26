/**
 * Tests for src/utils/summarization.ts
 */

import { test, describe, mock } from "node:test";
import assert from "node:assert/strict";
import type { LanguageModel } from "ai";
import type { ModelMessage } from "@/types";
import {
  estimateMessagesTokens,
  summarizeIfNeeded,
  needsSummarization,
  DEFAULT_SUMMARIZATION_THRESHOLD,
  DEFAULT_KEEP_MESSAGES,
} from "@/utils/summarization";

// Mock the generateText function from AI SDK
const mockGenerateText = mock.fn(() =>
  Promise.resolve({
    text: "Summary: Conversation about testing",
    usage: { promptTokens: 100, completionTokens: 20 },
  })
);

// Create a mock LanguageModel
const mockModel = {
  provider: "test",
  modelId: "test-model",
} as unknown as LanguageModel;

describe("utils/summarization", () => {
  describe("estimateMessagesTokens", () => {
    test("should estimate tokens for string content messages", () => {
      const messages: ModelMessage[] = [
        { role: "user", content: "Hello world" },
        { role: "assistant", content: "Hi there!" },
      ];
      const result = estimateMessagesTokens(messages);
      assert.ok(result > 0);
      assert.strictEqual(typeof result, "number");
    });

    test("should handle array content messages", () => {
      const messages: ModelMessage[] = [
        {
          role: "user",
          content: [
            { type: "text", text: "Hello" },
            { type: "text", text: " world" },
          ],
        },
      ];
      const result = estimateMessagesTokens(messages);
      assert.ok(result > 0);
    });

    test("should handle mixed content types", () => {
      const messages: ModelMessage[] = [
        {
          role: "user",
          content: [
            { type: "text", text: "Call this function" },
            {
              type: "tool-call",
              toolName: "testTool",
              toolCallId: "123",
              args: "{}",
            } as any,
          ],
        },
      ];
      const result = estimateMessagesTokens(messages);
      assert.ok(result > 0);
    });

    test("should handle empty content array", () => {
      const messages: ModelMessage[] = [
        { role: "user", content: [] },
      ];
      const result = estimateMessagesTokens(messages);
      assert.strictEqual(result, 0);
    });

    test("should handle empty messages array", () => {
      const result = estimateMessagesTokens([]);
      assert.strictEqual(result, 0);
    });

    test("should handle tool results in array content", () => {
      const messages: ModelMessage[] = [
        {
          role: "tool",
          content: [
            { type: "tool-result", toolCallId: "123", result: null } as any,
          ],
        },
      ];
      const result = estimateMessagesTokens(messages);
      // The getMessageText returns "[Tool result]" which has fixed length
      // So we check that it returns a number (could be 0 for very short strings)
      assert.strictEqual(typeof result, "number");
    });
  });

  describe("needsSummarization", () => {
    test("should return false for small token counts", () => {
      const messages: ModelMessage[] = [
        { role: "user", content: "Small message" },
      ];
      const result = needsSummarization(messages);
      assert.strictEqual(result, false);
    });

    test("should return true for large token counts", () => {
      // Create a very long message that exceeds threshold
      // estimateTokens is roughly 1 token per 4 characters, so we need ~680k characters
      const longContent = "A".repeat(700000);
      const messages: ModelMessage[] = [
        { role: "user", content: longContent },
      ];
      const result = needsSummarization(messages, DEFAULT_SUMMARIZATION_THRESHOLD);
      assert.strictEqual(result, true);
    });

    test("should use custom threshold", () => {
      // estimateTokens is roughly 1 token per 4 characters
      // So we need ~40 characters to exceed threshold of 10
      const messages: ModelMessage[] = [
        { role: "user", content: "This is a much longer test message that should exceed the token threshold" },
      ];
      const result = needsSummarization(messages, 10); // Very low threshold
      assert.strictEqual(result, true);
    });

    test("should use default threshold when not specified", () => {
      const messages: ModelMessage[] = [
        { role: "user", content: "Test message" },
      ];
      const result = needsSummarization(messages);
      assert.strictEqual(result, false);
    });
  });

  describe("summarizeIfNeeded", () => {
    // We need to mock the AI SDK's generateText at module level
    // For now, we'll test the logic without actual LLM calls

    test("should return original messages when under threshold", async () => {
      const messages: ModelMessage[] = [
        { role: "user", content: "Small message" },
        { role: "assistant", content: "Response" },
      ];

      // Create a real model but with small threshold to avoid summarization
      const result = await summarizeIfNeeded(messages, {
        model: mockModel,
        tokenThreshold: 1000000, // Very high threshold
      });

      assert.strictEqual(result.summarized, false);
      assert.deepStrictEqual(result.messages, messages);
      assert.notStrictEqual(result.tokensBefore, undefined);
      assert.strictEqual(result.tokensAfter, undefined);
    });

    test("should return original when not enough messages to keep", async () => {
      const messages: ModelMessage[] = [
        { role: "user", content: "Single message" },
      ];

      const result = await summarizeIfNeeded(messages, {
        model: mockModel,
        tokenThreshold: 0, // Trigger summarization
        keepMessages: 6, // More messages than we have
      });

      assert.strictEqual(result.summarized, false);
      assert.deepStrictEqual(result.messages, messages);
    });

    test("should include token counts when not summarizing", () => {
      const messages: ModelMessage[] = [
        { role: "user", content: "Test" },
      ];

      return summarizeIfNeeded(messages, {
        model: mockModel,
        tokenThreshold: 1000000,
      }).then((result) => {
        assert.notStrictEqual(result.tokensBefore, undefined);
        assert.strictEqual(typeof result.tokensBefore, "number");
      });
    });

    test("should use custom token threshold", async () => {
      const messages: ModelMessage[] = [
        { role: "user", content: "Test" },
      ];

      const result = await summarizeIfNeeded(messages, {
        model: mockModel,
        tokenThreshold: 1, // Very low, should not trigger for short message
        keepMessages: 2,
      });

      // Should not summarize since message is still small
      assert.strictEqual(result.summarized, false);
    });

    test("should use custom keepMessages value", async () => {
      const messages: ModelMessage[] = [
        { role: "user", content: "Message 1" },
        { role: "assistant", content: "Response 1" },
        { role: "user", content: "Message 2" },
      ];

      const result = await summarizeIfNeeded(messages, {
        model: mockModel,
        tokenThreshold: 1000000,
        keepMessages: 10,
      });

      assert.strictEqual(result.summarized, false);
      assert.deepStrictEqual(result.messages, messages);
    });

    test("should handle generationOptions parameter", async () => {
      const messages: ModelMessage[] = [
        { role: "user", content: "Test" },
      ];

      const result = await summarizeIfNeeded(messages, {
        model: mockModel,
        tokenThreshold: 1000000,
        generationOptions: { temperature: 0.5 },
      });

      assert.strictEqual(result.summarized, false);
    });

    test("should handle advancedOptions parameter", async () => {
      const messages: ModelMessage[] = [
        { role: "user", content: "Test" },
      ];

      const result = await summarizeIfNeeded(messages, {
        model: mockModel,
        tokenThreshold: 1000000,
        advancedOptions: { maxTokens: 1000 },
      });

      assert.strictEqual(result.summarized, false);
    });
  });

  describe("constants", () => {
    test("DEFAULT_SUMMARIZATION_THRESHOLD should be 170000", () => {
      assert.strictEqual(DEFAULT_SUMMARIZATION_THRESHOLD, 170000);
    });

    test("DEFAULT_KEEP_MESSAGES should be 6", () => {
      assert.strictEqual(DEFAULT_KEEP_MESSAGES, 6);
    });
  });
});
