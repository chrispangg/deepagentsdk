# RPI Framework: Research → Plan → Implement

This document provides instructions for AI agents implementing features in this repository using the RPI (Research, Plan, Implement) framework.

## Why RPI?

The RPI framework prevents "AI slop"—low-quality code that requires significant rework. It achieves this through **intentional context compaction**: keeping your context window clean, focused, and accurate at each phase.

**Key Principle**: Do not attempt implementation until you have completed Research and Planning. Each phase compresses information for the next:

- **Research** → Compresses **truth** (how the system actually works)
- **Plan** → Compresses **intent** (exactly what changes to make)
- **Implement** → Executes with **precision** (mechanical application of the plan)

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

For each feature, create a folder under `.agent/` with three subdirectories:

```
.agent/
├── PROJECT-STATE.md          # Feature tracking (update after completion)
├── feature-example/          # Template structure
│   ├── research/
│   ├── plan/
│   └── implement/
└── {feature-name}/           # Your feature folder
    ├── research/
    │   └── findings.md       # Research output
    ├── plan/
    │   └── implementation-plan.md  # Detailed plan
    └── implement/
        └── notes.md          # Implementation notes (optional)
```

---

## Phase 1: Research — Compressing Truth

### Objective

Build an accurate understanding of how the system currently works. Identify all relevant files, functions, and code flows necessary for the feature.

### Process

1. **Create research folder**: `.agent/{feature-name}/research/`

2. **Explore the codebase** using search tools to find:
   - Existing implementations of similar patterns
   - Files that will need modification
   - Dependencies and interactions
   - Test patterns used in the codebase

3. **Check reference implementations** in `.refs/`:
   - `.refs/deepagentsjs/` — JavaScript reference
   - `.refs/deepagents/` — Python reference

4. **Document findings** in `research/findings.md`:

```markdown
# Research: {Feature Name}

## Overview
Brief description of what this feature does in the reference implementation.

## Reference Implementation Analysis
- Location in reference: `path/to/file`
- Key functions/classes: `FunctionName`, `ClassName`
- How it integrates with existing system

## Current Codebase Analysis
- Related existing code: `src/path/to/relevant.ts`
- Patterns to follow: (describe existing patterns)
- Files that will need changes: (list files)

## Dependencies
- External packages needed (if any)
- Internal modules this will interact with

## Key Insights
- Important implementation details discovered
- Gotchas or edge cases to handle
- Differences between reference and our architecture

## Questions Resolved
- Q: How does X work? A: ...
- Q: Where is Y handled? A: ...
```

### Research Quality Checklist

- [ ] Identified all files that need modification
- [ ] Understood existing patterns in the codebase
- [ ] Reviewed reference implementation
- [ ] Documented dependencies and interactions
- [ ] No assumptions—all claims backed by code inspection

---

## Phase 2: Plan — Compressing Intent

### Objective

Transform research findings into a detailed, step-by-step implementation plan that can be executed mechanically.

### Process

1. **Create plan folder**: `.agent/{feature-name}/plan/`

2. **Write implementation plan** in `plan/implementation-plan.md`:

```markdown
# Implementation Plan: {Feature Name}

## Summary
One paragraph describing what will be implemented.

## Prerequisites
- [ ] Research phase completed
- [ ] Dependencies identified: {list}

## Implementation Steps

### Step 1: {Description}
**File**: `src/path/to/file.ts`
**Action**: Create/Modify/Delete

```typescript
// Code to add or modify
// Be specific—include actual code snippets
```

**Validation**: How to verify this step worked

### Step 2: {Description}

**File**: `src/path/to/another.ts`
**Action**: Modify

```typescript
// Before:
existing code here

// After:
modified code here
```

**Validation**: How to verify this step worked

### Step 3: Export from index

**File**: `src/index.ts`
**Action**: Modify

```typescript
export { NewThing } from './path/to/new-thing';
```

## Testing Strategy

1. Run existing tests: `bun test`
2. Add new tests in: `src/path/to/file.test.ts`
3. Test cases to cover:
   - Case 1: ...
   - Case 2: ...

## Rollback Plan

If implementation fails:

1. Revert changes to: {list files}
2. Remove new files: {list files}

## Post-Implementation

- [ ] Update `PROJECT-STATE.md` (move feature to Implemented)
- [ ] Run `bun run typecheck`
- [ ] Run `bun test`

```

### Plan Quality Checklist

- [ ] Every file to modify is explicitly named
- [ ] Actual code snippets included (not pseudocode)
- [ ] Steps are sequential and ordered correctly
- [ ] Each step has a validation method
- [ ] Testing strategy is explicit
- [ ] Human can review and approve the plan

---

## Phase 3: Implement — Executing with Precision

### Objective

Execute the plan mechanically. This phase should be straightforward if Research and Plan were done correctly.

### Process

1. **Start fresh context**: Begin implementation with only the plan in context (not the full research)

2. **Execute step by step**:
   - Follow the plan exactly
   - Validate after each step
   - If a step fails, stop and reassess—do not improvise

3. **Run validation**:
   ```bash
   bun run typecheck
   bun test
   ```

4. **Update PROJECT-STATE.md**:
   - Move feature from "To Implement" to "Implemented"
   - Add any notes about deviations or limitations

5. **Document any deviations** in `implement/notes.md` (optional):

   ```markdown
   # Implementation Notes: {Feature Name}
   
   ## Deviations from Plan
   - Step 3 required additional change to X because...
   
   ## Issues Encountered
   - Issue: ...
   - Resolution: ...
   
   ## Future Improvements
   - Could optimize X by...
   ```

### Implementation Quality Checklist

- [ ] All plan steps completed
- [ ] `bun run typecheck` passes
- [ ] `bun test` passes
- [ ] `PROJECT-STATE.md` updated
- [ ] No improvised changes outside the plan

---

## Context Management Rules

### Do's

- ✅ Start each phase with clean context
- ✅ Use sub-agents for isolated research tasks
- ✅ Compress findings into Markdown before moving to next phase
- ✅ Include actual code snippets in plans
- ✅ Validate after each implementation step

### Don'ts

- ❌ Don't carry failed attempts into new context
- ❌ Don't skip research for complex features
- ❌ Don't improvise during implementation
- ❌ Don't let context window exceed ~40% with noise
- ❌ Don't assume—verify everything in the actual code

---

## Quick Reference: Starting a New Feature

```bash
# 1. Check PROJECT-STATE.md for feature to implement
# 2. Create feature folder
mkdir -p .agent/{feature-name}/{research,plan,implement}

# 3. Research phase → output: research/findings.md
# 4. Plan phase → output: plan/implementation-plan.md  
# 5. Implement phase → execute plan, update PROJECT-STATE.md
# 6. Validate
bun run typecheck && bun test
```

---

## Example: Implementing "Execute Tool"

See `.agent/feature-example/` for the folder structure template.

A real implementation would follow this flow:

1. **Research**: Examine how `.refs/deepagentsjs/` implements the execute tool, understand the SandboxBackendProtocol interface, identify where tools are defined in `src/tools/`

2. **Plan**: Detail exact files to create/modify, include TypeScript interfaces, specify test cases

3. **Implement**: Create files, run tests, update PROJECT-STATE.md

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
