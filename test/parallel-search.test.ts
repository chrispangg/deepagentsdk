import { afterEach, expect, spyOn, test } from "bun:test";
import { MockLanguageModelV3 } from "ai/test";
import { runParallelResearch } from "../examples/parallel-search";

const usage = {
  inputTokens: { total: 1, noCache: 1, cacheRead: 0, cacheWrite: 0 },
  outputTokens: { total: 1, text: 1, reasoning: 0 },
};
const originalTavilyKey = process.env.TAVILY_API_KEY;
let restoreFetch: (() => void) | undefined;
afterEach(() => {
  restoreFetch?.();
  if (originalTavilyKey === undefined) delete process.env.TAVILY_API_KEY;
  else process.env.TAVILY_API_KEY = originalTavilyKey;
});

function mockServer(failDiscovery = false) {
  const requests: { method: string; headers: Headers; params?: Record<string, unknown> }[] = [];
  const handler = async (_url: RequestInfo | URL, init?: RequestInit) => {
    const headers = new Headers(init?.headers);
    if (init?.method === "DELETE") {
      requests.push({ method: "DELETE", headers });
      return new Response(null, { status: 200 });
    }
    if (init?.method === "GET") return new Response(null, { status: 405 });
    const body = JSON.parse(String(init?.body));
    requests.push({ method: body.method, headers, params: body.params });
    if (body.id === undefined) return new Response(null, { status: 202 });
    const result = body.method === "initialize" ? {
      protocolVersion: body.params.protocolVersion,
      capabilities: { tools: {} },
      serverInfo: { name: "test-search", version: "1.0.0" },
    } : body.method === "tools/list" ? {
      tools: [{
        name: "web_search",
        description: "Search for documentation",
        inputSchema: { type: "object", properties: { query: { type: "string" } }, required: ["query"] },
      }],
    } : { content: [{ type: "text", text: "MCP connects applications to tools: https://modelcontextprotocol.io" }] };
    return Response.json(failDiscovery && body.method === "tools/list" ? {
      jsonrpc: "2.0", id: body.id, error: { code: -32603, message: "Discovery unavailable" },
    } : { jsonrpc: "2.0", id: body.id, result }, {
      headers: { "mcp-session-id": "test-session" },
    });
  };
  const mock = spyOn(globalThis, "fetch").mockImplementation(
    Object.assign(handler, { preconnect: globalThis.fetch.preconnect }),
  );
  restoreFetch = () => mock.mockRestore();
  return requests;
}

test("MCP tools execute through DeepAgent without replacing Tavily", async () => {
  process.env.TAVILY_API_KEY = "test-existing-selection";
  const requests = mockServer();
  let step = 0;
  const model = new MockLanguageModelV3({
    doGenerate: async (params) => {
      const names = params.tools?.map((tool) => tool.name);
      expect(names).toContain("parallel_web_search");
      expect(names).toContain("web_search");
      if (step++ === 0) return {
        content: [{ type: "tool-call" as const, toolCallId: "search-1", toolName: "parallel_web_search", input: '{"query":"MCP documentation"}' }],
        finishReason: { unified: "tool-calls" as const, raw: undefined }, usage, warnings: [],
      };
      expect(JSON.stringify(params.prompt)).toContain("MCP connects applications to tools");
      return {
        content: [{ type: "text" as const, text: "MCP connects applications to tools (https://modelcontextprotocol.io)." }],
        finishReason: { unified: "stop" as const, raw: undefined }, usage, warnings: [],
      };
    },
  });
  const result = await runParallelResearch(model, "Explain MCP with a source.");
  expect(result.text).toContain("https://modelcontextprotocol.io");
  expect(requests.find((r) => r.method === "tools/call")?.params).toEqual({ name: "web_search", arguments: { query: "MCP documentation" } });
  expect(requests.at(-1)?.method).toBe("DELETE");
  for (const request of requests) {
    expect(request.headers.get("User-Agent")).toStartWith("deepagentsdk/parallel-search-example");
    expect(request.headers.has("Authorization")).toBe(false);
  }
  expect(process.env.TAVILY_API_KEY).toBe("test-existing-selection");
});

test("closes MCP session when discovery fails", async () => {
  const requests = mockServer(true);
  await expect(runParallelResearch(new MockLanguageModelV3(), "Research MCP")).rejects.toThrow();
  expect(requests.at(-1)?.method).toBe("DELETE");
});

test("closes MCP session when generation fails", async () => {
  delete process.env.TAVILY_API_KEY;
  const requests = mockServer();
  const model = new MockLanguageModelV3({ doGenerate: async () => { throw new Error("Generation unavailable"); } });
  await expect(runParallelResearch(model, "Research MCP")).rejects.toThrow("Generation unavailable");
  expect(requests.at(-1)?.method).toBe("DELETE");
});
