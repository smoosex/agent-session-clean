import type { AgentId } from "./agent"

export type ProjectSummary = {
  id: string
  agentId: AgentId
  name: string
  location?: string
  displayPath: string
  sessionCount: number
  totalSizeBytes: number
  updatedAt: string
  warningCount: number
}
