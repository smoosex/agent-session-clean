export type AgentId = "pi" | "claude-code" | "codex" | "antigravity"
export type AgentStatus = "available" | "coming-soon" | "error"

export type AgentInfo = {
  id: AgentId
  label: string
  status: AgentStatus
  detail?: string
}

export type AgentDetection = {
  available: boolean
  location?: string
  reason?: string
}
