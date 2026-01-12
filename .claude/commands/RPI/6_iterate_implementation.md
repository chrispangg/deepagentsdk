---
name: 6_iterate_implementation
description: Iterate on implementation to fix bugs, address deviations, and refine features until completion
model: claude-sonnet-4-5-20250929
allowed-tools: AskUserQuestion, Edit, Task, TodoWrite, Write, Bash(git:*), Bash(gh:*), Bash(basename:*), Bash(date:*)
argument-hint: [plan-path]
---

# Iterate Implementation

You are tasked with iterating on an implementation to fix bugs, address deviations from the plan, and refine features until they are complete and bug-free. This command works in a cycle with validation (step 5) to ensure quality.

## When to Use This Command

Invoke this command:

- After running validation (step 5) that identified bugs or deviations
- When features need refinement or additional work
- To address issues found during testing or manual verification
- As part of the iterative development cycle: validate → iterate → validate → iterate

## Initial Setup

When invoked:

1. **Read validation report** - If a validation report exists, read it to understand issues
2. **Read plan document** - Understand what was intended vs. what exists
3. **Read all ticket documentation** - Read all files in `docs/tickets/TICKET-NAME/`:
   - `plan.md` - The implementation plan
   - `research.md` - Research findings (if exists)
   - `notes-*.md` - All implementation notes
   - `sessions/*.md` - Session summaries (if exists)
   - `validation-report*.md` - Any validation reports
4. **Review current code state** - Check git status and recent changes
5. **Run automated checks** - Execute tests, type checking, linting to establish baseline

## Iteration Process

### Step 1: Issue Analysis

1. **Categorize issues** from validation report or testing:

   ```markdown
   ## Issues to Address

   ### Critical Bugs
   - [Issue description] - [Impact] - [Location]
   - [Another critical bug]

   ### Deviations from Plan
   - [What was planned] vs [What exists] - [Why it matters]
   - [Another deviation]

   ### Missing Requirements
   - [Requirement from plan/notes] - [Where it should be]
   - [Another missing requirement]

   ### Code Quality Issues
   - [Linting/type errors] - [Files affected]
   - [Test failures] - [What's broken]

   ### Manual Testing Findings
   - [User-reported issue] - [Steps to reproduce]
   - [Edge case not handled]
   ```

2. **Prioritize fixes**:
   - Critical bugs first (functionality broken)
   - Deviations that affect feature completeness
   - Missing requirements from plan/notes
   - Code quality and test failures
   - Edge cases and refinements

3. **Create iteration todo list** using TodoWrite to track fixes

### Step 2: Fix Implementation

For each issue category:

1. **Fix critical bugs first**:
   - Read affected files fully
   - Understand root cause
   - Implement fix
   - Add/update tests if needed
   - Verify fix resolves the issue

2. **Address deviations from plan**:
   - Compare current implementation to plan specification
   - Determine if deviation was intentional (check notes) or accidental
   - If accidental: align implementation with plan
   - If intentional: verify it's documented in notes, update plan if needed
   - Ensure deviation doesn't break success criteria

3. **Implement missing requirements**:
   - Check both original plan AND notes files for requirements
   - Implement missing functionality
   - Add tests for new functionality
   - Update plan checkboxes as you complete items

4. **Resolve code quality issues**:
   - Fix linting errors
   - Resolve type errors
   - **Fix production code to make tests pass** - Tests define correct behavior, don't modify them
   - Improve code organization if needed

   **When to modify tests**:
   - ✅ Test has a bug (incorrect expectation)
   - ✅ Requirements changed (documented in notes)
   - ❌ Test is failing (fix production code instead)
   - ❌ Test is "too strict" (tests define requirements)

5. **Handle manual testing findings**:
   - Reproduce reported issues
   - Fix bugs
   - Add test coverage for edge cases
   - Verify fixes with manual testing steps

### Step 3: Update Documentation

As you fix issues:

1. **Update plan checkboxes** - Mark items as complete when fixed
2. **Create/update notes** - Document any decisions or discoveries:

   ```markdown
   ---
   date: [ISO timestamp]
   context: [What iteration cycle we're in]
   ---

   # Iteration Notes - [Date]

   ## Issues Addressed
   - [Bug fixed] - [How it was fixed]
   - [Deviation corrected] - [What changed]

   ## Decisions Made
   - [Any implementation decisions]
   - [Trade-offs accepted]

   ## Discoveries
   - [Important findings during iteration]
   - [Patterns identified]

   ## Remaining Work
   - [Any issues still pending]
   - [Next iteration priorities]
   ```

3. **Update validation report** - If one exists, note what was fixed

### Step 4: Verify Fixes

After each fix or batch of fixes:

1. **Run automated checks**:

   ```bash
   # Run tests
   bun test
   
   # Type checking
   bun run typecheck
   
   # Linting
   bun run lint
   ```

2. **Verify specific fixes**:
   - Re-run tests that were failing
   - Test the specific bug scenarios
   - Check that deviations are resolved

3. **Update progress**:
   - Mark todos as complete
   - Update plan checkboxes
   - Note what's been fixed

### Step 5: Iteration Summary

After completing fixes for this iteration:

```markdown
## Iteration Summary

### Issues Fixed
- ✓ [Critical bug] - Fixed in [file:line]
- ✓ [Deviation] - Aligned with plan
- ✓ [Missing requirement] - Implemented

### Tests Updated
- Added test: [test name]
- Fixed test: [test name]

### Code Changes
- Modified: [file1] - [what changed]
- Modified: [file2] - [what changed]

### Remaining Issues
- [ ] [Issue] - [Why not fixed yet]
- [ ] [Another issue] - [Next iteration]

### Next Steps
1. Re-run validation (step 5) to verify fixes
2. Continue iteration if more issues found
3. Mark complete when all criteria met
```

## Iteration Cycle Pattern

This command is designed to work in a cycle with validation:

```
Step 5 (Validate) → Step 6 (Iterate) → Step 5 (Validate) → Step 6 (Iterate) → ...
```

**Typical flow:**

1. Run validation (step 5) → Identifies issues
2. Run iteration (step 6) → Fixes issues
3. Run validation (step 5) → Verifies fixes, finds new issues
4. Run iteration (step 6) → Fixes remaining issues
5. Repeat until validation passes completely

## Important Guidelines

1. **Fix systematically** - Don't skip around; address issues in priority order
2. **Test as you go** - Verify each fix before moving to the next
3. **Document decisions** - Update notes when making implementation choices
4. **Keep plan updated** - Mark checkboxes as you complete work
5. **Don't introduce new bugs** - Be careful not to break working code
6. **Consider root causes** - Fix underlying issues, not just symptoms
7. **Maintain code quality** - Don't sacrifice quality for speed

## When to Stop Iterating

Stop and mark work complete when:

- ✅ All validation criteria pass
- ✅ All automated tests pass
- ✅ No critical bugs remain
- ✅ Implementation matches plan (or deviations are documented)
- ✅ All requirements from plan and notes are implemented
- ✅ Manual testing confirms feature works correctly
- ✅ Code quality standards met

## Integration with Other Commands

This command works with:

- **Step 4 (Implement Plan)** - Continues implementation work
- **Step 5 (Validate Implementation)** - Receives issues from validation, fixes them
- **Step 7 (Save Progress)** - Can save progress mid-iteration if needed
- **Step 8 (Resume Work)** - Can resume interrupted iteration work

## Handling Complex Issues

If an issue requires significant rework:

1. **Assess impact** - How much code needs to change?
2. **Update plan** - Document the rework needed
3. **Create notes** - Explain why rework is necessary
4. **Implement carefully** - Make changes incrementally
5. **Test thoroughly** - Ensure rework doesn't break other features

## Success Criteria

A successful iteration should:

- [ ] Fix all critical bugs identified
- [ ] Address all deviations from plan
- [ ] Implement all missing requirements
- [ ] Resolve code quality issues
- [ ] Update documentation appropriately
- [ ] Pass automated verification checks
- [ ] Be ready for next validation cycle

Remember: The goal is to iterate until the implementation is complete, bug-free, and matches all requirements. Don't rush - quality matters more than speed.
