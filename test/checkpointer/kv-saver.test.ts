import { test, beforeEach } from "node:test";
import { KeyValueStoreSaver } from "@/checkpointer/kv-saver.ts";
import { InMemoryStore } from "@/backends/persistent.ts";
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

let store: InMemoryStore;
let saver: KeyValueStoreSaver;

beforeEach(() => {
  store = new InMemoryStore();
  saver = new KeyValueStoreSaver({ store });
});

test("KeyValueStoreSaver > save and load checkpoint", async () => {
  const checkpoint = createTestCheckpoint("thread-1");
  await saver.save(checkpoint);
  
  const loaded = await saver.load("thread-1");
  assert.notStrictEqual(loaded, undefined);
  assert.strictEqual(loaded?.threadId, "thread-1");
  assert.strictEqual(loaded?.step, 1);
});

test("KeyValueStoreSaver > load returns undefined for non-existent thread", async () => {
  const loaded = await saver.load("non-existent");
  assert.strictEqual(loaded, undefined);
});

test("KeyValueStoreSaver > list returns all thread IDs", async () => {
  await saver.save(createTestCheckpoint("thread-1"));
  await saver.save(createTestCheckpoint("thread-2"));
  
  const threads = await saver.list();
  assert.ok(threads.includes("thread-1"));
  assert.ok(threads.includes("thread-2"));
  assert.strictEqual(threads.length, 2);
});

test("KeyValueStoreSaver > delete removes checkpoint", async () => {
  await saver.save(createTestCheckpoint("thread-1"));
  await saver.delete("thread-1");
  
  const loaded = await saver.load("thread-1");
  assert.strictEqual(loaded, undefined);
});

test("KeyValueStoreSaver > exists returns correct value", async () => {
  assert.strictEqual(await saver.exists("thread-1"), false);
  
  await saver.save(createTestCheckpoint("thread-1"));
  assert.strictEqual(await saver.exists("thread-1"), true);
  
  await saver.delete("thread-1");
  assert.strictEqual(await saver.exists("thread-1"), false);
});

test("KeyValueStoreSaver > namespace isolates checkpoints", async () => {
  const saver1 = new KeyValueStoreSaver({ store, namespace: "ns1" });
  const saver2 = new KeyValueStoreSaver({ store, namespace: "ns2" });
  
  await saver1.save(createTestCheckpoint("thread-1"));
  
  assert.strictEqual(await saver1.exists("thread-1"), true);
  assert.strictEqual(await saver2.exists("thread-1"), false);
  
  const list1 = await saver1.list();
  const list2 = await saver2.list();
  
  assert.ok(list1.includes("thread-1"));
  assert.strictEqual(list2.length, 0);
});

test("KeyValueStoreSaver > overwrites existing checkpoint", async () => {
  await saver.save(createTestCheckpoint("thread-1", 1));
  await saver.save(createTestCheckpoint("thread-1", 2));
  
  const loaded = await saver.load("thread-1");
  assert.strictEqual(loaded?.step, 2);
  
  const threads = await saver.list();
  assert.strictEqual(threads.length, 1);
});

test("KeyValueStoreSaver > updatedAt is set on save", async () => {
  const checkpoint = createTestCheckpoint("thread-1");
  const originalUpdatedAt = checkpoint.updatedAt;
  
  await new Promise(resolve => setTimeout(resolve, 10));
  
  await saver.save(checkpoint);
  const loaded = await saver.load("thread-1");
  
  assert.notStrictEqual(loaded?.updatedAt, undefined);
  assert.notStrictEqual(loaded?.updatedAt, originalUpdatedAt);
});

test("KeyValueStoreSaver > handles complex state", async () => {
  const checkpoint: Checkpoint = {
    threadId: "complex-thread",
    step: 5,
    messages: [
      { role: "user", content: "Hello" },
      { role: "assistant", content: "Hi there!" },
    ],
    state: {
      todos: [
        { id: "1", content: "Task 1", status: "completed" },
        { id: "2", content: "Task 2", status: "in_progress" },
      ],
      files: {
        "/test.txt": {
          content: ["line 1", "line 2"],
          created_at: new Date().toISOString(),
          modified_at: new Date().toISOString(),
        },
      },
    },
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  
  await saver.save(checkpoint);
  const loaded = await saver.load("complex-thread");
  
  assert.strictEqual(loaded?.state.todos.length, 2);
  assert.notStrictEqual(loaded?.state.files["/test.txt"], undefined);
  assert.strictEqual(loaded?.messages.length, 2);
});


