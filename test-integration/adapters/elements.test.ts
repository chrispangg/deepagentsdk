/**
 * Integration tests for AI SDK Elements server-side adapter
 *
 * These tests verify that the createElementsRouteHandler works correctly
 * with real API calls (requires ANTHROPIC_API_KEY).
 */

import { test, describe } from "node:test";
import { anthropic } from "@ai-sdk/anthropic";
import { createDeepAgent } from "@/agent";
import {
  createElementsRouteHandler,
  convertUIMessagesToModelMessages,
  extractLastUserMessage,
  hasToolParts,
  countMessagesByRole,
  extractTextFromMessage,
} from "@/adapters/elements";
import type { UIMessage } from "ai";
import assert from "node:assert/strict";

type TestCallback = () => void | Promise<void>;
type TestOptions = { timeout?: number } & Record<string, unknown>;

const skipIf = (condition: boolean) => {
  const runner = condition ? test.skip : test;
  return (name: string, fn: TestCallback, options?: TestOptions) => {
    if (options) {
      runner(name, options, fn);
      return;
    }
    runner(name, fn);
  };
};

// Skip all tests if no API key
const SKIP = !process.env.ANTHROPIC_API_KEY;

describe("createElementsRouteHandler", () => {
  skipIf(SKIP)("handles basic chat request", async () => {
    const agent = createDeepAgent({
      model: anthropic("claude-haiku-4-5-20251001"),
      maxSteps: 3,
    });

    const handler = createElementsRouteHandler({ agent });

    const messages: UIMessage[] = [
      {
        id: "1",
        role: "user",
        parts: [{ type: "text", text: "Say hello in exactly 3 words." }],
      },
    ];

    const request = new Request("http://localhost/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ messages }),
    });

    const response = await handler(request);

    assert.strictEqual(response.status, 200);
    assert.ok(response.headers.get("content-type")?.includes("text/event-stream"));

    // Read the stream
    const reader = response.body?.getReader();
    if (!reader) throw new Error("No response body");

    let receivedText = false;
    const decoder = new TextDecoder();

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      const chunk = decoder.decode(value);
      if (chunk.includes("text-delta")) {
        receivedText = true;
      }
    }

    assert.strictEqual(receivedText, true);
  });

  skipIf(SKIP)("handles onRequest hook", async () => {
    const agent = createDeepAgent({
      model: anthropic("claude-haiku-4-5-20251001"),
      maxSteps: 1,
    });

    let hookCalled = false;

    const handler = createElementsRouteHandler({
      agent,
      onRequest: async () => {
        hookCalled = true;
      },
    });

    const messages: UIMessage[] = [
      {
        id: "1",
        role: "user",
        parts: [{ type: "text", text: "Hi" }],
      },
    ];

    const request = new Request("http://localhost/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ messages }),
    });

    await handler(request);

    assert.strictEqual(hookCalled, true);
  });

  skipIf(SKIP)("rejects request when onRequest throws", async () => {
    const agent = createDeepAgent({
      model: anthropic("claude-haiku-4-5-20251001"),
      maxSteps: 1,
    });

    const handler = createElementsRouteHandler({
      agent,
      onRequest: async () => {
        throw new Error("Unauthorized");
      },
    });

    const messages: UIMessage[] = [
      {
        id: "1",
        role: "user",
        parts: [{ type: "text", text: "Hi" }],
      },
    ];

    const request = new Request("http://localhost/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ messages }),
    });

    const response = await handler(request);

    assert.strictEqual(response.status, 401);
    const body = await response.json();
    assert.strictEqual(body.error, "Unauthorized");
  });

  test("returns 400 for invalid JSON", async () => {
    const agent = createDeepAgent({
      model: anthropic("claude-haiku-4-5-20251001"),
      maxSteps: 1,
    });

    const handler = createElementsRouteHandler({ agent });

    const request = new Request("http://localhost/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "not json",
    });

    const response = await handler(request);

    assert.strictEqual(response.status, 400);
    const body = await response.json();
    assert.strictEqual(body.error, "Invalid JSON body");
  });

  test("returns 400 when messages array is missing", async () => {
    const agent = createDeepAgent({
      model: anthropic("claude-haiku-4-5-20251001"),
      maxSteps: 1,
    });

    const handler = createElementsRouteHandler({ agent });

    const request = new Request("http://localhost/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });

    const response = await handler(request);

    assert.strictEqual(response.status, 400);
    const body = await response.json();
    assert.strictEqual(body.error, "messages array is required");
  });
});

describe("Message conversion utilities", () => {
  test("convertUIMessagesToModelMessages converts messages", async () => {
    const uiMessages: UIMessage[] = [
      {
        id: "1",
        role: "user",
        parts: [{ type: "text", text: "Hello" }],
      },
    ];

    const modelMessages = await convertUIMessagesToModelMessages(uiMessages);

    assert.ok(modelMessages.length > 0);
  });

  test("extractLastUserMessage extracts text", () => {
    const messages: UIMessage[] = [
      {
        id: "1",
        role: "user",
        parts: [{ type: "text", text: "First message" }],
      },
      {
        id: "2",
        role: "assistant",
        parts: [{ type: "text", text: "Response" }],
      },
      {
        id: "3",
        role: "user",
        parts: [{ type: "text", text: "Last message" }],
      },
    ];

    const result = extractLastUserMessage(messages);
    assert.strictEqual(result, "Last message");
  });

  test("extractLastUserMessage returns undefined for no user messages", () => {
    const messages: UIMessage[] = [
      {
        id: "1",
        role: "assistant",
        parts: [{ type: "text", text: "Response" }],
      },
    ];

    const result = extractLastUserMessage(messages);
    assert.strictEqual(result, undefined);
  });

  test("hasToolParts detects tool parts", () => {
    const messagesWithTools: UIMessage[] = [
      {
        id: "1",
        role: "assistant",
        parts: [
          { type: "text", text: "Let me search" },
          // Dynamic tool part
          {
            type: "dynamic-tool",
            toolName: "search",
            toolCallId: "tc1",
            state: "input-available",
            input: { query: "test" },
          } as any,
        ],
      },
    ];

    const messagesWithoutTools: UIMessage[] = [
      {
        id: "1",
        role: "user",
        parts: [{ type: "text", text: "Hello" }],
      },
    ];

    assert.strictEqual(hasToolParts(messagesWithTools), true);
    assert.strictEqual(hasToolParts(messagesWithoutTools), false);
  });

  test("countMessagesByRole counts correctly", () => {
    const messages: UIMessage[] = [
      { id: "1", role: "user", parts: [{ type: "text", text: "Hi" }] },
      { id: "2", role: "assistant", parts: [{ type: "text", text: "Hello" }] },
      { id: "3", role: "user", parts: [{ type: "text", text: "How are you?" }] },
      { id: "4", role: "assistant", parts: [{ type: "text", text: "Good" }] },
    ];

    const counts = countMessagesByRole(messages);

    assert.strictEqual(counts.user, 2);
    assert.strictEqual(counts.assistant, 2);
    assert.strictEqual(counts.system, 0);
  });

  test("extractTextFromMessage extracts all text parts", () => {
    const message: UIMessage = {
      id: "1",
      role: "assistant",
      parts: [
        { type: "text", text: "Part 1. " },
        { type: "text", text: "Part 2." },
      ],
    };

    const text = extractTextFromMessage(message);
    assert.strictEqual(text, "Part 1. Part 2.");
  });
});

