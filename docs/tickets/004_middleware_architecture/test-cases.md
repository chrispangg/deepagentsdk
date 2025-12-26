---
title: "Test Cases: Middleware Architecture"
description: Documentation
---

This document defines comprehensive test cases for the Middleware Architecture feature using TDD (Test-Driven Development).

**Test Case Structure**: Each test follows Arrange-Act-Assert pattern with comment-based DSL functions.

---

## Phase 1: Model Middleware Support

### 1.1 Basic Middleware Wrapping

#### 1. Model wrapping with single middleware
```typescript
// Setup
createAgentWithSingleMiddleware

// Action
modelIsWrapped

// Assert
expectModelIsInstanceOfWrappedLanguageModel
expectMiddlewareIsApplied
```

**Scenario**: Verify that a single middleware is correctly applied to the model wrapper.

**Key Validations**:
- Model becomes a wrapped instance
- Middleware is accessible and active
- Type system recognizes wrapped model

---

#### 2. Model wrapping with multiple middleware
```typescript
// Setup
createAgentWithMultipleMiddleware

// Action
middlewareListIsProvided

// Assert
expectMiddlewareChainIsComposed
expectAllMiddlewareAreApplied
```

**Scenario**: Verify that multiple middleware are correctly composed in sequence.

**Key Validations**:
- All middleware are registered
- Composition order is preserved
- All middleware execute when model is called

---

#### 3. Model wrapping with undefined middleware
```typescript
// Setup
createAgentWithoutMiddleware

// Action
middlewareParameterIsOmitted

// Assert
expectModelRemainsUnwrapped
expectAgentWorksWithoutMiddleware
```

**Scenario**: Verify that agent works correctly when middleware parameter is not provided.

**Key Validations**:
- Model is not wrapped unnecessarily
- Agent functions normally without middleware
- No performance overhead

---

#### 4. Model wrapping with empty middleware array
```typescript
// Setup
createAgentWithEmptyMiddlewareArray

// Action
emptyArrayIsProvided

// Assert
expectModelRemainsUnwrapped
expectNoCompositionError
```

**Scenario**: Verify that empty middleware array doesn't cause errors.

**Key Validations**:
- Empty array is handled gracefully
- No unnecessary wrapping occurs
- Agent still functions

---

### 1.2 Logging Middleware

#### 5. Logging middleware captures model calls
```typescript
// Setup
createAgentWithLoggingMiddleware
modelIsConfiguredWithLogging

// Action
agentGeneratesResponse

// Assert
expectModelCallIsLogged
expectDurationIsRecorded
expectInputParametersAreLogged
expectOutputIsLogged
```

**Scenario**: Verify logging middleware correctly intercepts and logs model invocations.

**Key Validations**:
- All model calls are logged
- Execution duration is measured
- Input and output are captured
- Log format is parseable

---

#### 6. Logging middleware doesn't interfere with response
```typescript
// Setup
createAgentWithLoggingMiddleware

// Action
agentGeneratesResponse

// Assert
expectResponseUnchanged
expectToolsUnchanged
expectStreamingBehaviorUnchanged
```

**Scenario**: Verify that logging is non-invasive and doesn't modify responses.

**Key Validations**:
- Response content is identical to unlogged version
- Tool definitions unchanged
- Streaming chunks unaltered

---

#### 7. Logging middleware handles errors gracefully
```typescript
// Setup
createAgentWithLoggingMiddleware
modelThrowsError

// Action
agentAttemptsGeneration

// Assert
expectErrorIsLogged
expectErrorIsPropagated
expectLoggingDoesntMaskError
```

**Scenario**: Verify logging doesn't suppress or modify error behavior.

**Key Validations**:
- Errors are logged before propagation
- Original error type is preserved
- Error stack trace is available

---

### 1.3 Caching Middleware

#### 8. Caching middleware stores and retrieves results
```typescript
// Setup
createAgentWithCachingMiddleware
cacheIsEmpty

// Action
identicalRequestIsCalledTwice

// Assert
expectFirstCallHitsModel
expectSecondCallReturnsCachedResult
expectModelIsNotCalledTwice
```

**Scenario**: Verify caching correctly stores and retrieves identical requests.

**Key Validations**:
- First call uses model
- Second call returns cached result
- Model invocation count is 1, not 2
- Cache hit is verifiable

---

#### 9. Caching middleware handles cache misses
```typescript
// Setup
createAgentWithCachingMiddleware
cacheIsEmpty

// Action
differentRequestsAreCalled

// Assert
expectEachRequestCallsModel
expectNoIncorrectCacheLookups
```

**Scenario**: Verify caching doesn't return stale results for different requests.

**Key Validations**:
- Each unique request calls model
- No incorrect cache hits occur
- Cache key computation is sound

---

#### 10. Caching middleware expires entries
```typescript
// Setup
createAgentWithCachingMiddleware
cacheTimeToLiveIsSet

// Action
requestIsMadeAndCacheExpires

// Assert
expectCacheEntryIsEvicted
expectModelIsCalledAgain
```

**Scenario**: Verify cache TTL works and entries expire correctly.

**Key Validations**:
- Cache entries expire after TTL
- Expired entries are removed
- Model is called again after expiration

---

### 1.4 Middleware Composition

#### 11. Multiple middleware execute in order
```typescript
// Setup
createAgentWithLoggingAndCachingMiddleware
middlewareOrderIsSpecified

// Action
agentGeneratesResponse

// Assert
expectLoggingMiddlewareExecutesFirst
expectCachingMiddlewareExecutesSecond
expectBothMiddlewareAreActive
```

**Scenario**: Verify middleware execute in the order specified.

**Key Validations**:
- Execution order is deterministic
- First middleware sees raw call
- Second middleware sees first's result
- Order is reversible and produces different results

---

#### 12. Middleware composition doesn't break streaming
```typescript
// Setup
createAgentWithMultipleMiddleware

// Action
agentStreamsResponse

// Assert
expectStreamingWorksThroughMiddleware
expectChunksAreDeliveredCorrectly
expectAllChunksAreLogged
```

**Scenario**: Verify streaming works correctly through middleware chain.

**Key Validations**:
- Streaming is not buffered
- Chunks arrive in order
- Middleware don't delay streaming
- All chunks are processed

---

#### 13. Middleware errors are handled correctly
```typescript
// Setup
createAgentWithFaultyMiddleware
middlewareThrowsError

// Action
agentAttemptsGeneration

// Assert
expectErrorIsPropagated
expectOtherMiddlewareStillExecute
expectAgentFailsGracefully
```

**Scenario**: Verify error in one middleware doesn't break the chain.

**Key Validations**:
- Error is properly propagated
- Earlier middleware still execute
- Later middleware can see the error
- Agent can recover with try-catch

---

## Phase 2: Skills System

### 2.1 Skill Loading and Discovery

#### 14. Skill metadata is loaded from SKILL.md files
```typescript
// Setup
skillFilesExistInSkillsDirectory
skillFilesHaveProperYAMLFrontmatter

// Action
agentIsInitializedWithSkillsConfig

// Assert
expectSkillMetadataIsParsed
expectSkillNameIsExtracted
expectSkillDescriptionIsExtracted
```

**Scenario**: Verify skill metadata is correctly parsed from SKILL.md files.

**Key Validations**:
- YAML frontmatter is parsed
- Name field is extracted
- Description field is extracted
- Metadata is available to agent

---

#### 15. Multiple skills are discovered
```typescript
// Setup
multipleSkillFilesExist
eachSkillHasValidStructure

// Action
agentScansSkillsDirectory

// Assert
expectAllSkillsAreDiscovered
expectNoSkillsAreMissed
expectSkillsAreIndexedByName
```

**Scenario**: Verify all skills in directory are discovered.

**Key Validations**:
- All skill files are found
- No files are skipped
- Skills are indexed for fast lookup
- Discovery is recursive if configured

---

#### 16. Skill discovery handles missing files gracefully
```typescript
// Setup
skillsDirectoryContainsMissingFiles
someSkillFilesAreCorrupted

// Action
agentInitializesWithSkillsConfig

// Assert
expectValidSkillsAreLoaded
expectErrorsAreReportedForInvalidSkills
expectAgentContinuesWithValidSkills
```

**Scenario**: Verify agent doesn't crash on invalid skill files.

**Key Validations**:
- Valid skills are loaded
- Errors are reported with context
- Agent continues functioning
- User can identify problematic skills

---

#### 17. Skill names and descriptions are unique
```typescript
// Setup
multipleSkillsExist
someSkillsHaveDuplicateNames

// Action
agentLoadsSkills

// Assert
expectDuplicateSkillNamesAreDetected
expectWarningIsIssued
expectLaterSkillOverridersEarlierSkill
```

**Scenario**: Verify duplicate skill names are handled.

**Key Validations**:
- Duplicates are detected
- Warning is issued to user
- Later skill overrides earlier (or vice versa, configurable)
- No silent overwrites

---

### 2.2 Skill Injection Into System Prompt

#### 18. Skill metadata is injected into system prompt
```typescript
// Setup
skillsAreLoaded
systemPromptTemplateExists

// Action
agentIsInitialized

// Assert
expectSystemPromptContainsSkillsSection
expectEachSkillHasNameAndDescription
expectSkillListIsFormattedCorrectly
```

**Scenario**: Verify skills are injected into system prompt for model awareness.

**Key Validations**:
- System prompt includes skills section
- Each skill appears exactly once
- Format is human-readable
- Format can be parsed by model

---

#### 19. System prompt includes instructions for progressive disclosure
```typescript
// Setup
skillsAreLoaded
systemPromptTemplateExists

// Action
agentIsInitialized

// Assert
expectSystemPromptIncludesDisclosureInstructions
expectInstructionsGuideSkillLoading
expectInstructionsExplainCallConvention
```

**Scenario**: Verify system prompt explains how to use skills.

**Key Validations**:
- Instructions are clear
- Instructions mention read_file pattern
- Instructions explain skill paths
- Instructions are concise

---

#### 20. Skill metadata doesn't exceed token limits
```typescript
// Setup
manySkillsAreLoaded
eachSkillHasLongDescription

// Action
systemPromptIsGenerated

// Assert
expectMetadataIsConcise
expectTokenCountIsReasonable
expectPromptFitsWithinBudget
```

**Scenario**: Verify skill metadata doesn't bloat prompt tokens.

**Key Validations**:
- Descriptions are truncated if needed
- Token count is acceptable
- Truncation preserves meaning
- User is warned if budget exceeded

---

#### 21. System prompt generation handles empty skills
```typescript
// Setup
noSkillsExist
skillsConfigIsEmpty

// Action
agentIsInitialized

// Assert
expectSystemPromptIsValid
expectNoSkillsSectionIsIncluded
expectAgentFunctionsNormally
```

**Scenario**: Verify agent works without any skills.

**Key Validations**:
- System prompt is valid
- No empty skills section
- Agent functions normally
- No errors about missing skills

---

### 2.3 Progressive Skill Loading

#### 22. Skill content is loaded on-demand
```typescript
// Setup
skillMetadataIsInPrompt
skillContentIsNotYetLoaded

// Action
agentRequestsSkillContent

// Assert
expectSkillFileIsRead
expectContentIsInjectedIntoContext
expectModelCanAccessFullSkill
```

**Scenario**: Verify skills are loaded progressively, not all upfront.

**Key Validations**:
- Metadata doesn't include full content
- Content is read only when needed
- Content is available in context
- Model can process full content

---

#### 23. Skill content is injected via read_file tool
```typescript
// Setup
skillExists
agentWantsToUseSkill

// Action
agentCallsReadFileWithSkillPath

// Assert
expectSkillContentIsReturned
expectContentIncludesAllSections
expectModelCanProcessContent
```

**Scenario**: Verify read_file tool returns skill content correctly.

**Key Validations**:
- read_file returns full skill content
- YAML frontmatter is stripped
- All markdown sections included
- Content is properly formatted

---

#### 24. Multiple skills can be loaded in single conversation
```typescript
// Setup
multipleSkillsExist
agentNeedsAccessToMultipleSkills

// Action
agentLoadsFirstSkillThenSecondSkill

// Assert
expectBothSkillsAreAccessible
expectNoConflictsBetweenSkills
expectContextDoesntOverflow
```

**Scenario**: Verify agent can load multiple skills in sequence.

**Key Validations**:
- Both skills accessible after loading
- Skills don't interfere with each other
- Context growth is manageable
- No truncation of skill content

---

#### 25. Skill loading fails gracefully for missing skills
```typescript
// Setup
agentTriesToLoadNonexistentSkill
skillFileDoesNotExist

// Action
agentCallsReadFileWithInvalidSkillPath

// Assert
expectFileNotFoundError
expectErrorMessageIsInformative
expectAgentCanRecoverFromError
```

**Scenario**: Verify agent handles missing skill files gracefully.

**Key Validations**:
- Appropriate error is returned
- Error message mentions skill path
- Error suggests alternatives
- Agent can continue after error

---

### 2.4 Skill Content Validation

#### 26. Skill files with valid YAML frontmatter are parsed correctly
```typescript
// Setup
skillFileHasValidYAMLFrontmatter
fronmatterContainsNameAndDescription

// Action
skillMetadataIsExtracted

// Assert
expectNameIsParsed
expectDescriptionIsParsed
expectFrontmatterIsRemovedFromContent
```

**Scenario**: Verify proper YAML frontmatter is parsed correctly.

**Key Validations**:
- Name field is extracted
- Description field is extracted
- Frontmatter delimiter is recognized
- Content after frontmatter is preserved

---

#### 27. Skill files without frontmatter are rejected
```typescript
// Setup
skillFileHasMissingFrontmatter
fileExistsButLacksYAMLFormat

// Action
skillLoadingAttempted

// Assert
expectValidationErrorIsRaised
expectErrorMessageIndicatesMissingFrontmatter
expectSkillIsNotLoaded
```

**Scenario**: Verify invalid skill files are rejected.

**Key Validations**:
- Validation error is raised
- Error message is clear
- Skill is not loaded
- Agent doesn't crash

---

#### 28. Skill files with malformed YAML frontmatter are handled
```typescript
// Setup
skillFileHasInvalidYAML
YAMLSyntaxIsIncorrect

// Action
skillLoadingAttempted

// Assert
expectParsingErrorIsRaised
expectErrorMessageIndicatesInvalidYAML
expectSkillIsNotLoaded
```

**Scenario**: Verify malformed YAML is detected.

**Key Validations**:
- YAML parse error is caught
- Error message indicates syntax issue
- Skill is not loaded
- Agent continues with other skills

---

#### 29. Skill files with missing required fields are rejected
```typescript
// Setup
skillFileHasFrontmatterButMissingRequiredFields
nameOrDescriptionIsMissing

// Action
skillLoadingAttempted

// Assert
expectValidationErrorIsRaised
expectErrorMessageIndicatesMissingField
expectSkillIsNotLoaded
```

**Scenario**: Verify required fields are enforced.

**Key Validations**:
- Missing field is detected
- Error message indicates which field
- Skill is not loaded
- Validation is strict

---

### 2.5 Skills and Filesystem Integration

#### 30. Skills are organized in dedicated directory structure
```typescript
// Setup
skillsDirectoryIsConfigured
skillsArePlacedInCorrectLocations

// Action
agentInitializes

// Assert
expectSkillsAreFoundByPath
expectDirectoryStructureIsPreserved
expectNoSkillsAreMisplaced
```

**Scenario**: Verify skills directory structure is respected.

**Key Validations**:
- Skills are found in configured directory
- Subdirectories are navigable
- No skills in unexpected locations
- Path construction is correct

---

#### 31. Skills can include subdirectories for related files
```typescript
// Setup
skillWithSubdirectoryStructureExists
skillIncludesAuxiliaryFiles

// Action
skillIsLoaded

// Assert
expectSkillRootDirectoryIsIdentified
expectSubdirectoriesArePreserved
expectRelativePathsInSkillsWorkCorrectly
```

**Scenario**: Verify skills can have complex directory structures.

**Key Validations**:
- Skill root is correctly identified
- Subdirectories don't interfere
- Relative paths work from skill root
- Auxiliary files can be referenced

---

#### 32. Skill updates are reflected without agent restart
```typescript
// Setup
skillFileIsModified
skillDescriptionIsUpdated

// Action
agentReloadsSkillMetadata

// Assert
expectNewDescriptionIsUsed
expectOldDescriptionIsNotUsed
expectChangeIsImmediateWithoutRestart
```

**Scenario**: Verify skill changes are hot-reloaded.

**Key Validations**:
- New metadata is loaded on reload
- Old metadata is not cached
- No restart required
- Reloading is efficient

---

#### 33. Skill content can be modified and changes persist
```typescript
// Setup
skillContentIsModified
skillFileIsEdited

// Action
skillIsReloadedFromDisk

// Assert
expectNewContentIsLoaded
expectModificationsPersist
expectFileSystemReflectsChanges
```

**Scenario**: Verify skill content changes persist.

**Key Validations**:
- Modified content is read from disk
- Changes are not cached
- Filesystem reflects changes
- Multiple reloads work

---

### 2.6 Skills and Middleware Interaction

#### 34. Middleware can intercept skill-related model calls
```typescript
// Setup
middlewareAndSkillsAreConfigured
loggingMiddlewareIsActive

// Action
agentLoadsAndUsesSkill

// Assert
expectSkillLoadCallIsLogged
expectSkillContentTransferIsLogged
expectMiddlewareSeesAllSkillInteractions
```

**Scenario**: Verify middleware sees all skill operations.

**Key Validations**:
- Model calls for skill loading are logged
- Content transfer is visible to middleware
- Middleware can modify skill operations
- No skill operations bypass middleware

---

#### 35. Caching middleware works with skill loading
```typescript
// Setup
cachingMiddlewareAndSkillsAreConfigured
skillIsLoadedAndUsed

// Action
identicalSkillIsRequestedAgain

// Assert
expectFirstLoadHitsFilesystem
expectSecondLoadReturnsCached
expectCachingDoesNotBreakSkillContent
```

**Scenario**: Verify caching works correctly with skill loading.

**Key Validations**:
- First skill load reads from filesystem
- Second identical load uses cache
- Cached content is identical to original
- Caching improves performance

---

#### 36. Multiple middleware and skills work together
```typescript
// Setup
multipleMiddlewareAndMultipleSkillsExist
systemIsFullyConfigured

// Action
agentGeneratesWithMultipleSkills

// Assert
expectAllMiddlewareAreActive
expectAllSkillsAreAccessible
expectNoConflictsOrInterference
```

**Scenario**: Verify full feature integration works correctly.

**Key Validations**:
- All middleware execute correctly
- All skills are accessible
- No conflicts between features
- System is stable under load

---

## Summary

**Total Test Cases**: 36

**By Phase**:
- Phase 1 (Middleware): 13 tests
- Phase 2 (Skills): 23 tests

**By Category**:
- Happy Paths: 16 tests
- Edge Cases: 12 tests
- Error Scenarios: 8 tests

**DSL Functions Required**: 130 functions across setup, action, and assertion categories

**Execution Order**: Tests should be implemented and executed in the order listed, as later tests may depend on earlier infrastructure being in place.
