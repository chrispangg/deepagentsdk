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
const testUserDir = path.join(os.tmpdir(), `agent-memory-test-${Date.now()}`);
const testProjectDir = path.join(os.tmpdir(), `agent-memory-project-${Date.now()}`);

beforeEach(async () => {
  // Create test directories
  await fs.mkdir(testUserDir, { recursive: true });
  await fs.mkdir(testProjectDir, { recursive: true });

  // Initialize git repo in project directory
  await fs.mkdir(path.join(testProjectDir, ".git"), { recursive: true });
});

afterEach(async () => {
  // Clean up test directories
  await fs.rm(testUserDir, { recursive: true, force: true });
  await fs.rm(testProjectDir, { recursive: true, force: true });
});

test("agent memory middleware - loads user-level memory", async () => {
  const agentId = "test-agent";
  const userMemoryDir = path.join(testUserDir, ".deepagents", agentId);
  await fs.mkdir(userMemoryDir, { recursive: true });

  const userMemoryContent = "I prefer concise responses.";
  await fs.writeFile(
    path.join(userMemoryDir, "agent.md"),
    userMemoryContent
  );

  // Mock process.env to use test directory
  const originalHome = os.homedir;
  Object.defineProperty(os, "homedir", {
    value: () => testUserDir,
    configurable: true,
  });

  try {
    const middleware = createAgentMemoryMiddleware({
      agentId,
      workingDirectory: "/tmp", // Not a git repo
    });

    // Middleware should have transformParams function
    assert.notStrictEqual(middleware.transformParams, undefined);
    assert.strictEqual(middleware.specificationVersion, "v3");

    // Simulate a model call with system prompt
    const result = await middleware.transformParams!({
      type: "generate",
      params: {
        prompt: [
          { role: "system", content: "You are a helpful assistant." },
          { role: "user", content: "Hello" },
        ],
      } as any,
      model: {} as any,
    });

    // System prompt should include memory content
    const systemMessage = result.prompt.find((m: any) => m.role === "system");
    assert.notStrictEqual(systemMessage, undefined);
    assert.ok(systemMessage?.content);
    const userContent = String(systemMessage.content);
    assert.ok(userContent.includes(userMemoryContent));
    expect(userContent).toContain("Agent Memory (User-Level)");
  } finally {
    // Restore original homedir
    Object.defineProperty(os, "homedir", {
      value: originalHome,
      configurable: true,
    });
  }
});

test("agent memory middleware - loads project-level memory", async () => {
  const agentId = "test-agent";
  const projectDeepagentsDir = path.join(testProjectDir, ".deepagents");
  await fs.mkdir(projectDeepagentsDir, { recursive: true });

  const projectMemoryContent = "This project uses TypeScript strict mode.";
  await fs.writeFile(
    path.join(projectDeepagentsDir, "agent.md"),
    projectMemoryContent
  );

  const middleware = createAgentMemoryMiddleware({
    agentId,
    workingDirectory: testProjectDir,
  });

  // Mock homedir to return empty directory (no user memory)
  const originalHome = os.homedir;
  Object.defineProperty(os, "homedir", {
    value: () => path.join(os.tmpdir(), "nonexistent"),
    configurable: true,
  });

  try {
    const result = await middleware.transformParams!({
      type: "generate",
      params: {
        prompt: [
          { role: "system", content: "You are a helpful assistant." },
          { role: "user", content: "Hello" },
        ],
      } as any,
      model: {} as any,
    });

    const systemMessage = result.prompt.find((m: any) => m.role === "system");
    assert.notStrictEqual(systemMessage, undefined);
    assert.ok(systemMessage?.content);
    const projectContent = String(systemMessage.content);
    assert.ok(projectContent.includes(projectMemoryContent));
    expect(projectContent).toContain("Agent Memory (Project-Level)");
  } finally {
    Object.defineProperty(os, "homedir", {
      value: originalHome,
      configurable: true,
    });
  }
});

test("agent memory middleware - loads both user and project memory", async () => {
  const agentId = "test-agent";

  // Create user memory
  const userMemoryDir = path.join(testUserDir, ".deepagents", agentId);
  await fs.mkdir(userMemoryDir, { recursive: true });
  await fs.writeFile(
    path.join(userMemoryDir, "agent.md"),
    "User preference: concise responses"
  );

  // Create project memory
  const projectDeepagentsDir = path.join(testProjectDir, ".deepagents");
  await fs.mkdir(projectDeepagentsDir, { recursive: true });
  await fs.writeFile(
    path.join(projectDeepagentsDir, "agent.md"),
    "Project context: TypeScript project"
  );

  const originalHome = os.homedir;
  Object.defineProperty(os, "homedir", {
    value: () => testUserDir,
    configurable: true,
  });

  try {
    const middleware = createAgentMemoryMiddleware({
      agentId,
      workingDirectory: testProjectDir,
    });

    const result = await middleware.transformParams!({
      type: "generate",
      params: {
        prompt: [
          { role: "system", content: "You are a helpful assistant." },
        ],
      } as any,
      model: {} as any,
    });

    const systemMessage = result.prompt.find((m: any) => m.role === "system");
    assert.notStrictEqual(systemMessage, undefined);
    assert.ok(systemMessage?.content);
    const combinedContent = String(systemMessage.content);
    assert.ok(combinedContent.includes("User preference: concise responses"));
    assert.ok(combinedContent.includes("Project context: TypeScript project"));
    expect(combinedContent).toContain("Agent Memory (User-Level)");
    expect(combinedContent).toContain("Agent Memory (Project-Level)");
  } finally {
    Object.defineProperty(os, "homedir", {
      value: originalHome,
      configurable: true,
    });
  }
});

test("agent memory middleware - handles additional .md files", async () => {
  const agentId = "test-agent";
  const userMemoryDir = path.join(testUserDir, ".deepagents", agentId);
  await fs.mkdir(userMemoryDir, { recursive: true });

  // Create main memory file
  await fs.writeFile(
    path.join(userMemoryDir, "agent.md"),
    "Main memory"
  );

  // Create additional files
  await fs.writeFile(
    path.join(userMemoryDir, "decisions.md"),
    "Decision log: Use React"
  );
  await fs.writeFile(
    path.join(userMemoryDir, "architecture.md"),
    "Architecture: Microservices"
  );

  const originalHome = os.homedir;
  Object.defineProperty(os, "homedir", {
    value: () => testUserDir,
    configurable: true,
  });

  try {
    const middleware = createAgentMemoryMiddleware({
      agentId,
      workingDirectory: "/tmp",
    });

    const result = await middleware.transformParams!({
      type: "generate",
      params: {
        prompt: [{ role: "system", content: "You are a helpful assistant." }],
      } as any,
      model: {} as any,
    });

    const systemMessage = result.prompt.find((m: any) => m.role === "system");
    assert.notStrictEqual(systemMessage, undefined);
    assert.ok(systemMessage?.content);
    const content = String(systemMessage.content);
    assert.ok(content.includes("Main memory"));
    assert.ok(content.includes("decisions.md"));
    assert.ok(content.includes("Decision log: Use React"));
    assert.ok(content.includes("architecture.md"));
    assert.ok(content.includes("Architecture: Microservices"));
    assert.ok(content.includes("Additional Context Files"));
  } finally {
    Object.defineProperty(os, "homedir", {
      value: originalHome,
      configurable: true,
    });
  }
});

test("agent memory middleware - caches memory after first load", async () => {
  const agentId = "test-agent";
  const userMemoryDir = path.join(testUserDir, ".deepagents", agentId);
  await fs.mkdir(userMemoryDir, { recursive: true });

  await fs.writeFile(
    path.join(userMemoryDir, "agent.md"),
    "Original content"
  );

  const originalHome = os.homedir;
  Object.defineProperty(os, "homedir", {
    value: () => testUserDir,
    configurable: true,
  });

  try {
    const middleware = createAgentMemoryMiddleware({
      agentId,
      workingDirectory: "/tmp",
    });

    // First call
    const result1 = await middleware.transformParams!({
      type: "generate",
      params: {
        prompt: [{ role: "system", content: "Prompt 1" }],
      } as any,
      model: {} as any,
    });

    const systemMessage1 = result1.prompt.find((m: any) => m.role === "system");
    assert.ok(systemMessage1?.content);
    const content1 = String(systemMessage1.content);
    assert.ok(content1.includes("Original content"));

    // Modify file after first load
    await fs.writeFile(
      path.join(userMemoryDir, "agent.md"),
      "Modified content"
    );

    // Second call should still use cached content
    const result2 = await middleware.transformParams!({
      type: "generate",
      params: {
        prompt: [{ role: "system", content: "Prompt 2" }],
      } as any,
      model: {} as any,
    });

    const systemMessage2 = result2.prompt.find((m: any) => m.role === "system");
    assert.ok(systemMessage2?.content);
    const content2 = String(systemMessage2.content);
    assert.ok(content2.includes("Original content"));
    assert.ok(!content2.includes("Modified content"));
  } finally {
    Object.defineProperty(os, "homedir", {
      value: originalHome,
      configurable: true,
    });
  }
});

skipIf(!hasApiKey)(
  "agent memory middleware - integrates with DeepAgent",
  async () => {
    const agentId = "integration-test-agent";
    const userMemoryDir = path.join(testUserDir, ".deepagents", agentId);
    await fs.mkdir(userMemoryDir, { recursive: true });

    await fs.writeFile(
      path.join(userMemoryDir, "agent.md"),
      "Test memory: Always say 'memory loaded' in your response."
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
        prompt: "Hello! Can you confirm you have memory?",
      });

      // Response should acknowledge memory was loaded
      expect(result.text.toLowerCase()).toContain("memory");
    } finally {
      Object.defineProperty(os, "homedir", {
        value: originalHome,
        configurable: true,
      });
    }
  },
  { timeout: 30000 }
);

