---
name: 4_implement_plan
description: Implement approved technical plan from docs/tickets/TICKET-NAME/plan.md
model: claude-sonnet-4-5-20250929
allowed-tools: AskUserQuestion, Edit, Task, TodoWrite, Write, Bash(git:*), Bash(gh:*), Bash(basename:*), Bash(date:*)
argument-hint: [plan-path]
---

# Implement Plan

You are tasked with implementing an approved technical plan from `docs/tickets/TICKET-NAME/plan.md`. These plans contain phases with specific changes and success criteria.

## Getting Started

When given a plan path:

- Read the plan completely and check for any existing checkmarks (- [x])
- **Read test file** - If `test-cases.md` exists, it will reference the actual test file (e.g., `test/tools/web.test.ts`). Read the test file to understand what needs to be implemented
- Read all files mentioned in the plan
- **Read files fully** - never use limit/offset parameters
- Create a todo list to track your progress
- Start implementing if you understand what needs to be done

If no plan path provided, ask for one.

## Implementation Philosophy

Plans are carefully designed, but reality can be messy. Your job is to:

- Follow the plan's intent while adapting to what you find
- Implement each phase fully before moving to the next
- Verify your work makes sense in the broader codebase context
- Update checkboxes in the plan as you complete sections

When things don't match the plan exactly:

```text
Issue in Phase [N]:
Expected: [what the plan says]
Found: [actual situation]
Why this matters: [explanation]

How should I proceed?
```

## Verification Approach

After implementing a phase:

- Run the success criteria checks
- **If `test-cases.md` exists**: Run tests to verify test cases pass
- Fix any issues before proceeding
- Update your progress in both the plan and your todos
- Check off completed items in the plan file using Edit

## Working Process

1. **Phase by Phase Implementation**:
   - Complete one phase entirely before moving to next
   - Run all automated checks for that phase
   - Update plan checkboxes as you go

2. **Test-Driven Implementation** (if test file exists):
   - **Tests already written** - Step 3 generated actual test code in `test/[feature]/[feature].test.ts`
   - **Run tests to see failures** - Execute `bun test test/[feature]/[feature].test.ts` to understand what needs to be built
   - **Implement production code** - Write code to make failing tests pass
   - **Refactor while green** - Improve code quality while keeping all tests passing
   - **Note**: Tests are specifications - they define correct behavior. Focus on making them pass, not modifying them

3. **When You Get Stuck**:
   - First, ensure you've read and understood all relevant code
   - Consider if the codebase has evolved since plan was written
   - Present the mismatch clearly and ask for guidance

4. **Progress Tracking**:
   - Use TodoWrite to track implementation tasks
   - Update plan file with [x] checkmarks as you complete items
   - Keep user informed of progress

5. **Documenting New Requirements and Requests**:
   - When the user requests new features, changes, or clarifications during implementation:
     - Create a note file in the ticket folder: `docs/tickets/TICKET-NAME/notes-YYYY-MM-DD.md`
     - Use descriptive filenames if multiple notes per day: `docs/tickets/TICKET-NAME/notes-YYYY-MM-DD-{topic}.md`
     - Document the request, context, and any decisions made
     - If the request affects the plan, update the plan document accordingly

   - Note file structure:

     ```markdown
     ---
     date: [ISO timestamp]
     context: [What phase/task we were working on]
     ---
     
     # Implementation Notes - [Date]
     
     ## New Requirements/Requests
     - [Description of what was requested]
     - [Context and reasoning]
     
     ## Decisions Made
     - [Any decisions or clarifications]
     
     ## Impact on Plan
     - [How this affects the current plan, if applicable]
     ```

   - Examples of when to create notes:
     - User requests additional features mid-implementation
     - User clarifies requirements or changes direction
     - User provides new constraints or preferences
     - Important decisions are made during implementation
     - Discoveries that affect future phases

## Resuming Work

If the plan has existing checkmarks:

- Trust that completed work is done
- Pick up from the first unchecked item
- Verify previous work only if something seems off
- **Read all note files** in the ticket folder to understand any new requirements or decisions made since the plan was created

## Ticket Folder Structure

When working on a ticket, maintain documentation in `docs/tickets/TICKET-NAME/`:

- `plan.md` - The implementation plan (updated with checkboxes as you progress)
- `test-cases.md` - Lightweight index with line references to actual test file (created by `/3_define_test_cases`)
  - **Note**: Actual test code is in `test/[feature]/[feature].test.ts`, not in this markdown file
- `research.md` - Research findings (if applicable)
- `notes-YYYY-MM-DD.md` - Implementation notes, new requirements, and decisions
- `sessions/` - Session summaries (created by `/7_save_progress`)
- `validation-report*.md` - Validation reports (created by `/5_validate_implementation`)

All files in the ticket folder should be considered part of the implementation context. **If test file exists (referenced in `test-cases.md`), tests are already written - your job is to implement production code to make them pass.**

## Post-Implementation Workflow

After completing implementation:

1. **Run validation** (step 5) - Verify implementation matches plan and success criteria
2. **Iterate if needed** (step 6) - Fix bugs and address deviations found during validation
3. **Re-validate** (step 5) - Confirm fixes resolved issues
4. **Continue cycle** - Repeat validation → iteration until all criteria pass

Remember: You're implementing a solution, not just checking boxes. Keep the end goal in mind and maintain forward momentum.
