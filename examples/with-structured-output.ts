/**
 * Example: Structured Output
 *
 * Demonstrates using structured output with deep agents.
 * The agent returns typed, validated objects alongside text responses.
 *
 * Run with: bun examples/with-structured-output.ts
 * Requires: OPENAI_API_KEY environment variable in .env file
 */

import { createDeepAgent, getStructuredOutput, getEventOutput } from "../src/index";
import { openai } from "@ai-sdk/openai";
import { z } from "zod";

const hasApiKey = !!process.env.OPENAI_API_KEY;

if (!hasApiKey) {
  console.error("Error: OPENAI_API_KEY environment variable not set");
  console.error("Please set your API key in a .env file: OPENAI_API_KEY=your-key-here");
  process.exit(1);
}

// Example 1: Basic Structured Output
console.log("=== Example 1: Basic Sentiment Analysis ===\n");

const sentimentSchema = z.object({
  sentiment: z.enum(["positive", "negative", "neutral"]),
  score: z.number().min(0).max(1),
  summary: z.string(),
});

// Type inference helpers
type SentimentResult = z.infer<typeof sentimentSchema>;

const sentimentAgent = createDeepAgent({
  model: openai("gpt-5-mini") as any,
  output: {
    schema: sentimentSchema,
    description: "Sentiment analysis result with score and summary",
  },
});

const sentimentResult = await sentimentAgent.generate({
  prompt: 'Analyze this review: "The product exceeded my expectations!"',
});

console.log("Text response:", sentimentResult.text);
console.log("Structured output:", getStructuredOutput<SentimentResult>(sentimentResult));
console.log("Type-safe access:", getStructuredOutput<SentimentResult>(sentimentResult)?.sentiment); // TypeScript knows this is 'positive' | 'negative' | 'neutral'

// Example 2: Complex Nested Schema
console.log("\n=== Example 2: Research with Complex Schema ===\n");

const researchSchema = z.object({
  summary: z.string().describe("Brief summary of findings"),
  keyPoints: z.array(z.string()).describe("Main takeaways"),
  confidence: z.number().min(0).max(1).describe("Confidence score 0-1"),
  topics: z.array(z.string()).describe("Main topics covered"),
  reliability: z.enum(["high", "medium", "low"]).describe("Reliability of findings"),
});

type ResearchResult = z.infer<typeof researchSchema>;

const researchAgent = createDeepAgent({
  model: openai("gpt-5-mini") as any,
  output: {
    schema: researchSchema,
    description: "Research findings with metadata and confidence",
  },
});

const researchResult = await researchAgent.generate({
  prompt: "Research the latest developments in AI agents (2025)",
  maxSteps: 10,
});

console.log("Structured research output:");
console.log(JSON.stringify(getStructuredOutput<ResearchResult>(researchResult), null, 2));

// Example 3: Using with Streaming
console.log("\n=== Example 3: Streaming with Structured Output ===\n");

for await (const event of researchAgent.streamWithEvents({
  // Old way: prompt: "Briefly explain how agents use tools",
  messages: [{ role: "user", content: "Briefly explain how agents use tools" }],
})) {
  if (event.type === "text") {
    process.stdout.write(event.text);
  }

  if (event.type === "done") {
    console.log("\n\nStructured output from stream:");
    const output = getEventOutput<ResearchResult>(event);
    console.log("Summary:", output?.summary);
    console.log("Key points:", output?.keyPoints);
    console.log("Topics:", output?.topics);
    console.log("Reliability:", output?.reliability);
  }
}

// Example 4: Works with Other Features
console.log("\n=== Example 4: Combining with Middleware ===\n");

const loggingMiddleware = {
  specificationVersion: 'v3' as const,
  wrapGenerate: async ({ doGenerate, params }: any) => {
    console.log("[Logging] Generate called with prompt:", params.prompt?.[0]?.content?.substring(0, 50));
    const result = await doGenerate();
    console.log("[Logging] Output schema:", getStructuredOutput<SentimentResult>(result) ? "present" : "absent");
    return result;
  },
};

const agentWithMiddleware = createDeepAgent({
  model: openai("gpt-5-mini") as any,
  middleware: loggingMiddleware,
  output: {
    schema: sentimentSchema,
  },
});

const middlewareResult = await agentWithMiddleware.generate({
  prompt: "Analyze: This is great!",
});

console.log("Result with middleware:", getStructuredOutput<SentimentResult>(middlewareResult));

console.log("\n=== All Examples Complete ===");
