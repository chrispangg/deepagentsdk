/**
 * Web tools for search and HTTP requests.
 * Based on LangChain DeepAgents implementation.
 */

import { tool } from "ai";
import { z } from "zod";
import { tavily } from "@tavily/core";
import TurndownService from "turndown";
import { Readability } from "@mozilla/readability";
import { JSDOM } from "jsdom";
import type {
  BackendProtocol,
  BackendFactory,
  DeepAgentState,
  EventCallback,
} from "../types";
import { evictToolResult } from "../utils/eviction";

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Helper to resolve backend from factory or instance.
 */
function getBackend(
  backend: BackendProtocol | BackendFactory | undefined,
  state: DeepAgentState
): BackendProtocol | null {
  if (!backend) return null;
  if (typeof backend === "function") {
    return backend(state);
  }
  return backend;
}

// ============================================================================
// HTML to Markdown Utilities
// ============================================================================

/**
 * Convert HTML to Markdown with article extraction.
 * Uses Mozilla Readability to extract main content, then converts to Markdown.
 */
function htmlToMarkdown(html: string, url: string): string {
  try {
    // Parse HTML with JSDOM
    const dom = new JSDOM(html, { url });

    // Extract article content with Readability
    const reader = new Readability(dom.window.document);
    const article = reader.parse();

    if (!article) {
      // If Readability fails, fall back to body content
      const bodyContent = dom.window.document.body?.textContent || "";
      return bodyContent.trim();
    }

    // Convert extracted HTML to Markdown
    const turndown = new TurndownService({
      headingStyle: "atx",
      codeBlockStyle: "fenced",
    });

    const markdown = turndown.turndown(article.content || "");

    // Prepend title if available
    if (article.title) {
      return `# ${article.title}\n\n${markdown}`;
    }

    return markdown;
  } catch (error) {
    // On error, return error message
    return `Error converting HTML to Markdown: ${error instanceof Error ? error.message : String(error)}`;
  }
}

// ============================================================================
// Tool Implementations
// ============================================================================

/**
 * Tool description for web_search.
 */
const WEB_SEARCH_TOOL_DESCRIPTION = `Search the web using Tavily API for current information, news, and documentation.

Returns an array of search results with titles, URLs, relevant excerpts, and relevance scores.

IMPORTANT AGENT INSTRUCTIONS:
- You MUST synthesize information from search results into a coherent answer
- NEVER show raw JSON or result objects to the user
- Cite sources by including URLs in your response
- If search fails or returns no results, explain this clearly to the user`;

/**
 * Create the web_search tool.
 */
function createWebSearchTool(
  state: DeepAgentState,
  options: {
    backend?: BackendProtocol | BackendFactory;
    onEvent?: EventCallback;
    toolResultEvictionLimit?: number;
    tavilyApiKey: string;
  }
) {
  const { backend, onEvent, toolResultEvictionLimit, tavilyApiKey } = options;

  return tool({
    description: WEB_SEARCH_TOOL_DESCRIPTION,
    inputSchema: z.object({
      query: z.string().describe(
        "The search query (be specific and detailed for best results)"
      ),
      max_results: z
        .number()
        .default(5)
        .describe("Number of results to return (1-20)"),
      topic: z
        .enum(["general", "news", "finance"])
        .default("general")
        .describe("Search topic category"),
      include_raw_content: z
        .boolean()
        .default(false)
        .describe("Include full page content (warning: uses more tokens)"),
    }),
    execute: async ({ query, max_results, topic, include_raw_content }, { toolCallId }) => {
      // Emit start event
      if (onEvent) {
        onEvent({
          type: "web-search-start",
          query,
        });
      }

      try {
        // Initialize Tavily client
        const tvly = tavily({ apiKey: tavilyApiKey });

        // Perform search
        const response = await tvly.search(query, {
          maxResults: max_results,
          topic,
          includeRawContent: include_raw_content ? "text" : false,
        });

        // Format results
        const results = response.results || [];
        const formattedResults = results
          .map(
            (r: any, i: number) =>
              `## Result ${i + 1}: ${r.title}\n` +
              `URL: ${r.url}\n` +
              `Score: ${r.score?.toFixed(2) || "N/A"}\n` +
              `Content: ${r.content}\n`
          )
          .join("\n---\n\n");

        const output = `Found ${results.length} results for query: "${query}"\n\n${formattedResults}`;

        // Emit finish event
        if (onEvent) {
          onEvent({
            type: "web-search-finish",
            query,
            resultCount: results.length,
          });
        }

        // Evict if needed
        if (toolResultEvictionLimit && toolResultEvictionLimit > 0 && backend) {
          const resolvedBackend = getBackend(backend, state);
          if (resolvedBackend) {
            const evictResult = await evictToolResult({
              result: output,
              toolCallId: toolCallId || `web_search_${Date.now()}`,
              toolName: "web_search",
              backend: resolvedBackend,
              tokenLimit: toolResultEvictionLimit,
            });
            return evictResult.content;
          }
        }

        return output;
      } catch (error: unknown) {
        const err = error as Error;
        const errorMessage = `Web search error: ${err.message}`;

        // Emit finish event with 0 results (error case)
        if (onEvent) {
          onEvent({
            type: "web-search-finish",
            query,
            resultCount: 0,
          });
        }

        return errorMessage;
      }
    },
  });
}

/**
 * Tool description for http_request.
 */
const HTTP_REQUEST_TOOL_DESCRIPTION = `Make HTTP requests to APIs and web services.

Supports GET, POST, PUT, DELETE, PATCH methods with custom headers, query parameters, and request bodies.

Returns structured response with status code, headers, and parsed content (JSON or text).`;

/**
 * Create the http_request tool.
 */
function createHttpRequestTool(
  state: DeepAgentState,
  options: {
    backend?: BackendProtocol | BackendFactory;
    onEvent?: EventCallback;
    toolResultEvictionLimit?: number;
    defaultTimeout: number;
  }
) {
  const { backend, onEvent, toolResultEvictionLimit, defaultTimeout } = options;

  return tool({
    description: HTTP_REQUEST_TOOL_DESCRIPTION,
    inputSchema: z.object({
      url: z.string().url().describe("Target URL (must be valid HTTP/HTTPS URL)"),
      method: z
        .enum(["GET", "POST", "PUT", "DELETE", "PATCH"])
        .default("GET")
        .describe("HTTP method"),
      headers: z
        .record(z.string())
        .optional()
        .describe("HTTP headers as key-value pairs"),
      body: z
        .union([z.string(), z.record(z.any())])
        .optional()
        .describe("Request body (string or JSON object)"),
      params: z
        .record(z.string())
        .optional()
        .describe("URL query parameters as key-value pairs"),
      timeout: z
        .number()
        .default(defaultTimeout)
        .describe("Request timeout in seconds"),
    }),
    execute: async ({ url, method, headers, body, params, timeout }, { toolCallId }) => {
      // Emit start event
      if (onEvent) {
        onEvent({
          type: "http-request-start",
          url,
          method,
        });
      }

      try {
        // Build URL with query params
        const urlObj = new URL(url);
        if (params) {
          Object.entries(params).forEach(([key, value]) => {
            urlObj.searchParams.append(key, value);
          });
        }

        // Build request options
        const requestOptions: RequestInit = {
          method,
          headers: headers || {},
          signal: AbortSignal.timeout(timeout * 1000),
        };

        // Add body if provided
        if (body) {
          if (typeof body === "string") {
            requestOptions.body = body;
          } else {
            requestOptions.body = JSON.stringify(body);
            (requestOptions.headers as Record<string, string>)["Content-Type"] =
              "application/json";
          }
        }

        // Execute request
        const response = await fetch(urlObj.toString(), requestOptions);

        // Parse response
        const contentType = response.headers.get("content-type") || "";
        let content: any;

        if (contentType.includes("application/json")) {
          try {
            content = await response.json();
          } catch {
            content = await response.text();
          }
        } else {
          content = await response.text();
        }

        // Format response
        const formattedOutput =
          `HTTP ${method} ${url}\n` +
          `Status: ${response.status}\n` +
          `Success: ${response.ok}\n` +
          `Content:\n${typeof content === "string" ? content : JSON.stringify(content, null, 2)}`;

        // Emit finish event
        if (onEvent) {
          onEvent({
            type: "http-request-finish",
            url: response.url,
            statusCode: response.status,
          });
        }

        // Evict if needed
        if (toolResultEvictionLimit && toolResultEvictionLimit > 0 && backend) {
          const resolvedBackend = getBackend(backend, state);
          if (resolvedBackend) {
            const evictResult = await evictToolResult({
              result: formattedOutput,
              toolCallId: toolCallId || `http_request_${Date.now()}`,
              toolName: "http_request",
              backend: resolvedBackend,
              tokenLimit: toolResultEvictionLimit,
            });
            return evictResult.content;
          }
        }

        return formattedOutput;
      } catch (error: unknown) {
        const err = error as Error;
        let errorMessage: string;

        if (err.name === "TimeoutError" || err.name === "AbortError") {
          errorMessage = `Request timed out after ${timeout} seconds`;
        } else {
          errorMessage = `HTTP request error: ${err.message}`;
        }

        // Emit finish event with error status
        if (onEvent) {
          onEvent({
            type: "http-request-finish",
            url,
            statusCode: 0,
          });
        }

        return errorMessage;
      }
    },
  });
}

/**
 * Tool description for fetch_url.
 */
const FETCH_URL_TOOL_DESCRIPTION = `Fetch web page content and convert HTML to clean Markdown format.

Uses Mozilla Readability to extract main article content and Turndown to convert to Markdown.

Returns the page content as formatted Markdown, suitable for analysis and summarization.

IMPORTANT AGENT INSTRUCTIONS:
- Use this tool to read documentation, articles, and web pages
- The content is already cleaned and formatted as Markdown
- Cite the URL when referencing fetched content`;

/**
 * Create the fetch_url tool.
 */
function createFetchUrlTool(
  state: DeepAgentState,
  options: {
    backend?: BackendProtocol | BackendFactory;
    onEvent?: EventCallback;
    toolResultEvictionLimit?: number;
    defaultTimeout: number;
  }
) {
  const { backend, onEvent, toolResultEvictionLimit, defaultTimeout } = options;

  return tool({
    description: FETCH_URL_TOOL_DESCRIPTION,
    inputSchema: z.object({
      url: z.string().url().describe("The URL to fetch (must be valid HTTP/HTTPS URL)"),
      timeout: z
        .number()
        .default(defaultTimeout)
        .describe("Request timeout in seconds"),
      extract_article: z
        .boolean()
        .default(true)
        .describe(
          "Extract main article content using Readability (disable for non-article pages)"
        ),
    }),
    execute: async ({ url, timeout, extract_article }, { toolCallId }) => {
      // Emit start event
      if (onEvent) {
        onEvent({
          type: "fetch-url-start",
          url,
        });
      }

      try {
        // Fetch HTML
        const response = await fetch(url, {
          signal: AbortSignal.timeout(timeout * 1000),
          headers: {
            "User-Agent": "Mozilla/5.0 (compatible; DeepAgents/1.0)",
          },
        });

        if (!response.ok) {
          const errorMsg = `HTTP error: ${response.status} ${response.statusText}`;

          if (onEvent) {
            onEvent({
              type: "fetch-url-finish",
              url: response.url,
              success: false,
            });
          }

          return errorMsg;
        }

        const html = await response.text();

        // Parse DOM
        const dom = new JSDOM(html, { url });

        let contentToConvert = html;

        // Extract article content if requested
        if (extract_article) {
          try {
            const reader = new Readability(dom.window.document);
            const article = reader.parse();

            if (article && article.content) {
              contentToConvert = article.content;
            }
          } catch (readabilityError) {
            // If Readability fails, fall back to full HTML
            console.warn("Readability extraction failed, using full HTML");
          }
        }

        // Convert to Markdown
        const turndownService = new TurndownService({
          headingStyle: "atx",
          codeBlockStyle: "fenced",
        });

        const markdown = turndownService.turndown(contentToConvert);

        // Emit finish event
        if (onEvent) {
          onEvent({
            type: "fetch-url-finish",
            url: response.url,
            success: true,
          });
        }

        // Evict large content
        if (toolResultEvictionLimit && toolResultEvictionLimit > 0 && backend) {
          const resolvedBackend = getBackend(backend, state);
          if (resolvedBackend) {
            const evictResult = await evictToolResult({
              result: markdown,
              toolCallId: toolCallId || `fetch_url_${Date.now()}`,
              toolName: "fetch_url",
              backend: resolvedBackend,
              tokenLimit: toolResultEvictionLimit,
            });

            return evictResult.content;
          }
        }

        return markdown;
      } catch (error: unknown) {
        const err = error as Error;
        let errorMessage: string;

        if (err.name === "TimeoutError" || err.name === "AbortError") {
          errorMessage = `Request timed out after ${timeout} seconds`;
        } else {
          errorMessage = `Error fetching URL: ${err.message}`;
        }

        // Emit error finish event
        if (onEvent) {
          onEvent({
            type: "fetch-url-finish",
            url,
            success: false,
          });
        }

        return errorMessage;
      }
    },
  });
}

// ============================================================================
// Main Factory Function
// ============================================================================

/**
 * Options for creating web tools.
 */
export interface CreateWebToolsOptions {
  /** Backend for filesystem operations (for eviction) */
  backend?: BackendProtocol | BackendFactory;
  /** Callback for emitting events */
  onEvent?: EventCallback;
  /** Token limit before evicting large tool results (default: disabled) */
  toolResultEvictionLimit?: number;
  /** Tavily API key (defaults to process.env.TAVILY_API_KEY) */
  tavilyApiKey?: string;
  /** Default timeout for HTTP requests in seconds (default: 30) */
  defaultTimeout?: number;
}

/**
 * Create all web tools (web_search, http_request, fetch_url).
 * Tools are only created if TAVILY_API_KEY is available.
 */
export function createWebTools(
  state: DeepAgentState,
  options?: CreateWebToolsOptions
): Record<string, any> {
  const {
    backend,
    onEvent,
    toolResultEvictionLimit,
    tavilyApiKey = process.env.TAVILY_API_KEY,
    defaultTimeout = 30,
  } = options || {};

  // Return empty object if no Tavily API key
  if (!tavilyApiKey) {
    console.warn(
      "Tavily API key not found. Web tools (web_search, fetch_url, http_request) will not be available. " +
      "Set TAVILY_API_KEY environment variable to enable web tools."
    );
    return {};
  }

  return {
    web_search: createWebSearchTool(state, { backend, onEvent, toolResultEvictionLimit, tavilyApiKey }),
    http_request: createHttpRequestTool(state, { backend, onEvent, toolResultEvictionLimit, defaultTimeout }),
    fetch_url: createFetchUrlTool(state, { backend, onEvent, toolResultEvictionLimit, defaultTimeout }),
  };
}

// ============================================================================
// Exports
// ============================================================================

export { htmlToMarkdown };
