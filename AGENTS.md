# AGENTS.md

This file provides guidance to AI Agents (Claude Code, Cursor, etc.) when working with code in this repository.

## Project Overview

**deepagentsdk** is a TypeScript library implementing "Deep Agents" architecture using Vercel AI SDK v6. Deep Agents extend basic LLM tool-calling with four core pillars:

1. **Planning tools** (`write_todos`) - Task planning and tracking
2. **Virtual filesystem** - Stateful file operations across tool calls
3. **Subagent spawning** (`task`) - Delegate work to specialized agents
4. **Detailed prompting** - Rich system prompts and tool descriptions

**Key Pattern**: This library wraps AI SDK v6's `ToolLoopAgent` with state management and specialized tools to enable complex, multi-step agent behaviors.

**Documentation Structure**:

- **AGENTS.md** (this file) - Quick reference for AI agents
- **docs/site/handbook/** - Website documentation (get-started, guides, reference)
- **docs/site/blog/** - Blog posts (drafts and published)
- **docs/research/** - Internal research documents
- **docs/tickets/** - Feature tickets and implementation plans
- **.github/PUBLISHING.md** - Publishing and release guide

## Feature Parity Tracking

This project reimplements LangChain's DeepAgents framework using Vercel AI SDK.

- **Reference**: `.refs/deepagentsjs/` (JS) and `.refs/deepagents/` (Python)
- **Feature tracker**: `docs/PROJECT-STATE.md`
- **Implementation framework**: `PLAYBOOK.md` (Research → Plan → Implement)

**When implementing features**:

- Complex features → Full RPI (read `PLAYBOOK.md`)
- Simple changes → Light plan
- Trivial fixes → Direct implementation

**After completing**: Update `PROJECT-STATE.md` (move to "Implemented" or "Won't Support")

## Development Commands

```bash
# Run tests
npm test

# Type checking
npm run typecheck

# Run CLI (development)
npm run cli
npm run cli -- --model anthropic/claude-haiku-4-5-20251001 --dir ./workspace

# Run examples
node --import tsx examples/basic.ts
node --import tsx examples/streaming.ts
```

## Key Files

**Core:**

- `src/agent.ts` - DeepAgent class and createDeepAgent factory
- `src/types.ts` - TypeScript type definitions
- `src/prompts.ts` - System prompts for agent and tools

**Tools:**

- `src/tools/filesystem.ts` - Virtual filesystem tools
- `src/tools/subagent.ts` - Subagent spawning
- `src/tools/todos.ts` - Todo management

**Backends:**

- `src/backends/state.ts` - In-memory storage (default)
- `src/backends/filesystem.ts` - Disk persistence
- `src/backends/persistent.ts` - Cross-conversation memory
- `src/backends/composite.ts` - Combine multiple backends

**CLI:**

- `src/cli/index.tsx` - Interactive CLI (Ink/React)
- `src/cli/hooks/useAgent.ts` - Agent streaming hook

**Utils:**

- `src/utils/model-parser.ts` - Parse model strings to LanguageModel instances (CLI only)

## Testing Patterns

- Use Node's built-in test runner (`node:test`)
- Import: `import { test } from "node:test";`
- Co-locate tests with source files (`agent.test.ts`)
- Test backends separately from agent logic

```typescript
import { test } from "node:test";
import assert from "node:assert/strict";
import { createDeepAgent, StateBackend } from "deepagentsdk";

test("agent behavior", async () => {
  const backend = new StateBackend();
  const agent = createDeepAgent({ model, backend });
  // ... test logic
  assert.ok(agent);
});
```

## Test Organization

**Unit Tests** (`test/`):

- Fast, isolated tests with no external dependencies
- Run by default: `npm test`
- Executed in CI on every push
- Examples: `test/backends/utils.test.ts`, `test/approval.test.ts`

**Integration Tests** (`test-integration/`):

- Require API keys and external services (Anthropic, OpenAI)
- Must be run explicitly: `npm run test:integration`
- Skipped in CI (manual or separate workflow only)
- Examples: `test-integration/middleware.test.ts`, `test-integration/structured-output.test.ts`

**Running Tests**:

```bash
# Unit tests (default, CI)
npm test

# Integration tests (requires ANTHROPIC_API_KEY)
npm run test:integration

# All tests
npm run test:all
```

## Publishing & Commit Messages

**CRITICAL**: This repo uses GitHub Actions for automated npm publishing. Commit messages control version bumps.

### Commit Message Format

Use semantic prefixes to control versioning:

```bash
# Patch (0.1.12 → 0.1.13) - Bug fixes, refactors, chores
fix: resolve memory leak in checkpointer
refactor: simplify backend logic
chore: update dependencies

# Minor (0.1.12 → 0.2.0) - New features (backwards-compatible)
feat: add Redis backend support
feature: implement parallel subagents

# Major (0.1.12 → 1.0.0) - Breaking changes
breaking: remove deprecated createAgent API
major: refactor event system (breaking)
```

### Multi-Commit Push Behavior

The workflow analyzes ALL commits since the last version tag. **Highest priority wins**:

- If ANY commit contains "breaking" or "major" → **major** bump
- Else if ANY commit contains "feat" or "feature" → **minor** bump
- Otherwise → **patch** bump

**Examples:**

```bash
# Scenario 1: Fixes only → Patch (0.1.12 → 0.1.13)
git commit -m "fix: resolve bug A"
git commit -m "fix: resolve bug B"
git push origin main

# Scenario 2: Fixes + Feature → Minor (0.1.12 → 0.2.0)
git commit -m "fix: resolve checkpointer bug"
git commit -m "feat: add new backend type"
git push origin main

# Scenario 3: Feature + Breaking → Major (0.1.12 → 1.0.0)
git commit -m "feat: add caching"
git commit -m "breaking: change API signature"
git push origin main
```

### Publishing Triggers

Workflow **ONLY** publishes when these files change:

- `src/**` (source code)
- `package.json`
- `tsconfig.json`
- `package-lock.json`

Workflow **SKIPS** publishing for:

- `examples/**`
- `*.md` files
- `.github/**`, `docs/**`, `.refs/**`, `docs/**`

**See**: `.github/PUBLISHING.md` for full publishing guide and setup instructions.

## Important Conventions

1. **File paths**: Always relative to working directory (e.g., `/src/main.ts` or `main.ts`)
2. **Todo status flow**: `pending` → `in_progress` → `completed` or `cancelled`
3. **Backend resolution**: Can be instances (`BackendProtocol`) or factories (`BackendFactory`)
4. **Subagent isolation**: Share filesystem with parent, independent todos and history
5. **Tool naming**: Use snake_case (`write_todos`, `read_file`) for consistency
6. **Model instances**: Library requires AI SDK `LanguageModel` instances (not strings)
   - CLI uses `parseModelString()` for backward compatibility only
   - Programmatic usage: Always pass provider instances (`anthropic()`, `openai()`, etc.)

## Quick Reference

**Need architecture details?** → See `docs/site/handbook/reference/architecture.mdx`

**Need code examples?** → See `docs/site/handbook/reference/patterns.mdx`

**Need checkpointer info?** → See `docs/site/handbook/guides/checkpointers.mdx`

**Need publishing help?** → See `.github/PUBLISHING.md`

**Need feature tracking?** → See `docs/PROJECT-STATE.md`

**Need implementation process?** → See `PLAYBOOK.md`

If you are unsure how to do something, use `gh_grep` to search code examples from GitHub, or `deepwiki` for documentation, questions, or implementation from public codebases, such as this one or any libraries.
