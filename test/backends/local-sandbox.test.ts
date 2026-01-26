import { test, describe, before, after } from "node:test";
import { LocalSandbox } from "@/backends/local-sandbox.ts";
import * as fs from "fs";
import * as path from "path";
import assert from "node:assert/strict";

describe("LocalSandbox", () => {
  const testDir = path.join(process.cwd(), ".test-sandbox");
  let sandbox: LocalSandbox;

  before(() => {
    // Clean up any previous test artifacts
    if (fs.existsSync(testDir)) {
      fs.rmSync(testDir, { recursive: true, force: true });
    }
    fs.mkdirSync(testDir, { recursive: true });
    sandbox = new LocalSandbox({ cwd: testDir });
  });

  after(() => {
    fs.rmSync(testDir, { recursive: true, force: true });
  });

  describe("execute()", () => {
    test("returns output and exit code for successful command", async () => {
      const result = await sandbox.execute("echo hello");
      assert.strictEqual(result.output.trim(), "hello");
      assert.strictEqual(result.exitCode, 0);
      assert.strictEqual(result.truncated, false);
    });

    test("captures stderr", async () => {
      const result = await sandbox.execute("echo error >&2");
      assert.strictEqual(result.output.trim(), "error");
      assert.strictEqual(result.exitCode, 0);
    });

    test("returns non-zero exit code on failure", async () => {
      const result = await sandbox.execute("exit 42");
      assert.strictEqual(result.exitCode, 42);
    });

    test("handles commands with special characters", async () => {
      const result = await sandbox.execute('echo "hello world" | cat');
      assert.strictEqual(result.output.trim(), "hello world");
      assert.strictEqual(result.exitCode, 0);
    });

    test("respects working directory", async () => {
      const result = await sandbox.execute("pwd");
      assert.strictEqual(result.output.trim(), testDir);
    });
  });

  describe("id", () => {
    test("returns unique identifier", () => {
      const sandbox2 = new LocalSandbox({ cwd: testDir });
      assert.notStrictEqual(sandbox.id, sandbox2.id);
    });

    test("matches expected format", () => {
      assert.match(sandbox.id, /^local-\d+-[a-z0-9]+$/);
    });
  });

  describe("write() and read()", () => {
    test("writes and reads a file", async () => {
      const testPath = path.join(testDir, "test-write.txt");
      const writeResult = await sandbox.write(testPath, "hello world");
      assert.strictEqual(writeResult.error, undefined);
      assert.strictEqual(writeResult.path, testPath);

      const content = await sandbox.read(testPath);
      assert.ok(content.includes("hello world"));
    });

    test("returns error when writing to existing file", async () => {
      const testPath = path.join(testDir, "test-exists.txt");
      await sandbox.write(testPath, "original");

      const result = await sandbox.write(testPath, "new content");
      assert.ok(result.error);
      assert.ok(result.error.includes("already exists"));
    });

    test("creates parent directories", async () => {
      const testPath = path.join(testDir, "nested", "dir", "file.txt");
      const result = await sandbox.write(testPath, "nested content");
      assert.strictEqual(result.error, undefined);
      assert.strictEqual(result.path, testPath);

      const content = await sandbox.read(testPath);
      assert.ok(content.includes("nested content"));
    });

    test("returns error when reading non-existent file", async () => {
      const content = await sandbox.read(
        path.join(testDir, "does-not-exist.txt")
      );
      assert.ok(content.includes("Error"));
      assert.ok(content.includes("not found"));
    });
  });

  describe("edit()", () => {
    test("replaces string in file", async () => {
      const testPath = path.join(testDir, "test-edit.txt");
      await sandbox.write(testPath, "foo bar baz");

      const editResult = await sandbox.edit(testPath, "bar", "qux");
      assert.strictEqual(editResult.error, undefined);
      assert.strictEqual(editResult.occurrences, 1);

      const content = await sandbox.read(testPath);
      assert.ok(content.includes("foo qux baz"));
    });

    test("returns error when string not found", async () => {
      const testPath = path.join(testDir, "test-edit-notfound.txt");
      await sandbox.write(testPath, "hello world");

      const result = await sandbox.edit(testPath, "xyz", "abc");
      assert.ok(result.error);
      assert.ok(result.error.includes("not found"));
    });

    test("returns error for multiple occurrences without replaceAll", async () => {
      const testPath = path.join(testDir, "test-edit-multi.txt");
      await sandbox.write(testPath, "foo foo foo");

      const result = await sandbox.edit(testPath, "foo", "bar");
      assert.ok(result.error);
      assert.ok(result.error.includes("multiple times"));
    });

    test("replaces all occurrences with replaceAll=true", async () => {
      const testPath = path.join(testDir, "test-edit-all.txt");
      await sandbox.write(testPath, "foo foo foo");

      const result = await sandbox.edit(testPath, "foo", "bar", true);
      assert.strictEqual(result.error, undefined);
      assert.strictEqual(result.occurrences, 3);

      const content = await sandbox.read(testPath);
      assert.ok(content.includes("bar bar bar"));
    });
  });

  describe("lsInfo()", () => {
    test("lists files in directory", async () => {
      // Create some test files
      await sandbox.write(path.join(testDir, "ls-test1.txt"), "content1");
      await sandbox.write(path.join(testDir, "ls-test2.txt"), "content2");

      const infos = await sandbox.lsInfo(testDir);
      assert.ok(infos.length > 0);

      const names = infos.map((f) => f.path);
      assert.ok(names.includes("ls-test1.txt"));
      assert.ok(names.includes("ls-test2.txt"));
    });

    test("returns file metadata", async () => {
      const infos = await sandbox.lsInfo(testDir);
      const file = infos.find((f) => f.path === "ls-test1.txt");

      assert.notStrictEqual(file, undefined);
      assert.strictEqual(file!.is_dir, false);
      assert.strictEqual(typeof file!.size, "number");
      assert.notStrictEqual(file!.modified_at, undefined);
    });
  });

  describe("readRaw()", () => {
    test("returns FileData structure", async () => {
      const testPath = path.join(testDir, "test-raw.txt");
      await sandbox.write(testPath, "line1\nline2\nline3");

      const data = await sandbox.readRaw(testPath);
      assert.deepStrictEqual(data.content, ["line1", "line2", "line3"]);
      assert.notStrictEqual(data.created_at, undefined);
      assert.notStrictEqual(data.modified_at, undefined);
    });

    test("throws for non-existent file", async () => {
      await assert.rejects(
        sandbox.readRaw(path.join(testDir, "nonexistent.txt"))
      );
    });
  });

  describe("options", () => {
    test("respects custom environment variables", async () => {
      const customSandbox = new LocalSandbox({
        cwd: testDir,
        env: { MY_VAR: "test_value" },
      });

      const result = await customSandbox.execute("echo $MY_VAR");
      assert.strictEqual(result.output.trim(), "test_value");
    });

    test("respects timeout", async () => {
      const shortTimeoutSandbox = new LocalSandbox({
        cwd: testDir,
        timeout: 100, // 100ms
      });

      // This command would take 5 seconds but should be killed
      const result = await shortTimeoutSandbox.execute("sleep 5");
      // The process should be terminated, resulting in null or non-zero exit code
      assert.notStrictEqual(result.exitCode, 0);
    });
  });
});


