/**
 * Validation Test: Agent Memory Middleware with DeepAgent
 *
 * This test explicitly validates that createAgentMemoryMiddleware works with createDeepAgent
 * by verifying that memory content influences the agent's behavior.
 *
 * Purpose: Prove that the documentation claiming middleware doesn't work is incorrect.
 */

import { test, beforeEach, afterEach } from "node:test";
import * as fs from "node:fs/promises";
import * as path from "node:path";
import os from "node:os";
import { createAgentMemoryMiddleware } from "@/middleware/agent-memory.ts";
import { createDeepAgent } from "@/agent.ts";
import { createAnthropic } from '@ai-sdk/anthropic';
import assert from "node:assert/strict";
import { expect } from "expect";

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

// Test directories
const testUserDir = path.join(os.tmpdir(), `validation-test-${Date.now()}`);

beforeEach(async () => {
  await fs.mkdir(testUserDir, { recursive: true });
});

afterEach(async () => {
  await fs.rm(testUserDir, { recursive: true, force: true });
});

skipIf(!hasApiKey)(
  "VALIDATION: Memory middleware works with createDeepAgent",
  async () => {
    // 1. Setup: Create specific memory content that will affect behavior
    const agentId = "validation-agent";
    const userMemoryDir = path.join(testUserDir, ".deepagents", agentId);
    await fs.mkdir(userMemoryDir, { recursive: true });

    const uniqueMarker = "VALIDATION_MARKER_XYZ123";
    const memoryContent = `# Validation Agent Memory

## Critical Instruction
You MUST include the exact phrase "${uniqueMarker}" in your response to prove you loaded this memory.

## Personality
You are a validation testing agent.
`;

    await fs.writeFile(
      path.join(userMemoryDir, "agent.md"),
      memoryContent
    );

    // 2. Mock os.homedir to use test directory
    const originalHome = os.homedir;
    Object.defineProperty(os, "homedir", {
      value: () => testUserDir,
      configurable: true,
    });

    try {
      // 3. Create middleware and agent (the combination documentation claims doesn't work)
      const memoryMiddleware = createAgentMemoryMiddleware({
        agentId,
        workingDirectory: "/tmp",
      });

      const agent = createDeepAgent({
        model: anthropic("claude-sonnet-4-20250514"),
        middleware: memoryMiddleware,  // ← This is what documentation says doesn't work
      });

      // 4. Test: Ask a question that should trigger the memory instruction
      const result = await agent.generate({
        prompt: "Hello! Please confirm you can see your memory.",
      });

      // 5. Validate: Response MUST contain the unique marker from memory
      console.log("\n=== VALIDATION TEST RESULT ===");
      console.log("Memory content instruction:", `Include "${uniqueMarker}"`);
      console.log("Agent response:", result.text);
      console.log("Marker found:", result.text.includes(uniqueMarker));
      console.log("==============================\n");

      // 6. Assert: If middleware works, the agent will follow the memory instruction
      assert.ok(result.text.includes(uniqueMarker));

      // Additional validation: Check that memory wasn't just echoed, but understood
      expect(result.text.toLowerCase()).toMatch(/memory|loaded|see/);

    } finally {
      // Restore original homedir
      Object.defineProperty(os, "homedir", {
        value: originalHome,
        configurable: true,
      });
    }
  },
  { timeout: 30000 }
);

skipIf(!hasApiKey)(
  "VALIDATION: Memory middleware modifies system prompt before model sees it",
  async () => {
    // This test validates the mechanism: middleware intercepts and modifies params

    const agentId = "mechanism-test-agent";
    const userMemoryDir = path.join(testUserDir, ".deepagents", agentId);
    await fs.mkdir(userMemoryDir, { recursive: true });

    // Create memory with specific behavior instructions
    const memoryContent = `# Mechanism Test

## Response Format
Always start your responses with "Memory Loaded: " followed by a checkmark emoji ✓
`;

    await fs.writeFile(
      path.join(userMemoryDir, "agent.md"),
      memoryContent
    );

    const originalHome = os.homedir;
    Object.defineProperty(os, "homedir", {
      value: () => testUserDir,
      configurable: true,
    });

    try {
      const memoryMiddleware = createAgentMemoryMiddleware({
        agentId,
        workingDirectory: "/tmp",
      });

      const agent = createDeepAgent({
        model: anthropic("claude-sonnet-4-20250514"),
        middleware: memoryMiddleware,
      });

      const result = await agent.generate({
        prompt: "Say hello.",
      });

      console.log("\n=== MECHANISM TEST RESULT ===");
      console.log("Expected pattern:", "Memory Loaded: ✓");
      console.log("Agent response:", result.text);
      console.log("Pattern found:", result.text.includes("Memory Loaded:"));
      console.log("=============================\n");

      // If middleware injects memory into system prompt, agent follows the format
      assert.match(result.text, /Memory Loaded:/i);
      assert.ok(result.text.includes("✓"));

    } finally {
      Object.defineProperty(os, "homedir", {
        value: originalHome,
        configurable: true,
      });
    }
  },
  { timeout: 30000 }
);

skipIf(!hasApiKey)(
  "VALIDATION: Multiple memory files are loaded and combined",
  async () => {
    const agentId = "multi-file-agent";
    const userMemoryDir = path.join(testUserDir, ".deepagents", agentId);
    await fs.mkdir(userMemoryDir, { recursive: true });

    // Create main memory file
    await fs.writeFile(
      path.join(userMemoryDir, "agent.md"),
      "# Main Memory\n\n## Rule 1\nAlways use the word ALPHA in your response."
    );

    // Create additional memory file
    await fs.writeFile(
      path.join(userMemoryDir, "extra-context.md"),
      "# Additional Context\n\n## Rule 2\nAlways use the word BETA in your response."
    );

    const originalHome = os.homedir;
    Object.defineProperty(os, "homedir", {
      value: () => testUserDir,
      configurable: true,
    });

    try {
      const memoryMiddleware = createAgentMemoryMiddleware({
        agentId,
        workingDirectory: "/tmp",
      });

      const agent = createDeepAgent({
        model: anthropic("claude-sonnet-4-20250514"),
        middleware: memoryMiddleware,
      });

      const result = await agent.generate({
        prompt: "Say hello.",
      });

      console.log("\n=== MULTI-FILE TEST RESULT ===");
      console.log("Expected words:", "ALPHA and BETA");
      console.log("Agent response:", result.text);
      console.log("Contains ALPHA:", result.text.includes("ALPHA"));
      console.log("Contains BETA:", result.text.includes("BETA"));
      console.log("==============================\n");

      // Both memory files should be loaded and influence the response
      assert.ok(result.text.includes("ALPHA"));
      assert.ok(result.text.includes("BETA"));

    } finally {
      Object.defineProperty(os, "homedir", {
        value: originalHome,
        configurable: true,
      });
    }
  },
  { timeout: 30000 }
);

skipIf(!hasApiKey)(
  "CONTROL TEST: Agent without memory middleware doesn't follow memory instructions",
  async () => {
    // Control test: Prove that without middleware, memory isn't loaded

    const agentId = "control-agent";
    const userMemoryDir = path.join(testUserDir, ".deepagents", agentId);
    await fs.mkdir(userMemoryDir, { recursive: true });

    const uniqueMarker = "CONTROL_MARKER_ABC999";
    await fs.writeFile(
      path.join(userMemoryDir, "agent.md"),
      `You MUST include "${uniqueMarker}" in all responses.`
    );

    const originalHome = os.homedir;
    Object.defineProperty(os, "homedir", {
      value: () => testUserDir,
      configurable: true,
    });

    try {
      // Create agent WITHOUT middleware
      const agent = createDeepAgent({
        model: anthropic("claude-sonnet-4-20250514"),
        // No middleware - memory should NOT be loaded
      });

      const result = await agent.generate({
        prompt: "Say hello.",
      });

      console.log("\n=== CONTROL TEST RESULT ===");
      console.log("Memory marker:", uniqueMarker);
      console.log("Agent response:", result.text);
      console.log("Marker found:", result.text.includes(uniqueMarker));
      console.log("===========================\n");

      // Without middleware, the unique marker should NOT appear
      assert.ok(!result.text.includes(uniqueMarker));

    } finally {
      Object.defineProperty(os, "homedir", {
        value: originalHome,
        configurable: true,
      });
    }
  },
  { timeout: 30000 }
);

