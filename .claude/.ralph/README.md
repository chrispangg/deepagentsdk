# Ralph Wiggum Method: Autonomous Execution

Run AI agents in continuous loops until task completion - no manual intervention required.

> **Note:** Currently only supported for Claude Code. Support for other AI coding assistants coming soon.

**Prerequisites:** You must copy `.claude/.ralph/` to your project folder

**How it works:** Agent reads `.claude/.ralph/prompt.md`, executes tasks, iterates until done, manages its own context.

## Platform Support

Ralph supports both Mac/Linux (bash) and Windows (PowerShell):

| Platform  | Scripts Location  | Usage                   |
| --------- | ----------------- | ----------------------- |
| Mac/Linux | `.claude/.ralph/` | `ralph.sh`, `sync.sh`   |
| Windows   | `.claude/.ralph/` | `ralph.ps1`, `sync.ps1` |

## Usage

### Option 1: Use Default Prompt

1. **Update `.claude/.ralph/prompt.md`** with your implementation instructions
   - Keep it concise
   - Example prompt in `.claude/.ralph/prompt.md`

2. **Test one iteration:**

   **Mac/Linux:**
   ```bash
   cd /path/to/your-project
   # Use default prompt.md
   ./.claude/.ralph/sync.sh
   
   # Or pass a ticket-name/prompt
   ./.claude/.ralph/sync.sh "docs/tickets/001_feature/plan.md"
   ```

   **Windows PowerShell:**
   ```powershell
   cd C:/path/to/your-project
   # Use default prompt.md
   ./.claude/.ralph/sync.ps1
   
   # Or pass a ticket-name/prompt
   ./.claude/.ralph/sync.ps1 "docs/tickets/001_feature/plan.md"
   ```
   Verifies the agent can read your prompt and execute successfully

3. **Run continuously:**

   **Mac/Linux:**
   ```bash
   ./.claude/.ralph/ralph.sh
   ```

   **Windows PowerShell:**
   ```powershell
   ./.claude/.ralph/ralph.ps1
   ```
   Agent loops, working until task completion

### Option 2: Pass Prompt Dynamically

You can pass a prompt as an argument to update `prompt.md` automatically:

**Mac/Linux:**
```bash
# Pass a plan path - automatically becomes "/3_implement_plan docs/tickets/001_feature/plan.md"
./.claude/.ralph/ralph.sh "docs/tickets/001_feature/plan.md"

# Pass a full command
./.claude/.ralph/ralph.sh "/2_create_plan Add new feature"

# Pass prompt with max iterations
./.claude/.ralph/ralph.sh "docs/tickets/001_feature/plan.md" 10
```

**Windows PowerShell:**
```powershell
# Pass a plan path - automatically becomes "/3_implement_plan docs/tickets/001_feature/plan.md"
./.claude/.ralph/ralph.ps1 -Prompt "docs/tickets/001_feature/plan.md"

# Pass a full command
./.claude/.ralph/ralph.ps1 -Prompt "/2_create_plan Add new feature"

# Pass prompt with max iterations
./.claude/.ralph/ralph.ps1 -Prompt "docs/tickets/001_feature/plan.md" -MaxIterations 10
```

**Note:** If you pass a path (contains `/` or `plan.md`), it automatically prepends `/3_implement_plan`. Otherwise, your prompt is used as-is.

## Controlling Iterations

By default, Ralph runs indefinitely until the task is complete. You can limit the number of iterations using the `max_iterations` parameter to define your own "done" criteria:

**Mac/Linux:**
```bash
# Run exactly 10 iterations (no prompt update)
./.claude/.ralph/ralph.sh 10

# Run indefinitely (default)
./.claude/.ralph/ralph.sh

# Update prompt and run 10 iterations
./.claude/.ralph/ralph.sh "docs/tickets/001_feature/plan.md" 10
```

**Windows PowerShell:**
```powershell
# Run exactly 10 iterations (no prompt update)
./.claude/.ralph/ralph.ps1 -MaxIterations 10

# Run indefinitely (default)
./.claude/.ralph/ralph.ps1

# Update prompt and run 10 iterations
./.claude/.ralph/ralph.ps1 -Prompt "docs/tickets/001_feature/plan.md" -MaxIterations 10
```

This is useful, depending on your use case, for:
- Budget control (limit API calls)
- Testing a fixed amount of work
- Running overnight with a cap
- Defining completion based on iteration count rather than only relying on agent judgment

## Best Environments to Run Ralph

Since Ralph runs continuously, it's best to run it in environments designed for long-running processes. Consider the following options:
- **Cloud VM**: Use a terminal multiplexer like [tmux](https://github.com/tmux/tmux) and setup your development environment with basic tools (git, Node.js, Python, Rust, C, C++, etc.)
  - Providers: AWS EC2, Google Cloud Compute Engine, DigitalOcean Droplets, etc.

## Agent Prompt Guidelines

### Best Practices

**Keep prompts short and concise.** Effective agent prompts are clear and focused, not verbose. Detailed specifications should be maintained in separate documents (specs, design docs, etc.) and referenced when needed.

**Additional guidelines:**
- One task per loop
- Clear completion criteria

