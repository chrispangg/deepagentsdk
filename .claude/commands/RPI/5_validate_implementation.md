---
name: 5_validate_implementation
description: Validate that an implementation plan was correctly executed, verifying all success criteria
model: claude-sonnet-4-5-20250929
allowed-tools: AskUserQuestion, Edit, Task, TodoWrite, Write, Bash(git:*), Bash(gh:*), Bash(basename:*), Bash(date:*)
argument-hint: [plan-path]
---

# Validate Plan

You are tasked with validating that an implementation plan was correctly executed, verifying all success criteria and identifying any deviations or issues.

## Initial Setup

When invoked:

1. **Determine context** - Review what was implemented
2. **Locate the plan** - Find the implementation plan document
3. **Read all ticket documentation** - Read all files in `docs/tickets/TICKET-NAME/` folder:
   - `plan.md` - The implementation plan
   - `test-cases.md` - Test case definitions (if exists - created by `/3_define_test_cases`)
   - `research.md` - Research findings (if exists)
   - `notes-*.md` - All implementation notes created during development
   - `sessions/*.md` - Session summaries (if exists)
   - Any other relevant documentation files
4. **Gather implementation evidence** through git and testing

## Validation Process

### Step 1: Context Discovery

1. **Read all ticket documentation**:
   - Read the implementation plan (`plan.md`) completely
   - **Read `test-cases.md`** if it exists - Understand test case definitions and DSL function requirements
   - Read all note files (`notes-*.md`) to understand any requirements changes or decisions made during implementation
   - Read research document (`research.md`) if it exists
   - Read session summaries if they exist
   - **Important**: Note files may contain requirements or decisions that modify or extend the original plan

2. **Identify what should have changed**:
   - List all files that should be modified (from plan + notes)
   - Note all success criteria (automated and manual) from plan and any additions from notes
   - **If test file exists**: Identify test file location (referenced in `test-cases.md`)
   - Identify key functionality to verify (considering both original plan and new requirements from notes)

3. **Spawn parallel research tasks** to discover implementation:
   - Verify code changes match plan specifications AND any requirements from notes
   - **If test file exists**: Run tests and verify they pass (tests were created in step 3)
   - Check if production code makes tests pass
   - Validate that success criteria are met (plan + notes)
   - Verify that any new requirements from notes were properly implemented

### Step 2: Systematic Validation

For each phase in the plan:

1. **Check completion status**:
   - Look for checkmarks in the plan (- [x])
   - Verify actual code matches claimed completion

2. **Run automated verification**:
   - Execute each command from "Automated Verification"
   - **If test file exists**: Run `bun test [test-file]` and verify 100% pass
   - Verify no tests are skipped or pending
   - Document pass/fail status with specific failing test names
   - If failures, investigate root cause (production code bug, not test bug)

3. **Assess manual criteria**:
   - List what needs manual testing
   - Provide clear steps for user verification

### Step 3: Generate Validation Report

Create comprehensive validation summary:

```markdown
## Validation Report: [Plan Name]

### Documentation Reviewed
- ✓ plan.md
- ✓ test-cases.md (if exists)
- ✓ notes-YYYY-MM-DD.md (list all note files read)
- ✓ research.md (if exists)
- ✓ sessions/*.md (if exists)

### Implementation Status
✓ Phase 1: [Name] - Fully implemented
✓ Phase 2: [Name] - Fully implemented
⚠️ Phase 3: [Name] - Partially implemented (see issues)

### Requirements Coverage
- ✓ Original plan requirements implemented
- ✓ Additional requirements from notes implemented (list key ones)
- ⚠️ [Any requirements from notes not yet implemented]

### Test Coverage (if test file exists)
- ✓ All tests passing: `bun test [file]` (25/25 passing)
- ✓ No skipped or pending tests
- ⚠️ Failing tests:
  - `[file].test.ts:[line]` - [test name] - [failure reason]
- Coverage: [percentage if available]

### Automated Verification Results
✓ Build passes
✓ All tests pass: `bun test [file]` (25/25)
✗ Linting issues (3 warnings)

### Code Review Findings

#### Matches Plan:
- [What was correctly implemented]
- [Another correct implementation]

#### Matches Notes/New Requirements:
- [Requirements from notes that were implemented]
- [Decisions from notes that were followed]

#### Matches Test Specifications (if test file exists):
- Production code makes all tests pass
- Tests are unchanged from step 3 (tests define requirements)
- ⚠️ Tests were modified (explain why and if justified)

#### Deviations from Plan:
- [Any differences from plan]
- [Explanation of deviation]
- [Note if deviation was documented in notes]

#### Potential Issues:
- [Any problems discovered]
- [Risk or concern]

### Manual Testing Required:
1. UI functionality:
   - [ ] Verify feature appears correctly
   - [ ] Test error states
   - [ ] Verify new requirements from notes work as expected

2. Integration:
   - [ ] Confirm works with existing components
   - [ ] Check performance

### Recommendations:
- [Action items before merge]
- [Improvements to consider]

### Next Steps:
- [ ] Run step 6 (Iterate Implementation) to address identified issues
- [ ] Re-run validation after fixes are complete
- [ ] Continue iteration cycle until all criteria pass
```

## Iteration Cycle

This validation step is designed to work in a cycle with iteration (step 6):

```text
Step 5 (Validate) → Step 6 (Iterate) → Step 5 (Validate) → Step 6 (Iterate) → ...
```

**Typical flow:**

1. Run validation (step 5) → Identifies issues, bugs, deviations
2. Run iteration (step 6) → Fixes issues found
3. Re-run validation (step 5) → Verifies fixes, finds any remaining issues
4. Continue cycle until all criteria pass

When validation finds issues:

- Document them clearly in the validation report
- Prioritize by severity (critical bugs, deviations, code quality)
- Provide actionable next steps
- Recommend running step 6 (Iterate Implementation) to address issues

## Important Guidelines

1. **Be thorough but practical** - Focus on what matters
2. **Run all automated checks** - Don't skip verification
3. **Document everything** - Both successes and issues
4. **Think critically** - Question if implementation solves the problem
5. **Consider maintenance** - Will this be maintainable?
6. **Enable iteration** - Structure findings to enable effective iteration cycles

## Validation Checklist

Always verify:

- [ ] All ticket documentation read (plan.md, test-cases.md if exists, notes-*.md, research.md, sessions/*.md)
- [ ] All phases marked complete are actually done
- [ ] All requirements from notes are implemented
- [ ] **If `test-cases.md` exists**: All test cases are implemented and passing
- [ ] **If `test-cases.md` exists**: All required DSL functions are implemented
- [ ] Automated tests pass
- [ ] Code follows existing patterns
- [ ] No regressions introduced
- [ ] Error handling is robust
- [ ] Documentation updated if needed
- [ ] Any deviations from plan are documented in notes
