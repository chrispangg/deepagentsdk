/**
 * Theme constants for the Ink CLI.
 * Colors, emoji, and styling values.
 */

/**
 * Color palette for the CLI.
 * Uses chalk-compatible color names.
 */
export const colors = {
  // Primary colors
  primary: "cyan",
  secondary: "magenta",
  accent: "yellow",

  // Status colors
  success: "green",
  error: "red",
  warning: "yellow",
  info: "blue",

  // Text colors
  muted: "gray",
  highlight: "white",

  // Semantic colors
  tool: "magenta",
  file: "blue",
  user: "cyan",
  agent: "green",
} as const;

/**
 * Status emoji for todo items and events.
 */
export const emoji = {
  // Todo statuses
  pending: "⏳",
  in_progress: "🔄",
  completed: "✅",
  cancelled: "❌",

  // UI elements
  robot: "🤖",
  thinking: "💭",
  tool: "🔧",
  file: "📁",
  edit: "✏️",
  todo: "📋",
  done: "🎉",
  error: "💥",
  warning: "⚠️",
  info: "ℹ️",
  user: "👤",
  subagent: "🤝",
  key: "🔑",
  model: "🧠",
} as const;

/**
 * Box border styles for different UI elements.
 */
export const borders = {
  panel: "round",
  preview: "single",
  alert: "double",
} as const;

/**
 * Slash commands configuration.
 */
export interface SlashCommand {
  command: string;
  aliases: string[];
  description: string;
}

export const SLASH_COMMANDS: SlashCommand[] = [
  {
    command: "/todos",
    aliases: ["/t", "/todo"],
    description: "Show current todo list",
  },
  {
    command: "/files",
    aliases: ["/f", "/file"],
    description: "Show files in working directory",
  },
  {
    command: "/read",
    aliases: ["/r"],
    description: "Read a file (usage: /read <path>)",
  },
  {
    command: "/apikey",
    aliases: ["/key", "/api"],
    description: "Set API key (usage: /apikey <provider> <key>)",
  },
  {
    command: "/model",
    aliases: [],
    description: "Change model (usage: /model <model-name>)",
  },
  {
    command: "/features",
    aliases: ["/feat"],
    description: "Show enabled features (caching, eviction, summarization)",
  },
  {
    command: "/tokens",
    aliases: ["/tok"],
    description: "Show estimated token count for conversation",
  },
  {
    command: "/cache",
    aliases: [],
    description: "Toggle prompt caching (usage: /cache on|off)",
  },
  {
    command: "/eviction",
    aliases: ["/evict"],
    description: "Toggle tool result eviction (usage: /eviction on|off)",
  },
  {
    command: "/summarize",
    aliases: ["/sum"],
    description: "Toggle auto-summarization (usage: /summarize on|off)",
  },
  {
    command: "/clear",
    aliases: ["/c"],
    description: "Clear chat history",
  },
  {
    command: "/help",
    aliases: ["/h", "/?"],
    description: "Show help",
  },
  {
    command: "/quit",
    aliases: ["/q", "/exit"],
    description: "Exit the CLI",
  },
];

/**
 * Filter commands by prefix.
 */
export function filterCommands(prefix?: string): SlashCommand[] {
  if (!prefix) {
    return SLASH_COMMANDS;
  }

  const normalizedPrefix = prefix.startsWith("/") ? prefix : `/${prefix}`;

  return SLASH_COMMANDS.filter((cmd) => {
    if (cmd.command.toLowerCase().startsWith(normalizedPrefix.toLowerCase())) {
      return true;
    }
    return cmd.aliases.some((alias) =>
      alias.toLowerCase().startsWith(normalizedPrefix.toLowerCase())
    );
  });
}

/**
 * Parse a slash command from input.
 */
export function parseCommand(input: string): {
  isCommand: boolean;
  command?: string;
  args?: string;
} {
  const trimmed = input.trim();

  if (!trimmed.startsWith("/")) {
    return { isCommand: false };
  }

  const parts = trimmed.slice(1).split(/\s+/);
  const command = parts[0]?.toLowerCase();
  const args = parts.slice(1).join(" ");

  return {
    isCommand: true,
    command,
    args: args || undefined,
  };
}

