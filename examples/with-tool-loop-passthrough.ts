/**
 * Example: ToolLoopAgent Passthrough Options
 *
 * This example demonstrates how to use advanced AI SDK v6 ToolLoopAgent features
 * through DeepAgent's new passthrough options.
 *
 * Run with: bun examples/with-tool-loop-passthrough.ts
 */

import { createDeepAgent, type DeepAgentEvent, type BackendProtocol } from "../src";
import { anthropic } from "@ai-sdk/anthropic";
import { hasToolCall } from "ai";
import { FilesystemBackend } from "../src/backends/filesystem";

async function main() {
  console.log("🚀 Creating DeepAgent with ToolLoopAgent passthrough options...\n");

  const agent = createDeepAgent({
    model: anthropic("claude-haiku-4-5-20251001"),
    systemPrompt: "You are a helpful research assistant. Use the task tool to delegate work when needed.",
    backend: new FilesystemBackend({ rootDir: process.cwd() + "/workspace" }) as BackendProtocol,

    // Loop Control: Customize iteration behavior
    loopControl: {
      // Force planning on first step
      prepareStep: async ({ stepNumber }) => {
        if (stepNumber === 0) {
          console.log("📋 Step 0: Forcing planning tool to create todos");
          return { toolChoice: { type: "tool", toolName: "write_todos" } };
        }
        return {};
      },

      // Log each step completion
      onStepFinish: async (stepResult) => {
        console.log(`\n✅ Step completed: ${stepResult.toolCalls.length} tool calls made`);

        // Log specific tool calls
        for (const toolCall of stepResult.toolCalls) {
          if (toolCall.toolName === "task") {
            const input = toolCall.input as { description?: string };
            console.log(`   🔄 Delegated to subagent: "${input.description}"`);
          }
        }
      },

      // Log final completion
      onFinish: async (event) => {
        console.log(`\n🎉 Agent finished!`);
        console.log(`   Total steps: ${event.steps.length}`);
        console.log(`   Total tokens: ${event.totalUsage.totalTokens}`);
      },

      // Stop when 'final_answer' tool is called OR max steps reached
      stopWhen: hasToolCall("final_answer"),
    },

    // Generation Options: Fine-tune model behavior
    generationOptions: {
      maxOutputTokens: 4000, // Limit response length
      maxRetries: 3, // Retry failed API calls up to 3 times
    },

    // Subagent with different settings
    subagents: [
      {
        name: "research-agent",
        description: "Focused research specialist for finding information",
        systemPrompt: "You are a research specialist. Conduct thorough, focused research and provide detailed findings.",

        // Override generation options for this subagent
        generationOptions: {
          maxOutputTokens: 2000,
        },

        // Inherit telemetry from parent
      },

      {
        name: "writer-agent",
        description: "Writing specialist for creating content",
        systemPrompt: "You are a writing specialist. Create clear, well-structured content based on the research provided.",

        generationOptions: {
          maxOutputTokens: 3000,
        },
      },
    ],
  });

  console.log("🔍 Researching the latest AI trends...\n");

  // Stream with events
  for await (const event of agent.streamWithEvents({
    prompt: "Research the latest trends in large language models and create a summary. Do not use subagents.",
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

    case "web-search-start":
      console.log(`\n🔍 Searching: "${event.query}"`);
      break;

    case "web-search-finish":
      console.log(`✓ Found ${event.resultCount} results`);
      break;

    case "fetch-url-start":
      console.log(`\n📥 Fetching: ${event.url}`);
      break;

    case "fetch-url-finish":
      console.log(`${event.success ? "✓" : "✗"} Fetch ${event.success ? "complete" : "failed"}`);
      break;

    case "http-request-start":
      console.log(`\n🌐 HTTP ${event.method} ${event.url}`);
      break;

    case "http-request-finish":
      console.log(`${event.statusCode >= 200 && event.statusCode < 300 ? "✓" : "✗"} Status: ${event.statusCode}`);
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

// Run the example
main().catch(console.error);