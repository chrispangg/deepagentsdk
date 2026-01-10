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

import { test, expect, describe } from "bun:test";

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
  expect(readContent).toContain(testContent);

  // When: Listing directory
  const files = await backend.lsInfo(workingDir);

  // Then: Test file should be in listing
  const fileName = testFilePath.split("/").pop()!;
  expect(files.some((f: any) => f.path === fileName)).toBe(true);

  // When: Grepping for content
  const matches = await backend.grepRaw("Hello", workingDir);

  // Then: Should find the test file
  expect(matches.length).toBeGreaterThan(0);
  expect(matches[0].path).toBe(fileName);

  // When: Downloading file
  const downloaded = await backend.downloadFiles([testFilePath]);

  // Then: Content should match
  expect(downloaded[0].content).toBeInstanceOf(Uint8Array);
  const decoded = new TextDecoder().decode(downloaded[0].content);
  expect(decoded).toContain(testContent);

  // Cleanup: Remove file via shell command
  await backend.execute(`rm "${testFilePath}"`);

  // Then: File should be removed
  const filesAfter = await backend.lsInfo(workingDir);
  expect(filesAfter.some((f: any) => f.path === fileName)).toBe(false);
}

/**
 * Test command execution with various exit codes.
 */
async function testCommandExecution(backend: any): Promise<void> {
  // Given: A sandbox backend

  // When: Executing simple echo command
  const result = await backend.execute("echo 'Hello, World!'");

  // Then: Should return output with exit code 0
  expect(result.output).toContain("Hello, World!");
  expect(result.exitCode).toBe(0);
  expect(result.truncated).toBe(false);

  // When: Executing command that fails
  const errorResult = await backend.execute("exit 42");

  // Then: Should return non-zero exit code
  expect(errorResult.exitCode).toBe(42);
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
  expect(editResult.success).toBe(true);

  // When: Reading the file
  const content = await backend.read(testFilePath);

  // Then: Content should be updated
  expect(content).toContain("Line 2 - Edited");
  expect(content).not.toContain("Line 2\n");

  // Cleanup
  await backend.execute(`rm "${testFilePath}"`);
}

// ============================================================================
// Phase 1: E2B Sandbox Backend
// ============================================================================

describe("E2B Sandbox Backend", () => {
  describe("Basic Operations", () => {
    test.skipIf(!hasE2BKey)(
      "creates sandbox with valid API key",
      async () => {
        // Given: Valid E2B API key in environment

        // When: Creating E2B backend via factory
        const backend = await createE2BBackend({
          template: "base",
        });

        // Then: Sandbox should have valid ID
        expect(backend.id).toBeDefined();
        expect(typeof backend.id).toBe("string");
        expect(backend.id.length).toBeGreaterThan(0);

        // Cleanup
        await backend.dispose();
      },
      { timeout: 60000 }
    );

    test.skipIf(!hasE2BKey)(
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
    test.skipIf(!hasE2BKey)(
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

    test.skipIf(!hasE2BKey)(
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
    test.skipIf(!hasE2BKey)(
      "handles non-existent file read",
      async () => {
        // Given: E2B backend instance
        const backend = await createE2BBackend({ template: "base" });

        try {
          // When: Reading non-existent file
          const result = await backend.read("/tmp/does-not-exist.txt");

          // Then: Should return error message (read() doesn't throw, returns error string)
          expect(result).toContain("not found");
        } finally {
          await backend.dispose();
        }
      },
      { timeout: 60000 }
    );

    test.skipIf(!hasE2BKey)(
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
          expect(content.length).toBe(1024 * 1024);
          expect(content).toBe(largeContent);

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
    test.skipIf(!hasE2BKey)(
      "rejects invalid API key",
      async () => {
        // Given: Invalid API key
        const invalidKey = "invalid-key-12345";

        // When: Creating backend
        const createBackend = () =>
          createE2BBackend({ apiKey: invalidKey });

        // Then: Should throw error
        await expect(createBackend()).rejects.toThrow();
      },
      { timeout: 30000 }
    );

    test.skipIf(!hasE2BKey)(
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
          expect(result.exitCode).not.toBe(0);
          expect(result.output).toBeDefined();
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
    test.skipIf(!hasModalKey)(
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
          expect(backend.id).toBeDefined();
          expect(typeof backend.id).toBe("string");
        } finally {
          await backend.dispose();
        }
      },
      { timeout: 120000 } // Modal can take longer to start
    );

    test.skipIf(!hasModalKey)(
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
    test.skipIf(!hasModalKey)(
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

    test.skipIf(!hasModalKey)(
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
    test.skipIf(!hasModalKey)(
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
          expect(result.exitCode).toBe(0);
          expect(result.output).toContain("v");
        } finally {
          await backend.dispose();
        }
      },
      { timeout: 120000 }
    );

    test.skipIf(!hasModalKey)(
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
          expect(results).toHaveLength(10);
          expect(results[0]).toContain("content-0");

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
    test.skipIf(!hasRunloopKey)(
      "creates devbox with valid API key",
      async () => {
        // Given: Valid Runloop API key in environment

        // When: Creating Runloop backend
        const backend = new RunloopBackend();

        try {
          // Wait for initialization
          await new Promise((resolve) => setTimeout(resolve, 5000));

          // Then: Devbox should have valid ID
          expect(backend.id).toBeDefined();
          expect(typeof backend.id).toBe("string");
        } finally {
          await backend.dispose();
        }
      },
      { timeout: 30000 }
    );

    test.skipIf(!hasRunloopKey)(
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
    test.skipIf(!hasRunloopKey)(
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
    test.skipIf(!hasDaytonaKey)(
      "creates sandbox with valid API key",
      async () => {
        // Given: Valid Daytona API key in environment

        // When: Creating Daytona backend
        const backend = new DaytonaBackend();

        try {
          // Wait for initialization
          await new Promise((resolve) => setTimeout(resolve, 5000));

          // Then: Sandbox should have valid ID
          expect(backend.id).toBeDefined();
          expect(typeof backend.id).toBe("string");
        } finally {
          await backend.dispose();
        }
      },
      { timeout: 30000 }
    );

    test.skipIf(!hasDaytonaKey)(
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
    test.skipIf(!hasDaytonaKey)(
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
    test.skipIf(!hasDaytonaKey)(
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
          expect(result.exitCode).toBe(0);
          expect(result.output).toMatch(/Python 3/);
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
  test.skipIf(!hasE2BKey)(
    "E2B: implements SandboxBackendProtocol correctly",
    async () => {
      // Given: E2B backend
      const backend = await createE2BBackend();

      try {
        // When: Checking protocol compliance
        // Then: Should have required properties
        expect(typeof backend.execute).toBe("function");
        expect(typeof backend.id).toBe("string");
        expect(typeof backend.read).toBe("function");
        expect(typeof backend.write).toBe("function");
        expect(typeof backend.lsInfo).toBe("function");
      } finally {
        await backend.dispose();
      }
    },
    { timeout: 60000 }
  );

  test.skipIf(!hasModalKey)(
    "Modal: implements SandboxBackendProtocol correctly",
    async () => {
      // Given: Modal backend
      const backend = await createModalBackend();

      try {
        // When: Checking protocol compliance
        // Then: Should have required properties
        expect(typeof backend.execute).toBe("function");
        expect(typeof backend.id).toBe("string");
        expect(typeof backend.read).toBe("function");
        expect(typeof backend.write).toBe("function");
        expect(typeof backend.lsInfo).toBe("function");
      } finally {
        await backend.dispose();
      }
    },
    { timeout: 120000 }
  );

  test.skipIf(!hasRunloopKey)(
    "Runloop: implements SandboxBackendProtocol correctly",
    async () => {
      // Given: Runloop backend
      const backend = new RunloopBackend();

      try {
        // Wait for initialization
        await new Promise((resolve) => setTimeout(resolve, 5000));

        // When: Checking protocol compliance
        // Then: Should have required properties
        expect(typeof backend.execute).toBe("function");
        expect(typeof backend.id).toBe("string");
        expect(typeof backend.read).toBe("function");
        expect(typeof backend.write).toBe("function");
        expect(typeof backend.lsInfo).toBe("function");
      } finally {
        await backend.dispose();
      }
    },
    { timeout: 30000 }
  );

  test.skipIf(!hasDaytonaKey)(
    "Daytona: implements SandboxBackendProtocol correctly",
    async () => {
      // Given: Daytona backend
      const backend = new DaytonaBackend();

      try {
        // Wait for initialization
        await new Promise((resolve) => setTimeout(resolve, 5000));

        // When: Checking protocol compliance
        // Then: Should have required properties
        expect(typeof backend.execute).toBe("function");
        expect(typeof backend.id).toBe("string");
        expect(typeof backend.read).toBe("function");
        expect(typeof backend.write).toBe("function");
        expect(typeof backend.lsInfo).toBe("function");
      } finally {
        await backend.dispose();
      }
    },
    { timeout: 30000 }
  );
});
