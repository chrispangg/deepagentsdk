/**
 * Integration tests for AI SDK Elements server-side adapter
 *
 * These tests verify that the createElementsRouteHandler works correctly
 * with real API calls (requires ANTHROPIC_API_KEY).
 */

import { test, expect, describe } from "bun:test";
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

// Skip all tests if no API key
const SKIP = !process.env.ANTHROPIC_API_KEY;

describe("createElementsRouteHandler", () => {
  test.skipIf(SKIP)("handles basic chat request", async () => {
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

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toContain("text/event-stream");

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

    expect(receivedText).toBe(true);
  });

  test.skipIf(SKIP)("handles onRequest hook", async () => {
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

    expect(hookCalled).toBe(true);
  });

  test.skipIf(SKIP)("rejects request when onRequest throws", async () => {
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

    expect(response.status).toBe(401);
    const body = await response.json();
    expect(body.error).toBe("Unauthorized");
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

    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body.error).toBe("Invalid JSON body");
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

    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body.error).toBe("messages array is required");
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

    expect(modelMessages.length).toBeGreaterThan(0);
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
    expect(result).toBe("Last message");
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
    expect(result).toBeUndefined();
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

    expect(hasToolParts(messagesWithTools)).toBe(true);
    expect(hasToolParts(messagesWithoutTools)).toBe(false);
  });

  test("countMessagesByRole counts correctly", () => {
    const messages: UIMessage[] = [
      { id: "1", role: "user", parts: [{ type: "text", text: "Hi" }] },
      { id: "2", role: "assistant", parts: [{ type: "text", text: "Hello" }] },
      { id: "3", role: "user", parts: [{ type: "text", text: "How are you?" }] },
      { id: "4", role: "assistant", parts: [{ type: "text", text: "Good" }] },
    ];

    const counts = countMessagesByRole(messages);

    expect(counts.user).toBe(2);
    expect(counts.assistant).toBe(2);
    expect(counts.system).toBe(0);
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
    expect(text).toBe("Part 1. Part 2.");
  });
});
