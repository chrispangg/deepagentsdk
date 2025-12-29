/**
 * Example: Using Skills with Deep Agent
 *
 * This example demonstrates:
 * 1. Loading skills from a directory
 * 2. Skills appearing in the agent's system prompt
 * 3. The agent reading and following skill instructions
 *
 * Skills provide specialized domain knowledge and workflows through
 * progressive disclosure - metadata in the system prompt, full content
 * loaded on-demand.
 */

import { createDeepAgent } from "../src/index";
import { anthropic } from "@ai-sdk/anthropic";
import * as path from "node:path";

// Point to the example skills directory
const skillsDir = path.join(import.meta.dir, "skills");

console.log("Creating agent with skills from:", skillsDir);
console.log();

// Create agent with skills enabled
const agent = createDeepAgent({
  model: anthropic("claude-sonnet-4-20250514"),
  skillsDir,
});

// Example 1: Agent recognizes when a skill applies
console.log("=== Example 1: Agent recognizes skill ===");
console.log("User: I need to analyze a CSV file with sales data");
console.log();

const response1 = await agent.generate({
  prompt: "I need to analyze a CSV file with sales data. Can you help?",
});

console.log("Agent:", response1.text);
console.log();

// Example 2: Agent uses skill for specific task
console.log("=== Example 2: Agent follows skill workflow ===");
console.log("User: Parse this sales data and create a summary");
console.log();

const response2 = await agent.generate({
  prompt:
    "I have sales data in a CSV format. Help me parse it and create a summary report.",
});

console.log("Agent:", response2.text);
console.log();

console.log("✓ Skills example complete!");
console.log();
console.log("How skills work:");
console.log("1. Skills are discovered from subdirectories containing SKILL.md");
console.log("2. Metadata (name, description) appears in system prompt");
console.log("3. Agent uses read_file to load full skill instructions when needed");
console.log("4. Skills provide step-by-step workflows for specialized tasks");
