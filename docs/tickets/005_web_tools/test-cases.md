---
title: Web Tools Test Cases
description: Documentation
---

## Overview

This document defines test cases for the web tools feature (`web_search`, `http_request`, `fetch_url`). Tests follow the bun:test framework conventions used throughout the codebase, with factory functions for mocking HTTP responses and creating test state.

## Test Organization

**File location**: `src/tools/web.test.ts`

**Framework**: Bun's built-in test framework (`bun:test`)

**Test structure**:

- Mock HTTP responses with globalThis.fetch
- Create test state with DeepAgentState factory
- Event collection with EventCallback pattern
- Backend setup with StateBackend for filesystem operations

---

## Phase 1: Tool Creation and Registration

### Test 1: Tool Factory Returns Empty Object Without API Key

```typescript
// web_search, http_request, fetch_url not created when TAVILY_API_KEY is missing
//
// createWebToolsWithoutApiKey
//
// expectToolFactoryReturnsEmptyObject
// expectWarningLogged
```

**DSL Functions**:

- **Setup**: `createWebToolsWithoutApiKey` - Call createWebTools with tavilyApiKey: undefined
- **Assertion**: `expectToolFactoryReturnsEmptyObject` - Verify Object.keys(tools).length === 0
- **Assertion**: `expectWarningLogged` - Verify console.warn was called with TAVILY_API_KEY message

---

### Test 2: Tool Factory Creates All Three Tools With API Key

```typescript
// web_search, http_request, fetch_url created when TAVILY_API_KEY is present
//
// createWebToolsWithValidApiKey
//
// expectWebSearchToolCreated
// expectHttpRequestToolCreated
// expectFetchUrlToolCreated
```

**DSL Functions**:

- **Setup**: `createWebToolsWithValidApiKey` - Call createWebTools with valid tavilyApiKey
- **Assertion**: `expectWebSearchToolCreated` - Verify 'web_search' in returned object
- **Assertion**: `expectHttpRequestToolCreated` - Verify 'http_request' in returned object
- **Assertion**: `expectFetchUrlToolCreated` - Verify 'fetch_url' in returned object

---

### Test 3: Tool Schemas Are Correct

```typescript
// web_search, http_request, fetch_url have proper input schemas
//
// createWebToolsWithValidApiKey
// getToolSchemas
//
// expectWebSearchSchemaHasRequiredFields
// expectHttpRequestSchemaHasRequiredFields
// expectFetchUrlSchemaHasRequiredFields
```

**DSL Functions**:

- **Setup**: `createWebToolsWithValidApiKey`
- **Action**: `getToolSchemas` - Extract inputSchema from each tool
- **Assertion**: `expectWebSearchSchemaHasRequiredFields` - Verify query, max_results, topic, include_raw_content
- **Assertion**: `expectHttpRequestSchemaHasRequiredFields` - Verify url, method, headers, body, params, timeout
- **Assertion**: `expectFetchUrlSchemaHasRequiredFields` - Verify url, timeout, extract_article

---

## Phase 2: Web Search Tool

### Test 4: Web Search Returns Results Successfully

```typescript
// web_search returns formatted results for valid query
//
// createWebSearchTool
// mockTavilyApiResponse
//
// executeWebSearch
//
// expectResultsFormatted
// expectTitlesIncluded
// expectUrlsIncluded
// expectScoresIncluded
```

**DSL Functions**:

- **Setup**: `createWebSearchTool` - Create tool with mocked backend
- **Setup**: `mockTavilyApiResponse` - Mock tavily() call to return standard results
- **Action**: `executeWebSearch` - Call tool.execute with valid query
- **Assertion**: `expectResultsFormatted` - Verify output is formatted markdown/text
- **Assertion**: `expectTitlesIncluded` - Verify result titles in output
- **Assertion**: `expectUrlsIncluded` - Verify result URLs in output
- **Assertion**: `expectScoresIncluded` - Verify relevance scores in output

---

### Test 5: Web Search Emits Start and Finish Events

```typescript
// web_search emits web-search-start and web-search-finish events
//
// createWebSearchTool
// mockTavilyApiResponse
// createEventCollector
//
// executeWebSearch
//
// expectWebSearchStartEventEmitted
// expectWebSearchFinishEventEmitted
// expectEventPayloadsCorrect
```

**DSL Functions**:

- **Setup**: `createWebSearchTool`
- **Setup**: `mockTavilyApiResponse`
- **Setup**: `createEventCollector` - Create (events: [], onEvent: callback) pair
- **Action**: `executeWebSearch` - Execute with event callback
- **Assertion**: `expectWebSearchStartEventEmitted` - Verify first event is 'web-search-start'
- **Assertion**: `expectWebSearchFinishEventEmitted` - Verify last event is 'web-search-finish'
- **Assertion**: `expectEventPayloadsCorrect` - Verify event fields (query, resultCount, etc.)

---

### Test 6: Web Search Handles Tavily API Errors

```typescript
// web_search returns error string when Tavily API fails
//
// createWebSearchTool
// mockTavilyApiError
//
// executeWebSearch
//
// expectErrorStringReturned
// expectErrorContainsTavilyMessage
```

**DSL Functions**:

- **Setup**: `createWebSearchTool`
- **Setup**: `mockTavilyApiError` - Mock tavily().search() to throw error
- **Action**: `executeWebSearch` - Execute with query
- **Assertion**: `expectErrorStringReturned` - Verify result is error string (not thrown)
- **Assertion**: `expectErrorContainsTavilyMessage` - Verify error mentions "Web search error"

---

### Test 7: Web Search Respects max_results Parameter

```typescript
// web_search returns only specified number of results
//
// createWebSearchTool
// mockTavilyApiResponse
//
// executeWebSearchWithMaxResults
//
// expectResultCountMatches
```

**DSL Functions**:

- **Setup**: `createWebSearchTool`
- **Setup**: `mockTavilyApiResponse` - Mock with 10 results
- **Action**: `executeWebSearchWithMaxResults` - Execute with max_results=3
- **Assertion**: `expectResultCountMatches` - Verify output has 3 results (not 10)

---

### Test 8: Web Search Handles Timeout

```typescript
// web_search returns timeout error string
//
// createWebSearchTool
// mockTavilyApiTimeout
//
// executeWebSearch
//
// expectTimeoutErrorReturned
// expectErrorContainsTavilyMessage
```

**DSL Functions**:

- **Setup**: `createWebSearchTool`
- **Setup**: `mockTavilyApiTimeout` - Mock tavily().search() to timeout
- **Action**: `executeWebSearch`
- **Assertion**: `expectTimeoutErrorReturned` - Verify "timed out" in result
- **Assertion**: `expectErrorContainsTavilyMessage` - Verify error format consistent

---

## Phase 3: HTTP Request Tool

### Test 9: HTTP Request GET Succeeds

```typescript
// http_request executes successful GET request
//
// createHttpRequestTool
// mockFetchResponse
//
// executeHttpRequest
//
// expectResponseWithStatusCode
// expectContentParsed
// expectUrlIncluded
```

**DSL Functions**:

- **Setup**: `createHttpRequestTool`
- **Setup**: `mockFetchResponse` - Mock fetch to return 200 with JSON body
- **Action**: `executeHttpRequest` - Execute with GET to example.com/api
- **Assertion**: `expectResponseWithStatusCode` - Verify "Status: 200" in output
- **Assertion**: `expectContentParsed` - Verify JSON body parsed and displayed
- **Assertion**: `expectUrlIncluded` - Verify response URL shown

---

### Test 10: HTTP Request POST With JSON Body

```typescript
// http_request sends POST with JSON body
//
// createHttpRequestTool
// mockFetchResponse
// createJsonRequestBody
//
// executeHttpRequestPost
//
// expectPostRequestSent
// expectJsonBodyEncoded
// expectResponseReceived
```

**DSL Functions**:

- **Setup**: `createHttpRequestTool`
- **Setup**: `mockFetchResponse` - Mock fetch and capture request
- **Setup**: `createJsonRequestBody` - Create {name: "test", value: 123}
- **Action**: `executeHttpRequestPost` - Execute POST with JSON body
- **Assertion**: `expectPostRequestSent` - Verify method is POST in captured request
- **Assertion**: `expectJsonBodyEncoded` - Verify body is JSON-encoded
- **Assertion**: `expectResponseReceived` - Verify response parsed

---

### Test 11: HTTP Request With Query Parameters

```typescript
// http_request adds query parameters to URL
//
// createHttpRequestTool
// mockFetchResponse
// createQueryParameters
//
// executeHttpRequestWithParams
//
// expectParametersInUrl
// expectUrlEncodedCorrectly
```

**DSL Functions**:

- **Setup**: `createHttpRequestTool`
- **Setup**: `mockFetchResponse` - Mock and capture request URL
- **Setup**: `createQueryParameters` - Create {search: "test", limit: "10"}
- **Action**: `executeHttpRequestWithParams` - Execute with params
- **Assertion**: `expectParametersInUrl` - Verify ?search=test&limit=10 in URL
- **Assertion**: `expectUrlEncodedCorrectly` - Verify URL encoding correct

---

### Test 12: HTTP Request Handles HTTP Errors

```typescript
// http_request returns error for 4xx/5xx status codes
//
// createHttpRequestTool
// mockFetchErrorResponse
//
// executeHttpRequest
//
// expectErrorStatusShown
// expectErrorCodeReturned
```

**DSL Functions**:

- **Setup**: `createHttpRequestTool`
- **Setup**: `mockFetchErrorResponse` - Mock fetch to return 404
- **Action**: `executeHttpRequest` - Execute request
- **Assertion**: `expectErrorStatusShown` - Verify "404" in output
- **Assertion**: `expectErrorCodeReturned` - Verify status shown, not thrown

---

### Test 13: HTTP Request Timeout

```typescript
// http_request handles timeout errors
//
// createHttpRequestTool
// mockFetchTimeout
//
// executeHttpRequest
//
// expectTimeoutErrorReturned
```

**DSL Functions**:

- **Setup**: `createHttpRequestTool`
- **Setup**: `mockFetchTimeout` - Mock fetch to timeout
- **Action**: `executeHttpRequest`
- **Assertion**: `expectTimeoutErrorReturned` - Verify "timed out" message

---

### Test 14: HTTP Request Parses JSON Responses

```typescript
// http_request parses JSON responses
//
// createHttpRequestTool
// mockFetchJsonResponse
//
// executeHttpRequest
//
// expectJsonParsed
// expectObjectDisplayed
```

**DSL Functions**:

- **Setup**: `createHttpRequestTool`
- **Setup**: `mockFetchJsonResponse` - Mock with {id: 1, name: "test"}
- **Action**: `executeHttpRequest`
- **Assertion**: `expectJsonParsed` - Verify JSON parsed (not raw string)
- **Assertion**: `expectObjectDisplayed` - Verify {"id": 1, ...} displayed

---

### Test 15: HTTP Request Falls Back to Text for Non-JSON

```typescript
// http_request returns text for non-JSON responses
//
// createHttpRequestTool
// mockFetchHtmlResponse
//
// executeHttpRequest
//
// expectHtmlReturned
// expectTextNotParsed
```

**DSL Functions**:

- **Setup**: `createHttpRequestTool`
- **Setup**: `mockFetchHtmlResponse` - Mock with HTML content
- **Action**: `executeHttpRequest`
- **Assertion**: `expectHtmlReturned` - Verify HTML in output
- **Assertion**: `expectTextNotParsed` - Verify not parsed as JSON

---

## Phase 4: Fetch URL Tool

### Test 16: Fetch URL Converts HTML to Markdown

```typescript
// fetch_url converts HTML to markdown
//
// createFetchUrlTool
// mockFetchHtmlResponse
//
// executeFetchUrl
//
// expectMarkdownOutput
// expectHeadingsFormatted
// expectParagraphsFormatted
```

**DSL Functions**:

- **Setup**: `createFetchUrlTool`
- **Setup**: `mockFetchHtmlResponse` - Mock with <h1>Title</h1><p>Content</p>
- **Action**: `executeFetchUrl` - Execute with extract_article: false
- **Assertion**: `expectMarkdownOutput` - Verify markdown format (# Title)
- **Assertion**: `expectHeadingsFormatted` - Verify headings are ### format
- **Assertion**: `expectParagraphsFormatted` - Verify paragraphs are plain text

---

### Test 17: Fetch URL Extracts Article Content

```typescript
// fetch_url extracts main article content when enabled
//
// createFetchUrlTool
// mockFetchNewsArticleResponse
//
// executeFetchUrlWithArticleExtraction
//
// expectArticleContentExtracted
// expectNavigationRemoved
// expectAdsRemoved
```

**DSL Functions**:

- **Setup**: `createFetchUrlTool`
- **Setup**: `mockFetchNewsArticleResponse` - Mock news page with nav/ads/article
- **Action**: `executeFetchUrlWithArticleExtraction` - Execute with extract_article: true
- **Assertion**: `expectArticleContentExtracted` - Verify article content present
- **Assertion**: `expectNavigationRemoved` - Verify nav elements removed
- **Assertion**: `expectAdsRemoved` - Verify ad content removed

---

### Test 18: Fetch URL Emits Events

```typescript
// fetch_url emits fetch-url-start and fetch-url-finish events
//
// createFetchUrlTool
// mockFetchHtmlResponse
// createEventCollector
//
// executeFetchUrl
//
// expectFetchUrlStartEventEmitted
// expectFetchUrlFinishEventEmitted
// expectEventPayloadsCorrect
```

**DSL Functions**:

- **Setup**: `createFetchUrlTool`
- **Setup**: `mockFetchHtmlResponse`
- **Setup**: `createEventCollector`
- **Action**: `executeFetchUrl`
- **Assertion**: `expectFetchUrlStartEventEmitted` - Verify 'fetch-url-start' event
- **Assertion**: `expectFetchUrlFinishEventEmitted` - Verify 'fetch-url-finish' event
- **Assertion**: `expectEventPayloadsCorrect` - Verify url, statusCode, contentLength, evicted

---

### Test 19: Fetch URL Handles 404 Errors

```typescript
// fetch_url returns error for 404 responses
//
// createFetchUrlTool
// mockFetch404Response
//
// executeFetchUrl
//
// expectErrorMessageReturned
// expectStatusCodeInError
```

**DSL Functions**:

- **Setup**: `createFetchUrlTool`
- **Setup**: `mockFetch404Response`
- **Action**: `executeFetchUrl`
- **Assertion**: `expectErrorMessageReturned` - Verify "404" in result (not thrown)
- **Assertion**: `expectStatusCodeInError` - Verify "Not Found" in result

---

### Test 20: Fetch URL Timeout

```typescript
// fetch_url handles request timeout
//
// createFetchUrlTool
// mockFetchTimeout
// createFetchUrlToolWithShortTimeout
//
// executeFetchUrl
//
// expectTimeoutErrorReturned
```

**DSL Functions**:

- **Setup**: `createFetchUrlTool`
- **Setup**: `mockFetchTimeout`
- **Setup**: `createFetchUrlToolWithShortTimeout` - Set timeout: 1 second
- **Action**: `executeFetchUrl`
- **Assertion**: `expectTimeoutErrorReturned` - Verify "timed out" message

---

### Test 21: Fetch URL Handles Readability Extraction Failure

```typescript
// fetch_url falls back to full HTML when Readability fails
//
// createFetchUrlTool
// mockFetchHtmlResponseWithoutArticle
//
// executeFetchUrl
//
// expectFullHtmlConverted
// expectNoErrorThrown
```

**DSL Functions**:

- **Setup**: `createFetchUrlTool`
- **Setup**: `mockFetchHtmlResponseWithoutArticle` - HTML without article tags
- **Action**: `executeFetchUrl` - With extract_article: true
- **Assertion**: `expectFullHtmlConverted` - Verify full HTML converted to markdown
- **Assertion**: `expectNoErrorThrown` - Verify no exception raised

---

## Phase 5: Result Eviction

### Test 22: Large Results Evicted to Filesystem

```typescript
// fetch_url evicts large content to filesystem
//
// createFetchUrlTool
// mockFetchLargeHtmlResponse
// createBackendWithEvictionSupport
//
// executeFetchUrlWithEvictionLimit
//
// expectResultEvicted
// expectContentSavedToBackend
// expectPointerMessageReturned
```

**DSL Functions**:

- **Setup**: `createFetchUrlTool`
- **Setup**: `mockFetchLargeHtmlResponse` - Mock with 50KB HTML
- **Setup**: `createBackendWithEvictionSupport` - Create StateBackend
- **Action**: `executeFetchUrlWithEvictionLimit` - Execute with toolResultEvictionLimit: 10000
- **Assertion**: `expectResultEvicted` - Verify evicted: true in event
- **Assertion**: `expectContentSavedToBackend` - Verify content written to `/large_tool_results/`
- **Assertion**: `expectPointerMessageReturned` - Verify result mentions "saved to /path"

---

### Test 23: Small Results Not Evicted

```typescript
// fetch_url does not evict small content
//
// createFetchUrlTool
// mockFetchSmallHtmlResponse
// createBackendWithEvictionSupport
//
// executeFetchUrlWithEvictionLimit
//
// expectResultNotEvicted
// expectFullContentReturned
```

**DSL Functions**:

- **Setup**: `createFetchUrlTool`
- **Setup**: `mockFetchSmallHtmlResponse` - Mock with 100 bytes HTML
- **Setup**: `createBackendWithEvictionSupport`
- **Action**: `executeFetchUrlWithEvictionLimit` - Execute with toolResultEvictionLimit: 10000
- **Assertion**: `expectResultNotEvicted` - Verify evicted: false in event
- **Assertion**: `expectFullContentReturned` - Verify full content returned inline

---

## Phase 6: Integration and Agent Registration

### Test 24: Web Tools Conditionally Registered in Agent

```typescript
// web tools only registered when TAVILY_API_KEY is present
//
// createAgentWithApiKey
//
// expectWebToolsRegistered
```

**DSL Functions**:

- **Setup**: `createAgentWithApiKey` - Set TAVILY_API_KEY before creating agent
- **Assertion**: `expectWebToolsRegistered` - Verify web_search, http_request, fetch_url in agent tools

---

### Test 25: Web Tools Approval Configuration

```typescript
// web_search and fetch_url require approval in CLI
//
// createAgentWithDefaultApprovalConfig
//
// expectWebSearchRequiresApproval
// expectFetchUrlRequiresApproval
// expectHttpRequestNoApproval
```

**DSL Functions**:

- **Setup**: `createAgentWithDefaultApprovalConfig` - Use DEFAULT_CLI_INTERRUPT_ON
- **Assertion**: `expectWebSearchRequiresApproval` - Verify web_search: true in config
- **Assertion**: `expectFetchUrlRequiresApproval` - Verify fetch_url: true in config
- **Assertion**: `expectHttpRequestNoApproval` - Verify http_request NOT in config

---

## DSL Functions Summary

### Setup Functions

**Tool Creation:**

- `createWebToolsWithoutApiKey()` - Factory without API key
- `createWebToolsWithValidApiKey()` - Factory with valid API key
- `createWebSearchTool()` - Instantiate web_search tool
- `createHttpRequestTool()` - Instantiate http_request tool
- `createFetchUrlTool()` - Instantiate fetch_url tool
- `createFetchUrlToolWithShortTimeout()` - Configure timeout

**Mocking:**

- `mockTavilyApiResponse()` - Mock successful tavily search
- `mockTavilyApiError()` - Mock tavily error
- `mockTavilyApiTimeout()` - Mock tavily timeout
- `mockFetchResponse()` - Mock fetch with status 200
- `mockFetchErrorResponse()` - Mock fetch 4xx/5xx
- `mockFetchTimeout()` - Mock fetch timeout
- `mockFetchJsonResponse()` - Mock JSON response
- `mockFetchHtmlResponse()` - Mock HTML response
- `mockFetch404Response()` - Mock 404 response
- `mockFetchNewsArticleResponse()` - Mock article with nav/ads
- `mockFetchHtmlResponseWithoutArticle()` - Mock HTML without article
- `mockFetchLargeHtmlResponse()` - Mock 50KB HTML
- `mockFetchSmallHtmlResponse()` - Mock 100 bytes HTML

**Data Creation:**

- `createEventCollector()` - Return (events: [], onEvent: callback)
- `createJsonRequestBody()` - Return {name: "test", value: 123}
- `createQueryParameters()` - Return {search: "test", limit: "10"}
- `createBackendWithEvictionSupport()` - Return StateBackend instance
- `getToolSchemas()` - Extract inputSchema from tools

**Agent Creation:**

- `createAgentWithApiKey()` - Create agent with TAVILY_API_KEY set
- `createAgentWithDefaultApprovalConfig()` - Create agent with DEFAULT_CLI_INTERRUPT_ON

---

### Action Functions

**Web Search:**

- `executeWebSearch()` - Call tool.execute with query parameter
- `executeWebSearchWithMaxResults()` - Execute with max_results=3

**HTTP Request:**

- `executeHttpRequest()` - Call tool.execute with GET
- `executeHttpRequestPost()` - Call tool.execute with POST
- `executeHttpRequestWithParams()` - Execute with query parameters

**Fetch URL:**

- `executeFetchUrl()` - Call tool.execute with URL
- `executeFetchUrlWithArticleExtraction()` - Execute with extract_article: true
- `executeFetchUrlWithEvictionLimit()` - Execute with toolResultEvictionLimit

---

### Assertion Functions

**Tool Creation:**

- `expectToolFactoryReturnsEmptyObject()` - Verify length === 0
- `expectWebSearchToolCreated()` - Verify in keys
- `expectHttpRequestToolCreated()` - Verify in keys
- `expectFetchUrlToolCreated()` - Verify in keys
- `expectWarningLogged()` - Verify console.warn called

**Schema Validation:**

- `expectWebSearchSchemaHasRequiredFields()` - Check fields
- `expectHttpRequestSchemaHasRequiredFields()` - Check fields
- `expectFetchUrlSchemaHasRequiredFields()` - Check fields

**Results:**

- `expectResultsFormatted()` - Verify output format
- `expectTitlesIncluded()` - Verify titles
- `expectUrlsIncluded()` - Verify URLs
- `expectScoresIncluded()` - Verify scores
- `expectResponseWithStatusCode()` - Verify "Status: "
- `expectContentParsed()` - Verify body in output
- `expectUrlIncluded()` - Verify URL shown
- `expectMarkdownOutput()` - Verify markdown format
- `expectHeadingsFormatted()` - Verify # format
- `expectParagraphsFormatted()` - Verify plain text
- `expectArticleContentExtracted()` - Verify article present
- `expectNavigationRemoved()` - Verify no nav
- `expectAdsRemoved()` - Verify no ads
- `expectJsonParsed()` - Verify JSON formatted
- `expectObjectDisplayed()` - Verify object display
- `expectHtmlReturned()` - Verify HTML in output
- `expectTextNotParsed()` - Verify not parsed

**Errors:**

- `expectErrorStringReturned()` - Verify string (not thrown)
- `expectErrorContainsTavilyMessage()` - Verify error text
- `expectTimeoutErrorReturned()` - Verify "timed out"
- `expectErrorStatusShown()` - Verify status in output
- `expectErrorCodeReturned()` - Verify code returned
- `expectErrorMessageReturned()` - Verify error message
- `expectStatusCodeInError()` - Verify code in error
- `expectNoErrorThrown()` - Verify no exception

**Events:**

- `expectWebSearchStartEventEmitted()` - Verify event type
- `expectWebSearchFinishEventEmitted()` - Verify event type
- `expectEventPayloadsCorrect()` - Verify fields
- `expectFetchUrlStartEventEmitted()` - Verify event type
- `expectFetchUrlFinishEventEmitted()` - Verify event type

**Eviction:**

- `expectResultEvicted()` - Verify evicted: true
- `expectContentSavedToBackend()` - Verify file written
- `expectPointerMessageReturned()` - Verify pointer message
- `expectResultNotEvicted()` - Verify evicted: false
- `expectFullContentReturned()` - Verify inline content

**Integration:**

- `expectWebToolsRegistered()` - Verify tools in agent
- `expectPostRequestSent()` - Verify method
- `expectJsonBodyEncoded()` - Verify encoding
- `expectResponseReceived()` - Verify response
- `expectParametersInUrl()` - Verify params in URL
- `expectUrlEncodedCorrectly()` - Verify encoding
- `expectFullHtmlConverted()` - Verify converted
- `expectWebSearchRequiresApproval()` - Verify config
- `expectFetchUrlRequiresApproval()` - Verify config
- `expectHttpRequestNoApproval()` - Verify config

---

## Test Execution Order

1. **Phase 1** (Tool Creation): Tests 1-3
2. **Phase 2** (Web Search): Tests 4-8
3. **Phase 3** (HTTP Request): Tests 9-15
4. **Phase 4** (Fetch URL): Tests 16-21
5. **Phase 5** (Eviction): Tests 22-23
6. **Phase 6** (Integration): Tests 24-25

---

## Implementation Notes

### Mocking Strategy

**HTTP Mocking**: Use globalThis.fetch override

```typescript
globalThis.fetch = async (url: string, options?: RequestInit) => {
  // Return mocked Response
  return new Response(JSON.stringify({...}), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  }) as any;
};
```

**Tavily Mocking**: Mock the `tavily()` function

```typescript
import * as module from "@tavily/core";
// Mock module.tavily() to return {...search: async () => {...}}
```

**Event Tracking**: Collect in array

```typescript
const events: DeepAgentEvent[] = [];
const onEvent: EventCallback = (event) => events.push(event);
```

### Test Coverage Goals

- **Unit tests**: All three tools (web_search, http_request, fetch_url)
- **Event tests**: Start/finish events for each tool
- **Error tests**: HTTP errors, timeouts, API errors
- **Integration tests**: Agent registration, approval config
- **Edge cases**: Large results, Readability failures, parameter validation
- **Target coverage**: ≥80% of tool code

---

## Acceptance Criteria

✅ All 25 test cases defined in structured format
✅ DSL functions identified and grouped by phase
✅ Mock strategies documented
✅ Integration points specified
✅ Event validation included
✅ Error scenarios covered
✅ Test execution order determined
