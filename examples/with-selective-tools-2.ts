/**
 * Example: Testing Subagent with Custom Tools
 *
 * This example demonstrates a subagent that has custom tools.
 * The main agent only delegates work to the subagent.
 *
 * Run with: node --import tsx examples/with-selective-tools-copy.ts
 *
 * Requires ANTHROPIC_API_KEY environment variable.
 */

import {
  createDeepAgent,
  type SubAgent,
  type DeepAgentEvent,
} from "../src/index";
import { anthropic } from "@ai-sdk/anthropic";
import { tool } from "ai";
import { z } from "zod";

// Colors for terminal output
const colors = {
  reset: "\x1b[0m",
  dim: "\x1b[2m",
  cyan: "\x1b[36m",
  green: "\x1b[32m",
  yellow: "\x1b[33m",
  magenta: "\x1b[35m",
  blue: "\x1b[34m",
};

// Custom tool: Simple calculator
const calculate = tool({
  description: "Perform mathematical calculations",
  inputSchema: z.object({
    expression: z.string().describe("Mathematical expression to evaluate (e.g., '2 + 2', '10 * 5')"),
  }),
  execute: async ({ expression }) => {
    try {
      // Simple safe evaluation
      const sanitized = expression.replace(/[^0-9+\-*/.() ]/g, "");
      const result = Function(`"use strict"; return (${sanitized})`)();
      return `${expression} = ${result}`;
    } catch {
      return `Error: Could not evaluate expression "${expression}"`;
    }
  },
});

// Custom tool: Word counter
const wordCount = tool({
  description: "Count words in a text",
  inputSchema: z.object({
    text: z.string().describe("The text to analyze"),
  }),
  execute: async ({ text }) => {
    const words = text.split(/\s+/).filter(word => word.length > 0).length;
    return `Word count: ${words} words`;
  },
});

// The task to perform
const TASK = `Calculate the result of (((127 * 89) + 456) / 23) - (89 * 12, be sure to break it down into multiple steps and count the words in "The quick brown fox jumps over the lazy dog while the industrious beaver builds a magnificent dam across the flowing river under the bright moonlight"`;

async function main() {
  console.log("═".repeat(70));
  console.log("  Testing Subagent with Custom Tools");
  console.log("═".repeat(70));
  console.log(`\n${colors.dim}Task: "${TASK}"${colors.reset}\n`);

  // Subagent with custom tools
  const calculator: SubAgent = {
    name: "calculator",
    description: "Performs calculations and text analysis using custom tools",
    systemPrompt: `You are a calculator agent with access to custom tools:
- calculator: For performing mathematical calculations
- word_counter: For counting words in text

Use these tools to complete the tasks given to you.`,
    tools: {
      calculator: calculate,
      word_counter: wordCount,
    },
  };

  // Main agent that only delegates
  const mainAgent = createDeepAgent({
    model: anthropic("claude-haiku-4-5-20251001"),
    systemPrompt: `You are a coordinator. When given a task that involves calculations or text analysis, you MUST delegate it to the calculator subagent using the task tool.

The calculator subagent has these tools:
- calculator: For performing mathematical calculations
- word_counter: For counting words in text

Your job is to:
1. Recognize when a task requires calculation or word counting
2. Use the task tool to delegate to the calculator subagent
3. Return the result from the subagent

Example: If asked to "calculate 2+2", you would call the task tool with description "Calculate 2+2".`,
    subagents: [calculator],
    includeGeneralPurposeAgent: false,
  });

  await runWithStreaming(mainAgent, TASK);

  console.log("\n" + "═".repeat(70));
  console.log("  Test Complete");
  console.log("═".repeat(70));
  console.log(`
  ${colors.green}✓ Main agent delegated work to subagent${colors.reset}
  ${colors.green}✓ Subagent used custom tools (calculator, word_counter)${colors.reset}
  ${colors.green}✓ Task completed successfully${colors.reset}
  `);
}

/**
 * Run a prompt with event streaming
 */
async function runWithStreaming(
  agent: ReturnType<typeof createDeepAgent>,
  prompt: string
) {
  for await (const event of agent.streamWithEvents({
    messages: [{ role: "user", content: prompt }],
    maxSteps: 10,
  })) {
    handleEvent(event);
  }
}

/**
 * Handle streaming events
 */
function handleEvent(event: DeepAgentEvent) {
  switch (event.type) {
    case "subagent-start":
      console.log(`\n${colors.cyan}🤖 SUBAGENT: ${event.name}${colors.reset}`);
      console.log(`${colors.dim}   Task: ${event.task}${colors.reset}`);
      break;

    case "subagent-finish":
      console.log(`\n${colors.green}   ✓ ${event.name} completed${colors.reset}`);
      console.log(`${colors.dim}   Result: ${event.result.slice(0, 200)}${event.result.length > 200 ? '...' : ''}${colors.reset}`);
      break;

    case "subagent-step":
      // Handle subagent step events (including tool calls within subagent)
      console.log(`\n${colors.magenta}   📋 Subagent step ${event.stepIndex + 1}${colors.reset}`);

      // Show tool calls made by the subagent
      if (event.toolCalls && event.toolCalls.length > 0) {
        for (const tc of event.toolCalls) {
          console.log(`${colors.yellow}   → ${tc.toolName}${colors.reset}`);
          if (tc.result) {
            const resultStr = typeof tc.result === 'string'
              ? tc.result
              : JSON.stringify(tc.result);
            console.log(`${colors.dim}      Result: ${resultStr.slice(0, 150)}${resultStr.length > 150 ? '...' : ''}${colors.reset}`);
          }
        }
      }
      break;

    case "step-finish":
      // Show tool calls from main agent
      for (const tc of event.toolCalls) {
        if (tc.toolName === "task") {
          // Task tool call shown via subagent-start
        } else {
          console.log(`${colors.yellow}   → ${tc.toolName}${colors.reset}`);
          if (tc.result) {
            console.log(`${colors.dim}      Result: ${JSON.stringify(tc.result).slice(0, 100)}${colors.reset}`);
          }
        }
      }
      break;

    case "text":
      process.stdout.write(event.text);
      break;

    case "tool-call":
      // Tool call event
      console.log(`${colors.yellow}   → ${event.toolName}${colors.reset}`);
      break;

    case "tool-result":
      // Tool result event
      console.log(`${colors.green}   ✓ ${event.toolName} completed${colors.reset}`);
      break;

    case "done":
      console.log(`\n${colors.green}✓ All tasks completed${colors.reset}`);
      break;
  }
}

main().catch(console.error);
