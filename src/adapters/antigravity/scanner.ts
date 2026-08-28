import { lstat } from "node:fs/promises"
import path from "node:path"
import type { AgentDetection } from "../../domain/agent"
import type { ProjectSummary } from "../../domain/project"
import type { ScanOptions, ScanResult } from "../../domain/scan"
import type { SessionSummary } from "../../domain/session"
import type { SessionScanner } from "../../application/ports"
import { displayPath, normalizeProjectPath, projectId } from "../../utils/paths"
import { truncate } from "../../utils/truncate"
import { openAntigravityDb, tableNames } from "./db"
import { antigravityConversationsDir, antigravitySessionIdPattern, antigravitySummariesDbPath, workspacePath } from "./paths"

type SummaryRow = {
  conversation_id: string
  title: string | null
  preview: string | null
  step_count: number | null
  last_modified_time: string | null
  workspace_uris: string | null
  project_id: string | null
  agent_name: string | null
}

function iso(value: string | null | undefined): string | undefined {
  if (!value || value.startsWith("0001-")) return undefined
  const parsed = Date.parse(value)
  return Number.isFinite(parsed) ? new Date(parsed).toISOString() : undefined
}

function timestampValue(value: string | undefined): number {
  if (!value) return 0
  const parsed = Date.parse(value)
  return Number.isFinite(parsed) ? parsed : 0
}

function sortByUpdated<T extends { updatedAt: string }>(items: T[]): T[] {
  return items.sort((left, right) => timestampValue(right.updatedAt) - timestampValue(left.updatedAt))
}

async function conversationFile(dataDir: string, conversationId: string): Promise<{ path: string; sizeBytes: number } | undefined> {
  const conversations = antigravityConversationsDir(dataDir)
  for (const name of [`${conversationId}.db`, `${conversationId}.pb`]) {
    const filePath = path.join(conversations, name)
    try {
      const stats = await lstat(filePath)
      if (stats.isFile()) return { path: filePath, sizeBytes: stats.size }
    } catch {
    }
  }
  return undefined
}

export class AntigravityScanner implements SessionScanner {
  readonly rootPath: string

  constructor(rootPath: string) {
    this.rootPath = rootPath
  }

  async detect(): Promise<AgentDetection> {
    const dbPath = antigravitySummariesDbPath(this.rootPath)
    try {
      const stats = await lstat(dbPath)
      if (!stats.isFile()) return { available: false, location: dbPath, reason: "Antigravity summaries database path is not a file" }
      return { available: true, location: this.rootPath }
    } catch (error) {
      return { available: false, location: this.rootPath, reason: error instanceof Error ? error.message : String(error) }
    }
  }

  async scan(options?: ScanOptions): Promise<ScanResult> {
    if (options?.signal?.aborted) throw new DOMException("Scan aborted", "AbortError")
    const dbPath = antigravitySummariesDbPath(this.rootPath)
    let db
    try {
      db = await openAntigravityDb(dbPath, true)
    } catch (error) {
      return { agentId: "antigravity", rootPath: path.resolve(this.rootPath), projects: [], sessions: [], issues: [{ location: dbPath, message: error instanceof Error ? error.message : String(error), severity: "error" }], scannedSources: 0, failedSources: 0 }
    }
    try {
      const tables = tableNames(db)
      if (!tables.has("conversation_summaries")) {
        return { agentId: "antigravity", rootPath: path.resolve(this.rootPath), projects: [], sessions: [], issues: [{ location: dbPath, message: "Antigravity database has no conversation_summaries table", severity: "error" }], scannedSources: 0, failedSources: 0 }
      }
      const rows = db.query("SELECT conversation_id, title, preview, step_count, last_modified_time, workspace_uris, project_id, agent_name FROM conversation_summaries").all() as SummaryRow[]
      const sessions: SessionSummary[] = []
      for (const row of rows) {
        if (options?.signal?.aborted) throw new DOMException("Scan aborted", "AbortError")
        if (!antigravitySessionIdPattern.test(row.conversation_id)) continue
        const file = await conversationFile(this.rootPath, row.conversation_id)
        if (!file) continue
        const rawLocation = workspacePath(row.workspace_uris) || (row.project_id && row.project_id !== "default-cli-project" ? row.project_id : "unknown")
        const location = rawLocation === "unknown" || rawLocation === "outside-of-project" ? rawLocation : normalizeProjectPath(rawLocation)
        const updatedAt = iso(row.last_modified_time) ?? new Date(0).toISOString()
        const title = (row.title && row.title.trim()) || (row.preview && row.preview.trim()) || row.conversation_id
        sessions.push({
          id: `session:antigravity:${row.conversation_id}`,
          ref: { agentId: "antigravity", sourceId: row.conversation_id },
          agentId: "antigravity",
          sessionId: row.conversation_id,
          projectId: projectId(location, "antigravity"),
          projectName: displayPath(location),
          projectLocation: location,
          title: truncate(title, 96) || row.conversation_id,
          updatedAt,
          sizeBytes: file.sizeBytes,
          messageCount: row.step_count ?? undefined,
          providerModels: row.agent_name ? [row.agent_name] : [],
          warnings: [],
        })
      }
      const projectMap = new Map<string, ProjectSummary>()
      for (const session of sessions) {
        const current = projectMap.get(session.projectId)
        if (current) {
          current.sessionCount += 1
          current.totalSizeBytes += session.sizeBytes ?? 0
          if (timestampValue(session.updatedAt) > timestampValue(current.updatedAt)) current.updatedAt = session.updatedAt
          continue
        }
        projectMap.set(session.projectId, {
          id: session.projectId,
          agentId: "antigravity",
          name: session.projectName,
          location: session.projectLocation,
          displayPath: session.projectName,
          sessionCount: 1,
          totalSizeBytes: session.sizeBytes ?? 0,
          updatedAt: session.updatedAt,
          warningCount: 0,
        })
      }
      return {
        agentId: "antigravity",
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
