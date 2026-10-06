import { expect, test } from "bun:test";
import { MockLanguageModelV3 } from "ai/test";
import { runParallelResearch } from "../examples/parallel-search";

type SourceResult = { url: string; excerpts: string[] };
function findSearchResults(value: unknown): SourceResult[] | undefined {
  if (typeof value === "string") {
    try { return findSearchResults(JSON.parse(value)); } catch { return undefined; }
  }
  if (value && typeof value === "object") {
    const record = value as Record<string, unknown>;
    if (Array.isArray(record.results)) {
      return record.results.filter((item): item is SourceResult =>
        item !== null && typeof item === "object" && typeof item.url === "string" &&
        Array.isArray(item.excerpts) && item.excerpts.every((excerpt: unknown) => typeof excerpt === "string"));
    }
    for (const child of Object.values(record)) {
      const results = findSearchResults(child);
      if (results) return results;
    }
  }
  return undefined;
}

function findExcerpt(value: unknown): string | undefined {
  if (typeof value === "string") {
    try { return findExcerpt(JSON.parse(value)); } catch { return undefined; }
  }
  if (value && typeof value === "object") {
    const record = value as Record<string, unknown>;
    if (Array.isArray(record.excerpts)) {
      return record.excerpts.find((excerpt): excerpt is string =>
        typeof excerpt === "string" && excerpt.includes("open-source standard"));
    }
    for (const child of Object.values(record)) {
      const excerpt = findExcerpt(child);
      if (excerpt) return excerpt;
    }
  }
  return undefined;
}

// This model requests real tools, then quotes an excerpt from their actual output.
// It exercises the documented example without charging a model API account.
test("anonymous HTTP MCP search and fetch return a grounded DeepAgent answer", async () => {
  const keys = ["TAVILY_API_KEY", "PARALLEL_API_KEY", "PARALLEL_API_TOKEN", "ANTHROPIC_API_KEY"];
  const saved = keys.map((key) => process.env[key]);
  keys.forEach((key) => { delete process.env[key]; });
  const originalFetch = globalThis.fetch;
  const observed: { method: string; name?: string; userAgent: string | null; authorization: boolean }[] = [];
  const capture = async (url: RequestInfo | URL, init?: RequestInit) => {
    expect(String(url)).toBe("https://search.parallel.ai/mcp");
    const headers = new Headers(init?.headers);
    const body = init?.body ? JSON.parse(String(init.body)) : {};
    observed.push({
      method: body.method || init?.method,
      name: body.params?.name,
      userAgent: headers.get("User-Agent"),
      authorization: headers.has("Authorization"),
    });
    return originalFetch(url, init);
  };
  globalThis.fetch = Object.assign(capture, { preconnect: originalFetch.preconnect });
  const sessionId = crypto.randomUUID();
  const usage = {
    inputTokens: { total: 1, noCache: 1, cacheRead: 0, cacheWrite: 0 },
    outputTokens: { total: 1, text: 1, reasoning: 0 },
  };
  let step = 0;
  let sourceUrl = "";
  let searchResultCount = 0;
  const model = new MockLanguageModelV3({
    doGenerate: async (params) => {
      expect(params.tools?.map((tool) => tool.name)).toContain("parallel_web_search");
      expect(params.tools?.map((tool) => tool.name)).toContain("parallel_web_fetch");
      expect(params.tools?.map((tool) => tool.name)).not.toContain("web_search");
      if (step === 1) {
        const searchMessage = params.prompt.filter((message) => message.role === "tool").at(-1);
        expect(JSON.stringify(searchMessage)).not.toContain('"isError":true');
        const searchResults = findSearchResults(searchMessage);
        expect(searchResults?.length).toBeGreaterThan(0);
        searchResultCount = searchResults?.length || 0;
        const source = searchResults?.find((result) =>
          new URL(result.url).hostname === "modelcontextprotocol.io" &&
          result.url.includes("intro") && result.excerpts.join(" ").includes("Model Context Protocol"));
        if (!source) throw new Error("Search returned no sourced official MCP introduction.");
        sourceUrl = source.url;
      }
      if (step < 2) {
        const search = step++ === 0;
        return {
          content: [{
            type: "tool-call" as const,
            toolCallId: search ? "search" : "fetch",
            toolName: search ? "parallel_web_search" : "parallel_web_fetch",
            input: JSON.stringify(search ? {
              objective: "Find official documentation explaining the Model Context Protocol.",
              search_queries: ["Model Context Protocol official introduction"],
              session_id: sessionId,
            } : {
              urls: [sourceUrl],
              objective: "What does the Model Context Protocol do?",
              session_id: sessionId,
            }),
          }],
          finishReason: { unified: "tool-calls" as const, raw: undefined }, usage, warnings: [],
        };
      }
      const toolMessage = params.prompt.filter((message) => message.role === "tool").at(-1);
      expect(toolMessage).toBeDefined();
      // The MCP text content contains the server's JSON search/extraction response.
      const serialized = JSON.stringify(toolMessage);
      expect(serialized).toContain("modelcontextprotocol.io");
      expect(serialized).toContain("excerpts");
      expect(serialized).toContain("Model Context Protocol");
      const excerpt = findExcerpt(toolMessage);
      const definition = excerpt?.split("\n").find((line) => line.includes("open-source standard"));
      expect(definition).toBeDefined();
      return {
        content: [{ type: "text" as const, text: `${definition}\nSource: ${sourceUrl}` }],
        finishReason: { unified: "stop" as const, raw: undefined }, usage, warnings: [],
      };
    },
  });
  try {
    const result = await runParallelResearch(model, "Explain the Model Context Protocol using official sources.");
    expect(result.text).toContain("Model Context Protocol");
    expect(result.text).toContain("modelcontextprotocol.io");
    expect(observed.filter((request) => request.method === "tools/call").map((request) => request.name)).toEqual(["web_search", "web_fetch"]);
    for (const request of observed) {
      expect(request.authorization).toBe(false);
      expect(request.userAgent).toStartWith("deepagentsdk/parallel-search-example");
    }
    console.log(JSON.stringify({ requests: observed, searchResultCount, sourceUrl, answer: result.text }));
  } finally {
    globalThis.fetch = originalFetch;
    keys.forEach((key, i) => {
      if (saved[i] === undefined) delete process.env[key];
      else process.env[key] = saved[i];
    });
  }
}, 120_000);
