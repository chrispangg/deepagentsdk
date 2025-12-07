/**
 * Example using LocalSandbox for command execution with streaming events.
 *
 * This example demonstrates how to use the LocalSandbox backend which allows
 * the agent to both manage files AND execute shell commands in a local directory.
 *
 * The execute tool is AUTOMATICALLY added when using a SandboxBackendProtocol!
 *
 * Run with: bun examples/with-local-sandbox.ts
 *
 * Bun automatically loads .env files, so just create a .env file with:
 *   ANTHROPIC_API_KEY=your-key
 */

import {
  createDeepAgent,
  LocalSandbox,
  isSandboxBackend,
  type DeepAgentEvent,
} from "../src/index.ts";
import { anthropic } from "@ai-sdk/anthropic";
import * as fs from "fs";
import * as path from "path";

// Create a workspace directory for the sandbox
const workspaceDir = path.join(process.cwd(), ".sandbox-workspace");

// Ensure workspace exists
if (!fs.existsSync(workspaceDir)) {
  fs.mkdirSync(workspaceDir, { recursive: true });
}

// Create a LocalSandbox with the workspace directory
const sandbox = new LocalSandbox({
  cwd: workspaceDir,
  timeout: 60000, // 60 second timeout for commands
  env: {
    // Add any environment variables needed
    NODE_ENV: "development",
  },
});

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
      console.log("┌" + "─".repeat(50) + "┐");
      const previewLines = event.content.split("\n").slice(0, 10);
      for (let i = 0; i < previewLines.length; i++) {
        const line = previewLines[i]?.substring(0, 48) || "";
        console.log(`│ ${String(i + 1).padStart(2)} ${line}`);
      }
      if (event.content.split("\n").length > 10) {
        console.log(
          `│ ... ${event.content.split("\n").length - 10} more lines ...`
        );
      }
      console.log("└" + "─".repeat(50) + "┘");
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

    case "subagent-start":
      console.log(`\n🤝 Starting subagent: ${event.name}`);
      console.log(`   Task: ${event.task.substring(0, 100)}...`);
      break;

    case "subagent-finish":
      console.log(`\n  ✓ Subagent ${event.name} completed`);
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

async function main() {
  console.log("🚀 Starting Deep Agent with LocalSandbox...\n");
  console.log(`📁 Workspace: ${workspaceDir}`);
  console.log(`🔑 Sandbox ID: ${sandbox.id}\n`);

  // Verify the backend is a sandbox
  if (isSandboxBackend(sandbox)) {
    console.log("✅ Backend supports command execution");
    console.log("   The 'execute' tool will be automatically added!\n");
  }

  // Create the agent with LocalSandbox as the backend
  // The execute tool is AUTOMATICALLY added because sandbox implements SandboxBackendProtocol
  const agent = createDeepAgent({
    model: anthropic("claude-sonnet-4-20250514"),
    backend: sandbox,
    systemPrompt: `You are a software development assistant with access to a local sandbox environment.

You can:
1. Create and edit files in the workspace
2. Execute shell commands using the 'execute' tool (automatically available)
3. Plan your work using todos

The workspace is a real directory on the local filesystem at: ${workspaceDir}

When creating projects:
- Always create a package.json first if needed
- Use appropriate commands for the runtime (bun or node)
- Check command output for errors and fix them

Be efficient and avoid unnecessary commands.`,
  });

  console.log("─".repeat(60));
  console.log("📝 Agent Response (streaming):");
  console.log("─".repeat(60) + "\n");

  // Stream with events - this shows real-time progress!
  for await (const event of agent.streamWithEvents({
    prompt: `Create a simple "hello world" TypeScript project in the workspace:

1. Create a package.json with name "hello-world" and a "start" script
2. Create a src/index.ts file that prints "Hello from LocalSandbox!"
3. Run the script using "bun src/index.ts" to verify it works

Use the execute tool to run commands. Show me the output of running the script.`,
    maxSteps: 15,
  })) {
    handleEvent(event);
  }

  // Show final state of workspace
  console.log("\n\n📁 Files in Workspace:");
  console.log("─".repeat(50));
  const listResult = await sandbox.execute(
    "find . -type f \\( -name '*.ts' -o -name '*.json' \\) 2>/dev/null | head -20"
  );
  console.log(listResult.output || "No files found");

  // Show the created files
  console.log("\n\n📄 File Contents:");
  console.log("─".repeat(50));

  // Read package.json if it exists
  const packageJsonResult = await sandbox.execute(
    "cat package.json 2>/dev/null || echo 'File not found'"
  );
  console.log("\npackage.json:");
  console.log(packageJsonResult.output);

  // Read src/index.ts if it exists
  const indexResult = await sandbox.execute(
    "cat src/index.ts 2>/dev/null || echo 'File not found'"
  );
  console.log("\nsrc/index.ts:");
  console.log(indexResult.output);

  console.log("\n\n🧹 Cleanup:");
  console.log("─".repeat(50));
  console.log(`To remove the workspace, run: rm -rf ${workspaceDir}`);
}

main().catch(console.error);
