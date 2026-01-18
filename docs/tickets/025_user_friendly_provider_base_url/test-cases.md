# Test Cases: Provider Base URL Configuration

**Test File**: `test/utils/model-parser.test.ts`
**Generated**: 2026-01-18
**Total Tests**: 9

## Quick Start

```bash
# Run all tests
bun test test/utils/model-parser.test.ts

# Run specific phase
bun test test/utils/model-parser.test.ts -t "Phase 1"

# Watch mode
bun test --watch test/utils/model-parser.test.ts

# Coverage
bun test --coverage test/utils/model-parser.test.ts
```

## Test Organization

### Phase 1: Core parseModelString functionality (9 tests)

- `test/utils/model-parser.test.ts:20` - parses anthropic model string with full specification
- `test/utils/model-parser.test.ts:29` - parses openai model string with full specification
- `test/utils/model-parser.test.ts:42` - parses zhipu model string with full specification
- `test/utils/model-parser.test.ts:55` - defaults to anthropic when no provider specified
- `test/utils/model-parser.test.ts:69` - uses default model name for anthropic when model is empty
- `test/utils/model-parser.test.ts:81` - uses default model name for openai when model is empty
- `test/utils/model-parser.test.ts:93` - uses default model name for zhipu when model is empty
- `test/utils/model-parser.test.ts:105` - handles empty string input
- `test/utils/model-parser.test.ts:118` - handles multiple slashes in model string

## Coverage Summary

- ✅ Happy paths: 9 tests (current core functionality)
- ✅ Edge cases: 0 tests
- ✅ Error scenarios: 0 tests
- ✅ Boundary conditions: 0 tests
- ✅ Authorization: 0 tests

**Note**: These tests cover the CURRENT implementation. After implementing ticket 025 features (custom baseURL, apiKey, global config, caching, options override), create additional tests for:
- Phase 2: Global Configuration Management (setProvidersConfig, getProvidersConfig)
- Phase 3: Provider Instance Caching
- Phase 4: Options Parameter Override
- Phase 5: Configuration Application (custom baseURL, apiKey)
- Phase 6: Edge Cases and Boundary Conditions
- Phase 7: Backward Compatibility

## Implementation Notes

After implementing the new features from `docs/tickets/025_user_friendly_provider_base_url/plan.md`:

1. **Update imports** to include new types and functions:
   ```typescript
   import {
     parseModelString,
     setProvidersConfig,
     getProvidersConfig,
     type ProviderConfig,
     type ProvidersConfig,
     type ParseModelStringOptions,
   } from "@/utils/model-parser";
   ```

2. **Add tests for new functionality** (50+ additional tests):
   - Global config management (set, get, merge)
   - Provider caching (same config = same instance)
   - Options parameter override behavior
   - Custom baseURL configuration per provider
   - Custom apiKey configuration per provider
   - Configuration precedence (options > global > env > .env)
   - Edge cases (empty config, undefined values, special chars, etc.)
   - Backward compatibility (no config = default behavior)

3. **Run tests after implementation**:
   ```bash
   bun test test/utils/model-parser.test.ts
   ```

4. **Update this index** to reflect all phases and tests
