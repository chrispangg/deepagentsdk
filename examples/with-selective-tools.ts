/**
 * Example: Subagents with Selective Builtin Tools AND Custom Tools
 *
 * This example demonstrates three approaches:
 * 1. A single DeepAgent doing everything itself
 * 2. A DeepAgent coordinating specialized subagents (with built-in tools only)
 * 3. A DeepAgent coordinating a subagent with BOTH built-in AND custom tools
 *
 * All perform the SAME task (research, calculate, and document), but the streaming
 * events show WHO is doing WHAT in each approach.
 *
 * Run with: node --import tsx examples/with-selective-tools.ts
 *
 * Requires ANTHROPIC_API_KEY and TAVILY_API_KEY environment variables.
 */

import {
  createDeepAgent,
  type SubAgent,
  type DeepAgentEvent,
  // Import individual builtin tool creators for selective assignment
  web_search,
  fetch_url,
  write_file,
  read_file,
  write_todos,
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

// Custom tool: Word counter for text analysis
const wordCount = tool({
  description: "Count words, characters, and sentences in a text",
  inputSchema: z.object({
    text: z.string().describe("The text to analyze"),
  }),
  execute: async ({ text }) => {
    const words = text.split(/\s+/).filter(word => word.length > 0).length;
    const characters = text.length;
    const sentences = text.split(/[.!?]+/).filter(s => s.trim().length > 0).length;
    return `Text analysis: ${words} words, ${characters} characters, ${sentences} sentences`;
  },
});

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

// The task all demos will perform
const TASK = `Research the benefits of TypeScript, calculate 25% of 4000, then save a summary with word count to /typescript-benefits.txt`;

async function main() {
  console.log("═".repeat(70));
  console.log("  Selective Builtin Tools & Custom Tools: Three Approaches");
  console.log("═".repeat(70));
  console.log(`\n${colors.dim}Task: "${TASK}"${colors.reset}\n`);

  // =========================================================================
  // DEMO 1: Single DeepAgent (no subagents)
  // =========================================================================

  console.log("─".repeat(70));
  console.log(`${colors.cyan}DEMO 1: Single DeepAgent (does everything itself)${colors.reset}`);
  console.log("─".repeat(70));
  console.log(`${colors.dim}The agent has all tools (built-in + custom) and does all work directly.${colors.reset}\n`);

  const singleAgent = createDeepAgent({
    model: anthropic("claude-haiku-4-5-20251001"),
    systemPrompt: `You research topics, perform calculations, and write documentation.
Create a todo list to track your work, research using web search, perform calculations, then save findings to a file.`,
    tools: {
      word_counter: wordCount,
      calculator: calculate,
    },
  });

  await runWithStreaming(singleAgent, TASK, "DEMO 1");

  // =========================================================================
  // DEMO 2: DeepAgent with Specialized Subagents (built-in tools only)
  // =========================================================================

  console.log("\n\n" + "─".repeat(70));
  console.log(`${colors.cyan}DEMO 2: Specialized Subagents (built-in tools only)${colors.reset}`);
  console.log("─".repeat(70));
  console.log(`${colors.dim}Each subagent has specific built-in tools. Watch which one handles each part.${colors.reset}`);
  console.log(`
  ${colors.magenta}• researcher${colors.reset}: web_search, fetch_url (web research only)
  ${colors.blue}• writer${colors.reset}:     write_file, read_file (file operations only)
  ${colors.green}• planner${colors.reset}:    write_todos (task planning only)
`);

  // Subagent for web research - can ONLY search the web
  const researcher: SubAgent = {
    name: "researcher",
    description: "Searches the web for information. Cannot write files or manage todos.",
    systemPrompt: "You search the web and summarize findings. Return your findings as text.",
    tools: [web_search, fetch_url],
  };

  // Subagent for file writing - can ONLY work with files
  const writer: SubAgent = {
    name: "writer",
    description: "Writes content to files. Cannot search the web or manage todos.",
    systemPrompt: "You write content to files. You receive content to save and write it to the specified file.",
    tools: [write_file, read_file],
  };

  // Subagent for planning - can ONLY manage todos
  const planner: SubAgent = {
    name: "planner",
    description: "Creates and manages todo lists. Cannot search web or write files.",
    systemPrompt: "You create structured task lists to track work progress.",
    tools: [write_todos],
  };

  const coordinatorAgent = createDeepAgent({
    model: anthropic("claude-haiku-4-5-20251001"),
    systemPrompt: `You coordinate specialized subagents to complete tasks.

IMPORTANT: You MUST delegate work using the task tool. Each subagent has LIMITED capabilities:
• researcher: Can ONLY search the web (no files, no todos)
• writer: Can ONLY write files (no web, no todos)
• planner: Can ONLY manage todos (no web, no files)

For this task:
1. Use planner to create a todo list
2. Use researcher to search the web
3. Use writer to save the findings to a file

Always delegate - do not do the work yourself.`,
    subagents: [researcher, writer, planner],
    includeGeneralPurposeAgent: false,
  });

  await runWithStreaming(coordinatorAgent, TASK, "DEMO 2");

  // =========================================================================
  // DEMO 3: Subagent with Built-in AND Custom Tools
  // =========================================================================

  console.log("\n\n" + "─".repeat(70));
  console.log(`${colors.cyan}DEMO 3: Subagent with Built-in AND Custom Tools${colors.reset}`);
  console.log("─".repeat(70));
  console.log(`${colors.dim}A subagent that has both built-in tools AND custom tools.${colors.reset}`);
  console.log(`
  ${colors.yellow}• analyst${colors.reset}: web_search, fetch_url (built-in)
                + word_counter, calculator (custom tools)
  ${colors.green}• planner${colors.reset}: write_todos (built-in only)
`);

  // Subagent with mixed tools (built-in + custom)
  const analyst: SubAgent = {
    name: "analyst",
    description: "Researches topics, performs calculations, and analyzes text. Has both built-in and custom tools.",
    systemPrompt: `You are an analyst with access to these specific tools:
- web_search, fetch_url: For web research (built-in tools)
- calculator: For performing calculations (custom tool)
- word_counter: For analyzing text (custom tool)

When given a task, use ALL relevant tools. For calculations, use the calculator tool. For text analysis, use the word_counter tool.`,
    tools: [
      web_search,
      fetch_url,
      { word_counter: wordCount },
      { calculator: calculate }
    ],
  };

  // Simple planner subagent
  const simplePlanner: SubAgent = {
    name: "planner",
    description: "Creates and manages todo lists",
    systemPrompt: "You create structured task lists to track work progress.",
    tools: [write_todos],
  };

  const mixedAgent = createDeepAgent({
    model: anthropic("claude-haiku-4-5-20251001"),
    systemPrompt: `You coordinate specialized subagents to complete tasks.

You MUST delegate ALL work using the task tool - do not do any work yourself.

Available subagents:
- planner: Creates todo lists
- analyst: Researches topics, performs calculations, and analyzes text

For this task: "Research the benefits of TypeScript, calculate 25% of 4000, then save a summary with word count"
1. Use the planner to create a todo list
2. Use the analyst to:
   - Research TypeScript benefits (using web_search)
   - Calculate 25% of 4000 (using calculator tool)
   - Analyze and count words in the summary (using word_counter tool)

IMPORTANT: The analyst has custom tools available - make sure to tell it to use them!`,
    subagents: [analyst, simplePlanner],
    includeGeneralPurposeAgent: false,
  });

  await runWithStreaming(mixedAgent, TASK, "DEMO 3");

  // =========================================================================
  // COMPARISON SUMMARY
  // =========================================================================

  console.log("\n\n" + "═".repeat(70));
  console.log("  COMPARISON");
  console.log("═".repeat(70));
  console.log(`
  ${colors.cyan}DEMO 1 - Single Agent:${colors.reset}
  • One agent does everything: planning, research, calculations
  • Has access to all built-in AND custom tools
  • Simpler but less control over capabilities

  ${colors.cyan}DEMO 2 - Specialized Subagents (built-in only):${colors.reset}
  • Parent coordinates, subagents execute
  • ${colors.magenta}researcher${colors.reset} handles web search (only has web tools)
  • ${colors.blue}writer${colors.reset} handles file writing (only has file tools)
  • ${colors.green}planner${colors.reset} handles todos (only has todo tools)
  • Each subagent is LIMITED to its assigned built-in tools

  ${colors.cyan}DEMO 3 - Subagent with Mixed Tools:${colors.reset}
  • ${colors.yellow}analyst${colors.reset} has BOTH built-in (web_search, fetch_url) AND custom tools (word_counter, calculator)
  • Shows how to mix built-in and custom tools in a single subagent
  • Custom tools passed using object notation: { tool_name: toolInstance }

  ${colors.yellow}Key Benefits:${colors.reset}
  • Selective tools let you control exactly what each subagent can do
  • Custom tools can be added to any subagent alongside built-in ones
  • Useful for security, focus, and specialization
  `);
}

/**
 * Run a prompt with event streaming
 */
async function runWithStreaming(
  agent: ReturnType<typeof createDeepAgent>,
  prompt: string,
  demoLabel: string
) {
  for await (const event of agent.streamWithEvents({
    messages: [{ role: "user", content: prompt }],
    maxSteps: 15,
  })) {
    handleEvent(event, demoLabel);
  }
}

/**
 * Handle streaming events
 */
function handleEvent(event: DeepAgentEvent, demoLabel: string) {
  switch (event.type) {
    case "subagent-start":
      // Color-code by subagent name
      const agentColor = event.name === "researcher" ? colors.magenta
        : event.name === "writer" ? colors.blue
        : event.name === "planner" ? colors.green
        : event.name === "analyst" ? colors.yellow
        : colors.cyan;
      console.log(`\n${agentColor}🤖 SUBAGENT: ${event.name}${colors.reset}`);
      console.log(`${colors.dim}   Task: ${event.task.slice(0, 60)}...${colors.reset}`);
      break;

    case "subagent-finish":
      console.log(`${colors.green}   ✓ ${event.name} completed${colors.reset}`);
      break;

    case "step-finish":
      // Show tool calls
      for (const tc of event.toolCalls) {
        if (tc.toolName === "task") {
          // Task tool call shown via subagent-start
        } else {
          console.log(`${colors.yellow}   → ${tc.toolName}${colors.reset}`);
        }
      }
      break;

    case "todos-changed":
      console.log(`${colors.green}   📋 Todos: ${event.todos.map(t => t.content.slice(0, 40)).join(", ")}${colors.reset}`);
      break;

    case "file-written":
      console.log(`${colors.green}   📁 Wrote: ${event.path}${colors.reset}`);
      break;

    case "web-search-start":
      console.log(`${colors.yellow}   🔍 Searching: "${event.query}"${colors.reset}`);
      break;

    case "web-search-finish":
      console.log(`${colors.green}   ✓ Found ${event.resultCount} results${colors.reset}`);
      break;

    case "done":
      console.log(`\n${colors.dim}[${demoLabel}] Complete - Files: ${Object.keys(event.state.files).length}, Todos: ${event.state.todos.length}${colors.reset}`);

      // Show file content preview
      for (const [path, file] of Object.entries(event.state.files)) {
        if (path.endsWith(".txt")) {
          console.log(`${colors.dim}   ${path}: "${file.content.slice(0, 2).join(" ").slice(0, 60)}..."${colors.reset}`);
        }
      }
      break;

    case "error":
      console.log(`${colors.yellow}   ⚠ ${event.error.message}${colors.reset}`);
      break;
  }
}

main().catch(console.error);
