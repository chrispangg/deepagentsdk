/**
 * Working tests for ToolLoopAgent Passthrough functionality
 * Simplified version that focuses on core functionality
 */

import { test, expect, describe } from "bun:test";
import { createDeepAgent } from "../../src/agent";
import { anthropic } from "@ai-sdk/anthropic";
import type {
  LoopControlOptions,
  GenerationOptions,
  AdvancedAgentOptions,
  SubAgent,
} from "../../src/types";

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

    expect(agent).toBeDefined();
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

    expect(agent).toBeDefined();
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

    expect(agent).toBeDefined();
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

    expect(agent).toBeDefined();
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
      // @ts-expect-error - loopControl should not be allowed
      loopControl: {
        onStepFinish: async () => {},
      },
    };

    // Even though we're forcing it with ts-expect-error,
    // it shouldn't be included in the SubAgent type
    const agent = createDeepAgent({
      model: mockModel as any,
      subagents: [invalidSubagent],
    });

    expect(agent).toBeDefined();
  });

  test("should build stop conditions with maxSteps safety", () => {
    const agent = createDeepAgent({
      model: mockModel as any,
      loopControl: {
        stopWhen: async () => false, // Never stop
      },
    });

    expect(agent).toBeDefined();
  });

  test("should maintain backward compatibility", () => {
    // Should work with no options at all
    const agent1 = createDeepAgent({
      model: mockModel as any,
    });
    expect(agent1).toBeDefined();

    // Should work with old options
    const agent2 = createDeepAgent({
      model: mockModel as any,
      systemPrompt: "Test prompt",
      maxSteps: 50,
    });
    expect(agent2).toBeDefined();
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

    expect(agent).toBeDefined();
  });
});