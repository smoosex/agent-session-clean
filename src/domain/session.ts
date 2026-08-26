import type { AgentId } from "./agent"

export type SessionRef = {
  agentId: AgentId
  sourceId: string
}

export type DetailField = {
  label: string
  value: string
}

export type SessionSummary = {
  id: string
  ref: SessionRef
  agentId: AgentId
  sessionId?: string
  projectId: string
  projectName: string
  projectLocation?: string
  title: string
  createdAt?: string
  updatedAt: string
  sizeBytes?: number
  messageCount?: number
  firstUserMessage?: string
  lastUserMessage?: string
  providerModels: string[]
  warnings: string[]
}

export type SessionDetail = SessionSummary & {
  fields: DetailField[]
  warningCount: number
}
