import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import os from 'node:os';
import type { LanguageModelMiddleware } from 'ai';
import { findGitRoot } from '../utils/project-detection.js';

/**
 * Configuration options for agent memory middleware.
 */
export interface AgentMemoryOptions {
  /**
   * Unique identifier for the agent (e.g., "code-architect", "research-agent").
   * Used to locate agent-specific memory at ~/.deepagents/{agentId}/agent.md
   */
  agentId: string;

  /**
   * Optional working directory for project-level memory detection.
   * Defaults to process.cwd().
   */
  workingDirectory?: string;

  /**
   * Optional custom path for user-level .deepagents directory.
   * Defaults to os.homedir() + '/.deepagents'.
   *
   * Useful for testing or custom deployment environments.
   *
   * @example
   * ```typescript
   * userDeepagentsDir: '/custom/path/.deepagents'
   * // Will look for memory at: /custom/path/.deepagents/{agentId}/agent.md
   * ```
   */
  userDeepagentsDir?: string;

  /**
   * Optional callback to request user approval for creating project-level .deepagents/ directory.
   * If not provided, project memory will be silently skipped if directory doesn't exist.
   *
   * @param projectPath - Absolute path to the detected git root
   * @returns Promise<boolean> - true if user approves, false otherwise
   */
  requestProjectApproval?: (projectPath: string) => Promise<boolean>;
}

/**
 * Load agent memory from a file path.
 * Returns empty string if file doesn't exist or can't be read.
 */
async function loadAgentMemory(filePath: string): Promise<string> {
  try {
    const content = await fs.readFile(filePath, 'utf-8');
    return content.trim();
  } catch {
    return '';
  }
}

/**
 * Load all additional .md files from the agent's directory (excluding agent.md).
 * Returns an array of { filename, content } objects.
 */
async function loadAdditionalMemoryFiles(
  dirPath: string
): Promise<Array<{ filename: string; content: string }>> {
  try {
    const files = await fs.readdir(dirPath);
    const mdFiles = files.filter(
      (f) => f.endsWith('.md') && f !== 'agent.md'
    );

    const results = await Promise.all(
      mdFiles.map(async (filename) => {
        const content = await loadAgentMemory(path.join(dirPath, filename));
        return { filename, content };
      })
    );

    return results.filter((r) => r.content.length > 0);
  } catch {
    return [];
  }
}

/**
 * Build the memory section for the system prompt.
 * This comprehensive prompt teaches the agent how to use memory effectively.
 */
function buildMemorySection(
  userMemory: string,
  projectMemory: string,
  additionalFiles: Array<{ filename: string; content: string }>,
  agentId: string,
  userMemoryPath: string,
  projectMemoryPath: string | null
): string {
  let sections: string[] = [];

  // Build memory content sections
  if (userMemory) {
    sections.push(`# Agent Memory (User-Level)

The following is your persistent memory stored at ${userMemoryPath}:

${userMemory}`);
  }

  if (projectMemory && projectMemoryPath) {
    sections.push(`# Agent Memory (Project-Level)

The following is project-specific context stored at ${projectMemoryPath}:

${projectMemory}`);
  }

  if (additionalFiles.length > 0) {
    const additionalSections = additionalFiles.map(
      ({ filename, content }) => `## ${filename}

${content}`
    );
    sections.push(`# Additional Context Files

${additionalSections.join('\n\n')}`);
  }

  if (sections.length === 0) {
    return ''; // No memory to inject
  }

  // Build comprehensive instructions
  const memoryContent = sections.join('\n\n---\n\n');
  const instructions = `
<agent_memory>
${memoryContent}

---

## How to Use This Memory

**What is this?**
- The content above is your persistent memory, stored in markdown files
- **User-level memory** (${userMemoryPath}) contains your core personality, preferences, and cross-project context
- **Project-level memory** ${projectMemoryPath ? `(${projectMemoryPath})` : '(not available)'} contains project-specific context and conventions

**When to read memory:**
- You already have the memory content above in your context - no need to read the files unless you need to verify exact content
- If you need to check current memory state or see if it's been updated, use \`read_file\` tool

**When to update memory:**
- **User memory**: When you learn something important about the user's preferences, working style, or recurring patterns
- **Project memory**: When you discover project-specific conventions, architecture decisions, or important context
- **Additional files**: For specialized context that doesn't fit in agent.md (e.g., decision logs, architecture notes)

**How to update memory:**
- Use the \`write_file\` or \`edit_file\` tools with the file paths shown above
- Keep entries concise and relevant
- Organize information clearly with markdown headings
- Remove outdated information when updating

**Important guidelines:**
- Memory is meant for long-term context, not temporary task tracking
- Don't store information that's already in the codebase or documentation
- Focus on insights, patterns, and preferences that aren't obvious from other sources
- When in doubt, ask the user if something should be remembered

**Example use cases:**
- User prefers TypeScript strict mode and comprehensive error handling
- Project uses custom testing framework located in \`test-utils/\`
- User wants all API responses to follow specific error format
- Project has specific commit message conventions
</agent_memory>
`;

  return instructions.trim();
}

/**
 * Create agent memory middleware for AI SDK v6.
 *
 * This middleware loads agent memory from:
 * 1. User-level: ~/.deepagents/{agentId}/agent.md (personality, preferences)
 * 2. Project-level: [git-root]/.deepagents/agent.md (project-specific context)
 * 3. Additional files: Any other .md files in the user-level directory
 *
 * The memory is injected into the system prompt before each model call, teaching
 * the agent when and how to read/update its own memory using filesystem tools.
 *
 * @param options - Configuration for agent memory
 * @param options.agentId - Unique identifier for the agent (e.g., "code-architect")
 * @param options.workingDirectory - Optional working directory for project detection (defaults to process.cwd())
 * @param options.userDeepagentsDir - Optional custom path for user-level .deepagents directory (defaults to ~/.deepagents)
 * @param options.requestProjectApproval - Optional callback to request approval before creating project .deepagents/ directory
 * @returns AI SDK v6 middleware
 *
 * @example Basic usage
 * ```typescript
 * import { createDeepAgent } from 'deepagentsdk';
 * import { createAgentMemoryMiddleware } from 'deepagentsdk/middleware';
 * import { anthropic } from '@ai-sdk/anthropic';
 *
 * const memoryMiddleware = createAgentMemoryMiddleware({
 *   agentId: 'code-architect',
 * });
 *
 * const agent = createDeepAgent({
 *   model: anthropic('claude-sonnet-4-5'),
 *   middleware: memoryMiddleware,
 * });
 * ```
 *
 * @example With project approval callback
 * ```typescript
 * const memoryMiddleware = createAgentMemoryMiddleware({
 *   agentId: 'code-architect',
 *   requestProjectApproval: async (projectPath) => {
 *     console.log(`Create .deepagents/ in ${projectPath}? (y/n)`);
 *     // ... get user input
 *     return userSaidYes;
 *   }
 * });
 * ```
 *
 * @example With custom user directory path
 * ```typescript
 * const memoryMiddleware = createAgentMemoryMiddleware({
 *   agentId: 'code-architect',
 *   userDeepagentsDir: '/custom/path/.deepagents',
 *   // Memory will be loaded from:
 *   // - /custom/path/.deepagents/code-architect/agent.md
 *   // - [git-root]/.deepagents/agent.md (project-level)
 * });
 * ```
 */
export function createAgentMemoryMiddleware(
  options: AgentMemoryOptions
): LanguageModelMiddleware {
  const { agentId, workingDirectory, userDeepagentsDir, requestProjectApproval } = options;

  // Memory is loaded once and cached in closure variables
  let memoryLoaded = false;
  let cachedMemorySection = '';

  return {
    specificationVersion: 'v3',
    transformParams: async ({ params }) => {
      // Load memory on first call only (closure-based caching)
      if (!memoryLoaded) {
        const workDir = workingDirectory || process.cwd();

        // 1. Load user-level memory
        const baseUserDir = userDeepagentsDir || path.join(os.homedir(), '.deepagents');
        const userAgentDir = path.join(baseUserDir, agentId);
        const userMemoryPath = path.join(userAgentDir, 'agent.md');
        const userMemory = await loadAgentMemory(userMemoryPath);

        // Auto-create user directory if it doesn't exist (safe operation)
        if (!userMemory) {
          try {
            await fs.mkdir(userAgentDir, { recursive: true });
          } catch {
            // Ignore errors - directory might already exist or permissions issue
          }
        }

        // 2. Load additional .md files from user directory
        const additionalFiles = await loadAdditionalMemoryFiles(userAgentDir);

        // 3. Load project-level memory (if in git repository)
        let projectMemory = '';
        let projectMemoryPath: string | null = null;

        const gitRoot = await findGitRoot(workDir);
        if (gitRoot) {
          const projectDeepagentsDir = path.join(gitRoot, '.deepagents');
          projectMemoryPath = path.join(projectDeepagentsDir, 'agent.md');

          // Check if project directory exists
          try {
            await fs.stat(projectDeepagentsDir);
            projectMemory = await loadAgentMemory(projectMemoryPath);
          } catch {
            // Project directory doesn't exist - request approval if callback provided
            if (requestProjectApproval) {
              const approved = await requestProjectApproval(gitRoot);
              if (approved) {
                try {
                  await fs.mkdir(projectDeepagentsDir, { recursive: true });
                  // Don't create agent.md yet - let the agent do it when needed
                } catch {
                  // Ignore errors - permissions issue or race condition
                }
              }
            }
          }
        }

        // Build and cache memory section
        cachedMemorySection = buildMemorySection(
          userMemory,
          projectMemory,
          additionalFiles,
          agentId,
          userMemoryPath,
          projectMemoryPath
        );

        memoryLoaded = true;
      }

      // Inject memory into system prompt if available
      if (cachedMemorySection) {
        const updatedPrompt = params.prompt.map((msg) => {
          if (msg.role === 'system') {
            return {
              ...msg,
              content: `${msg.content}\n\n${cachedMemorySection}`,
            };
          }
          return msg;
        });

        return { ...params, prompt: updatedPrompt };
      }

      return params;
    },
  };
}
