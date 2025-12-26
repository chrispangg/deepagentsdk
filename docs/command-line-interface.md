---
title: Command Line Interface
description: Interactive terminal interface for working with AI agents
---

# Command Line Interface

The Deep Agent CLI provides an interactive terminal interface for working with AI agents directly from your command line. Built with [Ink](https://github.com/vadimdemedes/ink) (React for CLI), it offers a rich, visual experience with real-time streaming, event rendering, and interactive workflows.

## What is the CLI?

The Deep Agent CLI is a **terminal-based interactive agent** that combines:

- **Natural language interaction** - Chat with the agent to accomplish tasks
- **Real-time streaming** - See responses as they're generated
- **Event visualization** - Watch tool calls, file operations, and subagents execute live
- **Interactive approvals** - Approve or deny tool executions for safe operation
- **Session persistence** - Save and resume conversations across sessions
- **File operations** - Read, write, and edit files directly from the terminal

## When to Use the CLI

The CLI is ideal for:

- **Development workflows** - Code generation, refactoring, debugging assistance
- **File operations** - Batch file processing, codebase navigation, project setup
- **Research tasks** - Web searches, API calls, content fetching and summarization
- **Scripting** - Execute shell commands, run tests, manage dependencies
- **Learning** - Explore agent behavior and capabilities interactively
- **Quick prototyping** - Test prompts and agent configurations without writing code

**vs. Programmatic Usage:**

| CLI | Programmatic (`createDeepAgent`) |
|-----|----------------------------------|
| Interactive, visual experience | Build custom applications and integrations |
| Quick ad-hoc tasks | Automated workflows and APIs |
| Built-in approval workflows | Full control over agent behavior |
| Session management UI | Custom state management |
| Real-time event streaming | Event handling in your code |

## Installation

### Prerequisites

The CLI requires [Bun](https://bun.sh) runtime (>= 1.0.0):

```bash
# Install Bun
curl -fsSL https://bun.sh/install | bash
```

### Installation Options

**Option 1: Run without installing (Recommended)**

```bash
bunx ai-sdk-deep-agent
```

**Option 2: Install globally**

```bash
bun add -g ai-sdk-deep-agent
deep-agent
```

**Option 3: Install locally in a project**

```bash
cd your-project
bun add ai-sdk-deep-agent
bunx deep-agent
```

**Option 4: Development (from source)**

```bash
git clone https://github.com/chrispangg/ai-sdk-deepagent.git
cd ai-sdk-deepagent
bun install
bun run cli
```

## Quick Start

1. **Set up API keys**

Create a `.env` file in your working directory:

```bash
ANTHROPIC_API_KEY=sk-ant-...
OPENAI_API_KEY=sk-...              # Optional
TAVILY_API_KEY=tvly-...            # Optional, for web_search tool
```

Or set environment variables:

```bash
export ANTHROPIC_API_KEY=sk-ant-...
export TAVILY_API_KEY=tvly-...     # For web search capabilities
```

2. **Start the CLI**

```bash
bunx ai-sdk-deep-agent
```

3. **Interact with the agent**

```
>_ Deep Agent
model:     anthropic/claude-haiku-4-5-20251001  /model to change
directory: ~/my-project

To get started, describe a task or try one of these commands:

/help - show available commands
/features - show enabled features
/model - change the model

> Create a TypeScript function that sorts an array
```

## Features Overview

### Natural Language Interaction

Chat with the agent to accomplish tasks:

```
> Refactor this function to use async/await
> Write unit tests for the User model
> Explain how this code works
```

### Real-Time Streaming

Watch responses stream in real-time with status indicators:

```
● I'll help you refactor that function.▌
```

### Event Visualization

See tool calls, file operations, and subagents execute live:

```
─── step 1 ───
📁 ls: 23 files found
📄 read_file: src/index.ts (150 lines)
✏️ edit_file: src/index.ts (3 occurrences)
📋 Todos: 1/3 completed
```

### Tool Approval Workflow

Control which tools the agent can use:

```
🛑 Tool Approval Required
Tool: execute
Arguments:
{
  "command": "rm -rf node_modules"
}

Press [Y] to approve, [N] to deny, [A] to approve all (enable auto-approve)
```

### Session Persistence

Save and resume conversations:

```bash
# Start a new session
bunx ai-sdk-deep-agent --session my-project

# Later, resume the session
bunx ai-sdk-deep-agent --session my-project
```

### Performance Features

Built-in optimizations for long-running conversations:

- **Prompt Caching** - Cache system prompts for faster subsequent calls (Anthropic only)
- **Tool Result Eviction** - Automatically evict large tool results to prevent context overflow
- **Auto-Summarization** - Summarize older messages when approaching token limits

### Web Tools

Search the web, make API calls, and fetch web content:

- `web_search` - Powered by Tavily API
- `http_request` - Make HTTP requests to any API
- `fetch_url` - Fetch web pages and convert HTML to Markdown

## Built-in Tools

The CLI includes all Deep Agent tools:

### Planning
- **`write_todos`** - Manage task lists for complex operations

### Filesystem
- **`ls`** - List files in a directory
- **`read_file`** - Read file contents with line numbers
- **`write_file`** - Create a new file
- **`edit_file`** - Replace text in an existing file
- **`glob`** - Find files matching a pattern
- **`grep`** - Search for text within files

### Web (requires TAVILY_API_KEY)
- **`web_search`** - Search the web using Tavily API
- **`http_request`** - Make HTTP requests to APIs
- **`fetch_url`** - Fetch web pages and convert to Markdown

### Shell Command Execution
- **`execute`** - Execute shell commands in the working directory

### Subagent Spawning
- **`task`** - Delegate work to specialized subagents

## Architecture

The CLI is built with:

- **Ink** - React for CLI, providing a component-based architecture
- **React hooks** - `useAgent` hook manages agent state and streaming
- **Event-driven** - Real-time event rendering for all agent activities
- **TypeScript** - Full type safety and IDE support

### Key Components

- **App** (`src/cli/index.tsx`) - Main application component
- **useAgent hook** (`src/cli/hooks/useAgent.ts`) - Agent state management
- **Components** (`src/cli/components/`) - Reusable UI components
- **Theme** (`src/cli/theme.ts`) - Colors, styling, and slash commands

## Next Steps

- **[CLI Usage Guide](./use-the-cli.md)** - Detailed documentation on commands, flags, and workflows
- **[Architecture](./architecture.md)** - Deep Agent architecture and components
- **[Patterns](./patterns.md)** - Common usage patterns and code examples
- **[Checkpointers](./checkpointers.md)** - Session persistence patterns

## Troubleshooting

**CLI won't start:**
- Ensure you're using Bun runtime (not Node.js)
- Check that API keys are set correctly
- Verify network connectivity

**Tools not working:**
- Check that `TAVILY_API_KEY` is set for web tools
- Verify file permissions for filesystem operations
- Check working directory is correct

**Session persistence issues:**
- Ensure `.checkpoints` directory is writable
- Use unique session names for different projects
- Check available disk space

For more help, see [GitHub Issues](https://github.com/chrispangg/ai-sdk-deepagent/issues).
