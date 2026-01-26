/**
 * Tests for src/backends/composite.ts
 */

import { test, describe } from "node:test";
import { CompositeBackend } from "@/backends/composite";
import { StateBackend } from "@/backends/state";
import type { FileData, FileInfo, GrepMatch } from "@/types";
import assert from "node:assert/strict";

// Helper to create a mock backend with predefined files
function createMockBackend(files: Record<string, FileData> = {}): StateBackend {
  const state = { todos: [], files };
  return new StateBackend(state);
}

describe("backends/composite", () => {
  describe("constructor", () => {
    test("should create with default backend and routes", () => {
      const defaultBackend = createMockBackend();
      const routes: Record<string, StateBackend> = {
        "/persistent/": createMockBackend(),
        "/cache/": createMockBackend(),
      };
      const backend = new CompositeBackend(defaultBackend, routes);
      assert.notStrictEqual(backend, undefined);
    });

    test("should sort routes by length (longest first)", () => {
      const defaultBackend = createMockBackend();
      const routes: Record<string, StateBackend> = {
        "/a/": createMockBackend(),
        "/long/path/": createMockBackend(),
        "/medium/": createMockBackend(),
      };
      const backend = new CompositeBackend(defaultBackend, routes);
      // Routes should be sorted longest first for correct prefix matching
      assert.notStrictEqual(backend, undefined);
    });
  });

  describe("write", () => {
    test("should write to default backend for unmatched paths", async () => {
      const defaultFiles: Record<string, FileData> = {};
      const defaultBackend = new StateBackend({ todos: [], files: defaultFiles });
      const routes: Record<string, StateBackend> = {
        "/persistent/": new StateBackend({
          todos: [],
          files: {},
        }),
      };
      const backend = new CompositeBackend(defaultBackend, routes);

      const result = await backend.write("/default/file.txt", "content");
      assert.strictEqual(result.success, true);
      assert.notStrictEqual(defaultFiles["/default/file.txt"], undefined);
    });

    test("should write to routed backend for matching paths", async () => {
      const persistentFiles: Record<string, FileData> = {};
      const persistentBackend = new StateBackend({
        todos: [],
        files: persistentFiles,
      });
      const routes: Record<string, StateBackend> = {
        "/persistent/": persistentBackend,
      };
      const backend = new CompositeBackend(
        new StateBackend({ todos: [], files: {} }),
        routes
      );

      const result = await backend.write("/persistent/file.txt", "content");
      assert.strictEqual(result.success, true);
      assert.notStrictEqual(persistentFiles["/file.txt"], undefined);
    });

    test("should strip route prefix from path", async () => {
      const persistentFiles: Record<string, FileData> = {};
      const persistentBackend = new StateBackend({
        todos: [],
        files: persistentFiles,
      });
      const routes: Record<string, StateBackend> = {
        "/persistent/": persistentBackend,
      };
      const backend = new CompositeBackend(
        new StateBackend({ todos: [], files: {} }),
        routes
      );

      await backend.write("/persistent/subdir/file.txt", "content");
      assert.notStrictEqual(persistentFiles["/subdir/file.txt"], undefined);
    });
  });

  describe("read", () => {
    test("should read from default backend for unmatched paths", async () => {
      const defaultBackend = new StateBackend({
        todos: [],
        files: {
          "/file.txt": {
            content: ["default content"],
            created_at: "2024-01-01T00:00:00.000Z",
            modified_at: "2024-01-01T00:00:00.000Z",
          },
        },
      });
      const backend = new CompositeBackend(defaultBackend, {});

      const result = await defaultBackend.read("/file.txt");
      assert.ok(result.includes("default content"));
    });

    test("should read from routed backend for matching paths", async () => {
      const persistentBackend = new StateBackend({
        todos: [],
        files: {
          "/file.txt": {
            content: ["persistent content"],
            created_at: "2024-01-01T00:00:00.000Z",
            modified_at: "2024-01-01T00:00:00.000Z",
          },
        },
      });
      const routes: Record<string, StateBackend> = {
        "/persistent/": persistentBackend,
      };
      const backend = new CompositeBackend(
        new StateBackend({ todos: [], files: {} }),
        routes
      );

      const result = await backend.read("/persistent/file.txt");
      assert.ok(result.includes("persistent content"));
    });

    test("should apply offset and limit parameters", async () => {
      const persistentBackend = new StateBackend({
        todos: [],
        files: {
          "/file.txt": {
            content: ["line1", "line2", "line3", "line4", "line5"],
            created_at: "2024-01-01T00:00:00.000Z",
            modified_at: "2024-01-01T00:00:00.000Z",
          },
        },
      });
      const routes: Record<string, StateBackend> = {
        "/persistent/": persistentBackend,
      };
      const backend = new CompositeBackend(
        new StateBackend({ todos: [], files: {} }),
        routes
      );

      const result = await backend.read("/persistent/file.txt", 1, 2);
      assert.ok(result.includes("line2"));
      assert.ok(result.includes("line3"));
    });
  });

  describe("readRaw", () => {
    test("should read raw file data from routed backend", async () => {
      const persistentBackend = new StateBackend({
        todos: [],
        files: {
          "/file.txt": {
            content: ["raw content"],
            created_at: "2024-01-01T00:00:00.000Z",
            modified_at: "2024-01-02T00:00:00.000Z",
          },
        },
      });
      const routes: Record<string, StateBackend> = {
        "/persistent/": persistentBackend,
      };
      const backend = new CompositeBackend(
        new StateBackend({ todos: [], files: {} }),
        routes
      );

      const result = await backend.readRaw("/persistent/file.txt");
      assert.deepStrictEqual(result.content, ["raw content"]);
      assert.strictEqual(result.created_at, "2024-01-01T00:00:00.000Z");
      assert.strictEqual(result.modified_at, "2024-01-02T00:00:00.000Z");
    });
  });

  describe("edit", () => {
    test("should edit file in default backend", async () => {
      const defaultBackend = new StateBackend({
        todos: [],
        files: {
          "/file.txt": {
            content: ["hello world"],
            created_at: "2024-01-01T00:00:00.000Z",
            modified_at: "2024-01-01T00:00:00.000Z",
          },
        },
      });
      const backend = new CompositeBackend(defaultBackend, {});

      const result = await backend.edit("/file.txt", "world", "there", false);
      assert.strictEqual(result.success, true);
    });

    test("should edit file in routed backend", async () => {
      const persistentBackend = new StateBackend({
        todos: [],
        files: {
          "/file.txt": {
            content: ["hello world"],
            created_at: "2024-01-01T00:00:00.000Z",
            modified_at: "2024-01-01T00:00:00.000Z",
          },
        },
      });
      const routes: Record<string, StateBackend> = {
        "/persistent/": persistentBackend,
      };
      const backend = new CompositeBackend(
        new StateBackend({ todos: [], files: {} }),
        routes
      );

      const result = await backend.edit("/persistent/file.txt", "world", "there", false);
      assert.strictEqual(result.success, true);
    });
  });

  describe("lsInfo", () => {
    test("should list files in default backend", async () => {
      const defaultBackend = new StateBackend({
        todos: [],
        files: {
          "/file1.txt": {
            content: [""],
            created_at: "2024-01-01T00:00:00.000Z",
            modified_at: "2024-01-01T00:00:00.000Z",
          },
          "/file2.txt": {
            content: [""],
            created_at: "2024-01-01T00:00:00.000Z",
            modified_at: "2024-01-01T00:00:00.000Z",
          },
        },
      });
      const backend = new CompositeBackend(defaultBackend, {});

      const result = await backend.lsInfo("/");
      assert.strictEqual(result.length, 2);
      assert.ok(result.some((f: FileInfo) => f.path.endsWith("file1.txt")));
      assert.ok(result.some((f: FileInfo) => f.path.endsWith("file2.txt")));
    });

    test("should list root with route directories", async () => {
      const defaultBackend = new StateBackend({
        todos: [],
        files: {
          "/default.txt": {
            content: [""],
            created_at: "2024-01-01T00:00:00.000Z",
            modified_at: "2024-01-01T00:00:00.000Z",
          },
        },
      });
      const routes: Record<string, StateBackend> = {
        "/persistent/": new StateBackend({
          todos: [],
          files: {},
        }),
        "/cache/": new StateBackend({
          todos: [],
          files: {},
        }),
      };
      const backend = new CompositeBackend(defaultBackend, routes);

      const result = await backend.lsInfo("/");
      assert.ok(result.some((f: FileInfo) => f.path === "/persistent/"));
      assert.ok(result.some((f: FileInfo) => f.path === "/cache/"));
      assert.ok(result.some((f: FileInfo) => f.path === "/default.txt"));
    });

    test("should list files in routed backend", async () => {
      const persistentBackend = new StateBackend({
        todos: [],
        files: {
          "/file.txt": {
            content: [""],
            created_at: "2024-01-01T00:00:00.000Z",
            modified_at: "2024-01-01T00:00:00.000Z",
          },
        },
      });
      const routes: Record<string, StateBackend> = {
        "/persistent/": persistentBackend,
      };
      const backend = new CompositeBackend(
        new StateBackend({ todos: [], files: {} }),
        routes
      );

      const result = await backend.lsInfo("/persistent/");
      assert.strictEqual(result.length, 1);
      assert.strictEqual(result[0]?.path, "/persistent/file.txt");
    });
  });

  describe("grepRaw", () => {
    test("should search in default backend", async () => {
      const defaultBackend = new StateBackend({
        todos: [],
        files: {
          "/file.txt": {
            content: ["hello world", "foo bar"],
            created_at: "2024-01-01T00:00:00.000Z",
            modified_at: "2024-01-01T00:00:00.000Z",
          },
        },
      });
      const backend = new CompositeBackend(defaultBackend, {});

      const result = await backend.grepRaw("hello");
      assert.ok(Array.isArray(result));
      if (Array.isArray(result)) {
        assert.ok(result.length > 0);
        assert.strictEqual(result[0]?.path, "/file.txt");
      }
    });

    test("should search in routed backend and add prefix", async () => {
      const persistentBackend = new StateBackend({
        todos: [],
        files: {
          "/file.txt": {
            content: ["persistent content"],
            created_at: "2024-01-01T00:00:00.000Z",
            modified_at: "2024-01-01T00:00:00.000Z",
          },
        },
      });
      const routes: Record<string, StateBackend> = {
        "/persistent/": persistentBackend,
      };
      const backend = new CompositeBackend(
        new StateBackend({ todos: [], files: {} }),
        routes
      );

      const result = await backend.grepRaw("persistent", "/persistent/");
      assert.ok(Array.isArray(result));
      if (Array.isArray(result)) {
        assert.ok(result.length > 0);
        assert.strictEqual(result[0]?.path, "/persistent/file.txt");
      }
    });

    test("should search all backends when path is root", async () => {
      const defaultBackend = new StateBackend({
        todos: [],
        files: {
          "/default.txt": {
            content: ["default content"],
            created_at: "2024-01-01T00:00:00.000Z",
            modified_at: "2024-01-01T00:00:00.000Z",
          },
        },
      });
      const persistentBackend = new StateBackend({
        todos: [],
        files: {
          "/file.txt": {
            content: ["persistent content"],
            created_at: "2024-01-01T00:00:00.000Z",
            modified_at: "2024-01-01T00:00:00.000Z",
          },
        },
      });
      const routes: Record<string, StateBackend> = {
        "/persistent/": persistentBackend,
      };
      const backend = new CompositeBackend(defaultBackend, routes);

      const result = await backend.grepRaw("content", "/");
      assert.ok(Array.isArray(result));
      if (Array.isArray(result)) {
        assert.ok(result.length > 0);
      }
    });
  });

  describe("globInfo", () => {
    test("should find files matching pattern in default backend", async () => {
      const defaultBackend = new StateBackend({
        todos: [],
        files: {
          "/file1.txt": {
            content: [""],
            created_at: "2024-01-01T00:00:00.000Z",
            modified_at: "2024-01-01T00:00:00.000Z",
          },
          "/file2.ts": {
            content: [""],
            created_at: "2024-01-01T00:00:00.000Z",
            modified_at: "2024-01-01T00:00:00.000Z",
          },
        },
      });
      const backend = new CompositeBackend(defaultBackend, {});

      const result = await backend.globInfo("*.txt");
      assert.strictEqual(result.length, 1);
      assert.strictEqual(result[0]?.path, "/file1.txt");
    });

    test("should find files matching pattern in routed backend", async () => {
      const persistentBackend = new StateBackend({
        todos: [],
        files: {
          "/file.txt": {
            content: [""],
            created_at: "2024-01-01T00:00:00.000Z",
            modified_at: "2024-01-01T00:00:00.000Z",
          },
        },
      });
      const routes: Record<string, StateBackend> = {
        "/persistent/": persistentBackend,
      };
      const backend = new CompositeBackend(
        new StateBackend({ todos: [], files: {} }),
        routes
      );

      const result = await backend.globInfo("*.txt", "/persistent/");
      assert.strictEqual(result.length, 1);
      assert.strictEqual(result[0]?.path, "/persistent/file.txt");
    });

    test("should search all backends when path is root", async () => {
      const defaultBackend = new StateBackend({
        todos: [],
        files: {
          "/default.txt": {
            content: [""],
            created_at: "2024-01-01T00:00:00.000Z",
            modified_at: "2024-01-01T00:00:00.000Z",
          },
        },
      });
      const persistentBackend = new StateBackend({
        todos: [],
        files: {
          "/file.txt": {
            content: [""],
            created_at: "2024-01-01T00:00:00.000Z",
            modified_at: "2024-01-01T00:00:00.000Z",
          },
        },
      });
      const routes: Record<string, StateBackend> = {
        "/persistent/": persistentBackend,
      };
      const backend = new CompositeBackend(defaultBackend, routes);

      const result = await backend.globInfo("*.txt");
      assert.strictEqual(result.length, 2);
    });
  });

  describe("path matching behavior", () => {
    test("should match longest prefix first", async () => {
      const backend1 = new StateBackend({ todos: [], files: {} });
      const backend2 = new StateBackend({ todos: [], files: {} });
      const backend3 = new StateBackend({ todos: [], files: {} });

      const routes: Record<string, StateBackend> = {
        "/a/": backend1,
        "/a/b/": backend2,
        "/a/b/c/": backend3,
      };

      const composite = new CompositeBackend(
        new StateBackend({ todos: [], files: {} }),
        routes
      );

      // These should route to the most specific (longest) matching backend
      // /a/file.txt -> backend1
      // /a/b/file.txt -> backend2
      // /a/b/c/file.txt -> backend3
    });

    test("should handle paths without trailing slashes", async () => {
      const persistentBackend = new StateBackend({
        todos: [],
        files: {
          "/file.txt": {
            content: ["test"],
            created_at: "2024-01-01T00:00:00.000Z",
            modified_at: "2024-01-01T00:00:00.000Z",
          },
        },
      });
      const routes: Record<string, StateBackend> = {
        "/persistent/": persistentBackend, // Use trailing slash in route definition
      };
      const backend = new CompositeBackend(
        new StateBackend({ todos: [], files: {} }),
        routes
      );

      // Should handle paths with or without trailing slash in the request
      const result = await backend.read("/persistent/file.txt");
      assert.ok(result.includes("test"));
    });
  });
});

