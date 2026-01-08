/**
 * Status mapping adapter for AI SDK Elements
 *
 * Maps deepagentsdk AgentStatus to Elements UIStatus
 */

import type { AgentStatus } from "../../cli/hooks/useAgent";
import type { UIStatus } from "./types";

/**
 * Maps deepagentsdk AgentStatus to Elements UIStatus
 *
 * @param agentStatus - The agent status from useAgent hook
 * @returns The corresponding UI status for Elements components
 *
 * Mapping rules:
 * - idle/done → ready (agent is waiting for input)
 * - thinking/tool-call/subagent → submitted (agent is processing)
 * - streaming → streaming (agent is generating text)
 * - error → error (an error occurred)
 */
export function mapAgentStatusToUIStatus(
  agentStatus: AgentStatus
): UIStatus {
  switch (agentStatus) {
    case "thinking":
    case "tool-call":
    case "subagent":
      return "submitted";
    case "streaming":
      return "streaming";
    case "error":
      return "error";
    case "idle":
    case "done":
    default:
      return "ready";
  }
}
