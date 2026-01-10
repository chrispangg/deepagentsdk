// Re-export all types from modular files for backward compatibility
export type { ModelMessage, LanguageModel } from "ai";

// Core types
export type {
  AgentMemoryOptions,
  TodoItem,
  DeepAgentToolChoice,
  PrepareStepResult,
  PrepareStepArgs,
  PrepareStepFunction,
  LoopControlOptions,
  GenerationOptions,
  AdvancedAgentOptions,
  SummarizationConfig,
  CreateDeepAgentParams,
} from "./core";

// Backend types
export type {
  FileData,
  FileInfo,
  GrepMatch,
  WriteResult,
  EditResult,
  DeepAgentState,
  BackendProtocol,
  BackendFactory,
  ExecuteResponse,
  SandboxBackendProtocol,
  FileOperationError,
  FileUploadResponse,
  FileDownloadResponse,
} from "./backend";

export { isSandboxBackend } from "./backend";

// Event types
export type {
  TextEvent,
  StepStartEvent,
  StepFinishEvent,
  ToolCallEvent,
  ToolResultEvent,
  TodosChangedEvent,
  FileWriteStartEvent,
  FileWrittenEvent,
  FileEditedEvent,
  FileReadEvent,
  LsEvent,
  GlobEvent,
  GrepEvent,
  ExecuteStartEvent,
  ExecuteFinishEvent,
  WebSearchStartEvent,
  WebSearchFinishEvent,
  HttpRequestStartEvent,
  HttpRequestFinishEvent,
  FetchUrlStartEvent,
  FetchUrlFinishEvent,
  SubagentStartEvent,
  SubagentFinishEvent,
  SubagentStepEvent,
  TextSegmentEvent,
  UserMessageEvent,
  ApprovalRequestedEvent,
  ApprovalResponseEvent,
  CheckpointSavedEvent,
  CheckpointLoadedEvent,
  DoneEvent,
  ErrorEvent,
  DeepAgentEvent,
  EventCallback,
  ToolEventContext,
  StreamWithEventsOptions,
} from "./events";

// Subagent types
export type {
  DynamicApprovalConfig,
  InterruptOnConfig,
  BuiltinToolCreator,
  SubagentToolConfig,
  SubAgent,
} from "./subagent";

// Structured output types
export type {
  StructuredAgentResult,
} from "./structured-output";

export {
  hasStructuredOutput,
  eventHasStructuredOutput,
  getStructuredOutput,
  getEventOutput,
} from "./structured-output";