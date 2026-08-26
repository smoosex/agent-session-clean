import type { AgentId, AgentInfo } from "../../domain/agent"
import type { DeleteOptions, DeleteResult } from "../../domain/operation"
import type { ScanOptions, ScanResult } from "../../domain/scan"
import type { SessionDetail, SessionSummary } from "../../domain/session"
import type { AgentAdapter } from "../ports"
import { deleteSessions } from "./delete-sessions"
import { loadSessionDetail } from "./load-session-detail"
import { scanSessions } from "./scan-sessions"

export type AgentUseCases = {
  agents: AgentInfo[]
  scanSessions: (agentId: AgentId, options?: ScanOptions) => Promise<ScanResult>
  loadSessionDetail: (session: SessionSummary, signal?: AbortSignal) => Promise<SessionDetail>
  deleteSessions: (sessions: readonly SessionSummary[], options?: DeleteOptions) => Promise<DeleteResult>
}

export function createAgentUseCases(adapters: ReadonlyMap<AgentId, AgentAdapter>): AgentUseCases {
  return {
    agents: [...adapters.values()].map((adapter) => adapter.info),
    scanSessions: (agentId, options) => scanSessions(adapters, agentId, options),
    loadSessionDetail: (session, signal) => loadSessionDetail(adapters, session, signal),
    deleteSessions: (sessions, options) => deleteSessions(adapters, sessions, options),
  }
}
