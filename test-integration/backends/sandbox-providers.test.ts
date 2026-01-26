/**
 * BDD Integration Tests: Cloud Sandbox Providers
 *
 * Tests E2B, Modal, Runloop, and Daytona sandbox backends.
 * Tests are gated by respective API keys in environment variables.
 *
 * Environment Variables Required:
 * - E2B_API_KEY (for E2B tests)
 * - MODAL_TOKEN_ID + MODAL_TOKEN_SECRET (for Modal tests)
 * - RUNLOOP_API_KEY (for Runloop tests)
 * - DAYTONA_API_KEY (for Daytona tests)
 */

import { test, describe } from "node:test";
import assert from "node:assert/strict";

type TestCallback = () => void | Promise<void>;
type TestOptions = { timeout?: number } & Record<string, unknown>;

const skipIf = (condition: boolean) => {
  const runner = condition ? test.skip : test;
  return (name: string, fn: TestCallback, options?: TestOptions) => {
    if (options) {
      runner(name, options, fn);
      return;
    }
    runner(name, fn);
  };
};

// Sandbox backends and factory functions
import {
  createE2BBackend,
  type E2BBackendOptions,
} from "@/backends/e2b";
import {
  createModalBackend,
  type ModalBackendOptions,
} from "@/backends/modal";
import {
  RunloopBackend,
  type RunloopBackendOptions,
} from "@/backends/runloop";
import {
  DaytonaBackend,
  type DaytonaBackendOptions,
} from "@/backends/daytona";

// ============================================================================
// Environment Variable Checks
// ============================================================================

const hasE2BKey = !!process.env.E2B_API_KEY;
const hasModalKey = !!process.env.MODAL_TOKEN_ID && !!process.env.MODAL_TOKEN_SECRET;
const hasRunloopKey = !!process.env.RUNLOOP_API_KEY;
const hasDaytonaKey = !!process.env.DAYTONA_API_KEY;

// ============================================================================
// Test Helpers
// ============================================================================

/**
 * Standard sandbox file operations test suite.
 * Tests write, read, lsInfo, grep, and download operations.
 */
async function testSandboxFileOperations(
  backend: any,
  workingDir: string
): Promise<void> {
  const testFilePath = `${workingDir}/test-${Date.now()}.txt`;
  const testContent = "Hello from sandbox integration test!";

  // Given: A fresh sandbox backend

  // When: Writing a file
  await backend.write(testFilePath, testContent);

  // Then: File should exist and contain correct content
  const readContent = await backend.read(testFilePath);
  assert.ok(readContent.includes(testContent));

  // When: Listing directory
  const files = await backend.lsInfo(workingDir);

  // Then: Test file should be in listing
  const fileName = testFilePath.split("/").pop()!;
  assert.ok(files.some((f: any) => f.path === fileName));

  // When: Grepping for content
  const matches = await backend.grepRaw("Hello", workingDir);

  // Then: Should find the test file
  assert.ok(matches.length > 0);
  assert.strictEqual(matches[0].path, fileName);

  // When: Downloading file
  const downloaded = await backend.downloadFiles([testFilePath]);

  // Then: Content should match
  assert.ok(downloaded[0].content instanceof Uint8Array);
  const decoded = new TextDecoder().decode(downloaded[0].content);
  assert.ok(decoded.includes(testContent));

  // Cleanup: Remove file via shell command
  await backend.execute(`rm "${testFilePath}"`);

  // Then: File should be removed
  const filesAfter = await backend.lsInfo(workingDir);
  assert.ok(!filesAfter.some((f: any) => f.path === fileName));
}

/**
 * Test command execution with various exit codes.
 */
async function testCommandExecution(backend: any): Promise<void> {
  // Given: A sandbox backend

  // When: Executing simple echo command
  const result = await backend.execute("echo 'Hello, World!'");

  // Then: Should return output with exit code 0
  assert.ok(result.output.includes("Hello, World!"));
  assert.strictEqual(result.exitCode, 0);
  assert.strictEqual(result.truncated, false);

  // When: Executing command that fails
  const errorResult = await backend.execute("exit 42");

  // Then: Should return non-zero exit code
  assert.strictEqual(errorResult.exitCode, 42);
}

/**
 * Test file edit operations.
 */
async function testFileEditOperations(
  backend: any,
  workingDir: string
): Promise<void> {
  const testFilePath = `${workingDir}/edit-test-${Date.now()}.txt`;

  // Given: A file with initial content
  await backend.write(testFilePath, "Line 1\nLine 2\nLine 3");

  // When: Editing a line
  const editResult = await backend.edit(testFilePath, "Line 2", "Line 2 - Edited");

  // Then: Edit should succeed
  assert.strictEqual(editResult.success, true);

  // When: Reading the file
  const content = await backend.read(testFilePath);

  // Then: Content should be updated
  assert.ok(content.includes("Line 2 - Edited"));
  assert.ok(!content.includes("Line 2\n"));

  // Cleanup
  await backend.execute(`rm "${testFilePath}"`);
}

// ============================================================================
// Phase 1: E2B Sandbox Backend
// ============================================================================

describe("E2B Sandbox Backend", () => {
  describe("Basic Operations", () => {
    skipIf(!hasE2BKey)(
      "creates sandbox with valid API key",
      async () => {
        // Given: Valid E2B API key in environment

        // When: Creating E2B backend via factory
        const backend = await createE2BBackend({
          template: "base",
        });

        // Then: Sandbox should have valid ID
        assert.notStrictEqual(backend.id, undefined);
        assert.strictEqual(typeof backend.id, "string");
        assert.ok(backend.id.length > 0);

        // Cleanup
        await backend.dispose();
      },
      { timeout: 60000 }
    );

    skipIf(!hasE2BKey)(
      "executes shell commands",
      async () => {
        // Given: E2B backend instance
        const backend = await createE2BBackend({ template: "base" });

        try {
          // When: Testing command execution
          await testCommandExecution(backend);
          // Then: Assertions validated in helper
        } finally {
          await backend.dispose();
        }
      },
      { timeout: 60000 }
    );
  });

  describe("File Operations", () => {
    skipIf(!hasE2BKey)(
      "performs complete file operations",
      async () => {
        // Given: E2B backend instance
        const backend = await createE2BBackend({ template: "base" });

        try {
          // When: Testing file operations
          await testSandboxFileOperations(backend, "/home/user");
          // Then: Assertions validated in helper
        } finally {
          await backend.dispose();
        }
      },
      { timeout: 60000 }
    );

    skipIf(!hasE2BKey)(
      "edits file content",
      async () => {
        // Given: E2B backend instance
        const backend = await createE2BBackend({ template: "base" });

        try {
          // When: Testing edit operations
          await testFileEditOperations(backend, "/home/user");
          // Then: Assertions validated in helper
        } finally {
          await backend.dispose();
        }
      },
      { timeout: 60000 }
    );
  });

  describe("Edge Cases", () => {
    skipIf(!hasE2BKey)(
      "handles non-existent file read",
      async () => {
        // Given: E2B backend instance
        const backend = await createE2BBackend({ template: "base" });

        try {
          // When: Reading non-existent file
          const result = await backend.read("/tmp/does-not-exist.txt");

          // Then: Should return error message (read() doesn't throw, returns error string)
          assert.ok(result.includes("not found"));
        } finally {
          await backend.dispose();
        }
      },
      { timeout: 60000 }
    );

    skipIf(!hasE2BKey)(
      "handles large file upload",
      async () => {
        // Given: E2B backend and large content (1MB)
        const backend = await createE2BBackend({ template: "base" });
        const largeContent = "x".repeat(1024 * 1024);

        try {
          // When: Uploading large file
          await backend.write("/tmp/large.txt", largeContent);

          // Then: File should be written successfully
          // Use readRaw() for raw content (read() formats with line numbers)
          const fileData = await backend.readRaw("/tmp/large.txt");
          const content = fileData.content.join("\n");
          assert.strictEqual(content.length, 1024 * 1024);
          assert.strictEqual(content, largeContent);

          // Cleanup
          await backend.execute("rm /tmp/large.txt");
        } finally {
          await backend.dispose();
        }
      },
      { timeout: 60000 }
    );
  });

  describe("Error Scenarios", () => {
    skipIf(!hasE2BKey)(
      "rejects invalid API key",
      async () => {
        // Given: Invalid API key
        const invalidKey = "invalid-key-12345";

        // When: Creating backend
        const createBackend = () =>
          createE2BBackend({ apiKey: invalidKey });

        // Then: Should throw error
        await assert.rejects(createBackend);
      },
      { timeout: 30000 }
    );

    skipIf(!hasE2BKey)(
      "handles invalid command gracefully",
      async () => {
        // Given: E2B backend
        const backend = await createE2BBackend({ template: "base" });

        try {
          // When: Executing invalid command
          const result = await backend.execute(
            "this-command-does-not-exist-xyz123"
          );

          // Then: Should return non-zero exit code
          assert.notStrictEqual(result.exitCode, 0);
          assert.notStrictEqual(result.output, undefined);
        } finally {
          await backend.dispose();
        }
      },
      { timeout: 60000 }
    );
  });
});

// ============================================================================
// Phase 2: Modal Sandbox Backend
// ============================================================================

describe("Modal Sandbox Backend", () => {
  describe("Basic Operations", () => {
    skipIf(!hasModalKey)(
      "creates sandbox with valid credentials",
      async () => {
        // Given: Valid Modal credentials in environment

        // When: Creating Modal backend via factory
        const backend = await createModalBackend({
          appName: "deepagentsdk-test",
          image: "python:3.13-slim",
        });

        try {
          // Then: Sandbox should have valid ID
          assert.notStrictEqual(backend.id, undefined);
          assert.strictEqual(typeof backend.id, "string");
        } finally {
          await backend.dispose();
        }
      },
      { timeout: 120000 } // Modal can take longer to start
    );

    skipIf(!hasModalKey)(
      "executes shell commands",
      async () => {
        // Given: Modal backend instance
        const backend = await createModalBackend({
          appName: "deepagentsdk-test",
        });

        try {
          // When: Testing command execution
          await testCommandExecution(backend);
          // Then: Assertions validated in helper
        } finally {
          await backend.dispose();
        }
      },
      { timeout: 120000 }
    );
  });

  describe("File Operations", () => {
    skipIf(!hasModalKey)(
      "performs complete file operations",
      async () => {
        // Given: Modal backend instance
        const backend = await createModalBackend({
          appName: "deepagentsdk-test",
        });

        try {
          // When: Testing file operations
          await testSandboxFileOperations(backend, "/workspace");
          // Then: Assertions validated in helper
        } finally {
          await backend.dispose();
        }
      },
      { timeout: 120000 }
    );

    skipIf(!hasModalKey)(
      "edits file content",
      async () => {
        // Given: Modal backend instance
        const backend = await createModalBackend({
          appName: "deepagentsdk-test",
        });

        try {
          // When: Testing edit operations
          await testFileEditOperations(backend, "/workspace");
          // Then: Assertions validated in helper
        } finally {
          await backend.dispose();
        }
      },
      { timeout: 120000 }
    );
  });

  describe("Edge Cases", () => {
    skipIf(!hasModalKey)(
      "handles custom image",
      async () => {
        // Given: Custom image specification
        const backend = await createModalBackend({
          appName: "deepagentsdk-test",
          image: "node:22-alpine",
        });

        try {
          // When: Executing Node.js command
          const result = await backend.execute("node --version");

          // Then: Should execute successfully
          assert.strictEqual(result.exitCode, 0);
          assert.ok(result.output.includes("v"));
        } finally {
          await backend.dispose();
        }
      },
      { timeout: 120000 }
    );

    skipIf(!hasModalKey)(
      "handles concurrent file operations",
      async () => {
        // Given: Modal backend
        const backend = await createModalBackend({
          appName: "deepagentsdk-test",
        });

        try {
          // When: Writing multiple files concurrently
          const files = Array.from({ length: 10 }, (_, i) =>
            backend.write(`/workspace/concurrent-${i}.txt`, `content-${i}`)
          );
          await Promise.all(files);

          // Then: All files should exist
          const results = await Promise.all(
            Array.from({ length: 10 }, (_, i) =>
              backend.read(`/workspace/concurrent-${i}.txt`)
            )
          );
          assert.strictEqual(results.length, 10);
          assert.ok(results[0]);
          assert.ok(results[0].includes("content-0"));

          // Cleanup
          for (let i = 0; i < 10; i++) {
            await backend.execute(`rm /workspace/concurrent-${i}.txt`);
          }
        } finally {
          await backend.dispose();
        }
      },
      { timeout: 120000 }
    );
  });
});

// ============================================================================
// Phase 3: Runloop Sandbox Backend
// ============================================================================

describe("Runloop Sandbox Backend", () => {
  describe("Basic Operations", () => {
    skipIf(!hasRunloopKey)(
      "creates devbox with valid API key",
      async () => {
        // Given: Valid Runloop API key in environment

        // When: Creating Runloop backend
        const backend = new RunloopBackend();

        try {
          // Wait for initialization
          await new Promise((resolve) => setTimeout(resolve, 5000));

          // Then: Devbox should have valid ID
          assert.notStrictEqual(backend.id, undefined);
          assert.strictEqual(typeof backend.id, "string");
        } finally {
          await backend.dispose();
        }
      },
      { timeout: 30000 }
    );

    skipIf(!hasRunloopKey)(
      "executes shell commands",
      async () => {
        // Given: Runloop backend instance
        const backend = new RunloopBackend();

        try {
          // Wait for initialization
          await new Promise((resolve) => setTimeout(resolve, 5000));

          // When: Testing command execution
          await testCommandExecution(backend);
          // Then: Assertions validated in helper
        } finally {
          await backend.dispose();
        }
      },
      { timeout: 30000 }
    );
  });

  describe("File Operations", () => {
    skipIf(!hasRunloopKey)(
      "performs complete file operations",
      async () => {
        // Given: Runloop backend instance
        const backend = new RunloopBackend();

        try {
          // Wait for initialization
          await new Promise((resolve) => setTimeout(resolve, 5000));

          // When: Testing file operations
          await testSandboxFileOperations(backend, "/home/user");
          // Then: Assertions validated in helper
        } finally {
          await backend.dispose();
        }
      },
      { timeout: 30000 }
    );
  });
});

// ============================================================================
// Phase 4: Daytona Sandbox Backend
// ============================================================================

describe("Daytona Sandbox Backend", () => {
  describe("Basic Operations", () => {
    skipIf(!hasDaytonaKey)(
      "creates sandbox with valid API key",
      async () => {
        // Given: Valid Daytona API key in environment

        // When: Creating Daytona backend
        const backend = new DaytonaBackend();

        try {
          // Wait for initialization
          await new Promise((resolve) => setTimeout(resolve, 5000));

          // Then: Sandbox should have valid ID
          assert.notStrictEqual(backend.id, undefined);
          assert.strictEqual(typeof backend.id, "string");
        } finally {
          await backend.dispose();
        }
      },
      { timeout: 30000 }
    );

    skipIf(!hasDaytonaKey)(
      "executes shell commands",
      async () => {
        // Given: Daytona backend instance
        const backend = new DaytonaBackend();

        try {
          // Wait for initialization
          await new Promise((resolve) => setTimeout(resolve, 5000));

          // When: Testing command execution
          await testCommandExecution(backend);
          // Then: Assertions validated in helper
        } finally {
          await backend.dispose();
        }
      },
      { timeout: 30000 }
    );
  });

  describe("File Operations", () => {
    skipIf(!hasDaytonaKey)(
      "performs complete file operations",
      async () => {
        // Given: Daytona backend instance
        const backend = new DaytonaBackend();

        try {
          // Wait for initialization
          await new Promise((resolve) => setTimeout(resolve, 5000));

          // When: Testing file operations
          await testSandboxFileOperations(backend, "/workspace");
          // Then: Assertions validated in helper
        } finally {
          await backend.dispose();
        }
      },
      { timeout: 30000 }
    );
  });

  describe("Edge Cases", () => {
    skipIf(!hasDaytonaKey)(
      "supports different languages",
      async () => {
        // Given: Daytona backend with Python language
        const backend = new DaytonaBackend({ language: "python" });

        try {
          // Wait for initialization
          await new Promise((resolve) => setTimeout(resolve, 5000));

          // When: Executing Python command
          const result = await backend.execute("python --version");

          // Then: Should execute successfully
          assert.strictEqual(result.exitCode, 0);
          assert.match(result.output, /Python 3/);
        } finally {
          await backend.dispose();
        }
      },
      { timeout: 30000 }
    );
  });
});

// ============================================================================
// Phase 5: Cross-Provider Comparison
// ============================================================================

describe("Cross-Provider Compatibility", () => {
  skipIf(!hasE2BKey)(
    "E2B: implements SandboxBackendProtocol correctly",
    async () => {
      // Given: E2B backend
      const backend = await createE2BBackend();

      try {
        // When: Checking protocol compliance
        // Then: Should have required properties
        assert.strictEqual(typeof backend.execute, "function");
        assert.strictEqual(typeof backend.id, "string");
        assert.strictEqual(typeof backend.read, "function");
        assert.strictEqual(typeof backend.write, "function");
        assert.strictEqual(typeof backend.lsInfo, "function");
      } finally {
        await backend.dispose();
      }
    },
    { timeout: 60000 }
  );

  skipIf(!hasModalKey)(
    "Modal: implements SandboxBackendProtocol correctly",
    async () => {
      // Given: Modal backend
      const backend = await createModalBackend();

      try {
        // When: Checking protocol compliance
        // Then: Should have required properties
        assert.strictEqual(typeof backend.execute, "function");
        assert.strictEqual(typeof backend.id, "string");
        assert.strictEqual(typeof backend.read, "function");
        assert.strictEqual(typeof backend.write, "function");
        assert.strictEqual(typeof backend.lsInfo, "function");
      } finally {
        await backend.dispose();
      }
    },
    { timeout: 120000 }
  );

  skipIf(!hasRunloopKey)(
    "Runloop: implements SandboxBackendProtocol correctly",
    async () => {
      // Given: Runloop backend
      const backend = new RunloopBackend();

      try {
        // Wait for initialization
        await new Promise((resolve) => setTimeout(resolve, 5000));

        // When: Checking protocol compliance
        // Then: Should have required properties
        assert.strictEqual(typeof backend.execute, "function");
        assert.strictEqual(typeof backend.id, "string");
        assert.strictEqual(typeof backend.read, "function");
        assert.strictEqual(typeof backend.write, "function");
        assert.strictEqual(typeof backend.lsInfo, "function");
      } finally {
        await backend.dispose();
      }
    },
    { timeout: 30000 }
  );

  skipIf(!hasDaytonaKey)(
    "Daytona: implements SandboxBackendProtocol correctly",
    async () => {
      // Given: Daytona backend
      const backend = new DaytonaBackend();

      try {
        // Wait for initialization
        await new Promise((resolve) => setTimeout(resolve, 5000));

        // When: Checking protocol compliance
        // Then: Should have required properties
        assert.strictEqual(typeof backend.execute, "function");
        assert.strictEqual(typeof backend.id, "string");
        assert.strictEqual(typeof backend.read, "function");
        assert.strictEqual(typeof backend.write, "function");
        assert.strictEqual(typeof backend.lsInfo, "function");
      } finally {
        await backend.dispose();
      }
    },
    { timeout: 30000 }
  );
});

