---
title: Using the CLI
description: Complete guide to CLI commands, flags, and workflows
---

# Using the CLI

Complete guide to using the Deep Agent CLI, including all commands, flags, interactive features, and workflows.

## Table of Contents

- [Starting the CLI](#starting-the-cli)
- [Command-Line Flags](#command-line-flags)
- [Slash Commands](#slash-commands)
- [Tool Approval Workflow](#tool-approval-workflow)
- [Interactive Features](#interactive-features)
- [Configuration Options](#configuration-options)
- [Tips and Tricks](#tips-and-tricks)
- [Advanced Usage](#advanced-usage)

## Starting the CLI

### Basic Usage

```bash
# Default model (claude-haiku-4-5-20251001) in current directory
bunx ai-sdk-deep-agent

# Specify a model
bunx ai-sdk-deep-agent --model anthropic/claude-sonnet-4-20250514

# Use a specific working directory
bunx ai-sdk-deep-agent --dir ./my-project

# Enable session persistence
bunx ai-sdk-deep-agent --session my-session
```

### Development

```bash
# Run from source (in the ai-sdk-deep-agent repository)
bun run cli

# With options
bun run cli --model openai/gpt-4o --dir ./workspace
```

## Command-Line Flags

### Model Selection

```bash
# Select specific model
--model <model>          # Full model identifier
-m <model>              # Short form

# Examples:
--model anthropic/claude-sonnet-4-20250514
--model openai/gpt-4o
-m claude-haiku-4-5-20251001    # Defaults to anthropic if provider omitted
```

**Supported Models:**

- Anthropic: `anthropic/claude-sonnet-4-20250514`, `anthropic/claude-haiku-4-5-20251001`
- OpenAI: `openai/gpt-4o`, `openai/gpt-4o-mini`, `openai/gpt-5`
- Or omit provider: `claude-sonnet-4-20250514` (defaults to Anthropic)

### Working Directory

```bash
# Set working directory for file operations
--dir <directory>        # Full or relative path
-d <directory>          # Short form

# Examples:
--dir ./my-project
-d ~/projects/web-app
```

**Note:** File operations (`read_file`, `write_file`, `edit_file`) are relative to this directory.

### Custom System Prompt

```bash
# Set a custom system prompt
--prompt <prompt>       # Custom system prompt
-p <prompt>            # Short form

# Examples:
--prompt "You are a TypeScript expert"
-p "You are a helpful coding assistant"
```

### Maximum Steps

```bash
# Limit the number of reasoning steps
--max-steps <number>    # Maximum steps (default: 100)
-s <number>            # Short form

# Examples:
--max-steps 50
-s 200
```

**Note:** One "step" = one complete cycle of thinking → tool calls → results → more thinking.

### Performance Features (All Enabled by Default)

#### Prompt Caching

```bash
# Enable prompt caching (default: enabled for Anthropic)
--cache                 # Enable prompt caching
--no-cache              # Disable prompt caching

# Examples:
bunx ai-sdk-deep-agent --cache
bunx ai-sdk-deep-agent --model openai/gpt-4o --no-cache  # Not needed for OpenAI
```

**What it does:** Caches system prompts across API calls for faster responses and lower costs (Anthropic only).

#### Tool Result Eviction

```bash
# Enable eviction with custom limit (default: 20000 tokens)
--eviction-limit <n>    # Set token threshold
-e <n>                  # Short form

# Disable eviction
--no-eviction           # Disable eviction entirely

# Examples:
--eviction-limit 30000  # Evict results > 30k tokens
-e 10000               # More aggressive eviction
--no-eviction          # Keep all tool results
```

**What it does:** Automatically saves large tool results (>20k tokens by default) to the filesystem and replaces them with a summary to prevent context overflow.

#### Auto-Summarization

```bash
# Enable summarization (default: enabled)
--summarize             # Enable auto-summarization
--no-summarize          # Disable summarization

# Custom summarization settings
--summarize-threshold <n>   # Token threshold to trigger (default: 170000)
--summarize-keep <n>        # Recent messages to keep intact (default: 6)

# Examples:
--summarize --summarize-threshold 150000 --summarize-keep 10
--no-summarize
```

**What it does:** When conversation approaches token limits (~170k tokens), automatically summarizes older messages while keeping the most recent messages intact.

### Session Persistence

```bash
# Enable session persistence
--session <name>         # Session name/ID
--session=<name>         # Equals sign also works

# Examples:
--session my-project
--session=debugging-session-2025-12-26
```

**What it does:** Saves conversation state to `.checkpoints/<session-name>.json` after each turn, allowing you to resume later.

### Help

```bash
# Show help message
--help
-h
```

## Slash Commands

Slash commands provide quick access to CLI features. Type `/` to see all available commands.

### Navigation and Display

#### `/help` (aliases: `/h`, `/?`)

Show all available slash commands.

```
> /help

Available Commands:
  /todos       Show current todo list
  /files       Show files in working directory
  /read <path> Read a file
  /model       Show available models or change model
  /features    Show enabled features
  /tokens      Show estimated token count
  /apikey      Manage API keys
  /clear       Clear chat history
  /session     Session management
  /help        Show this help
  /quit        Exit the CLI
```

#### `/todos` (aliases: `/t`, `/todo`)

Show the current todo list.

```
> /todos

📋 Todo List
  ⏳ pending: Implement authentication
  🔄 in_progress: Set up database
  ✅ completed: Create project structure
```

#### `/files` (aliases: `/f`, `/file`)

List files in the working directory.

```
> /files

📁 Working Directory (~/my-project)
  src/
    index.ts
    utils.ts
  package.json
  README.md
```

#### `/read <path>` (alias: `/r`)

Read a file's contents.

```
> /read src/index.ts

📄 src/index.ts (150 lines)
1  import express from 'express';
2
3  const app = express();
...
```

### Model and Configuration

#### `/model` (no aliases)

Show available models or change the current model.

```
> /model                    # Show available models
> /model claude-sonnet-4     # Change model
> /model openai/gpt-4o       # Change provider
```

**Interactive Model Selection:**

Type `/model` without arguments to see an interactive model picker:

```
> /model

🧠 Select a Model

  anthropic/claude-sonnet-4-20250514  (Recommended)
  anthropic/claude-haiku-4-5-20251001 (Fast)
  openai/gpt-4o                      (Balanced)
  openai/gpt-4o-mini                 (Fast)

Press [1-4] to select, [ESC] to cancel
```

#### `/features` (alias: `/feat`)

Show enabled performance features.

```
> /features

⚙️ Feature Status

✓ Prompt Caching: enabled
✓ Tool Eviction: enabled (20000 tokens)
✓ Auto-Summarization: enabled (170000 tokens, keep 6 msgs)

Enable with: --cache --eviction-limit 20000 --summarize
```

#### `/tokens` (alias: `/tok`)

Show estimated token count for the current conversation.

```
> /tokens

📊 Token Usage

Messages: 12
Estimated Tokens: 45,234
Context Usage: 22% (of ~200k)
```

### Feature Toggles

Toggle performance features at runtime.

#### `/cache [on|off]`

Toggle prompt caching.

```
> /cache on     # Enable
> /cache off    # Disable
> /cache        # Toggle current state
```

#### `/eviction [on|off]` (alias: `/evict`)

Toggle tool result eviction.

```
> /eviction on     # Enable
> /eviction off    # Disable
> /evict           # Toggle
```

#### `/summarize [on|off]` (alias: `/sum`)

Toggle auto-summarization.

```
> /summarize on     # Enable
> /summarize off    # Disable
> /sum              # Toggle
```

#### `/approve`

Toggle auto-approve mode for tool executions.

```
> /approve    # Toggle between safe mode and auto-approve
```

**Safe Mode (Default):** Agent asks for approval before executing dangerous tools (`execute`, `write_file`, `edit_file`, `web_search`, `fetch_url`).

**Auto-Approve Mode:** Agent executes all tools without asking for approval.

### Session Management

#### `/sessions` (alias: `/session-list`)

List all saved sessions.

```
> /sessions

Saved sessions:
  - my-project
  - debugging-session-2025-12-26
  - research-task
```

#### `/session clear`

Clear the current session.

```
> /session clear

Session cleared.
```

**Note:** Checkpointing must be enabled (`--session` flag) for session commands to work.

### Utility Commands

#### `/apikey` (aliases: `/key`, `/api`)

Open interactive API key management panel.

```
> /apikey

🔑 API Key Management

  [1] Anthropic (not set)
  [2] OpenAI (not set)
  [3] Tavily (not set)

Press [1-3] to set key, [ESC] to cancel
```

#### `/clear` (alias: `/c`)

Clear conversation history and reset the agent.

```
> /clear

Conversation cleared. Starting fresh.
```

**Note:** This doesn't delete the session checkpoint if using `--session`. Use `/session clear` to fully reset.

#### `/quit` (aliases: `/q`, `/exit`)

Exit the CLI.

```
> /quit

Goodbye!
```

**Keyboard Shortcuts:**
- `Ctrl+C` once - Abort current generation
- `Ctrl+C` twice - Exit CLI
- `Ctrl+D` - Exit CLI

## Tool Approval Workflow

The CLI includes a safety feature that requires approval before executing certain tools.

### Default Approval Requirements

The following tools require approval by default (in Safe Mode):

- `execute` - Execute shell commands
- `write_file` - Create or overwrite files
- `edit_file` - Edit existing files
- `web_search` - Search the web
- `fetch_url` - Fetch web content

**Note:** `http_request` does NOT require approval per the LangChain DeepAgents pattern.

### Approval Prompt

When the agent attempts to use a tool requiring approval, you'll see:

```
🛑 Tool Approval Required
Tool: execute
Arguments:
{
  "command": "rm -rf node_modules"
}

Press [Y] to approve, [N] to deny, [A] to approve all (enable auto-approve)
```

**Options:**
- `Y` or `y` - Approve this tool execution
- `N` or `n` - Deny this tool execution
- `A` or `a` - Approve and enable auto-approve mode
- `ESC` - Deny

### Auto-Approve Mode

Enable auto-approve to skip approval prompts:

```
> /approve

✅ Auto-approve enabled

○ claude-haiku-4-5-20251001 · 🟢 Auto-approve · ? for shortcuts
```

**When to use auto-approve:**
- Trusted environments (personal projects)
- Repetitive safe operations
- Automated workflows

**When to stay in safe mode:**
- Production systems
- Untrusted codebases
- Learning and exploration
- Critical operations

### Per-Session Approval State

Approval state is maintained for the current CLI session but resets when you restart the CLI.

## Interactive Features

### Model Selection Panel

Interactive model picker for changing models at runtime.

```
> /model

🧠 Select a Model

  [1] anthropic/claude-sonnet-4-20250514  (Recommended)
  [2] anthropic/claude-haiku-4-5-20251001 (Fast)
  [3] openai/gpt-4o                      (Balanced)
  [4] openai/gpt-4o-mini                 (Fast)

Current: anthropic/claude-haiku-4-5-20251001

Press [1-4] to select, [ESC] to cancel
```

### API Key Input Panel

Interactive API key management for quick setup.

```
> /apikey

🔑 API Key Management

Select provider:
  [1] Anthropic
  [2] OpenAI
  [3] Tavily (for web_search)

Press [1-3] to set key, [ESC] to cancel
```

After selecting a provider:

```
🔑 Enter Anthropic API Key

Paste your API key (sk-ant-...) and press Enter:

>
```

### File Previews

See file contents before they're written or edited.

```
📄 Writing: src/utils.ts (42 lines)

1  export function greet(name: string): string {
2    return `Hello, ${name}!`;
3  }
4
5  export function farewell(name: string): string {
...
```

### Status Indicators

Real-time status indicators in the status bar:

```
○ claude-haiku-4-5-20251001 · 🔴 Safe mode · ? for shortcuts
```

**Status indicators:**
- `○` - Idle
- `●` (yellow) - Thinking
- `●` (green) - Streaming text
- `●` (magenta) - Executing tool
- `●` (blue) - Running subagent
- `●` (red) - Error

**Feature badges:**
- `⚡` - Prompt caching enabled
- `📦` - Tool eviction enabled
- `📝` - Auto-summarization enabled

**Mode indicators:**
- `🟢 Auto-approve` - Auto-approve mode
- `🔴 Safe mode` - Safe mode (default)

## Configuration Options

### Environment Variables

The CLI automatically loads API keys from environment variables:

```bash
# Required for Anthropic models
export ANTHROPIC_API_KEY=sk-ant-...

# Optional for OpenAI models
export OPENAI_API_KEY=sk-...

# Optional for web_search tool
export TAVILY_API_KEY=tvly-...
```

### `.env` File Support

Create a `.env` or `.env.local` file in your working directory:

```bash
# .env file in working directory
ANTHROPIC_API_KEY=sk-ant-...
OPENAI_API_KEY=sk-...
TAVILY_API_KEY=tvly-...
```

**Priority:** Environment variables > `.env` file

### Working Directory `.env` Loading

When using `--dir`, the CLI loads `.env` from that directory:

```bash
bunx ai-sdk-deep-agent --dir ./my-project
# Loads: ./my-project/.env
```

This allows project-specific API key configuration.

## Tips and Tricks

### Keyboard Shortcuts

- `Ctrl+C` (once) - Abort current generation
- `Ctrl+C` (twice) - Exit CLI
- `Ctrl+D` - Exit CLI
- `/` then Tab - Autocomplete slash commands

### Efficient Workflows

**1. Use session persistence for long-running tasks**

```bash
# Start a session
bunx ai-sdk-deep-agent --session refactor-auth

# Work for a while...
> "Refactor the authentication system"

# Exit and come back later
bunx ai-sdk-deep-agent --session refactor-auth
# Conversation history is restored!
```

**2. Toggle auto-approve for trusted operations**

```bash
# Start in safe mode
bunx ai-sdk-deep-agent

# After verifying the agent's behavior, enable auto-approve
> /approve

# Now all tool calls execute without prompts
```

**3. Use different models for different tasks**

```bash
# Quick research (fast, cheap)
bunx ai-sdk-deep-agent --model claude-haiku-4-5-20251001

# Complex refactoring (smart, capable)
bunx ai-sdk-deep-agent --model claude-sonnet-4-20250514
```

**4. Monitor token usage for long conversations**

```
> /tokens

📊 Token Usage

Messages: 25
Estimated Tokens: 145,234
Context Usage: 72% (of ~200k)

⚠️ Consider enabling --summarize to manage context
```

**5. Use slash commands for quick navigation**

```
> /files           # See what's in the project
> /read src/index.ts  # Read a specific file
> /todos           # Check task progress
```

### Debugging

**Check feature status:**

```
> /features

⚙️ Feature Status

✓ Prompt Caching: enabled
✓ Tool Eviction: enabled (20000 tokens)
✓ Auto-Summarization: enabled (170000 tokens, keep 6 msgs)
```

**View current model:**

```
> /model

🧠 Current Model: anthropic/claude-sonnet-4-20250514

Provider: Anthropic
Model ID: claude-sonnet-4-20250514
Context Window: ~200k tokens
```

**Clear and restart:**

```
> /clear

Conversation cleared.
```

## Advanced Usage

### Combining Flags

```bash
# Full feature example
bunx ai-sdk-deep-agent \
  --model anthropic/claude-sonnet-4-20250514 \
  --dir ./my-project \
  --session my-session \
  --max-steps 200 \
  --cache \
  --eviction-limit 30000 \
  --summarize-threshold 150000 \
  --summarize-keep 10
```

### Session Management

```bash
# Start a named session
bunx ai-sdk-deep-agent --session feature-x-development

# Work on the feature...

# List all sessions
> /sessions

Saved sessions:
  - feature-x-development
  - bug-fix-session
  - research-task

# Clear current session
> /session clear

# Start a different session
bunx ai-sdk-deep-agent --session bug-fix-session
```

### Custom System Prompts

```bash
# Set a custom prompt for specific tasks
bunx ai-sdk-deep-agent \
  --prompt "You are a TypeScript expert. Focus on type safety and best practices."

# Use for code review
bunx ai-sdk-deep-agent \
  --prompt "You are a code reviewer. Focus on security, performance, and maintainability."
```

### Working Directory Isolation

```bash
# Work in a specific directory
bunx ai-sdk-deep-agent --dir ./frontend

# All file operations are relative to ./frontend
> "Read the package.json"
# Reads: ./frontend/package.json
```

### Performance Tuning

```bash
# For fast, cheap responses (Haiku)
bunx ai-sdk-deep-agent --model claude-haiku-4-5-20251001

# For complex reasoning (Sonnet)
bunx ai-sdk-deep-agent --model claude-sonnet-4-20250514

# Disable caching for non-Anthropic models
bunx ai-sdk-deep-agent --model openai/gpt-4o --no-cache

# Aggressive eviction for large file operations
bunx ai-sdk-deep-agent --eviction-limit 10000

# Custom summarization thresholds
bunx ai-sdk-deep-agent \
  --summarize-threshold 120000 \
  --summarize-keep 4
```

### API Key Rotation

```bash
# Set new API key interactively
> /apikey

[1] Anthropic
[2] OpenAI
[3] Tavily

Press [1-3] to set key: 1

🔑 Enter Anthropic API Key
Paste your API key (sk-ant-...) and press Enter:

> sk-ant-newkey...

✅ API key updated for Anthropic
```

## Troubleshooting

**"No API keys found"**

Create a `.env` file or set environment variables:

```bash
export ANTHROPIC_API_KEY=sk-ant-...
```

**"Web tools not available"**

Set `TAVILY_API_KEY` for web search capabilities:

```bash
export TAVILY_API_KEY=tvly-...
```

**"Session not found"**

The session doesn't exist yet. Start a new session:

```bash
bunx ai-sdk-deep-agent --session my-new-session
```

**"Permission denied" writing files**

Check file permissions and working directory:

```bash
ls -la ./my-project
bunx ai-sdk-deep-agent --dir ./my-project
```

**High token usage**

Enable summarization and eviction:

```bash
bunx ai-sdk-deep-agent \
  --summarize-threshold 150000 \
  --eviction-limit 15000
```

For more help, see [GitHub Issues](https://github.com/chrispangg/ai-sdk-deepagent/issues).
