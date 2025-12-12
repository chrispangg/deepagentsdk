/**
 * Unit tests for approval utility functions.
 */
import { test, expect, describe } from "bun:test";
import { applyInterruptConfig, hasApprovalTools } from "./approval";
import { tool } from "ai";
import { z } from "zod";

// Create a mock tool for testing using AI SDK v6 tool() API
const createMockTool = (name: string) =>
  tool({
    description: `Test tool: ${name}`,
    inputSchema: z.object({ arg: z.string() }),
    execute: async ({ arg }) => `Result: ${arg}`,
  });

describe("applyInterruptConfig", () => {
  test("returns tools unchanged when interruptOn is undefined", () => {
    const tools = {
      test_tool: createMockTool("test"),
    };

    const result = applyInterruptConfig(tools, undefined);

    expect(result).toBe(tools);
  });

  test("returns tools unchanged when interruptOn is empty", () => {
    const tools = {
      test_tool: createMockTool("test"),
    };

    const result = applyInterruptConfig(tools, {});

    // Should be a new object but tools unchanged
    expect(result.test_tool).toBe(tools.test_tool);
  });

  test("adds needsApproval: true for boolean true config", () => {
    const tools = {
      write_file: createMockTool("write_file"),
      read_file: createMockTool("read_file"),
    };

    const result = applyInterruptConfig(tools, { write_file: true });

    expect(result.write_file!.needsApproval).toBe(true);
    expect(result.read_file!.needsApproval).toBeUndefined();
  });

  test("does not add needsApproval for boolean false config", () => {
    const tools = {
      write_file: createMockTool("write_file"),
    };

    const result = applyInterruptConfig(tools, { write_file: false });

    expect(result.write_file!.needsApproval).toBeUndefined();
  });

  test("adds needsApproval function for DynamicApprovalConfig", () => {
    const shouldApprove = (args: unknown) => {
      const typedArgs = args as { arg: string };
      return typedArgs.arg.includes("dangerous");
    };

    const tools = {
      execute: createMockTool("execute"),
    };

    const result = applyInterruptConfig(tools, {
      execute: { shouldApprove },
    });

    expect(result.execute!.needsApproval).toBe(shouldApprove);
  });

  test("defaults to true when DynamicApprovalConfig has no shouldApprove", () => {
    const tools = {
      execute: createMockTool("execute"),
    };

    const result = applyInterruptConfig(tools, {
      execute: {}, // Empty DynamicApprovalConfig
    });

    expect(result.execute!.needsApproval).toBe(true);
  });

  test("handles multiple tools with mixed configs", () => {
    const shouldApprove = () => true;

    const tools = {
      write_file: createMockTool("write_file"),
      edit_file: createMockTool("edit_file"),
      read_file: createMockTool("read_file"),
      execute: createMockTool("execute"),
    };

    const result = applyInterruptConfig(tools, {
      write_file: true,
      edit_file: { shouldApprove },
      read_file: false,
      // execute not specified
    });

    expect(result.write_file!.needsApproval).toBe(true);
    expect(result.edit_file!.needsApproval).toBe(shouldApprove);
    expect(result.read_file!.needsApproval).toBeUndefined();
    expect(result.execute!.needsApproval).toBeUndefined();
  });

  test("preserves original tool properties", () => {
    const originalTool = createMockTool("test");
    const tools = { test: originalTool };

    const result = applyInterruptConfig(tools, { test: true });

    expect(result.test!.description).toBe(originalTool.description);
    // Use inputSchema instead of parameters (AI SDK v6 naming)
    expect(result.test!.inputSchema).toBe(originalTool.inputSchema);
    expect(result.test!.execute).toBe(originalTool.execute);
  });
});

describe("hasApprovalTools", () => {
  test("returns false when interruptOn is undefined", () => {
    expect(hasApprovalTools(undefined)).toBe(false);
  });

  test("returns false when interruptOn is empty", () => {
    expect(hasApprovalTools({})).toBe(false);
  });

  test("returns false when all values are false", () => {
    expect(
      hasApprovalTools({
        write_file: false,
        edit_file: false,
      })
    ).toBe(false);
  });

  test("returns true when any value is true", () => {
    expect(
      hasApprovalTools({
        write_file: true,
        edit_file: false,
      })
    ).toBe(true);
  });

  test("returns true when any value is DynamicApprovalConfig", () => {
    expect(
      hasApprovalTools({
        execute: { shouldApprove: () => true },
      })
    ).toBe(true);
  });

  test("returns true for mixed configs with at least one truthy", () => {
    expect(
      hasApprovalTools({
        write_file: false,
        edit_file: true,
        execute: { shouldApprove: () => false },
      })
    ).toBe(true);
  });
});
