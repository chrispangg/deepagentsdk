---
description: Generate executable BDD tests using Given-When-Then structure with minimal abstraction
model: claude-sonnet-4-5-20250929
allowed-tools: AskUserQuestion, Edit, Task, TodoWrite, Write, Bash(git:*), Bash(gh:*), Bash(basename:*), Bash(date:*)
argument-hint: [feature-to-test]
---

# Define Test Cases Command

You are helping generate executable BDD (Behavior-Driven Development) tests following modern best practices (2024-2025).

## Core Principles

1. **Tests as Primary Artifact**: Generate actual runnable test code, not specification documents. Tests ARE the living documentation.

2. **Minimal Abstraction**: Use Given-When-Then comments for readability. Create helper functions ONLY when significant duplication exists (3+ times).

3. **Native Framework**: Use bun:test with standard describe/test structure. No Cucumber/Gherkin - code is the specification.

4. **Self-Documenting**: Tests should read like natural language specifications. Non-developers should understand what's being tested.

5. **Follow Existing Patterns**: Study and adapt to the project's established testing conventions and structure.

## Test Structure

```typescript
describe("Feature Name", () => {
  test("behavior description", async () => {
    // Given: [preconditions - what exists before the action]
    const state = { files: {}, todos: [] };
    const tools = createWebTools(state, { apiKey: "test" });

    // When: [action - what happens]
    const result = await tools.web_search.execute({ query: "test" });

    // Then: [expected outcome - what should be true]
    expect(result).toContain("Result");
    expect(result).toContain("https://");
  });
});
```

**Structure Rules**:

- **Given**: Setup phase - create test state and preconditions
- **When**: Action phase - trigger the behavior under test
- **Then**: Assertion phase - verify expected outcomes
- Use blank lines to separate phases visually
- Write descriptive test names that explain the behavior

## DSL Helper Guidelines

Create helper functions ONLY when:

- **Duplication threshold**: Same setup appears 3+ times
- **Complex assertions**: 4+ expect() calls that logically belong together
- **Mock configuration**: Complex mock setups reused frequently

Do NOT create helpers for:

- Simple assertions (1-2 expect() calls)
- One-off setups
- Anything that doesn't significantly reduce duplication

**Good helper examples**:

```typescript
// Used 15+ times across all tests
function createMockState(): DeepAgentState {
  return { files: {}, todos: [] };
}

// Complex 10-line setup used 5+ times
function setupAuthenticatedUser() {
  const user = createUser();
  const session = createSession(user);
  mockAuthService(session);
  return { user, session };
}
```

**Bad helper examples** (don't create these):

```typescript
// Only used 2 times
function expectToolsExist(tools: any) {
  expect(tools).toBeDefined();
}

// Simple 1-liner
function createEmptyArray() {
  return [];
}
```

## Test Coverage Requirements

When defining test cases, ensure you cover:

### 1. Happy Paths

Standard successful flows where everything works as expected.

```typescript
test("creates user successfully with valid data", async () => {
  // Given: Valid user data
  const userData = { email: "test@example.com", name: "Test User" };

  // When: Creating user
  const result = await userService.create(userData);

  // Then: User should be created
  expect(result.success).toBe(true);
  expect(result.user.email).toBe("test@example.com");
});
```

### 2. Edge Cases

Boundary conditions and unusual but valid inputs.

```typescript
test("handles maximum allowed items", async () => {
  // Given: Cart with maximum items
  const cart = createCart();
  for (let i = 0; i < MAX_ITEMS; i++) {
    cart.addItem({ id: i });
  }

  // When: Submitting order
  const result = await orderService.submit(cart);

  // Then: Order should be created with all items
  expect(result.success).toBe(true);
  expect(result.items).toHaveLength(MAX_ITEMS);
});
```

### 3. Error Scenarios

Invalid inputs, service failures, timeout conditions.

```typescript
test("handles API timeout gracefully", async () => {
  // Given: Service configured to timeout
  mockApiTimeout();

  // When: Making request
  const result = await apiClient.fetch("https://api.example.com");

  // Then: Should return error message
  expect(result).toContain("timed out");
  expect(result).not.toContain("undefined");
});
```

### 4. Boundary Conditions

Maximum/minimum values, empty states, null cases.

```typescript
test("rejects empty input", async () => {
  // Given: Empty string input
  const input = "";

  // When: Validating input
  const result = validator.validate(input);

  // Then: Should fail validation
  expect(result.isValid).toBe(false);
  expect(result.errors).toContain("Input cannot be empty");
});
```

### 5. Authorization/Permission Scenarios

Permission-based access and security checks.

```typescript
test("denies access to unauthorized users", async () => {
  // Given: Unauthenticated user
  const user = createUnauthenticatedUser();

  // When: Attempting protected action
  const result = await protectedService.execute(user);

  // Then: Should be denied
  expect(result.success).toBe(false);
  expect(result.error).toContain("unauthorized");
});
```

## Workflow

When the user asks you to define test cases:

### 1. Understand the Feature

Ask clarifying questions about:

- What functionality is being tested
- Which systems/services are involved
- Expected behaviors and outcomes
- Edge cases and error conditions
- Authorization/permission requirements

### 2. Research Existing Test Patterns

**IMPORTANT**: Before writing any tests, use the Task tool to launch a codebase-pattern-finder agent to:

- Find existing test files and their structure
- Identify common helper patterns
- Understand how mocks are configured
- Discover reusable test utilities
- Learn test organization conventions

Example agent invocation:

```
Use the Task tool with subagent_type="codebase-pattern-finder" to find:
- Existing test files (*.test.ts) and their structure
- Helper function patterns and naming conventions
- Mock/setup patterns used in tests
- Test organization patterns (describe blocks, beforeEach usage)
```

### 3. Generate Test File

Create the actual test code file with:

**File location**: `test/[feature]/[feature].test.ts`

**Structure**:

```typescript
/**
 * BDD Tests: [Feature Name]
 *
 * Generated by: /3_define_test_cases
 * Last updated: [timestamp]
 * Test coverage: [brief description]
 */

import { test, expect, describe, beforeEach } from "bun:test";
// Import feature under test
// Import types

// ============================================================================
// Test Helpers (Only if duplication > 2x)
// ============================================================================

// Create helpers ONLY when pattern appears 3+ times
// Most tests should use direct code with GWT comments

/** [Helper description with usage count] */
function helperName(...) { ... }

// ============================================================================
// Phase 1: [Phase Name]
// ============================================================================

describe("[Phase Name]", () => {
  // Optional: beforeEach only if shared setup across ALL tests
  beforeEach(() => { ... });

  test("[specific behavior description]", async () => {
    // Given: [what exists before]

    // When: [what happens]

    // Then: [what should be true]
  });

  test("[another behavior]", async () => {
    // ...
  });
});

// ============================================================================
// Phase 2: [Phase Name]
// ============================================================================

describe("[Phase Name]", () => {
  // ... more tests
});
```

**Key points**:

- Use descriptive test names (not generic "it works")
- Group related tests in describe blocks by feature area/phase
- Include Given-When-Then comments in every test
- Use direct expect() calls unless helper significantly reduces duplication
- Tests should be readable top-to-bottom without scrolling

### 4. Generate Lightweight Index

Create a minimal index file for quick reference:

**File location**: `docs/tickets/TICKET-NAME/test-cases.md`

**Structure**:

```markdown
# Test Cases: [Feature Name]

**Test File**: `test/[feature]/[feature].test.ts`
**Generated**: [timestamp]
**Total Tests**: [count]

## Quick Start

\```bash
# Run all tests
bun test test/[feature]/[feature].test.ts

# Run specific phase
bun test test/[feature]/[feature].test.ts -t "Phase Name"

# Watch mode
bun test --watch test/[feature]/[feature].test.ts

# Coverage
bun test --coverage test/[feature]/[feature].test.ts
\```

## Test Organization

### Phase 1: [Phase Name] ([count] tests)
- `[file].test.ts:[line]` - [test description]
- `[file].test.ts:[line]` - [test description]
...

### Phase 2: [Phase Name] ([count] tests)
- `[file].test.ts:[line]` - [test description]
...

## Coverage Summary

- ✅ Happy paths: [count] tests
- ✅ Edge cases: [count] tests
- ✅ Error scenarios: [count] tests
- ✅ Boundary conditions: [count] tests
- ✅ Authorization: [count] tests
```

**Keep it minimal**: Target < 50 lines. Tests are the documentation, this is just an index.

### 5. Determine Ticket Name

If not provided, infer ticket folder from context or ask the user for:

- Ticket folder name (e.g., "005_web_tools")
- Feature being tested (e.g., "web-tools", "user-auth")

## Deliverables

When you complete this command, you must create TWO files:

### 1. PRIMARY: Test Code File

**Location**: `test/[feature]/[feature].test.ts`

**Contents**:

- File header with metadata
- Import statements
- Test helpers (only if duplication > 2x)
- Describe blocks organized by phase/feature area
- Tests with Given-When-Then structure
- Direct assertions (no unnecessary abstraction)

**Verification checklist**:

- [ ] File passes `bun run typecheck`
- [ ] Tests are runnable (may fail if production code doesn't exist yet)
- [ ] Given-When-Then comments are clear
- [ ] Helpers only created when justified (3+ uses)
- [ ] Test names are descriptive
- [ ] Coverage includes happy paths, edge cases, errors, boundaries

### 2. SECONDARY: Lightweight Index

**Location**: `docs/tickets/TICKET-NAME/test-cases.md`

**Contents**:

- Test file reference
- Quick command examples
- Test organization (phase → line numbers)
- Coverage summary

**Verification checklist**:

- [ ] File is < 50 lines
- [ ] Line numbers reference actual test file
- [ ] Commands are correct (bun test paths)
- [ ] Coverage counts are accurate

## Example Output

After running `/3_define_test_cases web-tools`, you would create:

**File 1**: `test/tools/web.test.ts` (~300-400 lines)

- Actual runnable tests with Given-When-Then structure
- Minimal helpers (only createMockState, used 15+ times)
- 25 tests covering all scenarios

**File 2**: `docs/tickets/005_web_tools/test-cases.md` (~40 lines)

- Lightweight index with line references
- Quick start commands
- Coverage summary

## Important Notes

- **Tests are specifications**: They define correct behavior, not just verify it
- **Executable documentation**: Tests run and prove the spec is correct
- **No duplication**: test-cases.md doesn't duplicate test content, just indexes it
- **Step 4 implements production code**: Tests already exist, step 4 makes them pass
- **Step 5 validates by running tests**: No manual verification needed

Remember: The goal is to make tests the living documentation. Focus on clarity and readability over clever abstractions.
