import type { AgentDetection, AgentId, AgentInfo } from "../domain/agent"
import type { DeleteOptions, DeleteResult } from "../domain/operation"
import type { ParsedSession, ScanOptions, ScanResult, SessionSource } from "../domain/scan"
import type { SessionDetail, SessionSummary } from "../domain/session"

export interface SessionScanner {
  readonly rootPath: string
  detect(): Promise<AgentDetection>
  scan(options?: ScanOptions): Promise<ScanResult>
}

export interface SessionParser {
  parseSummary(source: SessionSource, signal?: AbortSignal): Promise<ParsedSession>
  loadDetail(session: SessionSummary, signal?: AbortSignal): Promise<SessionDetail>
}

export interface SessionDeleter {
  deleteSessions(sessions: readonly SessionSummary[], options?: DeleteOptions): Promise<DeleteResult>
}

export interface AgentAdapter {
  readonly id: AgentId
  readonly info: AgentInfo
  readonly scanner: SessionScanner
  readonly parser: SessionParser
  readonly deleter?: SessionDeleter
}
