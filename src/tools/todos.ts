/**
 * Todo list tool for task planning and tracking.
 */

import { tool } from "ai";
import { z } from "zod";
import type { DeepAgentState, TodoItem, EventCallback } from "../types";

const TodoItemSchema = z.object({
  id: z.string().describe("Unique identifier for the todo item"),
  content: z
    .string()
    .max(100)
    .describe("The description/content of the todo item (max 100 chars)"),
  status: z
    .enum(["pending", "in_progress", "completed", "cancelled"])
    .describe("The current status of the todo item"),
});

/**
 * Create the write_todos tool for task planning.
 * @param state - The shared agent state
 * @param onEvent - Optional callback for emitting events
 */
export function createTodosTool(state: DeepAgentState, onEvent?: EventCallback) {
  return tool({
    description: `Manage and plan tasks using a structured todo list. Use this tool for:
- Complex multi-step tasks (3+ steps)
- After receiving new instructions - capture requirements
- When starting tasks - mark as in_progress (only one at a time)
- After completing tasks - mark complete immediately

Task states: pending, in_progress, completed, cancelled

When merge=true, updates are merged with existing todos by id.
When merge=false, the new todos replace all existing todos.`,
    inputSchema: z.object({
      todos: z
        .array(TodoItemSchema)
        .min(1)
        .describe("Array of todo items to write"),
      merge: z
        .boolean()
        .default(true)
        .describe(
          "Whether to merge with existing todos (true) or replace all (false)"
        ),
    }),
    execute: async ({ todos, merge }) => {
      if (merge) {
        // Merge by id
        const existingMap = new Map<string, TodoItem>();
        for (const todo of state.todos) {
          existingMap.set(todo.id, todo);
        }

        for (const newTodo of todos) {
          const existing = existingMap.get(newTodo.id);
          if (existing) {
            // Update existing todo
            existingMap.set(newTodo.id, {
              ...existing,
              ...newTodo,
            });
          } else {
            // Add new todo
            existingMap.set(newTodo.id, newTodo);
          }
        }

        state.todos = Array.from(existingMap.values());
      } else {
        // Replace all
        state.todos = todos;
      }

      // Emit event if callback provided
      if (onEvent) {
        onEvent({
          type: "todos-changed",
          todos: [...state.todos],
        });
      }

      // Format current todo list for response
      const todoList = state.todos
        .map((t) => `- [${t.status}] ${t.id}: ${t.content}`)
        .join("\n");

      return `Todo list updated successfully.\n\nCurrent todos:\n${todoList}`;
    },
  });
}
