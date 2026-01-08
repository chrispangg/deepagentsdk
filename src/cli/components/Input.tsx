/**
 * Text input component with slash command suggestions.
 * Clean, minimal design inspired by Claude Code and OpenAI Codex.
 */
import React, { useState, useRef } from "react";
import { Box, Text, useInput } from "ink";
import { colors } from "../theme";
import { SlashMenu } from "./SlashMenu";

interface InputProps {
  /** Called when user submits input */
  onSubmit: (value: string) => void;
  /** Whether input is disabled (e.g., during generation) */
  disabled?: boolean;
  /** Placeholder text */
  placeholder?: string;
}

// Module-level history storage to persist across re-renders
const inputHistory: string[] = [];
const MAX_HISTORY = 100;

export function Input({
  onSubmit,
  disabled = false,
  placeholder = "Plan, search, build anything",
}: InputProps): React.ReactElement {
  const [value, setValue] = useState("");
  const [cursorPos, setCursorPos] = useState(0);
  const showMenu = value.startsWith("/") && !disabled;
  
  // History navigation state
  // -1 means we're at the current input (not browsing history)
  const [historyIndex, setHistoryIndex] = useState(-1);
  // Store the current input when user starts navigating history
  const savedInputRef = useRef("");

  // Helper function to delete the previous word from cursor position
  const deleteWord = () => {
    if (cursorPos === 0) return;
    
    let end = cursorPos;
    // Skip trailing spaces
    while (end > 0 && value[end - 1] === " ") {
      end--;
    }
    // Find start of current word
    while (end > 0 && value[end - 1] !== " ") {
      end--;
    }
    
    const newValue = value.slice(0, end) + value.slice(cursorPos);
    setValue(newValue);
    setCursorPos(end);
  };

  useInput(
    (input, key) => {
      if (disabled) return;

      // Handle Enter - submit
      if (key.return) {
        if (value.trim()) {
          // Add to history (avoid duplicates of the last entry)
          if (inputHistory.length === 0 || inputHistory[0] !== value) {
            inputHistory.unshift(value);
            if (inputHistory.length > MAX_HISTORY) {
              inputHistory.pop();
            }
          }
          onSubmit(value);
          setValue("");
          setCursorPos(0);
          setHistoryIndex(-1);
          savedInputRef.current = "";
        }
        return;
      }

      // Handle up arrow - navigate to older history
      if (key.upArrow) {
        if (inputHistory.length === 0) return;
        
        if (historyIndex === -1) {
          // Save current input before navigating history
          savedInputRef.current = value;
        }
        
        const newIndex = Math.min(historyIndex + 1, inputHistory.length - 1);
        if (newIndex !== historyIndex) {
          const historyValue = inputHistory[newIndex];
          if (historyValue !== undefined) {
            setHistoryIndex(newIndex);
            setValue(historyValue);
            setCursorPos(historyValue.length);
          }
        }
        return;
      }

      // Handle down arrow - navigate to newer history
      if (key.downArrow) {
        if (historyIndex === -1) return;
        
        const newIndex = historyIndex - 1;
        if (newIndex === -1) {
          // Return to saved current input
          setHistoryIndex(-1);
          setValue(savedInputRef.current);
          setCursorPos(savedInputRef.current.length);
        } else {
          const historyValue = inputHistory[newIndex];
          if (historyValue !== undefined) {
            setHistoryIndex(newIndex);
            setValue(historyValue);
            setCursorPos(historyValue.length);
          }
        }
        return;
      }

      // Handle left arrow - move cursor left
      if (key.leftArrow) {
        if (key.meta || key.ctrl) {
          // Option/Ctrl+Left: jump to start of previous word
          let pos = cursorPos;
          // Skip spaces
          while (pos > 0 && value[pos - 1] === " ") {
            pos--;
          }
          // Skip word characters
          while (pos > 0 && value[pos - 1] !== " ") {
            pos--;
          }
          setCursorPos(pos);
        } else {
          setCursorPos((prev) => Math.max(0, prev - 1));
        }
        return;
      }

      // Handle right arrow - move cursor right
      if (key.rightArrow) {
        if (key.meta || key.ctrl) {
          // Option/Ctrl+Right: jump to end of next word
          let pos = cursorPos;
          // Skip current word characters
          while (pos < value.length && value[pos] !== " ") {
            pos++;
          }
          // Skip spaces
          while (pos < value.length && value[pos] === " ") {
            pos++;
          }
          setCursorPos(pos);
        } else {
          setCursorPos((prev) => Math.min(value.length, prev + 1));
        }
        return;
      }

      // Handle Ctrl+A - move to start of line
      if (key.ctrl && input === "a") {
        setCursorPos(0);
        return;
      }

      // Handle Ctrl+E - move to end of line
      if (key.ctrl && input === "e") {
        setCursorPos(value.length);
        return;
      }

      // Handle Option+Backspace (Alt+Backspace) - delete previous word
      if ((key.backspace || key.delete) && key.meta) {
        deleteWord();
        return;
      }

      // Handle Ctrl+W - delete previous word (Unix-style)
      if (key.ctrl && input === "w") {
        deleteWord();
        return;
      }

      // Handle Ctrl+U - delete from start to cursor
      if (key.ctrl && input === "u") {
        setValue(value.slice(cursorPos));
        setCursorPos(0);
        return;
      }

      // Handle Ctrl+K - delete from cursor to end
      if (key.ctrl && input === "k") {
        setValue(value.slice(0, cursorPos));
        return;
      }

      // Handle Backspace/Delete - single character
      if (key.backspace || key.delete) {
        if (cursorPos > 0) {
          setValue((prev) => prev.slice(0, cursorPos - 1) + prev.slice(cursorPos));
          setCursorPos((prev) => prev - 1);
        }
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

      // Handle pasted text or typed characters
      // Filter to only printable characters
      if (input) {
        const printable = input
          .split("")
          .filter((char) => char >= " " || char === "\t")
          .join("");
        
        if (printable) {
          // Reset history navigation when user types
          if (historyIndex !== -1) {
            setHistoryIndex(-1);
            savedInputRef.current = "";
          }
          setValue((prev) => prev.slice(0, cursorPos) + printable + prev.slice(cursorPos));
          setCursorPos((prev) => prev + printable.length);
        }
      }
    },
    { isActive: !disabled }
  );

  // Render text with cursor at the correct position
  const renderTextWithCursor = () => {
    if (!value) {
      return (
        <Text>
          <Text color={colors.primary}>▌</Text>
          <Text dimColor>{placeholder}</Text>
        </Text>
      );
    }

    const beforeCursor = value.slice(0, cursorPos);
    const afterCursor = value.slice(cursorPos);

    return (
      <Text>
        {beforeCursor}
        <Text color={colors.primary}>▌</Text>
        {afterCursor}
      </Text>
    );
  };

  return (
    <Box flexDirection="column">
      <Box>
        <Text color={colors.muted}>{"→ "}</Text>
        {disabled ? (
          <Text dimColor>...</Text>
        ) : (
          renderTextWithCursor()
        )}
      </Box>
      {showMenu && <SlashMenu filter={value} />}
    </Box>
  );
}

