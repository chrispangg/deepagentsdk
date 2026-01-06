# Publishing Guide

This repository uses GitHub Actions to automatically publish to npm when code changes are pushed to the `main` branch.

## Setup

This repository uses **npm Trusted Publishing** with OIDC for secure, token-free publishing. No secrets or long-lived tokens needed!

### Configure npm Trusted Publisher

**Steps:**

1. **Publish the package manually once** (first-time only):

   ```bash
   # Ensure you're logged in to npm
   npm login

   # Publish version 0.1.0 manually
   npm publish --access public
   ```

2. **Log in to [npmjs.com](https://www.npmjs.com/) and navigate to your package**:
   - Go to: `https://www.npmjs.com/package/deepagentsdk`
   - Click **Settings** tab

3. **Add GitHub as a Trusted Publisher**:
   - Scroll to **"Publishing access"** section
   - Click **"Add a trusted publisher"**
   - Select **GitHub Actions** as the provider
   - Fill in the details exactly as shown (**case-sensitive**, must match exactly):
     - **Repository owner**: `chrispangg` (your GitHub username/org)
     - **Repository name**: `deepagentsdk`
     - **Workflow file**: `publish.yaml` (include .yaml extension)
     - **Environment**: Leave blank (we're not using deployment environments)
   - Click **Add**

4. **Done!** Future publishes will authenticate automatically via OIDC

**Important Notes:**

- All fields are **case-sensitive** and must match exactly
- Workflow filename must include the extension (.yaml or .yml)
- A 404 error during publish usually means configuration mismatch
- Each package can only have one trusted publisher at a time

**Why Trusted Publishers?**

- ✅ No secrets to manage or rotate
- ✅ More secure (short-lived OIDC tokens)
- ✅ Automatic provenance attestation
- ✅ Better audit trail

**See:** [npm Trusted Publishers documentation](https://docs.npmjs.com/trusted-publishers)

## How It Works

### Automatic Publishing

The workflow (`publish.yml`) automatically:

1. **Detects code changes** - Only triggers on changes to:
   - `src/**` (source code)
   - `package.json`
   - `tsconfig.json`
   - `bun.lockb`

2. **Skips documentation changes** - Does NOT trigger for:
   - `examples/**` (example files)
   - `*.md` files (README, CHANGELOG, etc.)
   - `.github/**` (workflow files)
   - `.docs/**` (agent instructions)
   - `.refs/**` (reference implementations)
   - `docs/**` (documentation)

3. **Runs quality checks**:
   - Type checking (`bun run typecheck`)
   - Unit tests (`bun test`)

4. **Determines version bump** by analyzing ALL commits since last version tag:
   - **Major** (1.0.0 → 2.0.0): ANY commit contains "breaking" or "major"
   - **Minor** (1.0.0 → 1.1.0): ANY commit contains "feat" or "feature" (and no breaking changes)
   - **Patch** (1.0.0 → 1.0.1): Default when no major/minor keywords found
   - **Priority**: Major > Minor > Patch (highest level wins)

5. **Publishes to npm**:
   - Bumps version in `package.json`
   - Commits and pushes version bump with `[skip ci]`
   - Publishes to npm with provenance
   - Creates GitHub release with tag

### Commit Message Examples

**Single Commit Pushes:**

```bash
# Patch release (1.0.0 → 1.0.1)
git commit -m "fix: resolve bug in filesystem backend"
git push origin main

# Minor release (1.0.0 → 1.1.0)
git commit -m "feat: add Redis checkpointer support"
git push origin main

# Major release (1.0.0 → 2.0.0)
git commit -m "breaking: remove deprecated API methods"
git push origin main
```

**Multi-Commit Pushes:**

The workflow analyzes ALL commits since the last version tag. The highest priority change determines the version bump.

```bash
# Scenario 1: Multiple fixes → Patch (1.0.0 → 1.0.1)
git commit -m "fix: resolve memory leak"
git commit -m "fix: handle edge case in parser"
git commit -m "chore: update dependencies"
git push origin main
# Result: Patch bump (no feat/breaking found)

# Scenario 2: Fixes + Feature → Minor (1.0.0 → 1.1.0)
git commit -m "fix: resolve checkpointer bug"
git commit -m "feat: add parallel subagent execution"
git commit -m "docs: update examples"
git push origin main
# Result: Minor bump (feat found, no breaking)

# Scenario 3: Feature + Breaking → Major (1.0.0 → 2.0.0)
git commit -m "feat: add new caching layer"
git commit -m "fix: resolve type errors"
git commit -m "breaking: change createDeepAgent signature"
git push origin main
# Result: Major bump (breaking found)

# Scenario 4: Documentation only → No publish
git commit -m "docs: update README"
git commit -m "docs: add API examples"
git push origin main
# Result: No publish (only .md files changed)
```

## Manual Publishing

If you need to publish manually:

```bash
# Ensure you're on main and up to date
git checkout main
git pull

# Run quality checks
bun run typecheck
bun test

# Bump version (major, minor, or patch)
npm version patch -m "chore: bump version to %s"

# Push with tags
git push origin main --follow-tags

# Publish to npm
npm publish --access public
```

## Skipping CI

To push changes without triggering the workflow, include `[skip ci]` in your commit message:

```bash
git commit -m "docs: update README [skip ci]"
```

## Troubleshooting

### Publishing fails with "ENEEDAUTH", "403 Forbidden", or "401 Unauthorized"

**Checklist:**

- ✅ Verify you've configured the trusted publisher on npmjs.com
- ✅ Check that all fields match exactly (case-sensitive):
  - Repository owner: `chrispangg`
  - Repository name: `deepagentsdk`
  - Workflow file: `publish.yaml`
- ✅ Confirm your npm account has publish rights to `deepagentsdk`
- ✅ For first-time publish, publish manually once first (see step 1 above)
- ✅ Ensure the workflow has `id-token: write` permission (already configured)

### Workflow doesn't trigger

- Verify changes include files from the `paths` filter
- Check if commit message contains `[skip ci]`
- Ensure you pushed to the `main` branch

### Version bump conflicts

If the version bump commit conflicts:

1. Pull the latest changes: `git pull origin main`
2. Resolve conflicts in `package.json`
3. Push again

## Workflow Status

Check workflow runs at: [GitHub Actions](https://github.com/chrispangg/deepagentsdk/actions)
