import { test, beforeEach, afterEach } from "node:test";
import { FileSaver } from "@/checkpointer/file-saver.ts";
import { rmSync, existsSync } from "node:fs";
import type { Checkpoint } from "@/checkpointer/types.ts";
import assert from "node:assert/strict";

const TEST_DIR = "./.test-checkpoints";

const createTestCheckpoint = (threadId: string, step = 1): Checkpoint => ({
  threadId,
  step,
  messages: [{ role: "user", content: "test message" }],
  state: { todos: [], files: {} },
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
});

let saver: FileSaver;

beforeEach(() => {
  saver = new FileSaver({ dir: TEST_DIR });
});

afterEach(() => {
  if (existsSync(TEST_DIR)) {
    rmSync(TEST_DIR, { recursive: true });
  }
});

test("FileSaver > creates directory if it doesn't exist", () => {
  assert.strictEqual(existsSync(TEST_DIR), true);
});

test("FileSaver > save and load checkpoint", async () => {
  await saver.save(createTestCheckpoint("test-thread"));
  
  const loaded = await saver.load("test-thread");
  assert.strictEqual(loaded?.threadId, "test-thread");
  assert.strictEqual(loaded?.messages.length, 1);
});

test("FileSaver > load returns undefined for non-existent thread", async () => {
  const loaded = await saver.load("non-existent");
  assert.strictEqual(loaded, undefined);
});

test("FileSaver > list returns saved threads", async () => {
  await saver.save(createTestCheckpoint("thread-a"));
  await saver.save(createTestCheckpoint("thread-b"));
  
  const threads = await saver.list();
  assert.strictEqual(threads.length, 2);
  assert.ok(threads.includes("thread-a"));
  assert.ok(threads.includes("thread-b"));
});

test("FileSaver > delete removes file", async () => {
  await saver.save(createTestCheckpoint("to-delete"));
  assert.strictEqual(await saver.exists("to-delete"), true);
  
  await saver.delete("to-delete");
  assert.strictEqual(await saver.exists("to-delete"), false);
});

test("FileSaver > exists returns correct value", async () => {
  assert.strictEqual(await saver.exists("test-thread"), false);
  
  await saver.save(createTestCheckpoint("test-thread"));
  assert.strictEqual(await saver.exists("test-thread"), true);
});

test("FileSaver > sanitizes unsafe thread IDs", async () => {
  const unsafeId = "thread/with:special*chars?";
  await saver.save(createTestCheckpoint(unsafeId));
  
  const loaded = await saver.load(unsafeId);
  assert.strictEqual(loaded?.threadId, unsafeId);
});

test("FileSaver > overwrites existing checkpoint", async () => {
  await saver.save(createTestCheckpoint("thread-1", 1));
  await saver.save(createTestCheckpoint("thread-1", 2));
  
  const loaded = await saver.load("thread-1");
  assert.strictEqual(loaded?.step, 2);
  
  const threads = await saver.list();
  assert.strictEqual(threads.length, 1);
});

test("FileSaver > handles empty directory for list", async () => {
  // Delete the directory
  rmSync(TEST_DIR, { recursive: true });
  
  const threads = await saver.list();
  assert.deepStrictEqual(threads, []);
});

test("FileSaver > handles corrupted JSON file", async () => {
  const { writeFileSync } = await import("node:fs");
  const { join } = await import("node:path");
  
  // Write invalid JSON
  writeFileSync(join(TEST_DIR, "corrupted.json"), "{ invalid json", "utf-8");
  
  const loaded = await saver.load("corrupted");
  assert.strictEqual(loaded, undefined);
});

test("FileSaver > updatedAt is set on save", async () => {
  const checkpoint = createTestCheckpoint("thread-1");
  const originalUpdatedAt = checkpoint.updatedAt;
  
  await new Promise(resolve => setTimeout(resolve, 10));
  
  await saver.save(checkpoint);
  const loaded = await saver.load("thread-1");
  
  assert.notStrictEqual(loaded?.updatedAt, undefined);
  assert.notStrictEqual(loaded?.updatedAt, originalUpdatedAt);
});


