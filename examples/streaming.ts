/**
 * Streaming example demonstrating real-time events from Deep Agent.
 *
 * Run with: ANTHROPIC_API_KEY=your-key bun examples/streaming.ts
 */

import { createDeepAgent, type DeepAgentEvent } from "../src/index.ts";

async function main() {
  // Create a deep agent
  const agent = createDeepAgent({
    model: "anthropic/claude-sonnet-4-20250514",
    systemPrompt: `You are a helpful assistant. Break down tasks into todos and work through them methodically.`,
    maxSteps: 15,
  });

  console.log("🚀 Starting Deep Agent with streaming events...\n");

  // Stream with events
  for await (const event of agent.streamWithEvents({
    prompt: "Create a simple todo list for learning TypeScript, then write a brief guide to /typescript-guide.md",
  })) {
    handleEvent(event);
  }
}

/**
 * Handle each event type
 */
function handleEvent(event: DeepAgentEvent) {
  switch (event.type) {
    case "text":
      // Stream text in real-time
      process.stdout.write(event.text);
      break;

    case "step-start":
      if (event.stepNumber > 1) {
        console.log(`\n\n── Step ${event.stepNumber} ──`);
      }
      break;

    case "step-finish":
      // Log tool calls that happened in this step
      for (const tc of event.toolCalls) {
        console.log(`\n✓ ${tc.toolName} completed`);
      }
      break;

    case "todos-changed":
      console.log(`\n📋 Todos updated (${event.todos.length} items):`);
      for (const todo of event.todos) {
        const emoji = {
          pending: "⏳",
          in_progress: "🔄",
          completed: "✅",
          cancelled: "❌",
        }[todo.status];
        console.log(`   ${emoji} ${todo.content}`);
      }
      break;

    case "file-write-start":
      // Show preview of file being written
      console.log(`\n📁 Writing: ${event.path}`);
      console.log("┌" + "─".repeat(50) + "┐");
      const previewLines = event.content.split("\n").slice(0, 10);
      for (let i = 0; i < previewLines.length; i++) {
        const line = previewLines[i]?.substring(0, 48) || "";
        console.log(`│ ${String(i + 1).padStart(2)} ${line}`);
      }
      if (event.content.split("\n").length > 10) {
        console.log(`│ ... ${event.content.split("\n").length - 10} more lines ...`);
      }
      console.log("└" + "─".repeat(50) + "┘");
      break;

    case "file-written":
      console.log(`✓ Wrote: ${event.path}`);
      break;

    case "file-edited":
      console.log(`\n✏️ Edited: ${event.path} (${event.occurrences} changes)`);
      break;

    case "subagent-start":
      console.log(`\n🤝 Starting subagent: ${event.name}`);
      console.log(`   Task: ${event.task.substring(0, 100)}...`);
      break;

    case "subagent-finish":
      console.log(`\n✓ Subagent ${event.name} completed`);
      break;

    case "done":
      console.log("\n\n🎉 Done!");
      console.log(`   Todos: ${event.state.todos.length}`);
      console.log(`   Files: ${Object.keys(event.state.files).length}`);
      
      // Show final files
      for (const [path, file] of Object.entries(event.state.files)) {
        console.log(`\n📄 ${path}:`);
        console.log("─".repeat(40));
        console.log(file.content.join("\n"));
      }
      break;

    case "error":
      console.error(`\n💥 Error: ${event.error.message}`);
      break;
  }
}

main().catch(console.error);

