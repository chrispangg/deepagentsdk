/**
 * Basic example that runs without external API keys by using a mock model.
 *
 * Run with: node --import tsx examples/basic-node.ts
 */

import { createDeepAgent, StateBackend } from "../src/index";

const mockModel = {
  provider: "local",
  modelId: "mock-model",
  specificationVersion: "v3" as const,
  supportedUrls: async () => ({}),
  doGenerate: async () => ({
    text: "Hello from the mock model.",
    content: [{ type: "text", text: "Hello from the mock model." }],
    usage: {
      inputTokens: { total: 3 },
      outputTokens: { total: 2 },
    },
    finishReason: "stop",
  }),
  doStream: async function* () {
    yield { type: "text-delta", textDelta: "Hello " };
    yield { type: "text-delta", textDelta: "from " };
    yield { type: "text-delta", textDelta: "the " };
    yield { type: "text-delta", textDelta: "mock " };
    yield { type: "text-delta", textDelta: "model." };
    yield {
      type: "finish",
      finishReason: "stop",
      usage: { inputTokens: { total: 3 }, outputTokens: { total: 2 } },
    };
  },
};

async function main() {
  const backend = new StateBackend();
  const agent = createDeepAgent({
    model: mockModel as any,
    backend,
    systemPrompt: "You are a concise assistant.",
  });

  const result = await agent.generate({ prompt: "Say hello." });

  console.log("Result text:");
  console.log(result.text);
  console.log("Todos:", result.state.todos.length);
  console.log("Files:", Object.keys(result.state.files).length);
}

main().catch((error) => {
  console.error("Example failed:", error);
  process.exitCode = 1;
});
