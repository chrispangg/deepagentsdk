/**
 * Unit tests for approval utility functions.
 */
import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { applyInterruptConfig, hasApprovalTools } from "@/utils/approval";
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

    assert.strictEqual(result, tools);
  });

  test("returns tools unchanged when interruptOn is empty", () => {
    const tools = {
      test_tool: createMockTool("test"),
    };

    const result = applyInterruptConfig(tools, {});

    // Should be a new object but tools unchanged
    assert.strictEqual(result.test_tool, tools.test_tool);
  });

  test("adds needsApproval: true for boolean true config", () => {
    const tools = {
      write_file: createMockTool("write_file"),
      read_file: createMockTool("read_file"),
    };

    const result = applyInterruptConfig(tools, { write_file: true });

    assert.strictEqual(result.write_file!.needsApproval, true);
    assert.strictEqual(result.read_file!.needsApproval, undefined);
  });

  test("does not add needsApproval for boolean false config", () => {
    const tools = {
      write_file: createMockTool("write_file"),
    };

    const result = applyInterruptConfig(tools, { write_file: false });

    assert.strictEqual(result.write_file!.needsApproval, undefined);
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

    assert.strictEqual(result.execute!.needsApproval, shouldApprove);
  });

  test("defaults to true when DynamicApprovalConfig has no shouldApprove", () => {
    const tools = {
      execute: createMockTool("execute"),
    };

    const result = applyInterruptConfig(tools, {
      execute: {}, // Empty DynamicApprovalConfig
    });

    assert.strictEqual(result.execute!.needsApproval, true);
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

    assert.strictEqual(result.write_file!.needsApproval, true);
    assert.strictEqual(result.edit_file!.needsApproval, shouldApprove);
    assert.strictEqual(result.read_file!.needsApproval, undefined);
    assert.strictEqual(result.execute!.needsApproval, undefined);
  });

  test("preserves original tool properties", () => {
    const originalTool = createMockTool("test");
    const tools = { test: originalTool };

    const result = applyInterruptConfig(tools, { test: true });

    assert.strictEqual(result.test!.description, originalTool.description);
    // Use inputSchema instead of parameters (AI SDK v6 naming)
    assert.strictEqual(result.test!.inputSchema, originalTool.inputSchema);
    assert.strictEqual(result.test!.execute, originalTool.execute);
  });
});

describe("hasApprovalTools", () => {
  test("returns false when interruptOn is undefined", () => {
    assert.strictEqual(hasApprovalTools(undefined), false);
  });

  test("returns false when interruptOn is empty", () => {
    assert.strictEqual(hasApprovalTools({}), false);
  });

  test("returns false when all values are false", () => {
    assert.strictEqual(
      hasApprovalTools({
        write_file: false,
        edit_file: false,
      })
    , false);
  });

  test("returns true when any value is true", () => {
    assert.strictEqual(
      hasApprovalTools({
        write_file: true,
        edit_file: false,
      })
    , true);
  });

  test("returns true when any value is DynamicApprovalConfig", () => {
    assert.strictEqual(
      hasApprovalTools({
        execute: { shouldApprove: () => true },
      })
    , true);
  });

  test("returns true for mixed configs with at least one truthy", () => {
    assert.strictEqual(
      hasApprovalTools({
        write_file: false,
        edit_file: true,
        execute: { shouldApprove: () => false },
      })
    , true);
  });
});
