import type { AgentAdapter } from "./types"
import type { AgentInfo, AgentId } from "../domain/agent"

const unavailableAgents: AgentInfo[] = [
  { id: "claude-code", label: "Claude Code", status: "coming-soon", detail: "Coming soon" },
  { id: "codex", label: "Codex", status: "coming-soon", detail: "Coming soon" },
  { id: "antigravity", label: "Antigravity", status: "coming-soon", detail: "Coming soon" },
]

export function createAgentRegistry(piAdapter: AgentAdapter): Map<AgentId, AgentAdapter> {
  return new Map([[piAdapter.id, piAdapter]])
}

export function listAgents(piAdapter: AgentAdapter): AgentInfo[] {
  return [piAdapter.info, ...unavailableAgents]
}
