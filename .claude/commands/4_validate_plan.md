# Validate Plan

You are tasked with validating that an implementation plan was correctly executed, verifying all success criteria and identifying any deviations or issues.

## Initial Setup

When invoked:

1. **Determine context** - Review what was implemented
2. **Locate the plan** - Find the implementation plan document
3. **Read all ticket documentation** - Read all files in `docs/tickets/TICKET-NAME/` folder:
   - `plan.md` - The implementation plan
   - `research.md` - Research findings (if exists)
   - `notes-*.md` - All implementation notes created during development
   - `sessions/*.md` - Session summaries (if exists)
   - Any other relevant documentation files
4. **Gather implementation evidence** through git and testing

## Validation Process

### Step 1: Context Discovery

1. **Read all ticket documentation**:
   - Read the implementation plan (`plan.md`) completely
   - Read all note files (`notes-*.md`) to understand any requirements changes or decisions made during implementation
   - Read research document (`research.md`) if it exists
   - Read session summaries if they exist
   - **Important**: Note files may contain requirements or decisions that modify or extend the original plan

2. **Identify what should have changed**:
   - List all files that should be modified (from plan + notes)
   - Note all success criteria (automated and manual) from plan and any additions from notes
   - Identify key functionality to verify (considering both original plan and new requirements from notes)

3. **Spawn parallel research tasks** to discover implementation:
   - Verify code changes match plan specifications AND any requirements from notes
   - Check if tests were added/modified as specified (plan + notes)
   - Validate that success criteria are met (plan + notes)
   - Verify that any new requirements from notes were properly implemented

### Step 2: Systematic Validation

For each phase in the plan:

1. **Check completion status**:
   - Look for checkmarks in the plan (- [x])
   - Verify actual code matches claimed completion

2. **Run automated verification**:
   - Execute each command from "Automated Verification"
   - Document pass/fail status
   - If failures, investigate root cause

3. **Assess manual criteria**:
   - List what needs manual testing
   - Provide clear steps for user verification

### Step 3: Generate Validation Report

Create comprehensive validation summary:

```markdown
## Validation Report: [Plan Name]

### Documentation Reviewed
- ✓ plan.md
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

### Automated Verification Results
✓ Build passes
✓ Tests pass
✗ Linting issues (3 warnings)

### Code Review Findings

#### Matches Plan:
- [What was correctly implemented]
- [Another correct implementation]

#### Matches Notes/New Requirements:
- [Requirements from notes that were implemented]
- [Decisions from notes that were followed]

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
```

## Important Guidelines

1. **Be thorough but practical** - Focus on what matters
2. **Run all automated checks** - Don't skip verification
3. **Document everything** - Both successes and issues
4. **Think critically** - Question if implementation solves the problem
5. **Consider maintenance** - Will this be maintainable?

## Validation Checklist

Always verify:

- [ ] All ticket documentation read (plan.md, notes-*.md, research.md, sessions/*.md)
- [ ] All phases marked complete are actually done
- [ ] All requirements from notes are implemented
- [ ] Automated tests pass
- [ ] Code follows existing patterns
- [ ] No regressions introduced
- [ ] Error handling is robust
- [ ] Documentation updated if needed
- [ ] Any deviations from plan are documented in notes
