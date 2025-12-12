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
│   │   └── codebase-pattern-finder.md # Finds patterns to follow
│   └── commands/                 # Numbered workflow commands
│       ├── 1_research_codebase.md
│       ├── 2_create_plan.md
│       ├── 3_implement_plan.md
│       ├── 4_validate_plan.md
│       ├── 5_save_progress.md   # Save work session
│       ├── 6_resume_work.md     # Resume saved work
│       ├── 7_research_cloud.md  # Cloud infrastructure analysis
│       └── 8_define_test_cases.md # Design acceptance test cases
├── docs/                         # Persistent Context Storage
│   ├── tickets/                  # Ticket-associated documentation
│   │   └── TICKET-NAME/         # Feature/ticket folders
│   │       ├── plan.md
│   │       ├── research.md
│   │       └── sessions/        # Work session summaries
│   │           └── NNN_feature.md
│   └── notes/                    # General notes and meetings
│       └── YYYY-MM-DD-meeting.md
└── CLAUDE.md                    # Project-specific instructions
```

## Workflow Phases

### Phase 1: Research (`/1_research_codebase`)

**Purpose**: Comprehensive exploration and understanding

**Process**:

1. Invoke command with research question
2. AI spawns parallel agents to investigate
3. Findings compiled into structured document
4. Saved to `docs/tickets/TICKET-NAME/research.md` or `docs/{research-topic}.md` (creates folder if needed)

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

### Phase 2: Planning (`/2_create_plan`)

**Purpose**: Create detailed, phased implementation plan

**Process**:

1. Read requirements and research
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

### Phase 3: Implementation (`/3_implement_plan`)

**Purpose**: Execute plan systematically

**Process**:

1. Read plan and track with todos
2. Implement phase by phase
3. Run verification after each phase
4. Update plan checkboxes

**Example**:

```
/3_implement_plan
> docs/tickets/TICKET-NAME/plan.md
```

**Progress Tracking**:

- Uses checkboxes in plan
- TodoWrite for task management
- Communicates blockers clearly

### Phase 4: Validation (`/4_validate_plan`)

**Purpose**: Verify implementation matches plan

**Process**:

1. Review git changes
2. Run all automated checks
3. Generate validation report
4. Identify deviations
5. Prepare for manual commit process

**Example**:

```
/4_validate_plan
> Validate the Stripe integration implementation
```

**Report Includes**:

- Implementation status
- Test results
- Code review findings
- Manual testing requirements

### Test-Driven Development (`/8_define_test_cases`)

**Purpose**: Design acceptance test cases before implementation

**Process**:

1. Invoke command with feature description
2. AI researches existing test patterns in codebase
3. Defines test cases in structured comment format
4. Identifies required DSL functions
5. Notes which DSL functions exist vs. need creation

**Example**:

```
/8_define_test_cases
> Partner enrollment workflow when ordering kit products
```

**Output**:

1. **Test Case Definitions**: All scenarios in comment format:

```javascript
// 1. New Customer Orders Partner Kit

// newCustomer
// partnerKitInCart
//
// customerPlacesOrder
//
// expectOrderCreated
// expectPartnerCreatedInExigo
```

2. **DSL Function List**: Organized by type (setup/action/assertion)
3. **Pattern Notes**: How tests align with existing patterns

**Test Structure**:

- Setup phase (arrange state)
- Blank line
- Action phase (trigger behavior)
- Blank line
- Assertion phase (verify outcomes)
- No "Given/When/Then" labels - implicit structure

**Coverage Areas**:

- Happy paths
- Edge cases
- Error scenarios
- Boundary conditions
- Authorization/permission checks

**Key Principle**: Comment-first approach - design tests as specifications before any implementation.

## Command Reference

### Core Workflow Commands

### `/1_research_codebase`

- **Purpose**: Deep dive into codebase
- **Input**: Research question
- **Output**: Research document
- **Agents Used**: All locator/analyzer agents

### `/2_create_plan`

- **Purpose**: Create implementation plan
- **Input**: Requirements/ticket
- **Output**: Phased plan document
- **Interactive**: Yes

### `/3_implement_plan`

- **Purpose**: Execute implementation
- **Input**: Plan path
- **Output**: Completed implementation

### `/4_validate_plan`

- **Purpose**: Verify implementation
- **Input**: Plan path (optional)
- **Output**: Validation report

## Session Management

The framework supports saving and resuming work through persistent documentation:

### `/5_save_progress`

- **Purpose**: Save work progress and context
- **Input**: Current work state
- **Output**: Session summary and checkpoint
- **Creates**: `docs/tickets/TICKET-NAME/sessions/` document

### `/6_resume_work`

- **Purpose**: Resume previously saved work
- **Input**: Session summary path or auto-discover
- **Output**: Restored context and continuation
- **Reads**: Session, plan, and research documents

### Saving Progress (`/5_save_progress`)

When you need to pause work:

```
/5_save_progress
> Need to stop working on the payment feature

# Creates:
- Session summary in docs/tickets/TICKET-NAME/sessions/
- Progress checkpoint in the plan
- Work status documentation
```

### Resuming Work (`/6_resume_work`)

To continue where you left off:

```
/6_resume_work
> docs/tickets/TICKET-NAME/sessions/2025-01-06_payment_feature.md

# Restores:
- Full context from session
- Plan progress state
- Research findings
- Todo list
```

### Progress Tracking

Plans track progress with checkboxes:

- `- [ ]` Not started
- `- [x]` Completed
- Progress checkpoints document partial completion

When resuming, implementation continues from first unchecked item or documented checkpoint.

### Session Documents

Session summaries include:

- Work completed in session
- Current state and blockers
- Next steps to continue
- Commands to resume
- File changes and test status

This enables seamless context switching between features or across days/weeks.

### `/7_research_cloud`

- **Purpose**: Analyze cloud infrastructure (READ-ONLY)
- **Input**: Cloud platform and focus area
- **Output**: Infrastructure analysis document
- **Creates**: `docs/tickets/TICKET-NAME/cloud-platform-environment.md` or `docs/cloud-platform-environment.md` documents

### `/8_define_test_cases`

- **Purpose**: Design acceptance test cases using DSL approach
- **Input**: Feature/functionality to test
- **Output**: Test case definitions in comments + required DSL functions
- **Approach**: Comment-first, follows existing test patterns
- **Agent Used**: codebase-pattern-finder (automatic)

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

### codebase-online-researcher

- **Role**: Research external documentation and web resources
- **Tools**: DeepWiki, Playwright browser tools
- **Returns**: External documentation findings with links

### codebase-research-locator

- **Role**: Find existing documentation in docs/ directory
- **Tools**: Read, Grep, Glob, LS
- **Returns**: Categorized document listings

### codebase-research-analyzer

- **Role**: Extract insights from research documents
- **Tools**: Read, Grep, Glob, LS
- **Returns**: Key decisions, constraints, and actionable insights

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
- Follow existing test patterns and DSL conventions
- Use comment-first approach for test specifications
- Ensure tests cover happy paths, edge cases, and errors
- Let tests guide implementation

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
/1_research_codebase
> Research current auth system

/2_create_plan
> Based on research, plan OAuth integration

/3_implement_plan
> docs/tickets/TICKET-NAME/plan.md

/4_validate_plan
> Verify OAuth implementation

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
/7_research_cloud
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
/8_define_test_cases
> Partner enrollment when customer orders a kit product

# Output includes:
# - Test cases in comment format (happy path, edge cases, errors)
# - List of DSL functions needed (setup/action/assertion)
# - Existing functions that can be reused

# Step 2: Implement missing DSL functions
# (Follow patterns discovered by the agent)

# Step 3: Write tests using the defined test cases
# (Copy comment structure to test files, add function calls)

# Step 4: Create plan for feature implementation
/2_create_plan
> Implement partner enrollment logic to make tests pass

# Step 5: Implement the feature
/3_implement_plan
> docs/tickets/TICKET-NAME/plan.md

# Step 6: Validate tests pass
/4_validate_plan
```

**Key Benefit**: Tests are designed with existing patterns in mind, ensuring consistency across the test suite.

## Conclusion

This framework provides structure without rigidity. It scales from simple features to complex architectural changes. The key is consistent use - the more you use it, the more valuable your `docs/tickets/` directory becomes as organizational knowledge.

Remember: The framework is a tool to enhance development, not replace thinking. Use it to augment your capabilities, not as a rigid process.
