# Web research with Parallel Search MCP

Run [parallel-search.ts](./parallel-search.ts) to add web search and page extraction
through deepagentsdk's custom AI SDK tools. It connects to
`https://search.parallel.ai/mcp` with the AI SDK MCP client's HTTP transport.
[Parallel Search MCP](https://docs.parallel.ai/integrations/mcp/search-mcp) is free
without a Parallel API key for light use, subject to anonymous rate limits.
Model inference still requires an Anthropic key and may incur charges.

From a checkout of this repository:

```bash
bun install --frozen-lockfile
export ANTHROPIC_API_KEY=your-key
bun examples/parallel-search.ts "What is the Model Context Protocol? Cite sources."
```

The example discovers MCP tools, prefixes their names with `parallel_`, and passes
them to `createDeepAgent({ tools })`. The agent uses `parallel_web_search` and
`parallel_web_fetch` to return a summary with source URLs. Tool arguments come
from the server's discovered schemas. The client closes after generation,
including when discovery or generation fails.

The example sends no Parallel credentials and identifies requests with
`User-Agent: deepagentsdk/parallel-search-example`. Tavily's built-in `web_search`
and its `TAVILY_API_KEY` behavior remain available under their existing names.
This example doesn't change the CLI or other agents. To use it in an application,
install `@ai-sdk/mcp` as an application dependency and use the same client/tool
lifecycle around your agent. Approval rules for these custom tools use their
prefixed names, such as `parallel_web_search`.

Run the offline caller tests with `bun test test/parallel-search.test.ts`.
The live transport test uses a deterministic test model and real anonymous
search/fetch calls, so it requires network access but no model or Parallel key:

```bash
bun test test-integration/parallel-search.test.ts
```
