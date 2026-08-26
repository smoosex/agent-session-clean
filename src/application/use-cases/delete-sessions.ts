import type { AgentId } from "../../domain/agent"
import type { DeleteOptions, DeleteResult } from "../../domain/operation"
import type { SessionSummary } from "../../domain/session"
import type { AgentAdapter } from "../ports"

export async function deleteSessions(
  adapters: ReadonlyMap<AgentId, AgentAdapter>,
  sessions: readonly SessionSummary[],
  options?: DeleteOptions,
): Promise<DeleteResult> {
  const groups = new Map<AgentId, SessionSummary[]>()
  for (const session of sessions) {
    const group = groups.get(session.agentId) ?? []
    group.push(session)
    groups.set(session.agentId, group)
  }

  const items: DeleteResult["items"] = []
  for (const [agentId, group] of groups) {
    if (options?.signal?.aborted) throw new DOMException("Delete aborted", "AbortError")
    const adapter = adapters.get(agentId)
    if (!adapter?.deleter) {
      items.push(...group.map((session) => ({ sessionId: session.id, success: false, message: `${adapter?.info.label ?? agentId} does not support deletion` })))
      continue
    }
    try {
      const result = await adapter.deleter.deleteSessions(group, options)
      items.push(...result.items)
    } catch (error) {
      if ((error as Error).name === "AbortError" || (error as NodeJS.ErrnoException).code === "ABORT_ERR") throw error
      items.push(...group.map((session) => ({ sessionId: session.id, success: false, message: error instanceof Error ? error.message : String(error) })))
    }
  }
  return { items }
}
