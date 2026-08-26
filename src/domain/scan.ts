import type { AgentId } from "./agent"
import type { ProjectSummary } from "./project"
import type { DetailField, SessionRef, SessionSummary } from "./session"

export type ScanStatus = "idle" | "scanning" | "complete" | "error"

export type ScanIssue = {
  location?: string
  message: string
  severity: "warning" | "error"
}

export type ScanOptions = {
  signal?: AbortSignal
}

export type SessionSource = {
  ref: SessionRef
  locator: string
  sizeBytes: number
  updatedAt: string
  createdAt?: string
}

export type ParsedSession = {
  sessionId?: string
  projectLocation?: string
  projectName?: string
  createdAt?: string
  title?: string
  messageCount?: number
  firstUserMessage?: string
  lastUserMessage?: string
  providerModels: string[]
  warnings: string[]
  detailFields: DetailField[]
}

export type ScanResult = {
  agentId: AgentId
  rootPath: string
  projects: ProjectSummary[]
  sessions: SessionSummary[]
  issues: ScanIssue[]
  scannedSources: number
  failedSources: number
}
