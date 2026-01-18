---
name: 8_resume_work
description: Resume previously saved work by restoring full context and continuing implementation
allowed-tools: AskUserQuestion, Edit, Task, TodoWrite, Write, Bash(git:*), Bash(gh:*), Bash(basename:*), Bash(date:*)
argument-hint: [session-summary-path]
---

# Resume Work

You are tasked with resuming previously saved work by restoring full context and continuing implementation.

## When to Use This Command

Invoke this when:

- Returning to a previously paused feature
- Starting a new session on existing work
- Switching back to a saved task
- Recovering from an interrupted session

## Process

### Step 1: Load Session Context

1. **Read session summary** if provided:

   ```
   /6_resume_work
   > docs/tickets/TICKET-NAME/sessions/2025-01-06_user_management.md
   ```

2. **Or discover recent sessions**:

   ```bash
   ls -la docs/tickets/TICKET-NAME/sessions/
   # Show user recent sessions to choose from
   ```

### Step 2: Restore Full Context

Read in this order:

1. **Session summary** - Understand where we left off
2. **Implementation plan** - See overall progress
3. **Research document** - Refresh technical context
4. **Recent commits** - Review completed work

```bash
# Check current state
git status
git log --oneline -10

# Check for stashed work
git stash list
```

### Step 3: Rebuild Mental Model

Create a brief context summary:

```markdown
## Resuming: [Feature Name]

### Where We Left Off
- Working on: [Specific task]
- Phase: [X of Y]
- Last action: [What was being done]

### Current State
- [ ] Tests passing: [status]
- [ ] Build successful: [status]
- [ ] Uncommitted changes: [list]

### Immediate Next Steps
1. [First action to take]
2. [Second action]
3. [Continue with plan phase X]
```

### Step 4: Restore Working State

1. **Apply any stashed changes**:

   ```bash
   git stash pop stash@{n}
   ```

2. **Verify environment**:

   ```bash
   # Run tests to check current state
   npm test
   # or
   make test
   ```

3. **Load todos**:
   - Restore previous todo list
   - Update with current tasks

### Step 5: Continue Implementation

Based on the plan's checkboxes:

```markdown
# Identify first unchecked item
Looking at the plan, I need to continue with:
- [ ] Phase 2: API endpoints
  - [x] GET endpoints
  - [ ] POST endpoints <- Resume here
  - [ ] DELETE endpoints

Let me start by implementing the POST endpoints...
```

### Step 6: Communicate Status

Tell the user:

```markdown
✅ Context restored successfully!

📋 Resuming: [Feature Name]
📍 Current Phase: [X of Y]
🎯 Next Task: [Specific task]

Previous session:
- Duration: [X hours]
- Completed: [Y tasks]
- Remaining: [Z tasks]

I'll continue with [specific next action]...
```

## Resume Patterns

### Pattern 1: Quick Resume (Same Day)

```markdown
/6_resume_work
> Continue the user management feature from this morning

# Claude:
1. Finds most recent session
2. Reads plan to see progress
3. Continues from last checkbox
```

### Pattern 2: Full Context Restore (Days Later)

```markdown
/6_resume_work
> docs/tickets/TICKET-NAME/sessions/2025-01-03_auth_refactor.md

# Claude:
1. Reads full session summary
2. Reviews related research
3. Checks git history since then
4. Rebuilds complete context
5. Continues implementation
```

### Pattern 3: Investigate and Resume

```markdown
/6_resume_work
> What was I working on last week? Find and continue it.

# Claude:
1. Lists recent sessions
2. Shows git branches with recent activity
3. Presents options to user
4. Resumes chosen work
```

## Integration with Framework

This command connects with:

- `/7_save_progress` - Reads saved progress
- `/4_implement_plan` - Continues implementation
- `/5_validate_implementation` - Validates what's been completed
- `/6_iterate_implementation` - Can resume iteration cycles
- `/1_research_codebase` - Refreshes understanding if needed

## Advanced Features

### Handling Conflicts

If the codebase changed since last session:

1. Check for conflicts with current branch
2. Review changes to related files
3. Update plan if needed
4. Communicate impacts to user

### Session Comparison

```markdown
## Changes Since Last Session
- New commits: [list]
- Modified files: [that affect our work]
- Team updates: [relevant changes]
- Plan updates: [if any]
```

### Recovery Mode

If session wasn't properly saved:

1. Use git reflog to find work
2. Check editor backup files
3. Review shell history
4. Reconstruct from available evidence

## Important Guidelines

- **Always verify state** before continuing
- **Run tests first** to ensure clean slate
- **Communicate clearly** about what's being resumed
- **Update stale plans** if codebase evolved
- **Check for blockers** that may have been resolved
- **Refresh context fully** - don't assume memory

## Success Criteria

A successful resume should:

- [ ] Load all relevant context
- [ ] Identify exact continuation point
- [ ] Restore working environment
- [ ] Continue seamlessly from pause point
- [ ] Maintain plan consistency
- [ ] Preserve all previous decisions
