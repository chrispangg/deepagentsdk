# Publishing Guide

This repository uses GitHub Actions to automatically publish to npm when code changes are pushed to the `main` branch.

## Setup

You need to configure npm authentication for automated publishing. Choose **ONE** of these methods:

### Option 1: npm Token (Simplest for First-Time Setup)

**Steps:**

1. **Create an npm access token**:
   - Log in to [npmjs.com](https://www.npmjs.com/)
   - Go to **Access Tokens** → **Generate New Token**
   - Select **"Automation"** type
   - Copy the token (starts with `npm_...`)

2. **Add the token to GitHub Secrets**:
   - Go to your GitHub repo: Settings → Secrets and variables → Actions
   - Click **"New repository secret"**
   - Name: `NPM_TOKEN`
   - Value: Paste your npm token
   - Click **"Add secret"**

3. **Done!** The workflow will use this token to publish

### Option 2: npm Trusted Publishers (Advanced, More Secure)

**npm Trusted Publishers** use GitHub OIDC for secure, token-free publishing.

**Requirements:**
- Package must exist on npm (do a manual first publish)
- More complex initial setup

**Steps:**

1. **Log in to [npmjs.com](https://www.npmjs.com/)**

2. **Navigate to your package** (or create it if first publish):
   - Go to: `https://www.npmjs.com/package/ai-sdk-deep-agent`
   - Click **Settings** tab

3. **Add GitHub as a Trusted Publisher**:
   - Scroll to "Publishing access" section
   - Click **"Add a trusted publisher"**
   - Select **GitHub Actions** as the provider
   - Fill in the details:
     - **Repository owner**: `chrispangg` (your GitHub username/org)
     - **Repository name**: `ai-sdk-deepagent`
     - **Workflow file**: `publish.yaml`
     - **Environment**: Leave blank (not using deployment environments)
   - Click **Add**

4. **Done!** The workflow will now authenticate automatically using OIDC

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
   - `.agent/**` (agent instructions)
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

### Publishing fails with "403 Forbidden" or "401 Unauthorized"

**For Trusted Publishers:**

- Verify you've configured the trusted publisher on npmjs.com
- Check that the GitHub repository owner/name matches exactly
- Ensure the workflow filename is correct (`publish.yaml`)
- Confirm your npm account has publish rights to `ai-sdk-deep-agent`
- For first-time publish, you may need to publish manually once first

**If using npm token (legacy):**

- Check that `NPM_TOKEN` secret is set correctly
- Verify the token has "Automation" permissions

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

Check workflow runs at: [GitHub Actions](https://github.com/chrispangg/ai-sdk-deepagent/actions)
