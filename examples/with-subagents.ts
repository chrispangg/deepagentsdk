/**
 * Example using subagents for task delegation.
 *
 * Run with: bun examples/with-subagents.ts
 *
 * Requires ANTHROPIC_API_KEY environment variable.
 */

import { createDeepAgent, type SubAgent } from "../src/index.ts";

// Define a specialized research subagent
const researchSubagent: SubAgent = {
  name: "research-agent",
  description:
    "Used to research specific topics in depth. Give this agent one focused topic at a time.",
  systemPrompt: `You are a dedicated researcher. Your job is to:
1. Conduct thorough research on the given topic
2. Write detailed notes to files
3. Return a comprehensive summary

Focus only on the topic given. Be thorough and cite your reasoning.`,
};

// Define a writing/editing subagent
const writerSubagent: SubAgent = {
  name: "writer-agent",
  description:
    "Used to write and edit documents. Good for creating reports, summaries, and polished content.",
  systemPrompt: `You are a professional technical writer. Your job is to:
1. Read existing research and notes from files
2. Synthesize information into well-structured documents
3. Write clear, engaging, and accurate content

Always read relevant files before writing. Ensure proper structure and flow.`,
};

async function main() {
  const agent = createDeepAgent({
    model: "anthropic/claude-sonnet-4-20250514",
    systemPrompt: `You are a project manager coordinating research and writing tasks.

Use the research-agent for gathering information on specific topics.
Use the writer-agent for creating polished documents from research.
Use the general-purpose agent for other tasks.

Break complex tasks into parallel subtasks when possible.`,
    subagents: [researchSubagent, writerSubagent],
  });

  console.log("🚀 Starting Deep Agent with Subagents...\n");

  const result = await agent.generate({
    prompt: `Compare the programming languages Rust and Go. 
Research each language's strengths and use cases, then create a comparison document.`,
    maxSteps: 50,
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

  // Print content of any markdown files
  for (const [path, file] of Object.entries(result.state.files)) {
    if (path.endsWith(".md")) {
      console.log(`\n\n📄 Content of ${path}:`);
      console.log("─".repeat(50));
      console.log(file.content.join("\n"));
    }
  }
}

main().catch(console.error);

