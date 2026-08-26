import { lstat } from "node:fs/promises"
import os from "node:os"
import path from "node:path"
import type { AgentDetection, AgentInfo } from "../../domain/agent"
import type { SessionDetail, SessionSummary } from "../../domain/session"
import type { AgentAdapter, AgentScanResult, ScanOptions } from "../types"
import { normalizeProjectPath } from "../../utils/paths"
import { truncate } from "../../utils/truncate"
import { parseCodexSessionFile } from "./parser"
import { scanSessionFiles } from "../../services/scan-service"

export const defaultCodexHome = path.join(os.homedir(), ".codex")
export const defaultCodexSessionsDir = path.join(defaultCodexHome, "sessions")

export class CodexAdapter implements AgentAdapter {
  readonly id = "codex" as const
  readonly info: AgentInfo = { id: "codex", label: "Codex", status: "available" }
  readonly sessionsDir: string

  constructor(sessionsDir?: string) {
    const defaultDir = process.env.CODEX_HOME ? path.join(process.env.CODEX_HOME, "sessions") : defaultCodexSessionsDir
    this.sessionsDir = normalizeProjectPath(sessionsDir ?? process.env.AGC_CODEX_SESSIONS_DIR ?? defaultDir)
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
    return scanSessionFiles(this.sessionsDir, "Codex", parseCodexSessionFile, options)
  }

  async loadDetail(session: SessionSummary): Promise<SessionDetail> {
    const parsed = await parseCodexSessionFile(session.filePath)
    const projectPath = normalizeProjectPath(parsed.projectPath ?? session.projectPath)
    const warnings = [...new Set([...session.warnings, ...parsed.warnings])]
    return {
      ...session,
      sessionId: parsed.sessionId ?? session.sessionId,
      projectPath,
      projectId: `project:${projectPath}`,
      title: truncate(parsed.title ?? session.title, 160) || "Untitled session",
      createdAt: parsed.createdAt ?? session.createdAt,
      recordCount: parsed.recordCount,
      messageCount: parsed.messageCount,
      firstUserMessage: parsed.firstUserMessage,
      lastUserMessage: parsed.lastUserMessage,
      providerModels: parsed.providerModels,
      warnings,
      rawCwd: parsed.projectPath,
      warningCount: warnings.length,
    }
  }
}
