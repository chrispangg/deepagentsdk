/**
 * Example: Using Langfuse for observability with DeepAgent
 *
 * Langfuse provides tracing, monitoring, and debugging for AI applications.
 * This example shows how to integrate Langfuse with DeepAgent using OpenTelemetry.
 *
 * Setup:
 * 1. Set environment variables:
 *    LANGFUSE_SECRET_KEY=sk-lf-...
 *    LANGFUSE_PUBLIC_KEY=pk-lf-...
 *    LANGFUSE_BASEURL=https://cloud.langfuse.com  # or https://us.cloud.langfuse.com for US
 *
 * 2. Run with: node --import tsx examples/with-langfuse.ts
 *
 * @see https://ai-sdk.dev/providers/observability/langfuse
 */

import { createDeepAgent } from "../src/index";
import { openai } from "@ai-sdk/openai";
import { NodeSDK } from "@opentelemetry/sdk-node";
import { LangfuseSpanProcessor } from "@langfuse/otel";
// ============================================================================
// OpenTelemetry Setup for Langfuse
// ============================================================================

// Initialize OpenTelemetry with Langfuse exporter
// This captures all AI SDK telemetry and sends it to Langfuse

const sdk = new NodeSDK({
    spanProcessors: [new LangfuseSpanProcessor()],
  });
   
  sdk.start();

// ============================================================================
// Example 1: Basic Tracing with DeepAgent
// ============================================================================

async function basicTracingExample() {
  console.log("📊 Example 1: Basic Langfuse Tracing\n");

  const agent = createDeepAgent({
    model: openai("gpt-4o") as any,
    systemPrompt: `You are a helpful assistant. Keep responses brief.`,
    advancedOptions: {
      experimental_telemetry: { isEnabled: true },
    },
  });

  // The generate() method will automatically emit OpenTelemetry spans
  // that Langfuse captures for tracing
  const result = await agent.generate({
    prompt: "What are the three laws of robotics? List them briefly.",
    maxSteps: 3,
    
  });

  console.log("Response:", result.text);
  console.log("\n✅ Trace sent to Langfuse dashboard\n");
}


// ============================================================================
// Example 3: Streaming with Telemetry
// ============================================================================

async function streamingWithTelemetryExample() {
  console.log("📊 Example 3: Streaming with Telemetry\n");

  const agent = createDeepAgent({
    model: openai("gpt-4o") as any,
    systemPrompt: `You are a creative writer. Write engaging short content.`,
    advancedOptions: {
      experimental_telemetry: { isEnabled: true },
    },
  });

  console.log("Streaming response:\n");

  // Use streamWithEvents for real-time streaming with full telemetry
  for await (const event of agent.streamWithEvents({
    messages: [{ role: "user", content: "Write a haiku about programming." }],
    maxSteps: 2,
  })) {
    switch (event.type) {
      case "text":
        process.stdout.write(event.text);
        break;
      case "step-finish":
        console.log(`\n[Step ${event.stepNumber} completed]`);
        break;
      case "done":
        console.log("\n\n✅ Stream completed, telemetry sent to Langfuse\n");
        break;
      case "error":
        console.error("\n❌ Error:", event.error);
        break;
    }
  }
}

// ============================================================================
// Example 4: Multi-Step Agent with Tool Tracing
// ============================================================================

async function multiStepToolTracingExample() {
  console.log("📊 Example 4: Multi-Step Agent with Tool Tracing\n");

  const agent = createDeepAgent({
    model: openai("gpt-4o") as any,
    systemPrompt: `You are a project planner. Use the write_todos tool to create task lists
and write_file to save documentation. Be thorough but concise.`,
  });

  const result = await agent.generate({
    prompt:
      "Plan a simple web scraping project. Create todos for the main tasks and save a brief project overview to /project-overview.md",
    maxSteps: 10,
  });

  console.log("Response:", result.text);

  // Show todos
  if (result.state.todos.length > 0) {
    console.log("\n📋 Project Tasks:");
    for (const todo of result.state.todos) {
      const emoji = {
        pending: "⏳",
        in_progress: "🔄",
        completed: "✅",
        cancelled: "❌",
      }[todo.status];
      console.log(`  ${emoji} ${todo.content}`);
    }
  }

  // Show files created
  const files = Object.keys(result.state.files);
  if (files.length > 0) {
    console.log("\n📁 Files Created:");
    for (const file of files) {
      console.log(`  - ${file}`);
    }
  }

  console.log("\n✅ Multi-step trace with tool calls sent to Langfuse\n");
}

// ============================================================================
// Main Execution
// ============================================================================

async function main() {
  console.log("═".repeat(60));
  console.log("🔍 Langfuse Observability Integration with DeepAgent");
  console.log("═".repeat(60));
  console.log("\nAll traces will be visible in your Langfuse dashboard at:");
  console.log(
    `  ${process.env.LANGFUSE_BASEURL || "https://us.cloud.langfuse.com"}\n`
  );
  console.log("─".repeat(60) + "\n");

  try {
    // Run examples sequentially
    // await basicTracingExample();
    // console.log("─".repeat(60) + "\n");

    await streamingWithTelemetryExample();
    console.log("─".repeat(60) + "\n");

    // await multiStepToolTracingExample();
  } finally {
    // Flush and shutdown the SDK to ensure all traces are sent
    console.log("─".repeat(60));
    console.log("\n🔄 Flushing telemetry data to Langfuse...");
    await sdk.shutdown();
    console.log("✅ All telemetry data sent successfully!\n");
    console.log("═".repeat(60));
    console.log("View your traces at: https://cloud.langfuse.com");
    console.log("═".repeat(60));
  }
}

main().catch((error) => {
  console.error("Fatal error:", error);
  sdk.shutdown().finally(() => process.exit(1));
});

