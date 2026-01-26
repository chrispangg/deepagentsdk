/**
 * Tests for src/backends/utils.ts utility functions
 */

import { test, describe } from "node:test";
import assert from "node:assert/strict";
import type { FileData } from "@/types";
import {
  formatContentWithLineNumbers,
  checkEmptyContent,
  fileDataToString,
  createFileData,
  updateFileData,
  formatReadResponse,
  performStringReplacement,
  validatePath,
  globSearchFiles,
  grepMatchesFromFiles,
} from "@/backends/utils";

describe("backends/utils", () => {
  describe("formatContentWithLineNumbers", () => {
    test("should format single line with line number", () => {
      const result = formatContentWithLineNumbers("hello world");
      assert.strictEqual(result, "     1\thello world");
    });

    test("should format multiple lines with line numbers", () => {
      const result = formatContentWithLineNumbers("line1\nline2\nline3");
      assert.strictEqual(result, "     1\tline1\n     2\tline2\n     3\tline3");
    });

    test("should handle string array input", () => {
      const result = formatContentWithLineNumbers(["line1", "line2"]);
      assert.strictEqual(result, "     1\tline1\n     2\tline2");
    });

    test("should handle empty string", () => {
      const result = formatContentWithLineNumbers("");
      assert.strictEqual(result, "");
    });

    test("should handle single newline", () => {
      const result = formatContentWithLineNumbers("\n");
      // A single newline produces one empty line with line number
      assert.strictEqual(result, "     1\t");
    });

    test("should start from custom line number", () => {
      const result = formatContentWithLineNumbers("line1\nline2", 10);
      assert.strictEqual(result, "    10\tline1\n    11\tline2");
    });

    test("should split long lines into chunks", () => {
      const longLine = "a".repeat(12000);
      const result = formatContentWithLineNumbers(longLine);
      const lines = result.split("\n");
      assert.ok(lines.length > 1);
      assert.ok(lines[0]);
      assert.ok(lines[1]);
      assert.match(lines[0], /^\s+1\t/);
      assert.match(lines[1], /^\s+1\.1\t/);
    });

    test("should handle empty lines in content", () => {
      const result = formatContentWithLineNumbers("line1\n\nline3");
      assert.strictEqual(result, "     1\tline1\n     2\t\n     3\tline3");
    });
  });

  describe("checkEmptyContent", () => {
    test("should return warning for empty string", () => {
      const result = checkEmptyContent("");
      assert.strictEqual(result, "System reminder: File exists but has empty contents");
    });

    test("should return warning for whitespace-only string", () => {
      const result = checkEmptyContent("   \n\t  ");
      assert.strictEqual(result, "System reminder: File exists but has empty contents");
    });

    test("should return null for non-empty content", () => {
      const result = checkEmptyContent("hello world");
      assert.strictEqual(result, null);
    });

    test("should return null for content with leading/trailing whitespace", () => {
      const result = checkEmptyContent("  hello  ");
      assert.strictEqual(result, null);
    });
  });

  describe("fileDataToString", () => {
    test("should join content array with newlines", () => {
      const fileData: FileData = {
        content: ["line1", "line2", "line3"],
        created_at: "2024-01-01T00:00:00.000Z",
        modified_at: "2024-01-01T00:00:00.000Z",
      };
      const result = fileDataToString(fileData);
      assert.strictEqual(result, "line1\nline2\nline3");
    });

    test("should handle single line", () => {
      const fileData: FileData = {
        content: ["single line"],
        created_at: "2024-01-01T00:00:00.000Z",
        modified_at: "2024-01-01T00:00:00.000Z",
      };
      const result = fileDataToString(fileData);
      assert.strictEqual(result, "single line");
    });

    test("should handle empty content", () => {
      const fileData: FileData = {
        content: [],
        created_at: "2024-01-01T00:00:00.000Z",
        modified_at: "2024-01-01T00:00:00.000Z",
      };
      const result = fileDataToString(fileData);
      assert.strictEqual(result, "");
    });
  });

  describe("createFileData", () => {
    test("should create FileData from string content", () => {
      const result = createFileData("line1\nline2");
      assert.deepStrictEqual(result.content, ["line1", "line2"]);
      assert.ok(result.created_at);
      assert.ok(result.modified_at);
    });

    test("should use provided createdAt timestamp", () => {
      const customTime = "2023-01-01T00:00:00.000Z";
      const result = createFileData("content", customTime);
      assert.strictEqual(result.created_at, customTime);
      assert.notStrictEqual(result.modified_at, customTime); // Should be now
    });

    test("should handle single line content", () => {
      const result = createFileData("single line");
      assert.deepStrictEqual(result.content, ["single line"]);
    });

    test("should handle empty string", () => {
      const result = createFileData("");
      assert.deepStrictEqual(result.content, [""]);
    });
  });

  describe("updateFileData", () => {
    test("should update content and preserve created_at", async () => {
      const original = createFileData("original", "2023-01-01T00:00:00.000Z");
      // Add small delay to ensure different timestamps
      await new Promise(resolve => setTimeout(resolve, 2));
      const updated = updateFileData(original, "new content");
      assert.deepStrictEqual(updated.content, ["new content"]);
      assert.strictEqual(updated.created_at, "2023-01-01T00:00:00.000Z");
      assert.match(updated.modified_at, /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
    });

    test("should update content from string", () => {
      const original = createFileData("old");
      const updated = updateFileData(original, "line1\nline2");
      assert.deepStrictEqual(updated.content, ["line1", "line2"]);
    });
  });

  describe("formatReadResponse", () => {
    test("should return empty warning for empty file", () => {
      const fileData: FileData = {
        content: [],
        created_at: "2024-01-01T00:00:00.000Z",
        modified_at: "2024-01-01T00:00:00.000Z",
      };
      const result = formatReadResponse(fileData, 0, 100);
      assert.strictEqual(result, "System reminder: File exists but has empty contents");
    });

    test("should format content with line numbers", () => {
      const fileData: FileData = {
        content: ["line1", "line2", "line3"],
        created_at: "2024-01-01T00:00:00.000Z",
        modified_at: "2024-01-01T00:00:00.000Z",
      };
      const result = formatReadResponse(fileData, 0, 10);
      assert.ok(result.includes("     1\tline1"));
      assert.ok(result.includes("     2\tline2"));
      assert.ok(result.includes("     3\tline3"));
    });

    test("should apply offset", () => {
      const fileData: FileData = {
        content: ["a", "b", "c", "d", "e"],
        created_at: "2024-01-01T00:00:00.000Z",
        modified_at: "2024-01-01T00:00:00.000Z",
      };
      const result = formatReadResponse(fileData, 2, 2);
      assert.strictEqual(result, "     3\tc\n     4\td");
    });

    test("should apply limit", () => {
      const fileData: FileData = {
        content: ["a", "b", "c", "d", "e"],
        created_at: "2024-01-01T00:00:00.000Z",
        modified_at: "2024-01-01T00:00:00.000Z",
      };
      const result = formatReadResponse(fileData, 0, 3);
      assert.strictEqual(result, "     1\ta\n     2\tb\n     3\tc");
    });

    test("should return error for offset exceeding file length", () => {
      const fileData: FileData = {
        content: ["a", "b", "c"],
        created_at: "2024-01-01T00:00:00.000Z",
        modified_at: "2024-01-01T00:00:00.000Z",
      };
      const result = formatReadResponse(fileData, 10, 10);
      assert.ok(result.includes("Error: Line offset 10 exceeds file length"));
    });
  });

  describe("performStringReplacement", () => {
    test("should replace single occurrence", () => {
      const result = performStringReplacement("hello world", "world", "there", false);
      assert.deepStrictEqual(result, ["hello there", 1]);
    });

    test("should replace all occurrences when replaceAll is true", () => {
      const result = performStringReplacement("a b a b a", "a", "x", true);
      assert.deepStrictEqual(result, ["x b x b x", 3]);
    });

    test("should return error for single occurrence without replaceAll flag", () => {
      const result = performStringReplacement("a b a b", "a", "x", false);
      assert.strictEqual(typeof result, "string");
      if (typeof result === "string") {
        assert.ok(result.includes("appears 2 times"));
      }
    });

    test("should return error when string not found", () => {
      const result = performStringReplacement("hello world", "goodbye", "hi", false);
      assert.strictEqual(result, "Error: String not found in file: 'goodbye'");
    });

    test("should handle empty string replacement", () => {
      const result = performStringReplacement("hello world", "world", "", false);
      assert.deepStrictEqual(result, ["hello ", 1]);
    });

    test("should handle special regex characters", () => {
      const result = performStringReplacement("price: $100", "$100", "$200", false);
      assert.deepStrictEqual(result, ["price: $200", 1]);
    });
  });

  describe("validatePath", () => {
    test("should normalize path without leading slash", () => {
      const result = validatePath("home/user");
      assert.strictEqual(result, "/home/user/");
    });

    test("should add trailing slash if missing", () => {
      const result = validatePath("/home/user");
      assert.strictEqual(result, "/home/user/");
    });

    test("should keep existing trailing slash", () => {
      const result = validatePath("/home/user/");
      assert.strictEqual(result, "/home/user/");
    });

    test("should default to root for empty string", () => {
      const result = validatePath("");
      assert.strictEqual(result, "/");
    });

    test("should default to root for null", () => {
      const result = validatePath(null);
      assert.strictEqual(result, "/");
    });

    test("should default to root for undefined", () => {
      const result = validatePath(undefined);
      assert.strictEqual(result, "/");
    });

    test("should throw error for whitespace-only path", () => {
      assert.throws(() => validatePath("   "), /Path cannot be empty/);
    });
  });

  describe("globSearchFiles", () => {
    const files: Record<string, FileData> = {
      "/src/index.ts": {
        content: ["// index"],
        created_at: "2024-01-01T00:00:00.000Z",
        modified_at: "2024-01-02T00:00:00.000Z",
      },
      "/src/utils.ts": {
        content: ["// utils"],
        created_at: "2024-01-01T00:00:00.000Z",
        modified_at: "2024-01-02T00:00:00.000Z",
      },
      "/test/index.test.ts": {
        content: ["// test"],
        created_at: "2024-01-01T00:00:00.000Z",
        modified_at: "2024-01-02T00:00:00.000Z",
      },
    };

    test("should find files matching pattern", () => {
      const result = globSearchFiles(files, "*.ts", "/src");
      assert.ok(result.includes("/src/index.ts"));
      assert.ok(result.includes("/src/utils.ts"));
      assert.ok(!result.includes("/test/index.test.ts"));
    });

    test("should find files recursively with **", () => {
      const result = globSearchFiles(files, "**/*.ts");
      assert.ok(result.includes("/src/index.ts"));
      assert.ok(result.includes("/src/utils.ts"));
      assert.ok(result.includes("/test/index.test.ts"));
    });

    test("should return 'No files found' for no matches", () => {
      const result = globSearchFiles(files, "*.js", "/src");
      assert.strictEqual(result, "No files found");
    });

    test("should handle dot files with dot:true", () => {
      const filesWithDot: Record<string, FileData> = {
        "/src/.env": {
          content: ["SECRET=xxx"],
          created_at: "2024-01-01T00:00:00.000Z",
          modified_at: "2024-01-02T00:00:00.000Z",
        },
      };
      const result = globSearchFiles(filesWithDot, ".*", "/src");
      assert.ok(result.includes("/src/.env"));
    });
  });

  describe("grepMatchesFromFiles", () => {
    const files: Record<string, FileData> = {
      "/src/index.ts": {
        content: ["export function foo() {}", "export function bar() {}"],
        created_at: "2024-01-01T00:00:00.000Z",
        modified_at: "2024-01-02T00:00:00.000Z",
      },
      "/src/utils.ts": {
        content: ["import { foo } from './index'", "export const baz = 1"],
        created_at: "2024-01-01T00:00:00.000Z",
        modified_at: "2024-01-02T00:00:00.000Z",
      },
    };

    test("should find pattern matches across files", () => {
      const result = grepMatchesFromFiles(files, "function");
      assert.ok(Array.isArray(result));
      if (Array.isArray(result)) {
        assert.ok(result.length > 0);
        assert.ok(Object.prototype.hasOwnProperty.call(result[0], "path"));
        assert.ok(Object.prototype.hasOwnProperty.call(result[0], "line"));
        assert.ok(Object.prototype.hasOwnProperty.call(result[0], "text"));
      }
    });

    test("should filter by path prefix", () => {
      const result = grepMatchesFromFiles(files, "function", "/src");
      assert.ok(Array.isArray(result));
      if (Array.isArray(result)) {
        assert.strictEqual(result.length, 2); // Both files match
      }
    });

    test("should filter by glob pattern", () => {
      const result = grepMatchesFromFiles(files, "export", null, "*.ts");
      assert.ok(Array.isArray(result));
      if (Array.isArray(result)) {
        assert.ok(result.length > 0);
      }
    });

    test("should return error for invalid regex", () => {
      const result = grepMatchesFromFiles(files, "[invalid");
      assert.strictEqual(typeof result, "string");
      if (typeof result === "string") {
        assert.ok(result.includes("Invalid regex pattern"));
      }
    });

    test("should return empty array for no matches", () => {
      const result = grepMatchesFromFiles(files, "nonexistent");
      assert.ok(Array.isArray(result));
      if (Array.isArray(result)) {
        assert.strictEqual(result.length, 0);
      }
    });

    test("should handle special regex characters", () => {
      const result = grepMatchesFromFiles(files, "export\\s+function");
      assert.ok(Array.isArray(result));
      if (Array.isArray(result)) {
        assert.ok(result.length > 0);
      }
    });
  });
});

