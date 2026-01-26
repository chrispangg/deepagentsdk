import { test, beforeEach } from "node:test";
import { MemorySaver } from "@/checkpointer/memory-saver.ts";
import type { Checkpoint } from "@/checkpointer/types.ts";
import assert from "node:assert/strict";

const createTestCheckpoint = (threadId: string, step = 1): Checkpoint => ({
  threadId,
  step,
  messages: [{ role: "user", content: "test" }],
  state: { todos: [], files: {} },
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
});

let saver: MemorySaver;

beforeEach(() => {
  saver = new MemorySaver();
});

test("MemorySaver > save and load checkpoint", async () => {
  const checkpoint = createTestCheckpoint("thread-1");
  await saver.save(checkpoint);
  
  const loaded = await saver.load("thread-1");
  assert.notStrictEqual(loaded, undefined);
  assert.strictEqual(loaded?.threadId, "thread-1");
  assert.strictEqual(loaded?.step, 1);
});

test("MemorySaver > load returns undefined for non-existent thread", async () => {
  const loaded = await saver.load("non-existent");
  assert.strictEqual(loaded, undefined);
});

test("MemorySaver > list returns all thread IDs", async () => {
  await saver.save(createTestCheckpoint("thread-1"));
  await saver.save(createTestCheckpoint("thread-2"));
  
  const threads = await saver.list();
  assert.ok(threads.includes("thread-1"));
  assert.ok(threads.includes("thread-2"));
  assert.strictEqual(threads.length, 2);
});

test("MemorySaver > delete removes checkpoint", async () => {
  await saver.save(createTestCheckpoint("thread-1"));
  await saver.delete("thread-1");
  
  const loaded = await saver.load("thread-1");
  assert.strictEqual(loaded, undefined);
});

test("MemorySaver > exists returns correct value", async () => {
  assert.strictEqual(await saver.exists("thread-1"), false);
  
  await saver.save(createTestCheckpoint("thread-1"));
  assert.strictEqual(await saver.exists("thread-1"), true);
  
  await saver.delete("thread-1");
  assert.strictEqual(await saver.exists("thread-1"), false);
});

test("MemorySaver > save overwrites existing checkpoint", async () => {
  await saver.save(createTestCheckpoint("thread-1", 1));
  await saver.save(createTestCheckpoint("thread-1", 2));
  
  const loaded = await saver.load("thread-1");
  assert.strictEqual(loaded?.step, 2);
});

test("MemorySaver > namespace isolates checkpoints", async () => {
  const saver1 = new MemorySaver({ namespace: "ns1" });
  const saver2 = new MemorySaver({ namespace: "ns2" });
  
  await saver1.save(createTestCheckpoint("thread-1"));
  
  assert.strictEqual(await saver1.exists("thread-1"), true);
  assert.strictEqual(await saver2.exists("thread-1"), false);
  
  const list1 = await saver1.list();
  const list2 = await saver2.list();
  
  assert.ok(list1.includes("thread-1"));
  assert.ok(!list2.includes("thread-1"));
});

test("MemorySaver > clear removes all checkpoints", async () => {
  await saver.save(createTestCheckpoint("thread-1"));
  await saver.save(createTestCheckpoint("thread-2"));
  
  assert.strictEqual(saver.size(), 2);
  
  saver.clear();
  
  assert.strictEqual(saver.size(), 0);
  assert.deepStrictEqual(await saver.list(), []);
});

test("MemorySaver > size returns correct count", async () => {
  assert.strictEqual(saver.size(), 0);
  
  await saver.save(createTestCheckpoint("thread-1"));
  assert.strictEqual(saver.size(), 1);
  
  await saver.save(createTestCheckpoint("thread-2"));
  assert.strictEqual(saver.size(), 2);
  
  await saver.delete("thread-1");
  assert.strictEqual(saver.size(), 1);
});

test("MemorySaver > updatedAt is set on save", async () => {
  const checkpoint = createTestCheckpoint("thread-1");
  const originalUpdatedAt = checkpoint.updatedAt;
  
  // Wait a bit to ensure timestamp changes
  await new Promise(resolve => setTimeout(resolve, 10));
  
  await saver.save(checkpoint);
  const loaded = await saver.load("thread-1");
  
  assert.notStrictEqual(loaded?.updatedAt, undefined);
  assert.notStrictEqual(loaded?.updatedAt, originalUpdatedAt);
});


