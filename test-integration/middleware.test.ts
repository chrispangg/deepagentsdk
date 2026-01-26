import { test } from "node:test";
import { createDeepAgent } from "@/agent.ts";
import { createAnthropic } from '@ai-sdk/anthropic';
import type { LanguageModelMiddleware } from "ai";
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

const anthropic = createAnthropic({
  baseURL: 'https://api.anthropic.com/v1',
});

// Skip tests if no API key
const hasApiKey = !!process.env.ANTHROPIC_API_KEY;

skipIf(!hasApiKey)("middleware - single middleware applied", async () => {
  let callCount = 0;

  const countingMiddleware: LanguageModelMiddleware = {
    specificationVersion: 'v3',
    wrapGenerate: async ({ doGenerate }) => {
      callCount++;
      return await doGenerate();
    },
  };

  const agent = createDeepAgent({
    model: anthropic("claude-sonnet-4-20250514"),
    middleware: countingMiddleware,
  });

  await agent.generate({ prompt: "Say hello" });
  assert.strictEqual(callCount, 1);
});

skipIf(!hasApiKey)("middleware - multiple middlewares applied in order", async () => {
  const executionOrder: string[] = [];

  const firstMiddleware: LanguageModelMiddleware = {
    specificationVersion: 'v3',
    wrapGenerate: async ({ doGenerate }) => {
      executionOrder.push("first-before");
      const result = await doGenerate();
      executionOrder.push("first-after");
      return result;
    },
  };

  const secondMiddleware: LanguageModelMiddleware = {
    specificationVersion: 'v3',
    wrapGenerate: async ({ doGenerate }) => {
      executionOrder.push("second-before");
      const result = await doGenerate();
      executionOrder.push("second-after");
      return result;
    },
  };

  const agent = createDeepAgent({
    model: anthropic("claude-sonnet-4-20250514"),
    middleware: [firstMiddleware, secondMiddleware],
  });

  await agent.generate({ prompt: "Say hello" });

  // First middleware wraps second middleware
  assert.deepStrictEqual(executionOrder, [
    "first-before",
    "second-before",
    "second-after",
    "first-after",
  ]);
});

skipIf(!hasApiKey)("middleware - factory with closure context", async () => {
  let contextValue = "";

  function createContextMiddleware(context: string): LanguageModelMiddleware {
    return {
      specificationVersion: 'v3',
      wrapGenerate: async ({ doGenerate }) => {
        contextValue = context;
        return await doGenerate();
      },
    };
  }

  const agent = createDeepAgent({
    model: anthropic("claude-sonnet-4-20250514"),
    middleware: createContextMiddleware("test-context"),
  });

  await agent.generate({ prompt: "Say hello" });
  assert.strictEqual(contextValue, "test-context");
});

skipIf(!hasApiKey)("middleware - backwards compatible (no middleware)", async () => {
  const agent = createDeepAgent({
    model: anthropic("claude-sonnet-4-20250514"),
  });

  const result = await agent.generate({ prompt: "Say hello" });
  assert.notStrictEqual(result.text, undefined);
});

