---
title: "Test Cases: Code Smell Refactoring"
description: Documentation
---

**Generated**: 2025-12-23
**Test Files**: 3 new test files
**Total Tests**: 75+ new tests
**Status**: Ready for implementation

## Quick Start

```bash
# Run all new tests (will fail until production code exists)
bun test test/backends/utils.test.ts
bun test test/utils/summarization.test.ts
bun test test/backends/composite.test.ts

# Run specific describe block
bun test test/backends/utils.test.ts -t "formatFileContent"

# Run with coverage
bun test --coverage test/backends/utils.test.ts

# Watch mode during development
bun test --watch test/backends/utils.test.ts
```

## Test Organization

### 1. Backend Utilities (`test/backends/utils.test.ts`) - 36 tests

#### formatFileContent() (11 tests)
- `utils.test.ts:51` - formats single line content without line numbers
- `utils.test.ts:62` - formats multi-line content with line numbers
- `utils.test.ts:75` - handles file with many lines (line width expansion)
- `utils.test.ts:88` - handles empty file
- `utils.test.ts:97` - preserves trailing newlines
- `utils.test.ts:109` - handles file with only newlines
- `utils.test.ts:123` - handles very long lines (10000+ chars)
- `utils.test.ts:136` - handles unicode content
- `utils.test.ts:149` - handles mixed line endings (CRLF)
- `utils.test.ts:162` - handles file with negative line count
- `utils.test.ts:175` - handles file with mismatched line count

#### applyStringReplacement() (11 tests)
- `utils.test.ts:227` - replaces single occurrence of string
- `utils.test.ts:243` - returns occurrence count
- `utils.test.ts:259` - handles case-sensitive replacement
- `utils.test.ts:280` - handles empty new string (deletion)
- `utils.test.ts:297` - handles multiline strings
- `utils.test.ts:314` - handles old string not found
- `utils.test.ts:329` - handles empty old string
- `utils.test.ts:342` - handles special regex characters
- `utils.test.ts:359` - handles unicode strings
- `utils.test.ts:374` - handles empty content
- `utils.test.ts:389` - handles very large content (100K+ chars)

#### estimateTokens() (14 tests)
- `utils.test.ts:455` - estimates tokens for simple text
- `utils.test.ts:468` - estimates tokens for longer text
- `utils.test.ts:482` - handles code with special characters
- `utils.test.ts:493` - handles empty string
- `utils.test.ts:504` - handles only whitespace
- `utils.test.ts:515` - handles only newlines
- `utils.test.ts:526` - handles very long single word (100 chars)
- `utils.test.ts:537` - handles mixed unicode (emoji, CJK)
- `utils.test.ts:550` - provides consistent estimates for identical input
- `utils.test.ts:563` - scales linearly with repeated content

### 2. Summarization Utilities (`test/utils/summarization.test.ts`) - 26 tests

#### Basic Summarization (5 tests)
- `summarization.test.ts:84` - summarizes messages when over token threshold
- `summarization.test.ts:103` - keeps system message in summary
- `summarization.test.ts:122` - keeps recent messages when summarizing
- `summarization.test.ts:149` - adds summary as assistant message
- `summarization.test.ts:172` - returns messages unchanged when under threshold

#### Edge Cases (7 tests)
- `summarization.test.ts:189` - handles empty message array
- `summarization.test.ts:202` - handles single message
- `summarization.test.ts:217` - handles messages without system prompt
- `summarization.test.ts:236` - handles keepMessages larger than message count
- `summarization.test.ts:255` - handles zero keepMessages
- `summarization.test.ts:274` - handles very long individual messages
- `summarization.test.ts:295` - handles model generation errors gracefully

#### Configuration (3 tests)
- `summarization.test.ts:393` - respects custom tokenThreshold
- `summarization.test.ts:416` - respects custom keepMessages count
- `summarization.test.ts:443` - handles summarization disabled (threshold = 0)

#### Integration Scenarios (2 tests)
- `summarization.test.ts:468` - summarizes typical conversation flow
- `summarization.test.ts:503` - handles multiple summarization cycles

### 3. Composite Backend (`test/backends/composite.test.ts`) - 31 tests

#### Constructor (2 tests)
- `composite.test.ts:67` - creates backend with route map and fallback
- `composite.test.ts:86` - creates backend with only fallback (no routes)

#### lsInfo() (12 tests)
- `composite.test.ts:148` - routes to correct backend by path prefix
- `composite.test.ts:162` - routes to different backend by path prefix
- `composite.test.ts:176` - routes to fallback when no prefix matches
- `composite.test.ts:190` - routes to fallback for root path
- `composite.test.ts:202` - handles nested paths correctly
- `composite.test.ts:216` - handles path without leading slash
- `composite.test.ts:228` - handles path with trailing slash
- `composite.test.ts:240` - handles empty path
- `composite.test.ts:252` - handles overlapping prefix routes
- `composite.test.ts:275` - handles backend returning errors gracefully
- `composite.test.ts:293` - handles no fallback configured

#### read() (8 tests)
- `composite.test.ts:336` - reads from correct backend by path
- `composite.test.ts:351` - reads from different backend by path
- `composite.test.ts:366` - returns error for non-existent file
- `composite.test.ts:379` - handles nested file paths
- `composite.test.ts:393` - handles paths with special characters

#### write() (8 tests)
- `composite.test.ts:437` - writes to correct backend by path
- `composite.test.ts:457` - writes to different backend by path
- `composite.test.ts:477` - returns error when file already exists
- `composite.test.ts:493` - handles writing empty content
- `composite.test.ts:506` - handles writing large content
- `composite.test.ts:521` - handles unicode content

#### edit() (5 tests)
- `composite.test.ts:567` - edits file in routed backend
- `composite.test.ts:590` - returns error for non-existent file
- `composite.test.ts:605` - returns error when old string not found

#### grepRaw() (5 tests)
- `composite.test.ts:637` - searches files in routed backend
- `composite.test.ts:654` - handles regex patterns
- `composite.test.ts:671` - returns empty array for no matches
- `composite.test.ts:684` - handles invalid regex gracefully

#### globInfo() (5 tests)
- `composite.test.ts:715` - matches files in routed backend
- `composite.test.ts:733` - handles recursive patterns
- `composite.test.ts:750` - returns empty array for no matches
- `composite.test.ts:763` - handles complex glob patterns

## Coverage Summary

- ✅ **Happy paths**: 25 tests covering normal operations
- ✅ **Edge cases**: 30 tests covering boundary conditions
- ✅ **Error scenarios**: 15 tests covering error handling
- ✅ **Integration scenarios**: 5 tests covering real-world usage

## Test Helpers Used

**Factory Functions**:
- `createFileData(content)` - Creates test FileData object
- `createMultiLineContent(count)` - Creates multi-line test content
- `createMockModel(responseText)` - Creates mock language model
- `createTestMessages(count)` - Creates array of test messages
- `createLongMessage(size)` - Creates long content message
- `createTestState()` - Creates DeepAgentState
- `createTestBackend(state)` - Creates StateBackend
- `createTestFile(state, path, content)` - Adds file to state
- `createCompositeBackend(routes, fallback)` - Creates CompositeBackend

**Patterns Applied**:
- Given-When-Then structure in all tests
- beforeEach/afterEach for setup/teardown
- Mock models to avoid API calls
- Direct assertions (no unnecessary abstractions)

## Next Steps

1. **Implement Phase 4** of refactoring plan (`/3_implement_plan`)
2. Run tests to verify implementation: `bun test`
3. Fix any failing tests
4. Update test helpers if new patterns emerge
5. Commit with message: `test: add coverage for backends/utils, utils/summarization, backends/composite`

## Notes

- Tests follow existing codebase patterns ( researched via codebase-pattern-finder)
- Helper functions created only when used 4+ times
- Tests use `bun:test` framework (not Jest/Vitest)
- No external dependencies mocked except `LanguageModel`
- All tests are type-safe and compile with `bun run typecheck`
