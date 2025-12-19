/**
 * Web Research Example
 *
 * Demonstrates using web tools (web_search, http_request, fetch_url) with DeepAgent.
 *
 * Prerequisites:
 * - TAVILY_API_KEY environment variable must be set
 * - ANTHROPIC_API_KEY environment variable must be set
 *
 * Run: bun examples/web-research.ts
 */

import { createDeepAgent } from "../src/index";
import { anthropic } from "@ai-sdk/anthropic";

// Check for required API keys
if (!process.env.TAVILY_API_KEY) {
  console.error("Error: TAVILY_API_KEY environment variable is required");
  console.error("Get a free API key at https://tavily.com");
  process.exit(1);
}

if (!process.env.ANTHROPIC_API_KEY) {
  console.error("Error: ANTHROPIC_API_KEY environment variable is required");
  process.exit(1);
}

// Create agent with web tools
const agent = createDeepAgent({
  model: anthropic("claude-sonnet-4-20250514"),
  maxSteps: 20,
});

async function main() {
  console.log("🌐 Web Research Example\n");
  console.log("This agent can search the web, fetch web pages, and make HTTP requests.\n");

  // Example 1: Web search
  console.log("📊 Example 1: Searching the web for AI news\n");

  const result1 = await agent.streamWithEvents({
    prompt: "Search for the latest news about AI developments in 2025. Summarize the top 3 findings with sources.",
    state: { todos: [], files: {} },
    messages: [],
  });

  for await (const event of result1) {
    if (event.type === "text") {
      process.stdout.write(event.text);
    } else if (event.type === "web-search-start") {
      console.log(`\n🔍 Searching: "${event.query}"`);
    } else if (event.type === "web-search-finish") {
      console.log(`✓ Found ${event.resultCount} results\n`);
    }
  }

  console.log("\n\n---\n");

  // Example 2: Fetch and analyze a web page
  console.log("📄 Example 2: Fetching and analyzing a web page\n");

  const result2 = await agent.streamWithEvents({
    prompt: "Fetch the Anthropic homepage and summarize what Anthropic does.",
    state: { todos: [], files: {} },
    messages: [],
  });

  for await (const event of result2) {
    if (event.type === "text") {
      process.stdout.write(event.text);
    } else if (event.type === "fetch-url-start") {
      console.log(`\n📥 Fetching: ${event.url}`);
    } else if (event.type === "fetch-url-finish") {
      console.log(`${event.success ? "✓" : "✗"} Fetch ${event.success ? "complete" : "failed"}\n`);
    }
  }

  console.log("\n\n---\n");

  // Example 3: HTTP API request
  console.log("🔌 Example 3: Making an HTTP request to a public API\n");

  const result3 = await agent.streamWithEvents({
    prompt: "Use http_request to get data from https://api.github.com/repos/vercel/ai and tell me the repository description and star count.",
    state: { todos: [], files: {} },
    messages: [],
  });

  for await (const event of result3) {
    if (event.type === "text") {
      process.stdout.write(event.text);
    } else if (event.type === "http-request-start") {
      console.log(`\n🌐 HTTP ${event.method} ${event.url}`);
    } else if (event.type === "http-request-finish") {
      console.log(`${event.statusCode >= 200 && event.statusCode < 300 ? "✓" : "✗"} Status: ${event.statusCode}\n`);
    }
  }

  console.log("\n\n✅ Web research complete!");
}

main().catch(console.error);
