/**
 * Integration tests for checkpointer functionality.
 * 
 * These tests verify end-to-end checkpoint save/load behavior with a real agent.
 * Tests are skipped if ANTHROPIC_API_KEY is not set.
 */

import { test, beforeEach } from "node:test";
import { createDeepAgent, MemorySaver, FileSaver } from "@/index.ts";
import { createAnthropic } from '@ai-sdk/anthropic';
import { rmSync, existsSync } from "node:fs";
import assert from "node:assert/strict";

const anthropic = createAnthropic({
  baseURL: 'https://api.anthropic.com/v1',
});

// Skip tests if no API key
const hasApiKey = !!process.env.ANTHROPIC_API_KEY;
type TestCallback = () => void | Promise<void>;
const testWithApiKey = (
  name: string,
  fn: TestCallback,
  timeout?: number
) => {
  const runner = hasApiKey ? test : test.skip;
  if (timeout !== undefined) {
    runner(name, { timeout }, fn);
    return;
  }
  runner(name, fn);
};
const TEST_DIR = "./.test-integration-checkpoints";

// Helper to clean up test directory
function cleanupTestDir() {
  if (existsSync(TEST_DIR)) {
    rmSync(TEST_DIR, { recursive: true });
  }
}

beforeEach(() => {
  cleanupTestDir();
});

testWithApiKey("Checkpointer > saves and restores conversation state", async () => {
  const checkpointer = new MemorySaver();
  
  const agent = createDeepAgent({
    model: anthropic("claude-haiku-4-5-20251001"),
    checkpointer,
  });
  
  const threadId = "test-" + Date.now();
  let checkpointSaved = false;
  let checkpointLoaded = false;
  
  // First interaction
  for await (const event of agent.streamWithEvents({
    prompt: "Remember that my favorite color is blue",
    threadId,
  })) {
    if (event.type === 'checkpoint-saved') {
      checkpointSaved = true;
    }
  }
  
  assert.strictEqual(checkpointSaved, true);
  
  // Verify checkpoint exists
  const checkpoint = await checkpointer.load(threadId);
  assert.ok(checkpoint);
  assert.ok(checkpoint.messages);
  assert.ok(checkpoint.messages.length > 0);
  assert.strictEqual(checkpoint.threadId, threadId);
  
  // Second interaction - verify context is maintained
  let foundBlue = false;
  for await (const event of agent.streamWithEvents({
    prompt: "What is my favorite color?",
    threadId,
  })) {
    if (event.type === 'checkpoint-loaded') {
      checkpointLoaded = true;
    }
    if (event.type === "text" && event.text.toLowerCase().includes("blue")) {
      foundBlue = true;
    }
  }
  
  assert.strictEqual(checkpointLoaded, true);
  assert.strictEqual(foundBlue, true);
}, 30000); // 30 second timeout for API calls

testWithApiKey("Checkpointer > preserves todos across invocations", async () => {
  const checkpointer = new MemorySaver();
  
  const agent = createDeepAgent({
    model: anthropic("claude-haiku-4-5-20251001"),
    checkpointer,
  });
  
  const threadId = "test-todos-" + Date.now();
  let todosCreated = false;
  
  // First interaction - create todos
  for await (const event of agent.streamWithEvents({
    prompt: "Create a todo list with 3 items for building a web app",
    threadId,
  })) {
    if (event.type === 'todos-changed' && event.todos.length > 0) {
      todosCreated = true;
    }
  }
  
  assert.strictEqual(todosCreated, true);
  
  // Verify todos in checkpoint
  const checkpoint1 = await checkpointer.load(threadId);
  assert.ok(checkpoint1);
  assert.ok(checkpoint1.state.todos);
  assert.ok(checkpoint1.state.todos.length > 0);
  const todoCount = checkpoint1.state.todos.length;
  
  // Second interaction - todos should still be there
  let todosStillPresent = false;
  for await (const event of agent.streamWithEvents({
    prompt: "How many todos do we have?",
    threadId,
  })) {
    if (event.type === 'done') {
      todosStillPresent = event.state.todos.length === todoCount;
    }
  }
  
  assert.strictEqual(todosStillPresent, true);
}, 30000);

testWithApiKey("Checkpointer > thread isolation works correctly", async () => {
  const checkpointer = new MemorySaver();
  
  const agent = createDeepAgent({
    model: anthropic("claude-haiku-4-5-20251001"),
    checkpointer,
  });
  
  const threadA = "test-a-" + Date.now();
  const threadB = "test-b-" + Date.now();
  
  // Create separate contexts in two threads
  for await (const event of agent.streamWithEvents({
    prompt: "Remember: we're working on Project Alpha",
    threadId: threadA,
  })) {
    // Just consume events
  }
  
  for await (const event of agent.streamWithEvents({
    prompt: "Remember: we're working on Project Beta",
    threadId: threadB,
  })) {
    // Just consume events
  }
  
  // Verify threads are isolated
  let foundAlpha = false;
  let foundBeta = false;
  
  for await (const event of agent.streamWithEvents({
    prompt: "What project are we working on?",
    threadId: threadA,
  })) {
    if (event.type === "text" && event.text.toLowerCase().includes("alpha")) {
      foundAlpha = true;
    }
    if (event.type === "text" && event.text.toLowerCase().includes("beta")) {
      foundBeta = true;
    }
  }
  
  assert.strictEqual(foundAlpha, true);
  assert.strictEqual(foundBeta, false); // Thread A should NOT know about Beta
  
  // Verify list shows both threads
  const threads = await checkpointer.list();
  assert.ok(threads.includes(threadA));
  assert.ok(threads.includes(threadB));
}, 45000);

testWithApiKey("FileSaver > persists checkpoints to disk", async () => {
  const checkpointer = new FileSaver({ dir: TEST_DIR });
  
  const agent = createDeepAgent({
    model: anthropic("claude-haiku-4-5-20251001"),
    checkpointer,
  });
  
  const threadId = "test-file-" + Date.now();
  
  // Create a checkpoint
  for await (const event of agent.streamWithEvents({
    prompt: "Say hello",
    threadId,
  })) {
    // Just consume events
  }
  
  // Verify file was created
  assert.strictEqual(existsSync(TEST_DIR), true);
  const threads = await checkpointer.list();
  assert.ok(threads.includes(threadId));
  
  // Load checkpoint
  const checkpoint = await checkpointer.load(threadId);
  assert.notStrictEqual(checkpoint, undefined);
  assert.strictEqual(checkpoint?.threadId, threadId);
  
  // Cleanup
  cleanupTestDir();
}, 20000);

testWithApiKey("Checkpointer > step counter increments correctly", async () => {
  const checkpointer = new MemorySaver();
  
  const agent = createDeepAgent({
    model: anthropic("claude-haiku-4-5-20251001"),
    checkpointer,
  });
  
  const threadId = "test-steps-" + Date.now();
  let maxStep = 0;
  
  // First interaction
  for await (const event of agent.streamWithEvents({
    prompt: "Create 2 todos",
    threadId,
  })) {
    if (event.type === 'checkpoint-saved') {
      maxStep = Math.max(maxStep, event.step);
    }
  }
  
  const step1 = maxStep;
  assert.ok(step1 > 0);
  
  // Second interaction - steps should continue from previous
  maxStep = 0;
  for await (const event of agent.streamWithEvents({
    prompt: "Add one more todo",
    threadId,
  })) {
    if (event.type === 'checkpoint-saved') {
      maxStep = Math.max(maxStep, event.step);
    }
  }
  
  const step2 = maxStep;
  assert.ok(step2 > step1); // Steps should increment
}, 30000);

test("Checkpointer > without threadId, no checkpoints are saved", { timeout: 20000 }, async () => {
  const checkpointer = new MemorySaver();
  
  const agent = createDeepAgent({
    model: anthropic("claude-haiku-4-5-20251001"),
    checkpointer,
  });
  
  let checkpointSaved = false;
  
  // No threadId provided
  for await (const event of agent.streamWithEvents({
    prompt: "Say hello",
    // No threadId
  })) {
    if (event.type === 'checkpoint-saved') {
      checkpointSaved = true;
    }
  }
  
  assert.strictEqual(checkpointSaved, false);
  
  const threads = await checkpointer.list();
  assert.strictEqual(threads.length, 0);
});


