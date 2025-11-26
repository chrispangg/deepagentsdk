/**
 * Text input component with slash command suggestions.
 * Clean, minimal design inspired by Claude Code and OpenAI Codex.
 */
import React, { useState } from "react";
import { Box, Text, useInput } from "ink";
import { colors } from "../theme.js";
import { SlashMenu } from "./SlashMenu.js";

interface InputProps {
  /** Called when user submits input */
  onSubmit: (value: string) => void;
  /** Whether input is disabled (e.g., during generation) */
  disabled?: boolean;
  /** Placeholder text */
  placeholder?: string;
}

export function Input({
  onSubmit,
  disabled = false,
  placeholder = "Plan, search, build anything",
}: InputProps): React.ReactElement {
  const [value, setValue] = useState("");
  const showMenu = value.startsWith("/") && !disabled;

  // Helper function to delete the previous word
  const deleteWord = () => {
    setValue((prev) => {
      if (!prev) return "";
      // Trim trailing spaces first, then find the last word boundary
      let end = prev.length;
      // Skip trailing spaces
      while (end > 0 && prev[end - 1] === " ") {
        end--;
      }
      // Find start of current word
      while (end > 0 && prev[end - 1] !== " ") {
        end--;
      }
      return prev.slice(0, end);
    });
  };

  useInput(
    (input, key) => {
      if (disabled) return;

      // Handle Enter - submit
      if (key.return) {
        if (value.trim()) {
          onSubmit(value);
          setValue("");
        }
        return;
      }

      // Handle Option+Backspace (Alt+Backspace) - delete previous word
      // On macOS, Option+Backspace sends \x1b\x7f (escape + DEL)
      // Ink may report this as meta+backspace or just with a special input
      if ((key.backspace || key.delete) && key.meta) {
        deleteWord();
        return;
      }

      // Handle Ctrl+W - delete previous word (Unix-style)
      if (key.ctrl && input === "w") {
        deleteWord();
        return;
      }

      // Handle Ctrl+U - delete entire line
      if (key.ctrl && input === "u") {
        setValue("");
        return;
      }

      // Handle Ctrl+K - delete from cursor to end (we delete all since no cursor position)
      if (key.ctrl && input === "k") {
        setValue("");
        return;
      }

      // Handle Backspace/Delete - single character
      if (key.backspace || key.delete) {
        setValue((prev) => prev.slice(0, -1));
        return;
      }

      // Tab for autocomplete - complete first matching command
      if (key.tab && value.startsWith("/")) {
        return;
      }

      // Ignore other control keys
      if (key.ctrl || key.meta || key.escape || key.tab) {
        return;
      }

      // Ignore arrow keys and other special keys
      if (key.upArrow || key.downArrow || key.leftArrow || key.rightArrow) {
        return;
      }

      // Handle pasted text or typed characters
      // Filter to only printable characters
      if (input) {
        const printable = input
          .split("")
          .filter((char) => char >= " " || char === "\t")
          .join("");
        
        if (printable) {
          setValue((prev) => prev + printable);
        }
      }
    },
    { isActive: !disabled }
  );

  return (
    <Box flexDirection="column">
      <Box>
        <Text color={colors.muted}>{"→ "}</Text>
        {disabled ? (
          <Text dimColor>...</Text>
        ) : value ? (
          <Text>
            {value}
            <Text color={colors.primary}>▌</Text>
          </Text>
        ) : (
          <Text>
            <Text color={colors.primary}>▌</Text>
            <Text dimColor>{placeholder}</Text>
          </Text>
        )}
      </Box>
      {showMenu && <SlashMenu filter={value} />}
    </Box>
  );
}

