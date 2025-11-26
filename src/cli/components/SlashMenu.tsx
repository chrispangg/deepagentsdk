/**
 * Slash command autocomplete menu component.
 */
import React from "react";
import { Box, Text } from "ink";
import { colors, filterCommands, type SlashCommand } from "../theme.js";

interface SlashMenuProps {
  /** Current input value to filter commands */
  filter: string;
  /** Maximum number of items to show */
  maxItems?: number;
}

export function SlashMenu({
  filter,
  maxItems = 8,
}: SlashMenuProps): React.ReactElement | null {
  // Only show menu when input starts with /
  if (!filter.startsWith("/")) {
    return null;
  }

  const filtered = filterCommands(filter);

  if (filtered.length === 0) {
    return (
      <Box paddingLeft={2} marginTop={1}>
        <Text dimColor>No matching commands</Text>
      </Box>
    );
  }

  const displayItems = filtered.slice(0, maxItems);
  const hasMore = filtered.length > maxItems;

  return (
    <Box flexDirection="column" marginTop={1} paddingLeft={2}>
      {displayItems.map((cmd) => (
        <SlashMenuItem key={cmd.command} command={cmd} />
      ))}
      {hasMore && (
        <Text dimColor>... and {filtered.length - maxItems} more</Text>
      )}
    </Box>
  );
}

interface SlashMenuItemProps {
  command: SlashCommand;
}

function SlashMenuItem({ command }: SlashMenuItemProps): React.ReactElement {
  const aliases =
    command.aliases.length > 0 ? ` (${command.aliases.join(", ")})` : "";

  return (
    <Box>
      <Text color={colors.info}>{command.command}</Text>
      <Text dimColor>{aliases}</Text>
      <Text dimColor> - {command.description}</Text>
    </Box>
  );
}

/**
 * Full slash menu panel for /help command.
 */
export function SlashMenuPanel(): React.ReactElement {
  const commands = filterCommands();

  return (
    <Box
      flexDirection="column"
      borderStyle="single"
      borderColor={colors.muted}
      paddingX={2}
      paddingY={1}
      marginY={1}
    >
      <Text bold color={colors.info}>
        Available Commands
      </Text>
      <Box height={1} />
      {commands.map((cmd) => (
        <Box key={cmd.command} flexDirection="column" marginBottom={1}>
          <Box>
            <Text color={colors.info}>{cmd.command}</Text>
            {cmd.aliases.length > 0 && (
              <Text dimColor> ({cmd.aliases.join(", ")})</Text>
            )}
          </Box>
          <Box paddingLeft={2}>
            <Text dimColor>{cmd.description}</Text>
          </Box>
        </Box>
      ))}
    </Box>
  );
}

