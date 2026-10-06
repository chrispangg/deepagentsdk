/**
 * Opt-in web research with anonymous Parallel Search MCP over HTTP.
 * Run: ANTHROPIC_API_KEY=... bun examples/parallel-search.ts "Your question"
 * Search is free within anonymous rate limits; model inference still needs a key.
 */
import { createMCPClient } from "@ai-sdk/mcp";
import { anthropic } from "@ai-sdk/anthropic";
import type { LanguageModel, ToolSet } from "ai";
import { createDeepAgent } from "../src/index";

export async function runParallelResearch(model: LanguageModel, prompt: string) {
  const client = await createMCPClient({
    name: "deepagentsdk-parallel-example",
    transport: {
      type: "http",
      url: "https://search.parallel.ai/mcp",
      headers: { "User-Agent": "deepagentsdk/parallel-search-example" },
    },
  });

  try {
    const discoveredTools = await client.tools();
    // Keep Tavily's built-in web_search intact when TAVILY_API_KEY is set.
    const tools = Object.fromEntries(
      Object.entries(discoveredTools).map(([name, tool]) => [`parallel_${name}`, tool]),
    ) as ToolSet; // Dynamic MCP schemas produce AI SDK-compatible tools.
    const agent = createDeepAgent({
      model,
      tools,
      includeGeneralPurposeAgent: false,
      maxSteps: 5,
      systemPrompt:
        "Use parallel_web_search to research the question and parallel_web_fetch " +
        "to read sources when useful. Summarize findings with source URLs. " +
        "If a tool fails or finds no results, explain that clearly.",
    });
    return await agent.generate({ prompt });
  } finally {
    await client.close();
  }
}

if (import.meta.main) {
  if (!process.env.ANTHROPIC_API_KEY) {
    console.error("Set ANTHROPIC_API_KEY to run this example. No Parallel key is needed.");
    process.exit(1);
  }
  const prompt = process.argv.slice(2).join(" ") ||
    "What is the Model Context Protocol? Explain it briefly with sources.";
  try {
    const result = await runParallelResearch(anthropic("claude-sonnet-4-20250514"), prompt);
    console.log(result.text);
  } catch (error) {
    console.error("Research failed:", error instanceof Error ? error.message : error);
    process.exitCode = 1;
  }
}
