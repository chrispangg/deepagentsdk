import { test, before, after } from "node:test";
import { parseSkillMetadata, listSkills } from "@/skills/index.ts";
import * as fs from "node:fs/promises";
import * as path from "node:path";
import * as os from "node:os";
import assert from "node:assert/strict";

// Test fixtures directory
let tempDir: string;

before(async () => {
  // Create temporary directory for test fixtures
  tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "skills-test-"));

  // Create test skill directories
  await fs.mkdir(path.join(tempDir, "valid-skill"), { recursive: true });
  await fs.mkdir(path.join(tempDir, "no-frontmatter"), { recursive: true });
  await fs.mkdir(path.join(tempDir, "missing-fields"), { recursive: true });
  await fs.mkdir(path.join(tempDir, "hidden-skill"), { recursive: true });

  // Valid skill with proper frontmatter
  await fs.writeFile(
    path.join(tempDir, "valid-skill", "SKILL.md"),
    `---
name: test-skill
description: A test skill for unit testing
---

# Test Skill

This is test content.
`
  );

  // Skill without frontmatter
  await fs.writeFile(
    path.join(tempDir, "no-frontmatter", "SKILL.md"),
    `# Just a regular markdown file

No frontmatter here.
`
  );

  // Skill with missing required fields
  await fs.writeFile(
    path.join(tempDir, "missing-fields", "SKILL.md"),
    `---
name: incomplete
---

# Missing description field
`
  );

  // Hidden directory (should be skipped)
  await fs.mkdir(path.join(tempDir, ".hidden-skill"), { recursive: true });
  await fs.writeFile(
    path.join(tempDir, ".hidden-skill", "SKILL.md"),
    `---
name: hidden
description: Should be skipped
---
`
  );
});

after(async () => {
  // Clean up temporary directory
  await fs.rm(tempDir, { recursive: true, force: true });
});

test("parseSkillMetadata - valid frontmatter", async () => {
  const skillPath = path.join(tempDir, "valid-skill", "SKILL.md");
  const metadata = await parseSkillMetadata(skillPath, "project");

  assert.notStrictEqual(metadata, null);
  assert.strictEqual(metadata?.name, "test-skill");
  assert.strictEqual(metadata?.description, "A test skill for unit testing");
  assert.strictEqual(metadata?.path, skillPath);
  assert.strictEqual(metadata?.source, "project");
});

test("parseSkillMetadata - missing frontmatter", async () => {
  const skillPath = path.join(tempDir, "no-frontmatter", "SKILL.md");
  const metadata = await parseSkillMetadata(skillPath, "user");

  assert.strictEqual(metadata, null);
});

test("parseSkillMetadata - missing required fields", async () => {
  const skillPath = path.join(tempDir, "missing-fields", "SKILL.md");
  const metadata = await parseSkillMetadata(skillPath, "user");

  assert.strictEqual(metadata, null);
});

test("parseSkillMetadata - non-existent file", async () => {
  const skillPath = path.join(tempDir, "non-existent", "SKILL.md");
  const metadata = await parseSkillMetadata(skillPath, "project");

  assert.strictEqual(metadata, null);
});

test("listSkills - finds valid skills", async () => {
  const skills = await listSkills({ projectSkillsDir: tempDir });

  // Should find only the valid skill, not the ones with issues or hidden
  assert.strictEqual(skills.length, 1);
  assert.strictEqual(skills[0]?.name, "test-skill");
  assert.strictEqual(skills[0]?.source, "project");
});

test("listSkills - project skills override user skills", async () => {
  // Create a separate user skills directory
  const userDir = await fs.mkdtemp(path.join(os.tmpdir(), "user-skills-"));

  try {
    // Create user skill with same name
    await fs.mkdir(path.join(userDir, "test-skill"), { recursive: true });
    await fs.writeFile(
      path.join(userDir, "test-skill", "SKILL.md"),
      `---
name: test-skill
description: User version of test skill
---
`
    );

    const skills = await listSkills({
      userSkillsDir: userDir,
      projectSkillsDir: tempDir,
    });

    // Should have only one skill (project overrides user)
    assert.strictEqual(skills.length, 1);
    assert.strictEqual(skills[0]?.name, "test-skill");
    assert.strictEqual(skills[0]?.description, "A test skill for unit testing");
    assert.strictEqual(skills[0]?.source, "project");
  } finally {
    await fs.rm(userDir, { recursive: true, force: true });
  }
});

test("listSkills - handles non-existent directory", async () => {
  const skills = await listSkills({
    projectSkillsDir: "/non/existent/path",
  });

  assert.strictEqual(skills.length, 0);
});

test("listSkills - skips hidden directories", async () => {
  const skills = await listSkills({ projectSkillsDir: tempDir });

  // Should not include the hidden skill
  const hiddenSkill = skills.find((s) => s.name === "hidden");
  assert.strictEqual(hiddenSkill, undefined);
});

test("listSkills - combines user and project skills", async () => {
  const userDir = await fs.mkdtemp(path.join(os.tmpdir(), "user-skills-"));

  try {
    // Create a unique user skill
    await fs.mkdir(path.join(userDir, "user-only-skill"), { recursive: true });
    await fs.writeFile(
      path.join(userDir, "user-only-skill", "SKILL.md"),
      `---
name: user-skill
description: Only in user directory
---
`
    );

    const skills = await listSkills({
      userSkillsDir: userDir,
      projectSkillsDir: tempDir,
    });

    // Should have both user and project skills
    assert.strictEqual(skills.length, 2);

    const skillNames = skills.map((s) => s.name).sort();
    assert.deepStrictEqual(skillNames, ["test-skill", "user-skill"]);

    const userSkill = skills.find((s) => s.name === "user-skill");
    assert.strictEqual(userSkill?.source, "user");

    const projectSkill = skills.find((s) => s.name === "test-skill");
    assert.strictEqual(projectSkill?.source, "project");
  } finally {
    await fs.rm(userDir, { recursive: true, force: true });
  }
});

