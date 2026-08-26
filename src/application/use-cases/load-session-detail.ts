import type { AgentId } from "../../domain/agent"
import type { SessionDetail, SessionSummary } from "../../domain/session"
import type { AgentAdapter } from "../ports"

export async function loadSessionDetail(
  adapters: ReadonlyMap<AgentId, AgentAdapter>,
  session: SessionSummary,
  signal?: AbortSignal,
): Promise<SessionDetail> {
  const adapter = adapters.get(session.agentId)
  if (!adapter) throw new Error(`Agent is not registered: ${session.agentId}`)
  return adapter.parser.loadDetail(session, signal)
}
