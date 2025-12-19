/**
 * Example: Using middleware with DeepAgent
 * Demonstrates logging and caching middleware
 */
import { createDeepAgent } from "../src/index";
import { anthropic } from "@ai-sdk/anthropic";
import type { LanguageModelMiddleware } from "ai";

// Example 1: Logging middleware
const loggingMiddleware: LanguageModelMiddleware = {
  specificationVersion: 'v3',
  wrapGenerate: async ({ doGenerate, params }) => {
    console.log("\n[Logging Middleware] Model called");
    console.log("[Logging Middleware] Prompt:", params.prompt?.[0]?.content);

    const startTime = Date.now();
    const result = await doGenerate();
    const duration = Date.now() - startTime;

    console.log("[Logging Middleware] Response:", JSON.stringify(result.content).slice(0, 100) + "...");
    console.log(`[Logging Middleware] Duration: ${duration}ms\n`);

    return result;
  },
};

// Example 2: Simple caching middleware
const cache = new Map<string, any>();

const cachingMiddleware: LanguageModelMiddleware = {
  specificationVersion: 'v3',
  wrapGenerate: async ({ doGenerate, params }) => {
    const cacheKey = JSON.stringify(params.prompt);

    if (cache.has(cacheKey)) {
      console.log("[Caching Middleware] Cache hit!");
      return cache.get(cacheKey);
    }

    console.log("[Caching Middleware] Cache miss, calling model...");
    const result = await doGenerate();
    cache.set(cacheKey, result);

    return result;
  },
};

// Create agent with multiple middlewares
const agent = createDeepAgent({
  model: anthropic("claude-sonnet-4-20250514"),
  middleware: [loggingMiddleware, cachingMiddleware],
});

// Test the agent
console.log("=== Testing Middleware ===\n");

console.log("First call (cache miss):");
const result1 = await agent.generate({
  prompt: "What is 2 + 2? Answer briefly.",
});
console.log("Result:", result1.text);

console.log("\n---\n");

console.log("Second call with same prompt (should hit cache):");
const result2 = await agent.generate({
  prompt: "What is 2 + 2? Answer briefly.",
});
console.log("Result:", result2.text);

console.log("\n=== Middleware Test Complete ===");
