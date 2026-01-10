/**
 * Example using E2B Sandbox for secure cloud code execution with streaming events.
 *
 * This example demonstrates how to use the E2B backend which allows
 * the agent to execute code in an isolated cloud sandbox using Firecracker microVMs.
 *
 * The execute tool is AUTOMATICALLY added when using a SandboxBackendProtocol!
 *
 * Run with: E2B_API_KEY=your-key bun examples/with-e2b-sandbox.ts
 *
 * Get your API key at: https://e2b.dev/docs
 *
 * Features of E2B:
 * - Fast startup (~2-3 seconds)
 * - Auto-cleanup after 5 minutes of inactivity
 * - Default working directory: /home/user
 * - Isolated environment with popular pre-installed tools
 */

import {
  createDeepAgent,
  createE2BBackend,
  isSandboxBackend,
  type DeepAgentEvent,
} from "../src/index";
import { anthropic } from "@ai-sdk/anthropic";

async function main() {
  console.log("🚀 Starting Deep Agent with E2B Sandbox...\n");

  // Create an E2B sandbox backend
  // Note: E2B requires async initialization via factory function
  const sandbox = await createE2BBackend({
    template: "base", // Use the "base" template (Node.js, Python, Bun pre-installed)
    timeout: 5 * 60 * 1000, // 5 minute timeout for commands
  });

  console.log(`🔑 Sandbox ID: ${sandbox.id}`);
  console.log(`📁 Working Directory: /home/user`);
  console.log(`⏱️  Timeout: 5 minutes per command\n`);

  // Verify the backend is a sandbox
  if (isSandboxBackend(sandbox)) {
    console.log("✅ Backend supports command execution");
    console.log("   The 'execute' tool will be automatically added!\n");
  }

  /**
   * Handle each streaming event
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
          console.log(`\n  ✓ ${tc.toolName} completed`);
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
        console.log(`\n📁 Writing: ${event.path}`);
        break;

      case "file-written":
        console.log(`  ✓ Wrote: ${event.path}`);
        break;

      case "file-edited":
        console.log(`\n✏️ Edited: ${event.path} (${event.occurrences} changes)`);
        break;

      case "execute-start":
        console.log(`\n🔧 Executing: ${event.command}`);
        break;

      case "execute-finish":
        const status = event.exitCode === 0 ? "✓" : "✗";
        console.log(`  ${status} Exit code: ${event.exitCode}`);
        if (event.truncated) {
          console.log(`  ⚠️ Output was truncated`);
        }
        break;

      case "done":
        console.log("\n\n" + "═".repeat(60));
        console.log("🎉 Done!");
        console.log("═".repeat(60));
        console.log(`   Todos: ${event.state.todos.length}`);
        console.log(`   Files: ${Object.keys(event.state.files).length}`);
        break;

      case "error":
        console.error(`\n💥 Error: ${event.error.message}`);
        break;
    }
  }

  // Create the agent with E2B sandbox as the backend
  // The execute tool is AUTOMATICALLY added because sandbox implements SandboxBackendProtocol
  const agent = createDeepAgent({
    model: anthropic("claude-haiku-4-5-20251001"),
    backend: sandbox,
    systemPrompt: `You are a software development assistant with access to a secure cloud sandbox environment (E2B).

You can:
1. Create and edit files in /home/user
2. Execute shell commands using the 'execute' tool (automatically available)
3. Plan your work using todos
4. Run Python, Node.js, and other interpreted languages

Available tools:
- Node.js (node, npm, bun)
- Python (python3, pip)
- Git

When creating projects:
- Always create a package.json first if needed
- Use appropriate commands for the runtime
- Check command output for errors and fix them

Be efficient and avoid unnecessary commands.`,
  });

  console.log("─".repeat(60));
  console.log("📝 Agent Response (streaming):");
  console.log("─".repeat(60) + "\n");

  try {
    // Stream with events - this shows real-time progress!
    for await (const event of agent.streamWithEvents({
      messages: [
        {
          role: "user",
          content: `Create a simple Python script that calculates Fibonacci numbers:

1. Create a fibonacci.py file that:
   - Takes a number n as input
   - Calculates the nth Fibonacci number
   - Prints the result

2. Run the script with n=20 to verify it works

3. Show me the output

Use the execute tool to run commands. Show me the output of running the script.`,
        },
      ],
      maxSteps: 10,
    })) {
      handleEvent(event);
    }

    // Show final state by executing a command in the sandbox
    console.log("\n\n📁 Files in Sandbox:");
    console.log("─".repeat(50));
    const listResult = await sandbox.execute("ls -la");
    console.log(listResult.output);

    // Show the created file
    console.log("\n\n📄 Fibonacci Script:");
    console.log("─".repeat(50));
    const catResult = await sandbox.execute("cat fibonacci.py");
    console.log(catResult.output);

  } finally {
    // Clean up the sandbox
    console.log("\n\n🧹 Cleanup:");
    console.log("─".repeat(50));
    console.log("Terminating E2B sandbox...");
    await sandbox.dispose();
    console.log("✅ Sandbox terminated");
    console.log("\n💡 Note: E2B also auto-cleans after 5 minutes of inactivity");
  }
}

// Check for API key
if (!process.env.E2B_API_KEY) {
  console.error("❌ E2B_API_KEY environment variable is required");
  console.error("\nGet your API key at: https://e2b.dev/docs");
  console.error("\nThen run:");
  console.error("  E2B_API_KEY=your-key bun examples/with-e2b-sandbox.ts");
  process.exit(1);
}

main().catch(console.error);
