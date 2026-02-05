import { test, expect } from "bun:test";
import { mapEventToProtocol } from "@/adapters/elements";

test("mapEventToProtocol emits text-start then first text-delta", () => {
  const writes: Array<Record<string, unknown>> = [];
  const writer = {
    write: (chunk: Record<string, unknown>) => {
      writes.push(chunk);
    },
  };
  const genId = () => "text-1";

  const result = mapEventToProtocol(
    { type: "text", text: "Hello" },
    writer,
    genId,
    null,
  );

  expect(result).toBe("text-1");
  expect(writes).toEqual([
    { type: "text-start", id: "text-1" },
    { type: "text-delta", id: "text-1", delta: "Hello" },
  ]);
});

test("mapEventToProtocol reuses text id for subsequent deltas", () => {
  const writes: Array<Record<string, unknown>> = [];
  const writer = {
    write: (chunk: Record<string, unknown>) => {
      writes.push(chunk);
    },
  };
  const genId = () => "text-1";

  const firstResult = mapEventToProtocol(
    { type: "text", text: "Hello" },
    writer,
    genId,
    null,
  );
  const secondResult = mapEventToProtocol(
    { type: "text", text: " world" },
    writer,
    genId,
    firstResult,
  );

  expect(secondResult).toBe("text-1");
  expect(writes).toEqual([
    { type: "text-start", id: "text-1" },
    { type: "text-delta", id: "text-1", delta: "Hello" },
    { type: "text-delta", id: "text-1", delta: " world" },
  ]);
});
