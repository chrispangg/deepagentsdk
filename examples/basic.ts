/**
 * Basic example of using AI SDK Deep Agent with ToolLoopAgent.
 *
 * Run with: ANTHROPIC_API_KEY=your-key node --import tsx examples/basic.ts
 */

import { createDeepAgent } from "../src/index";
import { openai } from "@ai-sdk/openai";

async function main() {
  // Create a deep agent with default settings
  const agent = createDeepAgent({
    model: openai("gpt-5-mini") as any,
    systemPrompt: `You are an expert researcher. Your job is to:
1. Break down complex questions into manageable tasks
2. Research each component thoroughly
3. Write your findings to files for reference
4. Produce a comprehensive final report

Always use the write_todos tool to plan your work before starting.`,
  });

  console.log("🚀 Starting Deep Agent with AI SDK v6 ToolLoopAgent...\n");

  const result = await agent.generate({
    prompt:
      "What are the key differences between REST and GraphQL APIs? Create a comparison report and save it to /report.md",
    maxSteps: 10,
  });

  console.log("\n📝 Agent Response:");
  console.log("─".repeat(50));
  console.log(result.text);

  console.log("\n\n📋 Final Todo List:");
  console.log("─".repeat(50));
  for (const todo of result.state.todos) {
    const statusEmoji = {
      pending: "⏳",
      in_progress: "🔄",
      completed: "✅",
      cancelled: "❌",
    }[todo.status];
    console.log(`${statusEmoji} [${todo.status}] ${todo.content}`);
  }

  console.log("\n\n📁 Files Created:");
  console.log("─".repeat(50));
  for (const [path, file] of Object.entries(result.state.files)) {
    const lines = file.content.length;
    console.log(`  ${path} (${lines} lines)`);
  }

  // Print content of markdown files
  for (const [path, file] of Object.entries(result.state.files)) {
    if (path.endsWith(".md")) {
      console.log(`\n\n📄 Content of ${path}:`);
      console.log("─".repeat(50));
      console.log(file.content.join("\n"));
    }
  }
}

main().catch(console.error);
