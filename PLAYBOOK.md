# Claude Code Research-Plan-Implement Framework Playbook

## Table of Contents

1. [Overview](#overview)
2. [Quick Start](#quick-start)
3. [Framework Architecture](#framework-architecture)
4. [Workflow Phases](#workflow-phases)
5. [Command Reference](#command-reference)
6. [Session Management](#session-management)
7. [Agent Reference](#agent-reference)
8. [Best Practices](#best-practices)
9. [Customization Guide](#customization-guide)
10. [Troubleshooting](#troubleshooting)

## Overview

The Research-Plan-Implement Framework is a structured approach to AI-assisted software development that emphasizes:

- **Thorough research** before coding
- **Detailed planning** with clear phases
- **Systematic implementation** with verification
- **Persistent context** through markdown documentation

### Core Benefits

- 🔍 **Deep Understanding**: Research phase ensures complete context
- 📋 **Clear Planning**: Detailed plans prevent scope creep
- ✅ **Quality Assurance**: Built-in validation at each step
- 📚 **Knowledge Building**: Documentation accumulates over time
- ⚡ **Parallel Processing**: Multiple AI agents work simultaneously
- 🧪 **Test-Driven Development**: Design test cases following existing patterns before implementation

## Quick Start

### Installation

1. **Copy framework files to your repository:**

```bash
# From the .claude-framework-adoption directory
cp -r .claude your-repo/
# Create docs directory structure
mkdir -p your-repo/docs/tickets
mkdir -p your-repo/docs/notes
```

2. **Customize for your project:**

- Edit `.claude/commands/*.md` to match your tooling
- Update agent descriptions if needed
- Add project-specific CLAUDE.md

3. **Test the workflow:**

**Standard Approach:**

```
/1_research_codebase
> How does user authentication work in this codebase?

/2_create_plan
> I need to add two-factor authentication

/3_implement_plan
> docs/tickets/TICKET-NAME/plan.md
```

**Test-Driven Approach:**

```
/8_define_test_cases
> Two-factor authentication for user login

# Design tests, then implement feature
/3_implement_plan
> Implement 2FA to make tests pass
```

## Framework Architecture

```
your-repo/
├── .claude/                      # AI Assistant Configuration
│   ├── agents/                   # Specialized AI agents
│   │   ├── codebase-locator.md   # Finds relevant files
│   │   ├── codebase-analyzer.md  # Analyzes implementation
│   │   ├── codebase-pattern-finder.md # Finds patterns to follow
│   │   ├── codebase-research-locator.md # Finds docs/ files
│   │   ├── codebase-research-analyzer.md # Extracts insights from docs
│   │   └── codebase-online-researcher.md # Web research
│   └── commands/                 # Numbered workflow commands
│       ├── 1_research_codebase.md
│       ├── 2_create_plan.md
│       ├── 3_define_test_cases.md   # Generate executable tests
│       ├── 4_implement_plan.md
│       ├── 5_validate_implementation.md
│       ├── 6_iterate_implementation.md
│       ├── 7_save_progress.md   # Save work session
│       ├── 8_resume_work.md     # Resume saved work
│       └── 9_research_cloud.md  # Cloud infrastructure analysis
├── docs/                         # Persistent Context Storage
│   ├── tickets/                  # Ticket-associated documentation
│   │   └── TICKET-NAME/         # Feature/ticket folders
│   │       ├── plan.md
│   │       ├── research.md
│   │       ├── test-cases.md     # Lightweight test index
│   │       ├── notes-YYYY-MM-DD.md # Implementation notes
│   │       └── sessions/        # Work session summaries
│   │           └── NNN_feature.md
│   └── notes/                    # General notes and meetings
│       └── YYYY-MM-DD-meeting.md
├── test/                         # Test files
│   └── [feature]/
│       └── [feature].test.ts    # Actual runnable tests
└── CLAUDE.md                    # Project-specific instructions
```

## Workflow Phases

### Phase 1: Research (`/1_research_codebase`)

**Purpose**: Comprehensive exploration and understanding

**Process**:

1. Invoke command with research question
2. Optimize question using prompt-engineer skill
3. Read mentioned files FULLY before spawning sub-tasks
4. AI spawns parallel agents to investigate
5. Findings compiled into structured document
6. Saved to `docs/tickets/TICKET-NAME/{research-topic}.md` or `docs/{research-topic}.md` (creates folder if needed)

**Example**:

```
/1_research_codebase
> How does the payment processing system work?
```

**Output**: Detailed research document with:

- Code references (file:line)
- Architecture insights
- Patterns and conventions
- Related components
- Historical context from `docs/`

### Phase 2: Planning (`/2_create_plan`)

**Purpose**: Create detailed, phased implementation plan

**Process**:

1. Read requirements and research FULLY
2. Interactive planning with user
3. Generate phased approach
4. Save to `docs/tickets/TICKET-NAME/plan.md` (creates folder if needed)

**Example**:

```
/2_create_plan
> Add Stripe payment integration based on the research
```

**Plan Structure**:

```markdown
# Feature Implementation Plan

## Phase 1: Database Setup
### Changes Required:
- Add payment tables
- Migration scripts

### Success Criteria:
#### Automated:
- [ ] Migration runs successfully
- [ ] Tests pass

#### Manual:
- [ ] Data integrity verified

## Phase 2: API Integration
[...]
```

### Phase 3: Define Test Cases (`/3_define_test_cases`)

**Purpose**: Design executable test cases using BDD principles

**Process**:

1. Invoke command with feature description
2. AI researches existing test patterns in codebase
3. Generates actual runnable test code file
4. Creates lightweight index in `docs/tickets/TICKET-NAME/test-cases.md`

**Example**:

```
/3_define_test_cases
> Partner enrollment workflow when ordering kit products
```

**Output**:

1. **PRIMARY: Test Code File** - `test/[feature]/[feature].test.ts`
   - Actual runnable tests with Given-When-Then structure
   - Minimal helpers (only when duplication > 2x)
   - Tests ARE the specification

2. **SECONDARY: Lightweight Index** - `docs/tickets/TICKET-NAME/test-cases.md`
   - Quick reference with line numbers
   - Commands to run tests
   - Coverage summary

**Test Structure**:

```typescript
describe("Feature Name", () => {
  test("behavior description", async () => {
    // Given: [preconditions]
    const state = { files: {}, todos: [] };

    // When: [action]
    const result = await executeFeature(state);

    // Then: [expected outcome]
    expect(result.success).toBe(true);
  });
});
```

**Coverage Areas**:

- Happy paths
- Edge cases
- Error scenarios
- Boundary conditions
- Authorization/permission checks

### Phase 4: Implementation (`/4_implement_plan`)

**Purpose**: Execute plan systematically

**Process**:

1. Read plan and test files (if exist) FULLY
2. Read all note files in ticket folder
3. Implement phase by phase
4. **If test file exists**: Make tests pass (test-driven approach)
5. Run verification after each phase
6. Update plan checkboxes

**Example**:

```
/4_implement_plan
> docs/tickets/TICKET-NAME/plan.md
```

**Progress Tracking**:

- Uses checkboxes in plan
- TodoWrite for task management
- Creates note files for new requirements
- Communicates blockers clearly

### Phase 5: Validation (`/5_validate_implementation`)

**Purpose**: Verify implementation matches plan

**Process**:

1. Read all ticket documentation (plan, test-cases, notes, research, sessions)
2. Review git changes
3. Run all automated checks
4. **If test file exists**: Run tests and verify 100% pass
5. Generate validation report
6. Identify deviations
7. Recommend iteration if issues found

**Example**:

```
/5_validate_implementation
> Validate the Stripe integration implementation
```

**Report Includes**:

- Implementation status
- Test results (if applicable)
- Code review findings
- Requirements from notes
- Manual testing requirements
- Next steps (often: run step 6)

### Phase 6: Iteration (`/6_iterate_implementation`)

**Purpose**: Fix bugs, address deviations, refine features

**Process**:

1. Read validation report, plan, notes
2. Categorize issues (bugs, deviations, missing requirements)
3. Prioritize and fix systematically
4. **Fix production code to make tests pass** (not modify tests)
5. Update documentation (plan checkboxes, note files)
6. Verify fixes with automated checks

**Example**:

```
/6_iterate_implementation
> docs/tickets/TICKET-NAME/plan.md
```

**Iteration Cycle**:

```
Step 5 (Validate) → Step 6 (Iterate) → Step 5 (Validate) → ...
```

Continue until all validation criteria pass.

## Command Reference

### Core Workflow Commands

### `/1_research_codebase`

- **Purpose**: Deep dive into codebase
- **Input**: Research question
- **Output**: Research document
- **Agents Used**: All locator/analyzer agents (codebase-locator, codebase-analyzer, codebase-pattern-finder, codebase-research-locator, codebase-research-analyzer, codebase-online-researcher)

### `/2_create_plan`

- **Purpose**: Create implementation plan
- **Input**: Requirements/ticket
- **Output**: Phased plan document
- **Interactive**: Yes

### `/3_define_test_cases`

- **Purpose**: Generate executable test code using BDD principles
- **Input**: Feature/functionality to test
- **Output**: Test file (`test/[feature]/[feature].test.ts`) + lightweight index (`docs/tickets/TICKET-NAME/test-cases.md`)
- **Approach**: Tests ARE the specification - executable documentation
- **Agent Used**: codebase-pattern-finder (automatic)

### `/4_implement_plan`

- **Purpose**: Execute implementation
- **Input**: Plan path
- **Output**: Completed implementation
- **Note**: If tests exist, uses test-driven approach

### `/5_validate_implementation`

- **Purpose**: Verify implementation
- **Input**: Plan path (optional)
- **Output**: Validation report
- **Note**: Works in cycle with step 6

### `/6_iterate_implementation`

- **Purpose**: Fix bugs and address deviations found in validation
- **Input**: Plan path
- **Output**: Fixed implementation
- **Note**: Works in cycle with step 5

## Session Management

The framework supports saving and resuming work through persistent documentation:

### `/7_save_progress`

- **Purpose**: Save work progress and context
- **Input**: Current work state
- **Output**: Session summary and checkpoint
- **Creates**: `docs/tickets/TICKET-NAME/sessions/NNN_feature.md` document (NNN is sequential)

### `/8_resume_work`

- **Purpose**: Resume previously saved work
- **Input**: Session summary path or auto-discover
- **Output**: Restored context and continuation
- **Reads**: Session, plan, research, and note files

### `/9_research_cloud`

- **Purpose**: Analyze cloud infrastructure (READ-ONLY)
- **Input**: Cloud platform and focus area
- **Output**: Infrastructure analysis document
- **Creates**: `docs/tickets/TICKET-NAME/cloud-platform-environment.md` or `docs/cloud-platform-environment.md` documents
- **Safety**: Only executes READ-ONLY operations

## Agent Reference

### codebase-locator

- **Role**: Find relevant files
- **Tools**: Grep, Glob, LS
- **Returns**: Categorized file listings

### codebase-analyzer

- **Role**: Understand implementation
- **Tools**: Read, Grep, Glob, LS
- **Returns**: Detailed code analysis

### codebase-pattern-finder

- **Role**: Find examples to follow
- **Tools**: Grep, Glob, Read, LS
- **Returns**: Code patterns and examples

### codebase-research-locator

- **Role**: Find existing documents in `docs/` directory
- **Tools**: Read, Grep, Glob, LS
- **Returns**: Categorized document listings

### codebase-research-analyzer

- **Role**: Extract insights from research documents
- **Tools**: Read, Grep, Glob, LS
- **Returns**: Key decisions, constraints, and actionable insights

### codebase-online-researcher

- **Role**: Research external documentation and web resources
- **Tools**: DeepWiki, Playwright browser tools
- **Returns**: External documentation findings with links

## Best Practices

### 1. Research First

- Always start with research for complex features
- Don't skip research even if you think you know the codebase
- Research documents become valuable references

### 2. Plan Thoroughly

- Break work into testable phases
- Include specific success criteria
- Document what's NOT in scope
- Resolve all questions before finalizing
- Consider how work will be committed

### 3. Implement Systematically

- Complete one phase before starting next
- Run tests after each phase
- Update plan checkboxes as you go
- Communicate blockers immediately

### 4. Document Everything

- Research findings persist in `docs/tickets/TICKET-NAME/` or `docs/`
- Plans serve as technical specs
- Session summaries maintain continuity

### 5. Use Parallel Agents

- Spawn multiple agents for research
- Let them work simultaneously
- Combine findings for comprehensive view

### 6. Design Tests Early

- Define test cases before implementing features
- Use `/3_define_test_cases` to generate actual runnable test code
- Tests become the living specification
- Ensure tests cover happy paths, edge cases, and errors
- Let tests guide implementation (test-driven approach)

## Customization Guide

### Adapting Commands

1. **Remove framework-specific references:**

```markdown
# Before (cli project specific)
Run `cli thoughts sync`

# After (Generic)
Save to docs/tickets/TICKET-NAME/research.md or docs/{research-topic}.md
```

2. **Adjust tool commands:**

```markdown
# Match your project's tooling
- Tests: `npm test` → `yarn test`
- Lint: `npm run lint` → `make lint`
- Build: `npm run build` → `cargo build`
```

3. **Customize success criteria:**

```markdown
# Add project-specific checks
- [ ] Security scan passes: `npm audit`
- [ ] Performance benchmarks met
- [ ] Documentation generated
```

### Adding Custom Agents

Create new agents for specific needs:

```markdown
---
name: security-analyzer
description: Analyzes security implications
tools: Read, Grep
---

You are a security specialist...
```

### Project-Specific CLAUDE.md

Add instructions for your project:

```markdown
# Project Conventions

## Testing
- Always write tests first (TDD)
- Minimum 80% coverage required
- Use Jest for unit tests

## Code Style
- Use Prettier formatting
- Follow ESLint rules
- Prefer functional programming

## Git Workflow
- Feature branches from develop
- Squash commits on merge
- Conventional commit messages
```

## Troubleshooting

### Common Issues

**Q: Research phase taking too long?**

- A: Limit scope of research question
- Focus on specific component/feature
- Use more targeted queries

**Q: Plan too vague?**

- A: Request more specific details
- Ask for code examples
- Ensure success criteria are measurable

**Q: Implementation doesn't match plan?**

- A: Stop and communicate mismatch
- Update plan if needed
- Validate assumptions with research

**Q: How to commit changes?**

- A: Use git commands directly after validation
- Group related changes logically
- Write clear commit messages following project conventions

### Tips for Success

1. **Start Small**: Test with simple feature first
2. **Iterate**: Customize based on what works
3. **Build Library**: Accumulate research/plans over time
4. **Team Alignment**: Share framework with team
5. **Regular Reviews**: Update commands based on learnings

## Advanced Usage

### Chaining Commands

For complex features, chain commands:

```
# Step 1: Research
/1_research_codebase
> Research current auth system

# Step 2: Plan
/2_create_plan
> Based on research, plan OAuth integration

# Step 3: Define tests
/3_define_test_cases
> OAuth authentication flows

# Step 4: Implement
/4_implement_plan
> docs/tickets/TICKET-NAME/plan.md

# Step 5: Validate
/5_validate_implementation
> docs/tickets/TICKET-NAME/plan.md

# Step 6: Iterate if needed
/6_iterate_implementation
> docs/tickets/TICKET-NAME/plan.md

# Then manually commit using git
```

### Parallel Research

Research multiple aspects simultaneously:

```
/1_research_codebase
> How do authentication, authorization, and user management work together?
```

This spawns agents to research each aspect in parallel.

### Cloud Infrastructure Analysis

Analyze cloud deployments without making changes:

```
/9_research_cloud
> Azure
> all

# Analyzes:
- Resource inventory and costs
- Security and compliance
- Architecture patterns
- Optimization opportunities
```

### Test-Driven Development Workflow

Design tests before implementation:

```
# Step 1: Define test cases
/3_define_test_cases
> Partner enrollment when customer orders a kit product

# Output includes:
# - Actual test code: test/partners/enrollment.test.ts
# - Lightweight index: docs/tickets/TICKET-NAME/test-cases.md
# - Tests cover happy path, edge cases, errors, boundaries, auth

# Step 2: Create plan for feature implementation
/2_create_plan
> Implement partner enrollment logic to make tests pass

# Step 3: Implement the feature
/4_implement_plan
> docs/tickets/TICKET-NAME/plan.md
# Tests drive implementation - make them pass!

# Step 4: Validate
/5_validate_implementation
> docs/tickets/TICKET-NAME/plan.md

# Step 5: Iterate if tests don't pass
/6_iterate_implementation
> docs/tickets/TICKET-NAME/plan.md
```

**Key Benefit**: Tests are the living specification - executable documentation that defines correct behavior.

## Conclusion

This framework provides structure without rigidity. It scales from simple features to complex architectural changes. The key is consistent use - the more you use it, the more valuable your `docs/tickets/` directory becomes as organizational knowledge.

Remember: The framework is a tool to enhance development, not replace thinking. Use it to augment your capabilities, not as a rigid process.
