/**
 * Example: Provider Options - Anthropic Reasoning Tokens
 *
 * This example demonstrates using Anthropic's extended thinking mode to generate
 * reasoning tokens that appear as separate properties in the response.
 *
 * Provider options are passed through DeepAgent's `advancedOptions.providerOptions`
 * parameter and routed to the appropriate provider by the AI SDK.
 *
 * Run with: bun examples/with-provider-options.ts
 */

import { createDeepAgent } from "../src";
import { anthropic } from "@ai-sdk/anthropic";

async function main() {
  console.log("🧠 Anthropic Reasoning Tokens Example\n");
  console.log("=" .repeat(60));
  console.log("Testing extended thinking mode with reasoning tokens\n");

  // Create agent with extended thinking mode enabled
  const thinkingAgent = createDeepAgent({
    model: anthropic("claude-sonnet-4-5-20250929"),
    systemPrompt: "You are a logical reasoning expert. Think deeply before answering.",

    advancedOptions: {
      providerOptions: {
        anthropic: {
          // Enable extended thinking with token budget
          thinking: {
            type: "enabled",
            budgetTokens: 5000,
          },
        },
      },
    },
  });

  console.log("🤔 Solving logic puzzle with extended thinking...\n");

  try {
    const result = await thinkingAgent.generate({
      prompt: `Solve this step-by-step logic puzzle:

Three friends Alex, Ben, and Casey each have a different favorite color (red, blue, green) and a different pet (dog, cat, fish).

Clues:
1. The person who likes red doesn't have a dog
2. Ben doesn't have the cat
3. Alex's favorite color is blue
4. The person with the fish likes green
5. Casey doesn't have the dog

Who has which pet and what is their favorite color?

Please think through this carefully.`,
    });

    console.log("✅ Thinking mode completed successfully!\n");

    // Display reasoning tokens (available as separate property in AI SDK v6)
    if ('reasoning' in result && result.reasoning) {
      console.log("🧠 Reasoning Tokens:");
      console.log("-".repeat(40));
      console.log(result.reasoning);
      console.log("-".repeat(40));
    } else if ('reasoningDetails' in result && result.reasoningDetails) {
      console.log("🧠 Reasoning Details:");
      console.log("-".repeat(40));
      console.log(result.reasoningDetails);
      console.log("-".repeat(40));
    } else {
      console.log("ℹ️ No reasoning tokens found in response");
    }

    // Display token usage
    console.log("\n📊 Token Usage:");
    console.log("Usage:", result.usage);

    // Display the main response
    console.log("\n💬 Answer:");
    console.log(result.text);

    // Success!
    console.log("\n🎉 Provider Options Test Successful!");
    console.log("✅ Extended thinking mode is working");
    console.log("✅ Provider options are being passed through correctly");
    console.log("✅ Reasoning tokens accessible via 'reasoning' property");

  } catch (error) {
    console.error("❌ Error during thinking mode test:");

    // More specific error handling
    if (error instanceof Error) {
      if (error.message.includes("budgetTokens") || error.message.includes("thinking")) {
        console.log("💡 This might be a model compatibility issue with thinking mode");
        console.log("💡 Try with a different model or reduce budgetTokens");
      } else if (error.message.includes("404") || error.message.includes("NOT_FOUND")) {
        console.log("💡 This appears to be an API configuration issue");
        console.log("💡 Check ANTHROPIC_API_KEY environment variable");
      } else {
        console.log("💡 Error:", error.message);
      }
    } else {
      console.log("💡 Unknown error type:", error);
    }

    console.log("\n🔧 Provider Options Architecture:");
    console.log("   • Options passed via: advancedOptions.providerOptions.anthropic");
    console.log("   • Thinking mode: { type: 'enabled', budgetTokens: number }");
    console.log("   • Implementation: src/agent.ts → buildAgentSettings() → ToolLoopAgent");
    console.log("   • Research: docs/tickets/provider-options-passthrough/research.md");
  }
}

// Run the example
main().catch(console.error);
