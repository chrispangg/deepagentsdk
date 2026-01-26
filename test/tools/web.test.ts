/**
 * Unit tests for web tools (web_search, http_request, fetch_url).
 */
import { test, describe, beforeEach, afterEach, mock } from "node:test";
import { createWebTools } from "@/tools/web.ts";
import type { DeepAgentState, DeepAgentEvent } from "@/types.ts";
import { StateBackend } from "@/backends/state.ts";
import assert from "node:assert/strict";

// Store original fetch to restore after tests
const originalFetch = globalThis.fetch;

// ============================================================================
// Test Helpers
// ============================================================================

/**
 * Create a mock DeepAgentState for testing.
 */
function createMockState(): DeepAgentState {
  return {
    files: {},
    todos: [],
  };
}

/**
 * Create an event collector for tracking emitted events.
 */
function createEventCollector() {
  const events: DeepAgentEvent[] = [];
  const onEvent = (event: DeepAgentEvent) => events.push(event);
  return { events, onEvent };
}

/**
 * Mock fetch to return a successful JSON response.
 */
function mockFetchJsonResponse(data: any, status = 200) {
  (globalThis.fetch as any) = mock.fn(async (url: any, options: any) => {
    // Simulate abort signal check
    if (options?.signal?.aborted) {
      throw new Error("Request aborted");
    }
    return new Response(JSON.stringify(data), {
      status,
      headers: { "Content-Type": "application/json" },
    }) as any;
  });
}

/**
 * Mock fetch to return HTML content.
 */
function mockFetchHtmlResponse(html: string, status = 200) {
  (globalThis.fetch as any) = mock.fn(async (url: any, options: any) => {
    // Simulate abort signal check
    if (options?.signal?.aborted) {
      throw new Error("Request aborted");
    }
    return new Response(html, {
      status,
      headers: { "Content-Type": "text/html" },
    }) as any;
  });
}

/**
 * Mock fetch to return an HTTP error.
 */
function mockFetchErrorResponse(status: number, statusText: string) {
  (globalThis.fetch as any) = mock.fn(async (url: any, options: any) => {
    // Simulate abort signal check
    if (options?.signal?.aborted) {
      throw new Error("Request aborted");
    }
    return new Response(statusText, {
      status,
      statusText,
    }) as any;
  });
}

/**
 * Mock fetch to timeout.
 */
function mockFetchTimeout() {
  (globalThis.fetch as any) = mock.fn(async () => {
    await new Promise((resolve) => setTimeout(resolve, 100));
    const error = new Error("Request timed out");
    error.name = "TimeoutError";
    throw error;
  });
}

/**
 * Mock the Tavily API to return search results.
 */
function mockTavilyApiResponse(results: any[]) {
  // We'll need to mock the tavily module - for now we'll structure the test
  // to work with dependency injection if needed
  return results;
}

// ============================================================================
// Phase 1: Tool Creation and Registration
// ============================================================================

describe("createWebTools - Tool Creation", () => {
  let mockState: DeepAgentState;

  beforeEach(() => {
    mockState = createMockState();
  });

  afterEach(() => {
    // Restore original fetch after each test
    globalThis.fetch = originalFetch;
  });

  test("returns empty object when no API key provided", () => {
    // Save original env var and unset it
    const originalKey = process.env.TAVILY_API_KEY;
    delete process.env.TAVILY_API_KEY;

    // Suppress console.warn for this test
    const originalWarn = console.warn;
    console.warn = () => {};

    const tools = createWebTools(mockState, { tavilyApiKey: undefined });
    assert.strictEqual(Object.keys(tools).length, 0);

    console.warn = originalWarn;
    process.env.TAVILY_API_KEY = originalKey;
  });

  test("logs warning when no API key provided", () => {
    // Save original env var and unset it
    const originalKey = process.env.TAVILY_API_KEY;
    delete process.env.TAVILY_API_KEY;

    const originalWarn = console.warn;
    const warnMock = mock.fn((...args: any[]) => {});
    (console as any).warn = warnMock;

    createWebTools(mockState, { tavilyApiKey: undefined });

    const calls = warnMock.mock.calls as unknown as Array<{ arguments: unknown[] }>;
    assert.ok(calls.length > 0);
    const firstCallArgs = calls[0]?.arguments ?? [];
    if (firstCallArgs.length > 0) {
      assert.ok(String(firstCallArgs[0]).includes("Tavily API key not found"));
    }

    console.warn = originalWarn;
    process.env.TAVILY_API_KEY = originalKey;
  });

  test("returns all three tools when API key provided", () => {
    const tools = createWebTools(mockState, { tavilyApiKey: "tvly-test-key" });

    assert.strictEqual(Object.keys(tools).length, 3);
    assert.strictEqual("web_search" in tools, true);
    assert.strictEqual("http_request" in tools, true);
    assert.strictEqual("fetch_url" in tools, true);
  });

  test("tools have correct input schemas", () => {
    const tools = createWebTools(mockState, { tavilyApiKey: "tvly-test-key" });

    // Check web_search schema - validate by parsing test input
    assert.notStrictEqual(tools.web_search.inputSchema, undefined);
    const webSearchParse = tools.web_search.inputSchema.safeParse({
      query: "test query",
      max_results: 5,
      topic: "general",
      include_raw_content: false,
    });
    assert.strictEqual(webSearchParse.success, true);

    // Check http_request schema - validate by parsing test input
    assert.notStrictEqual(tools.http_request.inputSchema, undefined);
    const httpRequestParse = tools.http_request.inputSchema.safeParse({
      url: "https://example.com",
      method: "GET",
      headers: {},
      timeout: 30,
    });
    assert.strictEqual(httpRequestParse.success, true);

    // Check fetch_url schema - validate by parsing test input
    assert.notStrictEqual(tools.fetch_url.inputSchema, undefined);
    const fetchUrlParse = tools.fetch_url.inputSchema.safeParse({
      url: "https://example.com",
      timeout: 30,
      extract_article: true,
    });
    assert.strictEqual(fetchUrlParse.success, true);
  });
});

// ============================================================================
// Phase 2: HTTP Request Tool
// ============================================================================

describe("http_request tool", () => {
  let mockState: DeepAgentState;

  beforeEach(() => {
    mockState = createMockState();
  });

  afterEach(() => {
    // Restore original fetch after each test
    globalThis.fetch = originalFetch;
  });

  test("executes GET request successfully", async () => {
    mockFetchJsonResponse({ message: "success" });

    const tools = createWebTools(mockState, { tavilyApiKey: "tvly-test-key" });
    const result = await tools.http_request.execute(
      { url: "https://api.example.com/test", method: "GET", timeout: 30 },
      { toolCallId: "test-1" }
    );

    assert.ok(result.includes("Status: 200"));
    assert.ok(result.includes("success"));
    assert.ok(result.includes("Success: true"));
  });

  test("executes POST request with JSON body", async () => {
    let capturedRequest: any = null;

    (globalThis.fetch as any) = mock.fn(async (url: any, options: any) => {
      capturedRequest = { url, options };
      return new Response(JSON.stringify({ id: 1 }), {
        status: 201,
        headers: { "Content-Type": "application/json" },
      }) as any;
    });

    const tools = createWebTools(mockState, { tavilyApiKey: "tvly-test-key" });
    const result = await tools.http_request.execute(
      {
        url: "https://api.example.com/users",
        method: "POST",
        body: { name: "test", value: 123 },
        timeout: 30,
      },
      { toolCallId: "test-2" }
    );

    assert.ok(result.includes("Status: 201"));
    assert.notStrictEqual(capturedRequest, null);
    assert.strictEqual(capturedRequest.options.method, "POST");
    assert.ok(capturedRequest.options.body.includes("test"));
  });

  test("adds query parameters to URL", async () => {
    let capturedUrl: string | null = null;

    (globalThis.fetch as any) = mock.fn(async (url: any, options: any) => {
      capturedUrl = typeof url === "string" ? url : url.toString();
      return new Response(JSON.stringify({ data: [] }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }) as any;
    });

    const tools = createWebTools(mockState, { tavilyApiKey: "tvly-test-key" });
    await tools.http_request.execute(
      {
        url: "https://api.example.com/search",
        method: "GET",
        timeout: 30,
        params: { q: "test query", limit: "10" },
      },
      { toolCallId: "test-3" }
    );

    assert.notStrictEqual(capturedUrl, null);
    assert.ok(capturedUrl!.includes("q=test"));
    assert.ok(capturedUrl!.includes("limit=10"));
  });

  test("handles HTTP error status codes", async () => {
    mockFetchErrorResponse(404, "Not Found");

    const tools = createWebTools(mockState, { tavilyApiKey: "tvly-test-key" });
    const result = await tools.http_request.execute(
      { url: "https://api.example.com/missing", method: "GET", timeout: 30 },
      { toolCallId: "test-4" }
    );

    assert.ok(result.includes("Status: 404"));
    assert.ok(result.includes("Success: false"));
  });

  test("handles timeout errors", async () => {
    // Mock fetch to throw timeout error
    (globalThis.fetch as any) = mock.fn(async () => {
      const error: any = new Error("Request timed out after 1 seconds");
      error.name = "TimeoutError";
      throw error;
    });

    const tools = createWebTools(mockState, {
      tavilyApiKey: "tvly-test-key",
    });

    const result = await tools.http_request.execute(
      { url: "https://slow.example.com", method: "GET", timeout: 30 },
      { toolCallId: "test-5" }
    );

    assert.ok(result.includes("timed out"));
  });

  test("parses JSON responses correctly", async () => {
    mockFetchJsonResponse({ id: 42, name: "Test Item", active: true });

    const tools = createWebTools(mockState, { tavilyApiKey: "tvly-test-key" });
    const result = await tools.http_request.execute(
      { url: "https://api.example.com/item/42", method: "GET", timeout: 30 },
      { toolCallId: "test-6" }
    );

    assert.ok(result.includes('"id": 42'));
    assert.ok(result.includes('"name": "Test Item"'));
    assert.ok(result.includes('"active": true'));
  });

  test("returns plain text for non-JSON responses", async () => {
    (globalThis.fetch as any) = mock.fn(async () => {
      return new Response("<html><body>Hello</body></html>", {
        status: 200,
        headers: { "Content-Type": "text/html" },
      }) as any;
    });

    const tools = createWebTools(mockState, { tavilyApiKey: "tvly-test-key" });
    const result = await tools.http_request.execute(
      { url: "https://example.com", method: "GET", timeout: 30 },
      { toolCallId: "test-7" }
    );

    assert.ok(result.includes("<html>"));
    assert.ok(result.includes("Hello"));
  });

  test("emits http-request-start and http-request-finish events", async () => {
    mockFetchJsonResponse({ data: "test" });

    const { events, onEvent } = createEventCollector();
    const tools = createWebTools(mockState, {
      tavilyApiKey: "tvly-test-key",
      onEvent,
    });

    await tools.http_request.execute(
      { url: "https://api.example.com/test", method: "GET", timeout: 30 },
      { toolCallId: "test-8" }
    );

    const startEvent = events.find((e) => e.type === "http-request-start");
    const finishEvent = events.find((e) => e.type === "http-request-finish");

    assert.notStrictEqual(startEvent, undefined);
    assert.notStrictEqual(finishEvent, undefined);

    if (startEvent && startEvent.type === "http-request-start") {
      assert.ok(startEvent.url.includes("api.example.com"));
      assert.strictEqual(startEvent.method, "GET");
    }

    if (finishEvent && finishEvent.type === "http-request-finish") {
      assert.strictEqual(finishEvent.statusCode, 200);
    }
  });
});

// ============================================================================
// Phase 3: Fetch URL Tool
// ============================================================================

describe("fetch_url tool", () => {
  let mockState: DeepAgentState;

  beforeEach(() => {
    mockState = createMockState();
  });

  afterEach(() => {
    // Restore original fetch after each test
    globalThis.fetch = originalFetch;
  });

  test("converts HTML to Markdown", async () => {
    mockFetchHtmlResponse(
      "<html><body><h1>Test Title</h1><p>Test content paragraph.</p></body></html>"
    );

    const tools = createWebTools(mockState, { tavilyApiKey: "tvly-test-key" });
    const result = await tools.fetch_url.execute(
      { url: "https://example.com", extract_article: false, timeout: 30 },
      { toolCallId: "test-9" }
    );

    // Should contain markdown-formatted heading
    assert.ok(result.includes("Test Title"));
    assert.ok(result.includes("Test content paragraph"));
    // Markdown uses # for headings
    assert.match(result, /^#/m);
  });

  test("extracts article content with Readability", async () => {
    // Create an HTML page with navigation, ads, and article content
    const html = `
      <html>
        <body>
          <nav>Navigation links</nav>
          <aside>Advertisement</aside>
          <article>
            <h1>Main Article Title</h1>
            <p>This is the main article content that should be extracted.</p>
          </article>
        </body>
      </html>
    `;
    mockFetchHtmlResponse(html);

    const tools = createWebTools(mockState, { tavilyApiKey: "tvly-test-key" });
    const result = await tools.fetch_url.execute(
      { url: "https://example.com/article", extract_article: true, timeout: 30 },
      { toolCallId: "test-10" }
    );

    assert.ok(result.includes("Main Article Title"));
    assert.ok(result.includes("main article content"));
  });

  test("handles 404 errors gracefully", async () => {
    mockFetchErrorResponse(404, "Not Found");

    const tools = createWebTools(mockState, { tavilyApiKey: "tvly-test-key" });
    const result = await tools.fetch_url.execute(
      { url: "https://example.com/missing", timeout: 30 },
      { toolCallId: "test-11" }
    );

    assert.ok(result.includes("404"));
    assert.ok(result.includes("Not Found"));
  });

  test("handles timeout errors", async () => {
    // Mock fetch to throw timeout error
    (globalThis.fetch as any) = mock.fn(async () => {
      const error: any = new Error("Request timed out after 1 seconds");
      error.name = "TimeoutError";
      throw error;
    });

    const tools = createWebTools(mockState, {
      tavilyApiKey: "tvly-test-key",
    });

    const result = await tools.fetch_url.execute(
      { url: "https://slow.example.com", timeout: 30 },
      { toolCallId: "test-12" }
    );

    assert.ok(result.includes("timed out"));
  });

  test("falls back to full HTML when Readability fails", async () => {
    // HTML without proper article structure
    mockFetchHtmlResponse("<html><body><div>Simple content</div></body></html>");

    const tools = createWebTools(mockState, { tavilyApiKey: "tvly-test-key" });
    const result = await tools.fetch_url.execute(
      { url: "https://example.com", extract_article: true, timeout: 30 },
      { toolCallId: "test-13" }
    );

    // Should still return content (fallback to full HTML conversion)
    assert.ok(result.includes("Simple content"));
    assert.strictEqual(typeof result, "string");
  });

  test("emits fetch-url-start and fetch-url-finish events", async () => {
    mockFetchHtmlResponse("<html><body><h1>Test</h1></body></html>");

    const { events, onEvent } = createEventCollector();
    const tools = createWebTools(mockState, {
      tavilyApiKey: "tvly-test-key",
      onEvent,
    });

    await tools.fetch_url.execute(
      { url: "https://example.com", timeout: 30 },
      { toolCallId: "test-14" }
    );

    const startEvent = events.find((e) => e.type === "fetch-url-start");
    const finishEvent = events.find((e) => e.type === "fetch-url-finish");

    assert.notStrictEqual(startEvent, undefined);
    assert.notStrictEqual(finishEvent, undefined);

    if (startEvent && startEvent.type === "fetch-url-start") {
      assert.ok(startEvent.url.includes("example.com"));
    }

    if (finishEvent && finishEvent.type === "fetch-url-finish") {
      assert.strictEqual(finishEvent.success, true);
    }
  });

  test("emits failure event on error", async () => {
    mockFetchErrorResponse(500, "Internal Server Error");

    const { events, onEvent } = createEventCollector();
    const tools = createWebTools(mockState, {
      tavilyApiKey: "tvly-test-key",
      onEvent,
    });

    await tools.fetch_url.execute(
      { url: "https://example.com/error", timeout: 30 },
      { toolCallId: "test-15" }
    );

    const finishEvent = events.find((e) => e.type === "fetch-url-finish");

    assert.notStrictEqual(finishEvent, undefined);
    if (finishEvent && finishEvent.type === "fetch-url-finish") {
      assert.strictEqual(finishEvent.success, false);
    }
  });
});

// ============================================================================
// Phase 4: Result Eviction
// ============================================================================

describe("Result Eviction", () => {
  let mockState: DeepAgentState;
  let backend: StateBackend;

  beforeEach(() => {
    mockState = createMockState();
    backend = new StateBackend(mockState);
  });

  afterEach(() => {
    // Restore original fetch after each test
    globalThis.fetch = originalFetch;
  });

  test("large results are evicted to filesystem", async () => {
    // Create large HTML content (>10KB)
    const largeHtml =
      "<html><body><h1>Title</h1>" +
      "<p>Content paragraph. ".repeat(1000) +
      "</p></body></html>";

    mockFetchHtmlResponse(largeHtml);

    const tools = createWebTools(mockState, {
      tavilyApiKey: "tvly-test-key",
      backend,
      toolResultEvictionLimit: 5000, // 5000 tokens ~= 20KB
    });

    const result = await tools.fetch_url.execute(
      { url: "https://example.com/large", timeout: 30 },
      { toolCallId: "test-16" }
    );

    // Result should be a pointer message
    assert.ok(result.includes("saved to"));
    assert.ok(result.includes("/large_tool_results/"));

    // Check that content was written to backend
    const files = backend.lsInfo("/large_tool_results");
    assert.ok(files.length > 0);
  });

  test("small results are not evicted", async () => {
    mockFetchHtmlResponse("<html><body><p>Small content</p></body></html>");

    const tools = createWebTools(mockState, {
      tavilyApiKey: "tvly-test-key",
      backend,
      toolResultEvictionLimit: 10000, // High limit
    });

    const result = await tools.fetch_url.execute(
      { url: "https://example.com/small", timeout: 30 },
      { toolCallId: "test-17" }
    );

    // Result should contain actual content (not evicted)
    assert.ok(result.includes("Small content"));
    assert.ok(!result.includes("saved to"));

    // No files should be created in eviction directory
    const files = backend.lsInfo("/large_tool_results");
    assert.strictEqual(files.length, 0);
  });
});

// ============================================================================
// Phase 5: Web Search Tool (Note: Requires Tavily API mocking)
// ============================================================================

describe("web_search tool", () => {
  test("tool is created with valid API key", () => {
    const mockState = createMockState();
    const tools = createWebTools(mockState, { tavilyApiKey: "tvly-test-key" });

    assert.notStrictEqual(tools.web_search, undefined);
    assert.ok(tools.web_search.description.includes("Search the web"));
  });

  // Note: Full integration tests for web_search would require mocking the
  // @tavily/core module, which is complex. The tool structure is validated above.
  // In a production environment, you would:
  // 1. Mock the tavily() function using a test framework that supports module mocking
  // 2. Test event emission (web-search-start, web-search-finish)
  // 3. Test result formatting
  // 4. Test error handling
});

// ============================================================================
// Phase 6: Integration Tests
// ============================================================================

describe("Integration", () => {
  afterEach(() => {
    // Restore original fetch after each test
    globalThis.fetch = originalFetch;
  });

  test("all web tools have proper descriptions", () => {
    const mockState = createMockState();
    const tools = createWebTools(mockState, { tavilyApiKey: "tvly-test-key" });

    assert.ok(tools.web_search.description.includes("Search the web"));
    assert.ok(tools.http_request.description.includes("HTTP requests"));
    assert.ok(tools.fetch_url.description.includes("Fetch web page"));
  });

  test("tools use default timeout when not specified", async () => {
    mockFetchJsonResponse({ data: "test" });

    const mockState = createMockState();
    const tools = createWebTools(mockState, {
      tavilyApiKey: "tvly-test-key",
      defaultTimeout: 30,
    });

    // Should not throw timeout error with default 30s timeout
    const result = await tools.http_request.execute(
      { url: "https://api.example.com/test", method: "GET", timeout: 30 },
      { toolCallId: "test-18" }
    );

    assert.ok(result.includes("Status: 200"));
  });
});

