# RPI Framework: Research → Plan → Implement

This document provides instructions for AI agents implementing features in this repository using the RPI (Research, Plan, Implement) framework with specialized commands and sub-agents.

## Why RPI?

The RPI framework prevents "AI slop"—low-quality code that requires significant rework. It achieves this through **intentional context compaction**: keeping your context window clean, focused, and accurate at each phase.

**Key Principle**: Do not attempt implementation until you have completed Research and Planning. Each phase compresses information for the next:

- **Research** → Compresses **truth** (how the system actually works)
- **Plan** → Compresses **intent** (exactly what changes to make)
- **Implement** → Executes with **precision** (mechanical application of the plan)
- **Validate** → Verifies **correctness** (ensures implementation matches plan)

---

## When to Use RPI

| Task Complexity | Recommended Approach |
|-----------------|---------------------|
| Simple change (rename variable, fix typo) | Direct implementation |
| Small self-contained feature | Light plan, skip formal research |
| Medium feature (multiple files/services) | Full RPI with one research phase |
| Complex feature (core architecture changes) | Multiple RPI iterations |

**Rule of thumb**: If the feature is listed in `PROJECT-STATE.md` under "To Implement", use full RPI.

---

## Folder Structure

All RPI artifacts are stored in `docs/` with ticket-based organization:

```
docs/
├── tickets/
│   ├── TICKET-NAME/
│   │   ├── plan.md                    # Implementation plan
│   │   ├── research.md                # Research findings
│   │   ├── test-cases.md              # Lightweight test index
│   │   ├── notes-YYYY-MM-DD.md        # Implementation notes
│   │   └── sessions/
│   │       ├── 001_feature.md         # Session summaries
│   │       ├── 002_work-session.md
│   │       └── ...
├── notes/
│   ├── YYYY-MM-DD-meeting.md
│   └── ...
└── general-research-topic.md
```

**Test files** are co-located with source code:
```
test/
├── [feature]/
│   └── [feature].test.ts              # Actual runnable test code
```

**Ticket naming**: Use ticket number + descriptive name (e.g., `015_code_smell_refactoring`)
**Session numbering**: Use 3-digit sequential numbers (001, 002, etc.)

---

## Phase 1: Research — Compressing Truth

### Objective

Build an accurate understanding of how the system currently works. Identify all relevant files, functions, and code flows necessary for the feature.

### Command

Use `/1_research_codebase` command to conduct comprehensive research.

### Process

1. **Invoke research command**: `/1_research_codebase`

2. **Optimize research question** using prompt-engineer skill and confirm it captures user intent

3. **Read any directly mentioned files first**:
   - Read mentioned files FULLY before spawning sub-tasks
   - Ensure full context before decomposing research

4. **Decompose research question**:
   - Break down into composable research areas
   - Identify specific components, patterns, or concepts
   - Create research plan using TodoWrite

5. **Spawn parallel sub-agent tasks**:
   - **codebase-locator**: Finds WHERE code lives (files, directories, components)
   - **codebase-analyzer**: Analyzes HOW code works (implementation details, data flow)
   - **codebase-pattern-finder**: Finds PATTERNS and EXAMPLES (similar implementations, conventions)
   - **codebase-research-locator**: Discovers existing documents in `docs/` directory
   - **codebase-research-analyzer**: Extracts insights from research documents
   - **codebase-online-researcher**: Researches external documentation and web resources (if needed)

   Run multiple agents in parallel for different aspects of the research.

6. **Wait for all sub-agents to complete** before synthesizing findings.

7. **Synthesize findings**:
   - Prioritize live codebase findings as primary source of truth
   - Use `docs/` findings as supplementary historical context
   - Compile all sub-agent results
   - Connect findings across components
   - Include specific file paths and line numbers
   - Highlight patterns and architectural decisions

8. **Generate research document** with YAML frontmatter:

```markdown
---
date: 2025-01-15T10:30:00Z
researcher: Claude
git_commit: <git hash>
branch: main
repository: <repo-name>
topic: "Feature Name"
tags: [research, codebase, relevant-component-names]
status: complete
last_updated: 2025-01-15
last_updated_by: Claude
---

# Research: Feature Name

## Research Question
[Original user query]

## Summary
[High-level findings answering the user's question]

## Detailed Findings

### Component/Area 1
- Finding with reference (file.ext:line)
- Connection to other components
- Implementation details

### Component/Area 2
...

## Code References
- `path/to/file.ts:123` - Description of what's there
- `another/file.ts:45-67` - Description of the code block

## Architecture Documentation
[Current patterns, conventions, and design implementations found in the codebase]

## Historical Context (from docs/)
[Relevant insights from docs/ folders with references]
- `docs/tickets/AI-1234/database-implementation.md` - Information about database implementation for AI-1234
- `docs/notes/YYYY-MM-DD-meeting.md` - Past notes from internal engineering discussions

## Related Research
[Links to other research documents in docs/]

## Open Questions
[Any areas that need further investigation]
```

7. **Add GitHub permalinks (if applicable)**:
   - Check if on main branch or if commit is pushed
   - Generate GitHub permalinks for references

8. **Save research document**:
   - Create folder `docs/tickets/TICKET-NAME/` for ticket-associated research
   - Save to `docs/tickets/TICKET-NAME/{research-topic}.md` (use kebab-case)
   - For non-ticket research: `docs/{research-topic}.md`
   - A ticket can have multiple research markdown files under its folder

### Research Quality Checklist

- [ ] Identified all files that need modification
- [ ] Understood existing patterns in the codebase
- [ ] Reviewed reference implementations (`.refs/deepagentsjs/`, `.refs/deepagents/`)
- [ ] Documented dependencies and interactions
- [ ] Used parallel sub-agents for comprehensive coverage
- [ ] Prioritized live codebase findings over historical docs/ findings
- [ ] No assumptions—all claims backed by code inspection
- [ ] Documentarian approach (described what IS, not what SHOULD BE)

---

## Phase 2: Plan — Compressing Intent

### Objective

Transform research findings into a detailed, step-by-step implementation plan that can be executed mechanically. This is an **interactive, iterative process** with the user.

### Command

Use `/2_create_plan` command to create implementation plans.

### Process

1. **Invoke plan command**: `/2_create_plan`

2. **Context gathering & initial analysis**:
   - Read all mentioned files immediately and FULLY
   - Read all mentioned research documents immediately and FULLY
   - Spawn initial research tasks using sub-agents:
     - codebase-locator: Find all related files
     - codebase-analyzer: Understand current implementation
     - codebase-pattern-finder: Find similar features to model after

3. **Present informed understanding** and ask focused questions requiring human judgment.

4. **Research & discovery**:
   - Create research todo list using TodoWrite
   - Spawn parallel sub-tasks for comprehensive research
   - Wait for ALL sub-tasks to complete
   - Present findings and design options with pros/cons

5. **Plan structure development**:
   - Propose implementation phases
   - Get user buy-in on phasing approach

6. **Write detailed plan** with YAML frontmatter:

---

## Phase 2: Plan — Compressing Intent

### Objective

Transform research findings into a detailed, step-by-step implementation plan that can be executed mechanically. This is an **interactive, iterative process** with the user.

### Command

Use `/2_create_plan` command to create implementation plans.

### Process

1. **Invoke plan command**: `/2_create_plan`

2. **Context gathering & initial analysis**:
   - Read all mentioned files immediately and FULLY
   - Spawn initial research tasks using sub-agents:
     - codebase-locator: Find all related files
     - codebase-analyzer: Understand current implementation
     - codebase-pattern-finder: Find similar features to model after

3. **Present informed understanding** and ask focused questions requiring human judgment.

4. **Research & discovery**:
   - Create research todo list using TodoWrite
   - Spawn parallel sub-tasks for comprehensive research
   - Wait for ALL sub-tasks to complete
   - Present findings and design options with pros/cons

5. **Plan structure development**:
   - Propose implementation phases
   - Get user buy-in on phasing approach

6. **Write detailed plan** with YAML frontmatter:

```markdown
# Feature/Task Name Implementation Plan

## Overview
[Brief description of what we're implementing and why]

## Current State Analysis
[What exists now, what's missing, key constraints discovered]

## Desired End State
[Specification of the desired end state and how to verify it]

## What We're NOT Doing
[Explicitly list out-of-scope items]

## Implementation Approach
[High-level strategy and reasoning]

## Phase 1: Descriptive Name

### Overview
[What this phase accomplishes]

### Changes Required:

#### 1. Component/File Group
**File**: `path/to/file.ext`
**Changes**: [Summary of changes]

```typescript
// Specific code to add/modify
```

### Success Criteria

#### Automated Verification

- [ ] Tests pass: `npm test`
- [ ] Type checking passes: `npm run typecheck`
- [ ] Linting passes: `npm run lint`

#### Manual Verification

- [ ] Feature works as expected
- [ ] Performance is acceptable
- [ ] No regressions in related features

---

## Phase 2: Descriptive Name

[Similar structure...]

## Testing Strategy

### Unit Tests

- [What to test]
- [Key edge cases]

### Integration Tests

- [End-to-end scenarios]

### Manual Testing Steps

1. [Specific verification step]
2. [Another verification step]

## Performance Considerations

[Any performance implications or optimizations needed]

## Migration Notes

[If applicable, how to handle existing data/systems]

```

7. **Save plan document**: Create folder `thoughts/NNN_descriptive-name/` if it doesn't exist, then save to `thoughts/NNN_descriptive-name/plan.md`

8. **Review and iterate** based on user feedback until satisfied.

### Plan Quality Checklist

- [ ] Every file to modify is explicitly named
- [ ] Actual code snippets included (not pseudocode)
- [ ] Steps are sequential and ordered correctly
- [ ] Each phase has measurable success criteria
- [ ] Testing strategy is explicit
- [ ] Human has reviewed and approved the plan
- [ ] All questions resolved before finalizing

---

7. **Save plan document**: Create folder `docs/tickets/TICKET-NAME/` if it doesn't exist, then save to `docs/tickets/TICKET-NAME/plan.md`

8. **Review and iterate** based on user feedback until satisfied.

### Plan Quality Checklist

- [ ] Every file to modify is explicitly named
- [ ] Actual code snippets included (not pseudocode)
- [ ] Steps are sequential and ordered correctly
- [ ] Each phase has measurable success criteria
- [ ] Testing strategy is explicit
- [ ] Human has reviewed and approved the plan
- [ ] All questions resolved before finalizing

---

## Phase 3: Define Test Cases — Design Acceptance Tests

### Objective

Design executable test cases using BDD (Behavior-Driven Development) principles with Given-When-Then structure. Tests become the living specification for correct behavior.

### Command

Use `/3_define_test_cases` command to create test specifications.

### Process

1. **Invoke command**: `/3_define_test_cases [feature-to-test]`

2. **Understand the Feature**:
   - Ask clarifying questions about functionality, systems involved, expected behaviors
   - Identify edge cases, error conditions, authorization requirements

3. **Research Existing Test Patterns**:
   - Use codebase-pattern-finder agent to discover test structure
   - Find existing test files, helper patterns, mock configuration
   - Learn test organization conventions

4. **Generate Test File** (PRIMARY OUTPUT):
   - Create actual runnable test code: `test/[feature]/[feature].test.ts`
   - Use Given-When-Then comments for readability
   - Create helper functions ONLY when duplication appears 3+ times
   - Use native framework (node:test with describe/test structure)
   - Tests ARE the specification - executable documentation

5. **Generate Lightweight Index** (SECONDARY OUTPUT):
   - Create `docs/tickets/TICKET-NAME/test-cases.md`
   - Quick reference with line numbers to actual test file
   - Commands to run tests
   - Coverage summary (happy paths, edge cases, errors, boundaries, authorization)

### Test Structure

```typescript
describe("Feature Name", () => {
  test("behavior description", async () => {
    // Given: [preconditions - what exists before the action]
    const state = { files: {}, todos: [] };

    // When: [action - what happens]
    const result = await executeFeature(state);

    // Then: [expected outcome - what should be true]
    expect(result.success).toBe(true);
  });
});
```

### Test Coverage Requirements

- **Happy paths**: Standard successful flows
- **Edge cases**: Boundary conditions and unusual but valid inputs
- **Error scenarios**: Invalid inputs, service failures, timeouts
- **Boundary conditions**: Maximum/minimum values, empty states
- **Authorization/permission**: Security and access control checks

### DSL Helper Guidelines

Create helper functions ONLY when:
- Duplication appears 3+ times
- Complex assertions (4+ expect() calls that belong together)
- Mock configurations reused frequently

Do NOT create helpers for simple one-off operations.

### Test-Driven Workflow

1. **Step 3 (/3_define_test_cases)**: Generate test file defining correct behavior
2. **Step 4 (/4_implement_plan)**: Implement production code to make tests pass
3. **Step 5 (/5_validate_implementation)**: Run tests to verify implementation
4. **Step 6 (/6_iterate_implementation)**: Fix bugs until all tests pass

Tests define requirements - production code must make tests pass, not modify them.

### Test Quality Checklist

- [ ] Tests are runnable (may fail if production code doesn't exist yet)
- [ ] Given-When-Then comments are clear
- [ ] Helpers only created when justified (3+ uses)
- [ ] Test names are descriptive
- [ ] Coverage includes happy paths, edge cases, errors, boundaries
- [ ] Test-cases.md file is < 50 lines (just an index)

---

## Phase 4: Implement — Executing with Precision

### Objective

Execute the plan mechanically. This phase should be straightforward if Research and Plan were done correctly.

### Command

Use `/4_implement_plan` command to implement approved plans.

### Process

1. **Invoke implement command**: `/4_implement_plan docs/tickets/TICKET-NAME/plan.md`

2. **Read plan completely**:
   - Check for any existing checkmarks (- [x])
   - **Read test file** - If `test-cases.md` exists, read the actual test file referenced
   - Read all files mentioned in the plan
   - **Read files fully** - never use limit/offset parameters
   - **Read all note files** in ticket folder to understand any new requirements
   - Create todo list to track progress

3. **Execute phase by phase**:
   - Complete one phase entirely before moving to next
   - Follow the plan exactly
   - Update plan checkboxes as you go
   - If things don't match the plan, stop and ask:
     ```
     Issue in Phase [N]:
     Expected: [what the plan says]
     Found: [actual situation]
     Why this matters: [explanation]

     How should I proceed?
     ```

4. **Test-Driven Implementation** (if test file exists):
   - **Tests already written** - Step 3 generated actual test code
   - **Run tests to see failures** - Execute to understand what needs to be built
   - **Implement production code** - Write code to make failing tests pass
   - **Refactor while green** - Improve code quality while keeping all tests passing
   - Note: Tests define correct behavior - focus on making them pass

5. **Documenting New Requirements**:
   - When user requests new features/changes during implementation:
     - Create note file: `docs/tickets/TICKET-NAME/notes-YYYY-MM-DD.md`
     - Document request, context, decisions
     - Update plan document if request affects it

6. **Verify after each phase**:
   - Run all automated checks for that phase
   - **If test file exists**: Run tests to verify they pass
   - Fix any issues before proceeding
   - Update progress in both plan and todos

7. **Post-Implementation Workflow**:
   - Run validation (step 5) - Verify implementation matches plan
   - Iterate if needed (step 6) - Fix bugs and address deviations
   - Re-validate (step 5) - Confirm fixes resolved issues
   - Continue cycle until all criteria pass

### Implementation Quality Checklist

- [ ] All plan steps completed
- [ ] Plan checkboxes updated with [x]
- [ ] `npm run typecheck` passes
- [ ] All tests pass (if test file exists)
- [ ] Note files created for new requirements
- [ ] No improvised changes outside the plan (unless documented in notes)

---

## Phase 5: Validate — Verifying Correctness

### Objective

Verify that the implementation was correctly executed, checking all success criteria and identifying any deviations or issues.

### Command

Use `/5_validate_implementation` command to validate implementations.

### Process

1. **Invoke validate command**: `/5_validate_implementation [plan-path]`

2. **Context discovery**:
   - Read all ticket documentation (plan.md, test-cases.md, notes-*.md, research.md, sessions/*.md)
   - Identify what should have changed (files, success criteria)
   - **If test file exists**: Identify test file location from test-cases.md
   - Spawn parallel research tasks to discover implementation

3. **Systematic validation**:
   - For each phase: check completion status, run automated verification, assess manual criteria
   - **If test file exists**: Run tests and verify 100% pass
   - Document pass/fail status
   - Investigate root causes of any failures

4. **Generate validation report**:

```markdown
## Validation Report: [Plan Name]

### Documentation Reviewed
- ✓ plan.md
- ✓ test-cases.md (if exists)
- ✓ notes-YYYY-MM-DD.md (list all note files)
- ✓ research.md (if exists)

### Implementation Status
✓ Phase 1: [Name] - Fully implemented
✓ Phase 2: [Name] - Fully implemented
⚠️ Phase 3: [Name] - Partially implemented (see issues)

### Requirements Coverage
- ✓ Original plan requirements implemented
- ✓ Additional requirements from notes implemented

### Test Coverage (if test file exists)
- ✓ All tests passing: `npm test -- [file]` (25/25)
- ⚠️ Failing tests: [list]

### Automated Verification Results
✓ Build passes
✓ All tests pass (if applicable)
✗ Linting issues (3 warnings)

### Code Review Findings

#### Matches Plan:
- [Correctly implemented items]

#### Matches Notes/New Requirements:
- [Requirements from notes implemented]

#### Deviations from Plan:
- [Any differences from plan]
- [Note if deviation was documented in notes]

### Recommendations:
- [Action items before merge]
- [Improvements to consider]

### Next Steps:
- [ ] Run step 6 (Iterate) to address issues
- [ ] Re-run validation after fixes
```

### Iteration Cycle

This validation step works in a cycle with iteration (step 6):

```
Step 5 (Validate) → Step 6 (Iterate) → Step 5 (Validate) → ...
```

### Validation Checklist

- [ ] All ticket documentation read
- [ ] All phases marked complete are actually done
- [ ] All requirements from notes are implemented
- [ ] **If `test-cases.md` exists**: All test cases implemented and passing
- [ ] Automated tests pass
- [ ] Code follows existing patterns
- [ ] No regressions introduced
- [ ] Any deviations from plan are documented in notes

---

## Phase 6: Iterate — Fixing and Refining

### Objective

Fix bugs, address deviations from the plan, and refine features until they are complete and bug-free. This command works in a cycle with validation.

### Command

Use `/6_iterate_implementation` command to fix issues found during validation.

### Process

1. **Invoke iterate command**: `/6_iterate_implementation [plan-path]`

2. **Read all context**:
   - Validation report (if exists)
   - Plan document
   - All note files in ticket folder
   - Session summaries and research

3. **Categorize issues**:
   - Critical bugs
   - Deviations from plan
   - Missing requirements
   - Code quality issues
   - Test failures

4. **Prioritize and fix**:
   - Fix critical bugs first
   - Address deviations from plan
   - Implement missing requirements
   - **Fix production code to make tests pass** (not modify tests)
   - Resolve code quality issues

5. **Update documentation**:
   - Update plan checkboxes
   - Create iteration notes: `notes-YYYY-MM-DD.md`
   - Document decisions and discoveries

6. **Verify fixes**:
   - Run automated checks (tests, typecheck, lint)
   - Verify specific fixes
   - Update progress

### Iteration Cycle

```
Step 5 (Validate) → Step 6 (Iterate) → Step 5 (Validate) → ...
```

Continue until:
- ✅ All validation criteria pass
- ✅ All automated tests pass
- ✅ No critical bugs remain
- ✅ Implementation matches plan (or deviations documented)
- ✅ All requirements from notes implemented

### When to Modify Tests

- ✅ Test has a bug (incorrect expectation)
- ✅ Requirements changed (documented in notes)
- ❌ Test is failing (fix production code instead)
- ❌ Test is "too strict" (tests define requirements)

### Iteration Quality Checklist

- [ ] All critical bugs fixed
- [ ] All deviations from plan addressed
- [ ] All missing requirements implemented
- [ ] All code quality issues resolved
- [ ] Documentation updated appropriately
- [ ] Ready for next validation cycle

---

## Supporting Workflows

### Save Progress

Use `/7_save_progress` when pausing work mid-implementation:

- Commits meaningful work with WIP commits
- Updates plan document with progress checkpoint
- Creates session summary in `docs/tickets/TICKET-NAME/sessions/NNN_feature.md` (NNN is sequential)
- Documents current state, blockers, and next steps
- Provides commands to resume work

### Resume Work

Use `/8_resume_work` when returning to saved work:

- Loads session summary from `docs/tickets/TICKET-NAME/sessions/`
- Restores full context (plan, research, recent commits)
- Rebuilds mental model of where work left off
- Continues from first unchecked item in plan
- Handles conflicts if codebase changed

### Cloud Infrastructure Research

Use `/9_research_cloud` for cloud deployments (READ-ONLY operations only):

- Analyzes Azure/AWS/GCP infrastructure
- Uses cloud CLI tools (az, aws, gcloud)
- Generates infrastructure analysis documents
- Saves to `docs/tickets/TICKET-NAME/cloud-platform-environment.md` or `docs/cloud-platform-environment.md`

**Safety**: Only executes READ-ONLY operations (list, show, describe, get). Never creates, modifies, or deletes resources.

---

## Sub-Agents Reference

### codebase-locator

**Purpose**: Finds WHERE code lives in the codebase.

**Responsibilities**:

- Find files by topic/feature
- Categorize findings (implementation, tests, config, docs)
- Return structured results with full paths

**Use when**: You need to locate files related to a feature or topic.

### codebase-analyzer

**Purpose**: Analyzes HOW code works.

**Responsibilities**:

- Analyze implementation details
- Trace data flow and function calls
- Map component relationships
- Document technical details

**Use when**: You need to understand how existing code functions.

### codebase-pattern-finder

**Purpose**: Finds PATTERNS and EXAMPLES to model after.

**Responsibilities**:

- Find similar implementations
- Extract code examples
- Identify conventions (naming, organization, testing)

**Use when**: You need examples or patterns to follow for new code.

### codebase-research-locator

**Purpose**: Finds existing documents in `docs/` directory.

**Responsibilities**:

- Discover research documents by topic
- Find notes and meeting summaries
- Locate ticket-related documentation

**Use when**: You need to find existing research or documentation.

### codebase-research-analyzer

**Purpose**: Extracts insights from research documents.

**Responsibilities**:

- Extract key decisions and constraints
- Identify actionable insights
- Summarize historical context

**Use when**: You need to understand what's already been documented.

### codebase-online-researcher

**Purpose**: Researches external documentation and web resources.

**Responsibilities**:

- Search DeepWiki for documentation
- Browse web resources with Playwright
- Return findings with links and references

**Use when**: You need to research external libraries, frameworks, or APIs.

---

## Context Management Rules

### Do's

- ✅ Start each phase with clean context
- ✅ Use specialized sub-agents for parallel research
- ✅ Compress findings into Markdown before moving to next phase
- ✅ Include actual code snippets in plans
- ✅ Validate after each implementation phase
- ✅ Use sequential numbering for all artifacts
- ✅ Include YAML frontmatter in documents
- ✅ Save progress checkpoints when pausing work

### Don'ts

- ❌ Don't carry failed attempts into new context
- ❌ Don't skip research for complex features
- ❌ Don't improvise during implementation
- ❌ Don't let context window exceed ~40% with noise
- ❌ Don't assume—verify everything in the actual code
- ❌ Don't skip validation phase
- ❌ Don't forget to update plan checkboxes during implementation

---

## Quick Reference: Starting a New Feature

```bash
# 1. Check PROJECT-STATE.md for feature to implement

# 2. Research phase
/1_research_codebase
> [Research question about the feature]
# Output: docs/tickets/TICKET-NAME/research-topic.md

# 3. Plan phase
/2_create_plan
> [Task description and requirements]
# Output: docs/tickets/TICKET-NAME/plan.md

# 4. Define test cases (optional but recommended)
/3_define_test_cases
> [Feature to test]
# Output: test/[feature]/[feature].test.ts + docs/tickets/TICKET-NAME/test-cases.md

# 5. Implement phase
/4_implement_plan docs/tickets/TICKET-NAME/plan.md
# Updates plan checkboxes, implements code

# 6. Validate phase
/5_validate_implementation docs/tickets/TICKET-NAME/plan.md
# Generates validation report

# 7. Iterate if needed (cycle with step 5)
/6_iterate_implementation docs/tickets/TICKET-NAME/plan.md
# Fixes bugs and addresses deviations

# 8. Update PROJECT-STATE.md
# Move feature to "Implemented" section
```

---

## Example: Implementing a Feature

1. **Research**: `/1_research_codebase`
   - Spawns codebase-locator, codebase-analyzer, pattern-finder in parallel
   - Examines reference implementations in `.refs/`
   - Generates `docs/tickets/015_feature_name/research.md`

2. **Plan**: `/2_create_plan`
   - Uses research findings
   - Iterates with user on approach
   - Generates `docs/tickets/015_feature_name/plan.md`

3. **Define Tests**: `/3_define_test_cases`
   - Generates actual test code: `test/tools/web.test.ts`
   - Creates lightweight index: `docs/tickets/015_feature_name/test-cases.md`
   - Tests become the living specification

4. **Implement**: `/4_implement_plan docs/tickets/015_feature_name/plan.md`
   - Follows plan step-by-step
   - Makes tests pass (test-driven approach)
   - Updates checkboxes as work completes
   - Creates note files for new requirements

5. **Validate**: `/5_validate_implementation docs/tickets/015_feature_name/plan.md`
   - Verifies all success criteria met
   - Runs all tests
   - Generates validation report
   - Identifies any issues or deviations

6. **Iterate**: `/6_iterate_implementation docs/tickets/015_feature_name/plan.md`
   - Fixes bugs found in validation
   - Addresses deviations from plan
   - Re-validates until all criteria pass

7. **Update PROJECT-STATE.md**: Move feature to "Implemented"

---

## Updating PROJECT-STATE.md

After completing a feature:

```markdown
## ✅ Implemented
<!-- Move the completed feature here with checkbox checked -->
- [x] **Feature Name** - Brief description

## 🚧 To Implement
<!-- Remove from here when moved to Implemented -->
```

If a feature cannot be implemented due to AI SDK limitations:

```markdown
## ❌ Won't Support (AI SDK Limitations)
- **Feature Name** - Reason why it cannot be supported
```

---

## Integration with AGENTS.md

This RPI framework integrates with the project's agent architecture described in `AGENTS.md`:

- Uses DeepAgent's `task` tool to spawn sub-agents
- Leverages virtual filesystem for research artifacts
- Maintains todo lists via `write_todos` tool
- Supports multi-turn conversations for iterative planning

---

## File Organization Summary

```
docs/
├── tickets/
│   └── TICKET-NAME/           # Ticket folder
│       ├── plan.md            # Implementation plan
│       ├── research.md        # Research findings
│       ├── test-cases.md      # Lightweight test index
│       ├── notes-*.md         # Implementation notes
│       └── sessions/          # Session summaries
│           ├── 001_feature.md
│           └── 002_work.md
├── notes/                     # General notes
│   └── YYYY-MM-DD-meeting.md
└── general-topic.md           # Non-ticket research

test/                          # Test files
└── [feature]/
    └── [feature].test.ts      # Actual runnable tests

docs/
└── PROJECT-STATE.md           # Feature tracking
```

**Key conventions**:
- Tickets use descriptive names (e.g., `015_code_smell_refactoring`)
- Sessions use 3-digit sequential numbering (001, 002, etc.)
- Note files use date format: `notes-YYYY-MM-DD.md`
- All documents include YAML frontmatter with metadata
