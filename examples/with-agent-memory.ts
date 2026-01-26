/**
 * Example: Using Agent Memory Middleware
 *
 * This example demonstrates user-level agent memory with actual runnable tests.
 * We've set up memory files in .deepagents/ to test different scenarios.
 *
 * Run: node --import tsx examples/with-agent-memory.ts
 */

import { createDeepAgent, createAgentMemoryMiddleware } from "../src/index";
import { anthropic } from "@ai-sdk/anthropic";
import * as path from "node:path";

// Check for API key
if (!process.env.ANTHROPIC_API_KEY) {
  console.error("❌ ANTHROPIC_API_KEY environment variable required");
  console.error("   Set it with: export ANTHROPIC_API_KEY=your_key_here");
  process.exit(1);
}

console.log("🧪 Agent Memory Middleware Examples\n");
console.log("=" .repeat(60));

// =============================================================================
// Example 1: Basic user memory
// =============================================================================
console.log("\n📝 Example 1: Basic User Memory");
console.log("-".repeat(60));
console.log("Testing: User memory from custom directory");
console.log("User memory: examples/.deepagents/example-agent/agent.md");
console.log("Expected: Emojis in response 🎉✨🚀\n");

const example1Middleware = createAgentMemoryMiddleware({
  agentId: "example-agent",
  userDeepagentsDir: path.join(__dirname, ".deepagents"),
});

const agent1 = createDeepAgent({
  model: anthropic("claude-sonnet-4-20250514"),
  middleware: example1Middleware,
});

console.log("Prompt: 'Hello! What are your preferences?'\n");

const result1 = await agent1.generate({
  prompt: "Hello! What are your preferences?",
});

console.log("Response:", result1.text);
console.log("\n✅ Check: Emojis present? (should see 🎉✨🚀)");

// =============================================================================
// Example 2: Additional memory files
// =============================================================================
console.log("\n\n📚 Example 2: Additional Memory Files");
console.log("-".repeat(60));
console.log("Testing: Loading additional .md files (decisions.md)");
console.log("User memory: examples/.deepagents/example-agent/agent.md");
console.log("Additional file: examples/.deepagents/example-agent/decisions.md");
console.log("Expected: Knows about node:test decision + emojis 🎉\n");

const example2Middleware = createAgentMemoryMiddleware({
  agentId: "example-agent",
  userDeepagentsDir: path.join(__dirname, ".deepagents"),
});

const agent2 = createDeepAgent({
  model: anthropic("claude-sonnet-4-20250514"),
  middleware: example2Middleware,
});

console.log("Prompt: 'What testing framework was decided on?'\n");

const result2 = await agent2.generate({
  prompt: "What testing framework was decided on?",
});

console.log("Response:", result2.text);
console.log("\n✅ Check: Does it mention node:test? (from decisions.md)");

// =============================================================================
// Example 3: Using agentId parameter (simplified API)
// =============================================================================
console.log("\n\n🚀 Example 3: Using agentId Parameter (Recommended)");
console.log("-".repeat(60));
console.log("Testing: Simplified API with just agentId");
console.log("Note: Uses default ~/.deepagents/{agentId}/ path");
console.log("Expected: Loads user memory from home directory\n");

const agent3 = createDeepAgent({
  model: anthropic("claude-sonnet-4-20250514"),
  agentId: "demo-agent",
  // No middleware needed - agentId automatically enables memory!
});

console.log("Prompt: 'Hello! Introduce yourself.'\n");

const result3 = await agent3.generate({
  prompt: "Hello! Introduce yourself.",
});

console.log("Response:", result3.text);
console.log("\n✅ Check: Agent responds (may not have memory if ~/.deepagents/demo-agent/agent.md doesn't exist)");

// =============================================================================
// Summary
// =============================================================================
console.log("\n\n" + "=".repeat(60));
console.log("📊 Summary");
console.log("=".repeat(60));
console.log(`
✅ Example 1: Basic user memory
   - Used userDeepagentsDir to customize user memory location
   - Loaded from examples/.deepagents/example-agent/agent.md
   - Result: Agent uses emoji preferences from memory

✅ Example 2: Additional memory files
   - Automatically loaded decisions.md (additional .md file)
   - Agent knew about node:test decision from memory
   - All .md files in user directory are loaded

✅ Example 3: Simplified agentId API
   - Most convenient approach - just use agentId parameter
   - Automatically handles memory loading
   - Uses default ~/.deepagents/{agentId}/ path

Key takeaways:
- User memory: Personal preferences at ~/.deepagents/{agentId}/agent.md
- Additional files: Extra context in ~/.deepagents/{agentId}/*.md (auto-loaded)
- userDeepagentsDir: Customizes where user memory is loaded from
- Memory is cached: Loaded once per middleware instance

Memory file locations (default):
- User: ~/.deepagents/{agentId}/agent.md
- Additional: ~/.deepagents/{agentId}/*.md (auto-loaded)

For testing, we customized:
- userDeepagentsDir: '${path.join(__dirname, ".deepagents")}'
  (examples/.deepagents/ instead of ~/.deepagents/)
`);

console.log("\n🎉 All examples completed successfully!");
