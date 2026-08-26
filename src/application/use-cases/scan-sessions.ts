import type { AgentId } from "../../domain/agent"
import type { ScanOptions, ScanResult } from "../../domain/scan"
import type { AgentAdapter } from "../ports"

export async function scanSessions(adapters: ReadonlyMap<AgentId, AgentAdapter>, agentId: AgentId, options?: ScanOptions): Promise<ScanResult> {
  const adapter = adapters.get(agentId)
  if (!adapter) throw new Error(`Agent is not registered: ${agentId}`)
  return adapter.scanner.scan(options)
}
