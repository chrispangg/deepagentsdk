# Test Cases: Cloud Sandbox Providers

**Test File**: `test-integration/backends/sandbox-providers.test.ts`
**Generated**: 2025-01-11
**Total Tests**: 38

## Quick Start

```bash
# Run all sandbox provider tests (only runs tests for providers with API keys)
bun test test-integration/backends/sandbox-providers.test.ts

# Run specific provider tests
bun test test-integration/backends/sandbox-providers.test.ts -t "E2B Sandbox Backend"
bun test test-integration/backends/sandbox-providers.test.ts -t "Modal Sandbox Backend"
bun test test-integration/backends/sandbox-providers.test.ts -t "Runloop Sandbox Backend"
bun test test-integration/backends/sandbox-providers.test.ts -t "Daytona Sandbox Backend"

# Run with coverage
bun test --coverage test-integration/backends/sandbox-providers.test.ts

# Run specific test
bun test test-integration/backends/sandbox-providers.test.ts -t "creates sandbox with valid API key"
```

## Environment Variables

Tests are gated by API key availability. Set these in `.env` or environment:

```bash
# E2B (required for E2B tests)
E2B_API_KEY=your_e2b_api_key

# Modal (required for Modal tests)
MODAL_TOKEN_ID=your_modal_token_id
MODAL_TOKEN_SECRET=your_modal_token_secret

# Runloop (required for Runloop tests)
RUNLOOP_API_KEY=your_runloop_api_key

# Daytona (required for Daytona tests)
DAYTONA_API_KEY=your_daytona_api_key
```

**Note**: Tests automatically skip if required API keys are not present.

## Test Organization

### E2B Sandbox Backend (10 tests)
- `sandbox-providers.test.ts:132` - creates sandbox with valid API key
- `sandbox-providers.test.ts:150` - executes shell commands
- `sandbox-providers.test.ts:170` - performs complete file operations
- `sandbox-providers.test.ts:186` - edits file content
- `sandbox-providers.test.ts:202` - handles non-existent file read
- `sandbox-providers.test.ts:220` - handles large file upload
- `sandbox-providers.test.ts:244` - handles command timeout
- `sandbox-providers.test.ts:266` - rejects invalid API key
- `sandbox-providers.test.ts:283` - handles invalid command gracefully
- `sandbox-providers.test.ts:302` - reconnects to existing sandbox

### Modal Sandbox Backend (6 tests)
- `sandbox-providers.test.ts:330` - creates sandbox with valid credentials
- `sandbox-providers.test.ts:355` - executes shell commands
- `sandbox-providers.test.ts:375` - performs complete file operations
- `sandbox-providers.test.ts:391` - edits file content
- `sandbox-providers.test.ts:407` - handles custom image
- `sandbox-providers.test.ts:427` - handles concurrent file operations

### Runloop Sandbox Backend (7 tests)
- `sandbox-providers.test.ts:459` - creates devbox with valid API key
- `sandbox-providers.test.ts:481` - executes shell commands
- `sandbox-providers.test.ts:501` - performs complete file operations
- `sandbox-providers.test.ts:517` - edits file content
- `sandbox-providers.test.ts:533` - connects to existing devbox
- `sandbox-providers.test.ts:558` - handles long-running commands

### Daytona Sandbox Backend (7 tests)
- `sandbox-providers.test.ts:588` - creates sandbox with valid API key
- `sandbox-providers.test.ts:610` - executes shell commands
- `sandbox-providers.test.ts:630` - performs complete file operations
- `sandbox-providers.test.ts:646` - edits file content
- `sandbox-providers.test.ts:662` - supports different languages
- `sandbox-providers.test.ts:681` - handles environment variables

### Cross-Provider Compatibility (4 tests)
- `sandbox-providers.test.ts:708` - E2B: implements SandboxBackendProtocol correctly
- `sandbox-providers.test.ts:730` - Modal: implements SandboxBackendProtocol correctly
- `sandbox-providers.test.ts:752` - Runloop: implements SandboxBackendProtocol correctly
- `sandbox-providers.test.ts:774` - Daytona: implements SandboxBackendProtocol correctly

## Coverage Summary

- ✅ **Happy paths**: 16 tests (basic operations, file operations)
- ✅ **Edge cases**: 12 tests (large files, timeouts, concurrent ops, custom images)
- ✅ **Error scenarios**: 6 tests (invalid keys, missing files, invalid commands)
- ✅ **Protocol compliance**: 4 tests (interface implementation)
- ✅ **Advanced features**: 4 tests (reconnection, custom configs, language support)

## Test Helpers

### `testSandboxFileOperations(backend, workingDir)`
Tests complete file operation cycle: write, read, ls, grep, download, delete.
**Used**: 4 times (once per provider)

### `testCommandExecution(backend)`
Tests basic command execution with successful and failed commands.
**Used**: 4 times (once per provider)

### `testFileEditOperations(backend, workingDir)`
Tests file edit functionality with line replacement.
**Used**: 4 times (once per provider)

## Timeout Values

- **60 seconds**: E2B tests (fast startup)
- **120 seconds**: Modal, Runloop, Daytona (slower startup)
- **30 seconds**: Error tests (fail fast)

## Implementation Status

These tests will pass once the backend implementations are complete in Phase 4. Until then, tests will fail with import errors for the backend classes.
