import { test, expect, describe, beforeAll, afterAll } from "bun:test";
import { LocalSandbox } from "../../src/backends/local-sandbox.ts";
import * as fs from "fs";
import * as path from "path";

describe("LocalSandbox", () => {
  const testDir = path.join(process.cwd(), ".test-sandbox");
  let sandbox: LocalSandbox;

  beforeAll(() => {
    // Clean up any previous test artifacts
    if (fs.existsSync(testDir)) {
      fs.rmSync(testDir, { recursive: true, force: true });
    }
    fs.mkdirSync(testDir, { recursive: true });
    sandbox = new LocalSandbox({ cwd: testDir });
  });

  afterAll(() => {
    fs.rmSync(testDir, { recursive: true, force: true });
  });

  describe("execute()", () => {
    test("returns output and exit code for successful command", async () => {
      const result = await sandbox.execute("echo hello");
      expect(result.output.trim()).toBe("hello");
      expect(result.exitCode).toBe(0);
      expect(result.truncated).toBe(false);
    });

    test("captures stderr", async () => {
      const result = await sandbox.execute("echo error >&2");
      expect(result.output.trim()).toBe("error");
      expect(result.exitCode).toBe(0);
    });

    test("returns non-zero exit code on failure", async () => {
      const result = await sandbox.execute("exit 42");
      expect(result.exitCode).toBe(42);
    });

    test("handles commands with special characters", async () => {
      const result = await sandbox.execute('echo "hello world" | cat');
      expect(result.output.trim()).toBe("hello world");
      expect(result.exitCode).toBe(0);
    });

    test("respects working directory", async () => {
      const result = await sandbox.execute("pwd");
      expect(result.output.trim()).toBe(testDir);
    });
  });

  describe("id", () => {
    test("returns unique identifier", () => {
      const sandbox2 = new LocalSandbox({ cwd: testDir });
      expect(sandbox.id).not.toBe(sandbox2.id);
    });

    test("matches expected format", () => {
      expect(sandbox.id).toMatch(/^local-\d+-[a-z0-9]+$/);
    });
  });

  describe("write() and read()", () => {
    test("writes and reads a file", async () => {
      const testPath = path.join(testDir, "test-write.txt");
      const writeResult = await sandbox.write(testPath, "hello world");
      expect(writeResult.error).toBeUndefined();
      expect(writeResult.path).toBe(testPath);

      const content = await sandbox.read(testPath);
      expect(content).toContain("hello world");
    });

    test("returns error when writing to existing file", async () => {
      const testPath = path.join(testDir, "test-exists.txt");
      await sandbox.write(testPath, "original");

      const result = await sandbox.write(testPath, "new content");
      expect(result.error).toContain("already exists");
    });

    test("creates parent directories", async () => {
      const testPath = path.join(testDir, "nested", "dir", "file.txt");
      const result = await sandbox.write(testPath, "nested content");
      expect(result.error).toBeUndefined();
      expect(result.path).toBe(testPath);

      const content = await sandbox.read(testPath);
      expect(content).toContain("nested content");
    });

    test("returns error when reading non-existent file", async () => {
      const content = await sandbox.read(
        path.join(testDir, "does-not-exist.txt")
      );
      expect(content).toContain("Error");
      expect(content).toContain("not found");
    });
  });

  describe("edit()", () => {
    test("replaces string in file", async () => {
      const testPath = path.join(testDir, "test-edit.txt");
      await sandbox.write(testPath, "foo bar baz");

      const editResult = await sandbox.edit(testPath, "bar", "qux");
      expect(editResult.error).toBeUndefined();
      expect(editResult.occurrences).toBe(1);

      const content = await sandbox.read(testPath);
      expect(content).toContain("foo qux baz");
    });

    test("returns error when string not found", async () => {
      const testPath = path.join(testDir, "test-edit-notfound.txt");
      await sandbox.write(testPath, "hello world");

      const result = await sandbox.edit(testPath, "xyz", "abc");
      expect(result.error).toContain("not found");
    });

    test("returns error for multiple occurrences without replaceAll", async () => {
      const testPath = path.join(testDir, "test-edit-multi.txt");
      await sandbox.write(testPath, "foo foo foo");

      const result = await sandbox.edit(testPath, "foo", "bar");
      expect(result.error).toContain("multiple times");
    });

    test("replaces all occurrences with replaceAll=true", async () => {
      const testPath = path.join(testDir, "test-edit-all.txt");
      await sandbox.write(testPath, "foo foo foo");

      const result = await sandbox.edit(testPath, "foo", "bar", true);
      expect(result.error).toBeUndefined();
      expect(result.occurrences).toBe(3);

      const content = await sandbox.read(testPath);
      expect(content).toContain("bar bar bar");
    });
  });

  describe("lsInfo()", () => {
    test("lists files in directory", async () => {
      // Create some test files
      await sandbox.write(path.join(testDir, "ls-test1.txt"), "content1");
      await sandbox.write(path.join(testDir, "ls-test2.txt"), "content2");

      const infos = await sandbox.lsInfo(testDir);
      expect(infos.length).toBeGreaterThan(0);

      const names = infos.map((f) => f.path);
      expect(names).toContain("ls-test1.txt");
      expect(names).toContain("ls-test2.txt");
    });

    test("returns file metadata", async () => {
      const infos = await sandbox.lsInfo(testDir);
      const file = infos.find((f) => f.path === "ls-test1.txt");

      expect(file).toBeDefined();
      expect(file!.is_dir).toBe(false);
      expect(typeof file!.size).toBe("number");
      expect(file!.modified_at).toBeDefined();
    });
  });

  describe("readRaw()", () => {
    test("returns FileData structure", async () => {
      const testPath = path.join(testDir, "test-raw.txt");
      await sandbox.write(testPath, "line1\nline2\nline3");

      const data = await sandbox.readRaw(testPath);
      expect(data.content).toEqual(["line1", "line2", "line3"]);
      expect(data.created_at).toBeDefined();
      expect(data.modified_at).toBeDefined();
    });

    test("throws for non-existent file", async () => {
      await expect(
        sandbox.readRaw(path.join(testDir, "nonexistent.txt"))
      ).rejects.toThrow();
    });
  });

  describe("options", () => {
    test("respects custom environment variables", async () => {
      const customSandbox = new LocalSandbox({
        cwd: testDir,
        env: { MY_VAR: "test_value" },
      });

      const result = await customSandbox.execute("echo $MY_VAR");
      expect(result.output.trim()).toBe("test_value");
    });

    test("respects timeout", async () => {
      const shortTimeoutSandbox = new LocalSandbox({
        cwd: testDir,
        timeout: 100, // 100ms
      });

      // This command would take 5 seconds but should be killed
      const result = await shortTimeoutSandbox.execute("sleep 5");
      // The process should be terminated, resulting in null or non-zero exit code
      expect(result.exitCode).not.toBe(0);
    });
  });
});

