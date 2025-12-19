/**
 * Example using custom tools alongside built-in tools.
 *
 * Run with: ANTHROPIC_API_KEY=your-key bun examples/with-custom-tools.ts
 */

import { tool } from "ai";
import { z } from "zod";
import { createDeepAgent } from "../src/index";
import { anthropic } from "@ai-sdk/anthropic";

// Custom tool: Get current date/time
const getCurrentTime = tool({
  description: "Get the current date and time",
  inputSchema: z.object({}),
  execute: async () => {
    const now = new Date();
    return `Current time: ${now.toISOString()}`;
  },
});

// Custom tool: Simple calculator
const calculate = tool({
  description: "Perform a mathematical calculation",
  inputSchema: z.object({
    expression: z
      .string()
      .describe(
        "Mathematical expression to evaluate (e.g., '2 + 2', '10 * 5')"
      ),
  }),
  execute: async ({ expression }) => {
    try {
      // Simple safe evaluation (in production, use a proper math parser)
      const sanitized = expression.replace(/[^0-9+\-*/.() ]/g, "");
      const result = Function(`"use strict"; return (${sanitized})`)();
      return `${expression} = ${result}`;
    } catch {
      return `Error: Could not evaluate expression "${expression}"`;
    }
  },
});

// Custom tool: Generate random number
const randomNumber = tool({
  description: "Generate a random number within a range",
  inputSchema: z.object({
    min: z.number().describe("Minimum value (inclusive)"),
    max: z.number().describe("Maximum value (inclusive)"),
  }),
  execute: async ({ min, max }) => {
    const result = Math.floor(Math.random() * (max - min + 1)) + min;
    return `Random number between ${min} and ${max}: ${result}`;
  },
});

async function main() {
  const agent = createDeepAgent({
    model: anthropic("claude-sonnet-4-20250514"),
    systemPrompt: `You are a helpful assistant with access to utility tools.

You have access to:
- get_current_time: Get the current date and time
- calculate: Perform mathematical calculations
- random_number: Generate random numbers

Plus all the standard deep agent tools (todos, filesystem, subagents).`,
    tools: {
      get_current_time: getCurrentTime,
      calculate,
      random_number: randomNumber,
    },
  });

  console.log("🚀 Starting Deep Agent with Custom Tools...\n");

  const result = await agent.generate({
    prompt: `Please help me with the following:
1. What is the current time?
2. Calculate 15% of 250
3. Generate 3 random numbers between 1 and 100
4. Write a summary of these results to a file called /results.txt`,
    maxSteps: 20,
  });

  console.log("\n📝 Agent Response:");
  console.log("─".repeat(50));
  console.log(result.text);

  console.log("\n\n📁 Files Created:");
  console.log("─".repeat(50));
  for (const [path, file] of Object.entries(result.state.files)) {
    console.log(`\n📄 ${path}:`);
    console.log(file.content.join("\n"));
  }
}

main().catch(console.error);
