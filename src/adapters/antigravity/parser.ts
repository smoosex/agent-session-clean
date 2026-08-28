import { createReadStream } from "node:fs"
import { lstat } from "node:fs/promises"
import { createInterface } from "node:readline"
import path from "node:path"
import type { SessionParser } from "../../application/ports"
import type { ParsedSession, SessionSource } from "../../domain/scan"
import type { DetailField, SessionDetail, SessionSummary } from "../../domain/session"
import { truncate } from "../../utils/truncate"
import { openAntigravityDb, tableNames } from "./db"
import { antigravityConversationsDir, antigravitySummariesDbPath, workspacePath } from "./paths"

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

type LoadedSession = {
  sessionId: string
  projectLocation?: string
  title: string
  updatedAt?: string
  messageCount?: number
  firstUserMessage?: string
  lastUserMessage?: string
  providerModels: string[]
  warnings: string[]
  fields: DetailField[]
}

function asRecord(value: unknown): Record<string, unknown> | undefined {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : undefined
}

async function readHistory(dataDir: string, conversationId: string, signal?: AbortSignal): Promise<{ firstUserMessage?: string; lastUserMessage?: string }> {
  const historyPath = path.join(dataDir, "history.jsonl")
  try {
    await lstat(historyPath)
  } catch {
    return {}
  }
  const stream = createReadStream(historyPath, { encoding: "utf8", signal })
  const lines = createInterface({ input: stream, crlfDelay: Infinity })
  let firstUserMessage: string | undefined
  let lastUserMessage: string | undefined
  try {
    for await (const line of lines) {
      if (signal?.aborted) throw new DOMException("Scan aborted", "AbortError")
      let decoded: unknown
      try {
        decoded = JSON.parse(line)
      } catch {
        continue
      }
      const record = asRecord(decoded)
      if (!record || record.conversationId !== conversationId) continue
      const display = typeof record.display === "string" ? record.display.trim() : ""
      if (!display) continue
      const clipped = truncate(display, 1000)
      firstUserMessage ??= clipped
      lastUserMessage = clipped
    }
  } finally {
    lines.close()
    stream.destroy()
  }
  return { firstUserMessage, lastUserMessage }
}

export class AntigravityParser implements SessionParser {
  constructor(private readonly dataDir: string) {}

  async parseSummary(source: SessionSource): Promise<ParsedSession> {
    const loaded = await this.loadFromDb(source.ref.sourceId)
    return {
      sessionId: loaded.sessionId,
      projectLocation: loaded.projectLocation,
      title: loaded.title,
      messageCount: undefined,
      providerModels: [],
      warnings: loaded.warnings,
      detailFields: [{ label: "Source", value: source.locator }],
    }
  }

  async loadDetail(session: SessionSummary, signal?: AbortSignal): Promise<SessionDetail> {
    if (signal?.aborted) throw new DOMException("Scan aborted", "AbortError")
    const loaded = await this.loadFromDb(session.ref.sourceId, signal)
    const warnings = [...new Set([...session.warnings, ...loaded.warnings])]
    return {
      ...session,
      sessionId: loaded.sessionId || session.sessionId,
      projectLocation: loaded.projectLocation ?? session.projectLocation,
      title: truncate(loaded.title || session.title, 160) || session.title,
      messageCount: loaded.messageCount ?? session.messageCount,
      firstUserMessage: loaded.firstUserMessage,
      lastUserMessage: loaded.lastUserMessage,
      providerModels: loaded.providerModels.length > 0 ? loaded.providerModels : session.providerModels,
      warnings,
      fields: loaded.fields,
      warningCount: warnings.length,
    }
  }

  private async loadFromDb(conversationId: string, signal?: AbortSignal): Promise<LoadedSession> {
    const warnings: string[] = []
    const dbPath = antigravitySummariesDbPath(this.dataDir)
    const conversationPath = path.join(antigravityConversationsDir(this.dataDir), `${conversationId}.db`)
    let row: SummaryRow | undefined
    try {
      const db = await openAntigravityDb(dbPath, true)
      try {
        const tables = tableNames(db)
        if (tables.has("conversation_summaries")) {
          row = db.query("SELECT conversation_id, title, preview, step_count, last_modified_time, workspace_uris, project_id, agent_name FROM conversation_summaries WHERE conversation_id = ?").get(conversationId) as SummaryRow | undefined
        } else {
          warnings.push("Antigravity database has no conversation_summaries table")
        }
      } finally {
        db.close()
      }
    } catch (error) {
      warnings.push(`Unable to read Antigravity summaries: ${error instanceof Error ? error.message : String(error)}`)
    }
    const location = workspacePath(row?.workspace_uris)
    const title = (row?.title && row.title.trim()) || (row?.preview && row.preview.trim()) || conversationId
    const history = await readHistory(this.dataDir, conversationId, signal)
    const firstUserMessage = history.firstUserMessage ?? (row?.preview?.trim() || undefined)
    const lastUserMessage = history.lastUserMessage ?? firstUserMessage
    const fields: DetailField[] = [{ label: "Source", value: conversationPath }]
    if (location) fields.push({ label: "Workspace", value: location })
    if (row?.project_id) fields.push({ label: "Project id", value: row.project_id })
    if (row?.agent_name) fields.push({ label: "Agent", value: row.agent_name })
    if (row?.step_count != null) fields.push({ label: "Steps", value: String(row.step_count) })
    return {
      sessionId: row?.conversation_id ?? conversationId,
      projectLocation: location,
      title,
      updatedAt: row?.last_modified_time ?? undefined,
      messageCount: row?.step_count ?? undefined,
      firstUserMessage,
      lastUserMessage,
      providerModels: row?.agent_name ? [row.agent_name] : [],
      warnings,
      fields,
    }
  }
}
