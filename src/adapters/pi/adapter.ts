import { lstat } from "node:fs/promises"
import os from "node:os"
import path from "node:path"
import type { AgentDetection, AgentInfo } from "../../domain/agent"
import type { SessionDetail, SessionSummary } from "../../domain/session"
import type { AgentAdapter, AgentScanResult, ScanOptions } from "../types"
import { parsePiSessionFile } from "./parser"
import { scanPiSessions } from "../../services/scan-service"
import { normalizeProjectPath } from "../../utils/paths"
import { truncate } from "../../utils/truncate"

export const defaultPiSessionsDir = path.join(os.homedir(), ".pi", "agent", "sessions")

export class PiAdapter implements AgentAdapter {
  readonly id = "pi" as const
  readonly info: AgentInfo = { id: "pi", label: "Pi", status: "available" }
  readonly sessionsDir: string

  constructor(sessionsDir?: string) {
    this.sessionsDir = normalizeProjectPath(sessionsDir ?? process.env.AGC_PI_SESSIONS_DIR ?? defaultPiSessionsDir)
    this.info.detail = this.sessionsDir
  }

  async detect(): Promise<AgentDetection> {
    try {
      const stats = await lstat(this.sessionsDir)
      if (!stats.isDirectory()) return { available: false, location: this.sessionsDir, reason: "Session path is not a directory" }
      return { available: true, location: this.sessionsDir }
    } catch (error) {
      return { available: false, location: this.sessionsDir, reason: error instanceof Error ? error.message : String(error) }
    }
  }

  scan(options?: ScanOptions): Promise<AgentScanResult> {
    return scanPiSessions(this.sessionsDir, options)
  }

  async loadDetail(session: SessionSummary): Promise<SessionDetail> {
    const parsed = await parsePiSessionFile(session.filePath)
    const projectPath = normalizeProjectPath(parsed.header?.cwd ?? session.projectPath)
    const warnings = [...new Set([...session.warnings, ...parsed.warnings])]
    return {
      ...session,
      sessionId: parsed.header?.id ?? session.sessionId,
      projectPath,
      projectId: `project:${projectPath}`,
      title: truncate(parsed.title ?? session.title, 160) || "Untitled session",
      createdAt: parsed.header?.timestamp ?? session.createdAt,
      recordCount: parsed.recordCount,
      messageCount: parsed.messageCount,
      firstUserMessage: parsed.firstUserMessage,
      lastUserMessage: parsed.lastUserMessage,
      providerModels: parsed.providerModels,
      warnings,
      version: parsed.header?.version,
      rawCwd: parsed.header?.cwd,
      warningCount: warnings.length,
    }
  }
}
