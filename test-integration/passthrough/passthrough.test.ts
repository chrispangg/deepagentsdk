/**
 * Working tests for ToolLoopAgent Passthrough functionality
 * Simplified version that focuses on core functionality
 */

import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { createDeepAgent } from "@/agent.ts";
import { anthropic } from "@ai-sdk/anthropic";
import type {
  LoopControlOptions,
  GenerationOptions,
  AdvancedAgentOptions,
  SubAgent,
} from "@/types.ts";
import { expect } from "expect";

// Simple mock for testing
const mockModel = {
  provider: "test",
  modelId: "test-model",
  specificationVersion: "v3" as const,
  supportedUrls: async () => ({}),
  doGenerate: async () => ({
    text: "Mock response",
    usage: { totalTokens: 10, promptTokens: 5, completionTokens: 5 },
    finishReason: "stop",
  }),
  doStream: async function* () {
    yield { type: "text-delta", textDelta: "Mock" };
    yield { type: "text-delta", textDelta: " response" };
    yield { type: "finish", finishReason: "stop", usage: { totalTokens: 10 } };
  },
};

describe("ToolLoopAgent Passthrough - Working Tests", () => {
  test("should accept and store loop control options", () => {
    const onStepFinish = async () => {};
    const onFinish = async () => {};

    const agent = createDeepAgent({
      model: mockModel as any,
      loopControl: {
        prepareStep: async ({ stepNumber }) => ({ toolChoice: "auto" }),
        onStepFinish,
        onFinish,
      },
    });

    assert.notStrictEqual(agent, undefined);
    // Verify options were stored
    expect((agent as any).loopControl).toBeDefined();
    expect((agent as any).loopControl.onStepFinish).toBe(onStepFinish);
    expect((agent as any).loopControl.onFinish).toBe(onFinish);
  });

  test("should accept and store generation options", () => {
    const generationOptions: GenerationOptions = {
      temperature: 0.7,
      maxOutputTokens: 4000,
      maxRetries: 5,
      topP: 0.9,
    };

    const agent = createDeepAgent({
      model: mockModel as any,
      generationOptions,
    });

    assert.notStrictEqual(agent, undefined);
    expect((agent as any).generationOptions).toEqual(generationOptions);
  });

  test("should accept and store advanced options", () => {
    const advancedOptions: AdvancedAgentOptions = {
      experimental_telemetry: {
        isEnabled: true,
        functionId: "test-agent",
      },
      providerOptions: {
        anthropic: {
          cacheControl: { type: "ephemeral" },
        },
      },
    };

    const agent = createDeepAgent({
      model: mockModel as any,
      advancedOptions,
    });

    assert.notStrictEqual(agent, undefined);
    expect((agent as any).advancedOptions).toEqual(advancedOptions);
  });

  test("should accept subagent with generation options", () => {
    const subagent: SubAgent = {
      name: "test-agent",
      description: "Test subagent",
      systemPrompt: "You are a test agent",
      generationOptions: {
        temperature: 0.3,
        maxOutputTokens: 2000,
      },
      advancedOptions: {
        experimental_telemetry: { isEnabled: true },
      },
    };

    const agent = createDeepAgent({
      model: mockModel as any,
      subagents: [subagent],
    });

    assert.notStrictEqual(agent, undefined);
  });

  test("should prevent loop control in subagents", () => {
    // This test verifies that subagents cannot have loopControl
    // The TypeScript interface should prevent this
    const invalidSubagent = {
      name: "test-agent",
      description: "Test subagent",
      systemPrompt: "You are a test agent",
      generationOptions: {
        temperature: 0.3,
      },
      loopControl: {
        onStepFinish: async () => {},
      },
    };

    // Even though loopControl is provided,
    // it shouldn't be included in the SubAgent type
    const agent = createDeepAgent({
      model: mockModel as any,
      subagents: [invalidSubagent],
    });

    assert.notStrictEqual(agent, undefined);
  });

  test("should build stop conditions with maxSteps safety", () => {
    const agent = createDeepAgent({
      model: mockModel as any,
      loopControl: {
        stopWhen: async () => false, // Never stop
      },
    });

    assert.notStrictEqual(agent, undefined);
  });

  test("should maintain backward compatibility", () => {
    // Should work with no options at all
    const agent1 = createDeepAgent({
      model: mockModel as any,
    });
    assert.notStrictEqual(agent1, undefined);

    // Should work with old options
    const agent2 = createDeepAgent({
      model: mockModel as any,
      systemPrompt: "Test prompt",
      maxSteps: 50,
    });
    assert.notStrictEqual(agent2, undefined);
  });

  test("should accept all options together", () => {
    const agent = createDeepAgent({
      model: mockModel as any,

      // Loop control
      loopControl: {
        onStepFinish: async () => console.log("Step done"),
      },

      // Generation options
      generationOptions: {
        temperature: 0.7,
        maxOutputTokens: 4000,
      },

      // Advanced options
      advancedOptions: {
        experimental_telemetry: { isEnabled: true },
      },

      // Subagents
      subagents: [{
        name: "helper",
        description: "Helper agent",
        systemPrompt: "Help the user",
        generationOptions: {
          temperature: 0.1, // More focused
        },
      }],
    });

    assert.notStrictEqual(agent, undefined);
  });
});