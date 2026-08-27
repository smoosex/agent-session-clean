import { lstat } from "node:fs/promises"
import path from "node:path"
import type { AgentDetection } from "../../domain/agent"
import type { ProjectSummary } from "../../domain/project"
import type { ScanOptions, ScanResult } from "../../domain/scan"
import type { SessionSummary } from "../../domain/session"
import type { SessionScanner } from "../../application/ports"
import { displayPath, normalizeProjectPath, projectId } from "../../utils/paths"
import { truncate } from "../../utils/truncate"
import { openOpenCodeDb, tableNames } from "./db"
import { openCodeDbPath } from "./paths"

type SessionRow = {
  id: string
  project_id: string | null
  directory: string | null
  title: string | null
  version: string | null
  agent: string | null
  model: string | null
  time_created: number | null
  time_updated: number | null
  worktree: string | null
}

function iso(ms: number | null | undefined): string | undefined {
  if (!ms || !Number.isFinite(ms)) return undefined
  const date = new Date(ms)
  return Number.isNaN(date.getTime()) ? undefined : date.toISOString()
}

function timestampValue(value: string | undefined): number {
  if (!value) return 0
  const parsed = Date.parse(value)
  return Number.isFinite(parsed) ? parsed : 0
}

function providerModels(model: string | null): string[] {
  if (!model) return []
  try {
    const parsed = JSON.parse(model) as { id?: unknown; providerID?: unknown }
    const id = typeof parsed.id === "string" ? parsed.id : undefined
    const provider = typeof parsed.providerID === "string" ? parsed.providerID : undefined
    if (provider && id) return [`${provider}/${id}`]
    if (id) return [id]
    if (provider) return [provider]
  } catch {
    if (model.trim()) return [model.trim()]
  }
  return []
}

function sortByUpdated<T extends { updatedAt: string }>(items: T[]): T[] {
  return items.sort((left, right) => timestampValue(right.updatedAt) - timestampValue(left.updatedAt))
}

export class OpenCodeScanner implements SessionScanner {
  readonly rootPath: string

  constructor(rootPath: string) {
    this.rootPath = rootPath
  }

  async detect(): Promise<AgentDetection> {
    const dbPath = openCodeDbPath(this.rootPath)
    try {
      const stats = await lstat(dbPath)
      if (!stats.isFile()) return { available: false, location: dbPath, reason: "OpenCode database path is not a file" }
      return { available: true, location: this.rootPath }
    } catch (error) {
      return { available: false, location: this.rootPath, reason: error instanceof Error ? error.message : String(error) }
    }
  }

  async scan(options?: ScanOptions): Promise<ScanResult> {
    if (options?.signal?.aborted) throw new DOMException("Scan aborted", "AbortError")
    const dbPath = openCodeDbPath(this.rootPath)
    let db
    try {
      db = await openOpenCodeDb(dbPath, true)
    } catch (error) {
      return { agentId: "opencode", rootPath: path.resolve(this.rootPath), projects: [], sessions: [], issues: [{ location: dbPath, message: error instanceof Error ? error.message : String(error), severity: "error" }], scannedSources: 0, failedSources: 0 }
    }
    try {
      const tables = tableNames(db)
      const sessionTable = tables.has("session") ? "session" : tables.has("session_v2") ? "session_v2" : undefined
      if (!sessionTable) {
        return { agentId: "opencode", rootPath: path.resolve(this.rootPath), projects: [], sessions: [], issues: [{ location: dbPath, message: "OpenCode database has no session table", severity: "error" }], scannedSources: 0, failedSources: 0 }
      }
      const joinProject = tables.has("project")
      const rows = db.query(joinProject
        ? `SELECT s.id, s.project_id, s.directory, s.title, s.version, s.agent, s.model, s.time_created, s.time_updated, p.worktree FROM ${sessionTable} s LEFT JOIN project p ON p.id = s.project_id`
        : `SELECT id, project_id, directory, title, version, agent, model, time_created, time_updated, NULL AS worktree FROM ${sessionTable}`,
      ).all() as SessionRow[]
      const messageCounts = new Map<string, number>()
      if (tables.has("message")) {
        const counts = db.query("SELECT session_id AS id, COUNT(*) AS count FROM message GROUP BY session_id").all() as Array<{ id: string; count: number }>
        for (const row of counts) messageCounts.set(row.id, row.count)
      }
      const sessions: SessionSummary[] = []
      for (const row of rows) {
        if (options?.signal?.aborted) throw new DOMException("Scan aborted", "AbortError")
        const rawLocation = row.directory || row.worktree || (row.project_id === "global" ? "global" : row.project_id) || "unknown"
        const location = rawLocation === "global" || rawLocation === "unknown" ? rawLocation : normalizeProjectPath(rawLocation)
        const updatedAt = iso(row.time_updated) ?? iso(row.time_created) ?? new Date(0).toISOString()
        const scopedProjectId = projectId(location, "opencode")
        sessions.push({
          id: `session:opencode:${row.id}`,
          ref: { agentId: "opencode", sourceId: row.id },
          agentId: "opencode",
          sessionId: row.id,
          projectId: scopedProjectId,
          projectName: displayPath(location),
          projectLocation: location,
          title: truncate(row.title || row.id, 96) || row.id,
          createdAt: iso(row.time_created),
          updatedAt,
          messageCount: messageCounts.get(row.id),
          providerModels: providerModels(row.model),
          warnings: [],
        })
      }
      const projectMap = new Map<string, ProjectSummary>()
      for (const session of sessions) {
        const current = projectMap.get(session.projectId)
        if (current) {
          current.sessionCount += 1
          if (timestampValue(session.updatedAt) > timestampValue(current.updatedAt)) current.updatedAt = session.updatedAt
          continue
        }
        projectMap.set(session.projectId, {
          id: session.projectId,
          agentId: "opencode",
          name: session.projectName,
          location: session.projectLocation,
          displayPath: session.projectName,
          sessionCount: 1,
          totalSizeBytes: 0,
          updatedAt: session.updatedAt,
          warningCount: 0,
        })
      }
      return {
        agentId: "opencode",
        rootPath: path.resolve(this.rootPath),
        projects: sortByUpdated([...projectMap.values()]),
        sessions: sortByUpdated(sessions),
        issues: [],
        scannedSources: sessions.length,
        failedSources: 0,
      }
    } finally {
      db.close()
    }
  }
}
