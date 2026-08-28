import { lstat, readdir } from "node:fs/promises"
import path from "node:path"
import type { AgentDetection } from "../../domain/agent"
import type { ProjectSummary } from "../../domain/project"
import type { ScanIssue, ScanOptions, ScanResult } from "../../domain/scan"
import type { SessionSummary } from "../../domain/session"
import type { SessionParser, SessionScanner } from "../../application/ports"
import { displayPath, normalizeProjectPath, projectId } from "../../utils/paths"
import { truncate } from "../../utils/truncate"

function timestampValue(value: string | undefined): number {
  if (!value) return 0
  const parsed = Date.parse(value)
  return Number.isFinite(parsed) ? parsed : 0
}

function sortByUpdated<T extends { updatedAt: string }>(items: T[]): T[] {
  return items.sort((left, right) => timestampValue(right.updatedAt) - timestampValue(left.updatedAt))
}

async function sessionDirs(rootPath: string, signal?: AbortSignal): Promise<string[]> {
  const found: string[] = []
  let projects: string[]
  try {
    projects = await readdir(rootPath)
  } catch {
    return found
  }
  for (const projectName of projects) {
    if (signal?.aborted) throw new DOMException("Scan aborted", "AbortError")
    const projectPath = path.join(rootPath, projectName)
    let projectStat
    try {
      projectStat = await lstat(projectPath)
    } catch {
      continue
    }
    if (!projectStat.isDirectory()) continue
    let children: string[]
    try {
      children = await readdir(projectPath)
    } catch {
      continue
    }
    for (const sessionName of children) {
      if (signal?.aborted) throw new DOMException("Scan aborted", "AbortError")
      const sessionPath = path.join(projectPath, sessionName)
      let sessionStat
      try {
        sessionStat = await lstat(sessionPath)
      } catch {
        continue
      }
      if (!sessionStat.isDirectory()) continue
      found.push(sessionPath)
    }
  }
  return found
}

export class GrokScanner implements SessionScanner {
  readonly rootPath: string
  private readonly parser: SessionParser

  constructor(rootPath: string, parser: SessionParser) {
    this.rootPath = rootPath
    this.parser = parser
  }

  async detect(): Promise<AgentDetection> {
    try {
      const stats = await lstat(this.rootPath)
      if (!stats.isDirectory()) return { available: false, location: this.rootPath, reason: "Session path is not a directory" }
      return { available: true, location: this.rootPath }
    } catch (error) {
      return { available: false, location: this.rootPath, reason: error instanceof Error ? error.message : String(error) }
    }
  }

  async scan(options?: ScanOptions): Promise<ScanResult> {
    if (options?.signal?.aborted) throw new DOMException("Scan aborted", "AbortError")
    const issues: ScanIssue[] = []
    const sessions: SessionSummary[] = []
    let failedSources = 0
    const dirs = await sessionDirs(this.rootPath, options?.signal)
    for (const sessionDir of dirs) {
      if (options?.signal?.aborted) throw new DOMException("Scan aborted", "AbortError")
      let sizeBytes: number | undefined
      let fileUpdatedAt: string | undefined
      try {
        const history = await lstat(path.join(sessionDir, "chat_history.jsonl"))
        if (history.isFile()) {
          sizeBytes = history.size
          fileUpdatedAt = history.mtime.toISOString()
        }
      } catch {
      }
      let parsed
      try {
        parsed = await this.parser.parseSummary({
          ref: { agentId: "grok", sourceId: sessionDir },
          locator: sessionDir,
          sizeBytes: sizeBytes ?? 0,
          updatedAt: fileUpdatedAt ?? new Date(0).toISOString(),
        }, options?.signal)
      } catch (error) {
        if ((error as Error).name === "AbortError" || (error as NodeJS.ErrnoException).code === "ABORT_ERR") throw error
        failedSources += 1
        issues.push({ location: sessionDir, message: `Cannot parse session: ${error instanceof Error ? error.message : String(error)}`, severity: "error" })
        continue
      }
      const rawLocation = parsed.projectLocation || path.dirname(sessionDir)
      const location = rawLocation.startsWith("/") ? normalizeProjectPath(rawLocation) : rawLocation
      const warnings = [...new Set(parsed.warnings)]
      for (const warning of warnings) issues.push({ location: sessionDir, message: warning, severity: "warning" })
      const scopedProjectId = projectId(location, "grok")
      sessions.push({
        id: `session:grok:${parsed.sessionId ?? path.basename(sessionDir)}`,
        ref: { agentId: "grok", sourceId: sessionDir },
        agentId: "grok",
        sessionId: parsed.sessionId,
        projectId: scopedProjectId,
        projectName: displayPath(location),
        projectLocation: location,
        title: truncate(parsed.title ?? path.basename(sessionDir), 96) || path.basename(sessionDir),
        createdAt: parsed.createdAt,
        updatedAt: fileUpdatedAt ?? parsed.createdAt ?? new Date(0).toISOString(),
        sizeBytes,
        messageCount: parsed.messageCount,
        providerModels: parsed.providerModels,
        warnings,
      })
    }
    const projectMap = new Map<string, ProjectSummary>()
    for (const session of sessions) {
      const current = projectMap.get(session.projectId)
      const warningCount = session.warnings.length
      if (current) {
        current.sessionCount += 1
        current.totalSizeBytes += session.sizeBytes ?? 0
        current.warningCount += warningCount
        if (timestampValue(session.updatedAt) > timestampValue(current.updatedAt)) current.updatedAt = session.updatedAt
        continue
      }
      projectMap.set(session.projectId, {
        id: session.projectId,
        agentId: "grok",
        name: session.projectName,
        location: session.projectLocation,
        displayPath: session.projectName,
        sessionCount: 1,
        totalSizeBytes: session.sizeBytes ?? 0,
        updatedAt: session.updatedAt,
        warningCount,
      })
    }
    return {
      agentId: "grok",
      rootPath: path.resolve(this.rootPath),
      projects: sortByUpdated([...projectMap.values()]),
      sessions: sortByUpdated(sessions),
      issues,
      scannedSources: dirs.length,
      failedSources,
    }
  }
}
