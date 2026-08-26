import type { AgentDetection, AgentId, AgentInfo } from "../domain/agent"
import type { SessionDetail, SessionSummary } from "../domain/session"
import type { ProjectSummary } from "../domain/project"

export type ScanStatus = "idle" | "scanning" | "complete" | "error"

export type ScanIssue = {
  path?: string
  message: string
  severity: "warning" | "error"
}

export type AgentScanResult = {
  rootPath: string
  projects: ProjectSummary[]
  sessions: SessionSummary[]
  issues: ScanIssue[]
  scannedFiles: number
  failedFiles: number
}

export type ScanOptions = {
  signal?: AbortSignal
}

export interface AgentAdapter {
  readonly id: AgentId
  readonly info: AgentInfo
  detect(): Promise<AgentDetection>
  scan(options?: ScanOptions): Promise<AgentScanResult>
  loadDetail(session: SessionSummary): Promise<SessionDetail>
}
