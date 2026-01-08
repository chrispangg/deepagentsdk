/**
 * Todo list panel component.
 */
import React from "react";
import { Box, Text } from "ink";
import { Badge } from "@inkjs/ui";
import { emoji, colors } from "../theme";
import type { TodoItem } from "../../types";

interface TodoListProps {
  todos: TodoItem[];
  /** Whether to show as a full panel with border */
  showPanel?: boolean;
}

export function TodoList({
  todos,
  showPanel = true,
}: TodoListProps): React.ReactElement {
  const completed = todos.filter((t) => t.status === "completed").length;
  const inProgress = todos.filter((t) => t.status === "in_progress").length;
  const pending = todos.filter((t) => t.status === "pending").length;
  const total = todos.length;

  const content = (
    <Box flexDirection="column">
      <Box marginBottom={1}>
        <Text bold color={colors.info}>
          {emoji.todo} Todo List
        </Text>
        <Text dimColor>
          {" "}
          ({completed}/{total} done)
        </Text>
      </Box>

      {todos.length === 0 ? (
        <Box paddingLeft={2}>
          <Text dimColor>No todos yet.</Text>
        </Box>
      ) : (
        <Box flexDirection="column">
          {todos.map((todo) => (
            <TodoItemRow key={todo.id} todo={todo} />
          ))}
        </Box>
      )}

      {todos.length > 0 && (
        <Box marginTop={1} gap={2}>
          {inProgress > 0 && (
            <Text color={colors.warning}>{inProgress} in progress</Text>
          )}
          {pending > 0 && <Text dimColor>{pending} pending</Text>}
          {completed > 0 && (
            <Text color={colors.success}>{completed} completed</Text>
          )}
        </Box>
      )}
    </Box>
  );

  if (!showPanel) {
    return content;
  }

  return (
    <Box
      flexDirection="column"
      borderStyle="single"
      borderColor={colors.muted}
      paddingX={2}
      paddingY={1}
      marginY={1}
    >
      {content}
    </Box>
  );
}

interface TodoItemRowProps {
  todo: TodoItem;
}

function TodoItemRow({ todo }: TodoItemRowProps): React.ReactElement {
  const statusEmoji = emoji[todo.status] || "•";
  const isFinished = todo.status === "completed" || todo.status === "cancelled";

  const badgeColor = {
    pending: "gray" as const,
    in_progress: "yellow" as const,
    completed: "green" as const,
    cancelled: "red" as const,
  }[todo.status];

  return (
    <Box paddingLeft={2}>
      <Text>{statusEmoji} </Text>
      <Badge color={badgeColor}>
        {todo.status.replace("_", " ")}
      </Badge>
      <Text> </Text>
      {isFinished ? (
        <Text strikethrough dimColor>
          {todo.content}
        </Text>
      ) : (
        <Text>{todo.content}</Text>
      )}
    </Box>
  );
}

/**
 * Compact todo change notification.
 */
interface TodosChangedProps {
  todos: TodoItem[];
}

export function TodosChanged({ todos }: TodosChangedProps): React.ReactElement {
  const completed = todos.filter((t) => t.status === "completed").length;
  const total = todos.length;

  return (
    <Box marginY={1}>
      <Text color={colors.info}>
        {emoji.todo} Todos updated ({completed}/{total} done)
      </Text>
    </Box>
  );
}

