import type { AgentAdapter } from "../application/ports"
import type { AgentId, AgentInfo } from "../domain/agent"

export function createAgentRegistry(...adapters: AgentAdapter[]): Map<AgentId, AgentAdapter> {
  return new Map(adapters.map((adapter) => [adapter.id, adapter]))
}

export function listAgents(adapters: ReadonlyMap<AgentId, AgentAdapter>): AgentInfo[] {
  return [...adapters.values()].map((adapter) => adapter.info)
}
