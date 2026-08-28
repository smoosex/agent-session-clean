export type AgentId = "pi" | "claude-code" | "codex" | "antigravity" | "opencode" | "grok"
export type AgentStatus = "available" | "coming-soon" | "error"

export type AgentCapabilities = {
  canDelete: boolean
  canBulkDelete: boolean
}

export type AgentInfo = {
  id: AgentId
  label: string
  status: AgentStatus
  detail?: string
  capabilities: AgentCapabilities
}

export type AgentDetection = {
  available: boolean
  location?: string
  reason?: string
}
