import type { AgentAdapter } from "./types"
import type { AgentInfo, AgentId } from "../domain/agent"

export function createAgentRegistry(piAdapter: AgentAdapter, codexAdapter?: AgentAdapter): Map<AgentId, AgentAdapter> {
  const adapters = new Map<AgentId, AgentAdapter>([[piAdapter.id, piAdapter]])
  if (codexAdapter) adapters.set(codexAdapter.id, codexAdapter)
  return adapters
}

export function listAgents(adapters: ReadonlyMap<AgentId, AgentAdapter>): AgentInfo[] {
  return [...adapters.values()].map((adapter) => adapter.info)
}
