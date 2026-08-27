import type { SessionParser } from "../../application/ports"
import type { ParsedSession, SessionSource } from "../../domain/scan"
import type { DetailField, SessionDetail, SessionSummary } from "../../domain/session"
import { truncate } from "../../utils/truncate"
import { openOpenCodeDb, tableNames } from "./db"
import { openCodeDbPath } from "./paths"

type JsonRecord = Record<string, unknown>

function asRecord(value: unknown): JsonRecord | undefined {
  return value && typeof value === "object" && !Array.isArray(value) ? value as JsonRecord : undefined
}

function parseJson(value: string | null): JsonRecord | undefined {
  if (!value) return undefined
  try {
    return asRecord(JSON.parse(value))
  } catch {
    return undefined
  }
}

function textOf(part: JsonRecord | undefined): string | undefined {
  if (!part || part.type !== "text") return undefined
  return typeof part.text === "string" && part.text.length > 0 ? part.text : undefined
}

function providerModels(model: string | null | undefined, record?: JsonRecord): string[] {
  const fromRecord = record && typeof record.providerID === "string" && typeof record.modelID === "string" ? `${record.providerID}/${record.modelID}` : undefined
  if (fromRecord) return [fromRecord]
  if (!model) return []
  try {
    const parsed = JSON.parse(model) as { id?: unknown; providerID?: unknown }
    const id = typeof parsed.id === "string" ? parsed.id : undefined
    const provider = typeof parsed.providerID === "string" ? parsed.providerID : undefined
    if (provider && id) return [`${provider}/${id}`]
    if (id) return [id]
  } catch {
    if (model.trim()) return [model.trim()]
  }
  return []
}

export class OpenCodeParser implements SessionParser {
  constructor(private readonly dataDir: string) {}

  async parseSummary(source: SessionSource): Promise<ParsedSession> {
    const detail = await this.loadFromDb(source.ref.sourceId)
    return {
      sessionId: detail.sessionId,
      projectLocation: detail.projectLocation,
      createdAt: detail.createdAt,
      title: detail.title,
      messageCount: undefined,
      providerModels: [],
      warnings: detail.warnings,
      detailFields: [{ label: "Source", value: source.locator }],
    }
  }

  async loadDetail(session: SessionSummary, signal?: AbortSignal): Promise<SessionDetail> {
    if (signal?.aborted) throw new DOMException("Scan aborted", "AbortError")
    const loaded = await this.loadFromDb(session.ref.sourceId)
    const warnings = [...new Set([...session.warnings, ...loaded.warnings])]
    return {
      ...session,
      sessionId: loaded.sessionId ?? session.sessionId,
      projectLocation: loaded.projectLocation ?? session.projectLocation,
      title: truncate(loaded.title ?? session.title, 160) || session.title,
      createdAt: loaded.createdAt ?? session.createdAt,
      messageCount: loaded.messageCount,
      firstUserMessage: loaded.firstUserMessage,
      lastUserMessage: loaded.lastUserMessage,
      providerModels: loaded.providerModels.length > 0 ? loaded.providerModels : session.providerModels,
      warnings,
      fields: loaded.fields,
      warningCount: warnings.length,
    }
  }

  private async loadFromDb(sessionId: string): Promise<{
    sessionId?: string
    projectLocation?: string
    createdAt?: string
    title?: string
    messageCount?: number
    firstUserMessage?: string
    lastUserMessage?: string
    providerModels: string[]
    warnings: string[]
    fields: DetailField[]
  }> {
    const warnings: string[] = []
    const db = await openOpenCodeDb(openCodeDbPath(this.dataDir), true)
    try {
      const tables = tableNames(db)
      const sessionTable = tables.has("session") ? "session" : tables.has("session_v2") ? "session_v2" : undefined
      if (!sessionTable) return { providerModels: [], warnings: ["OpenCode database has no session table"], fields: [] }
      const row = db.query(`SELECT id, directory, title, version, agent, model, time_created FROM ${sessionTable} WHERE id = ?`).get(sessionId) as {
        id: string
        directory: string | null
        title: string | null
        version: string | null
        agent: string | null
        model: string | null
        time_created: number | null
      } | null
      if (!row) return { providerModels: [], warnings: ["OpenCode session was not found"], fields: [] }
      let messageCount: number | undefined
      let firstUserMessage: string | undefined
      let lastUserMessage: string | undefined
      const models = providerModels(row.model)
      if (tables.has("part") && tables.has("message")) {
        const parts = db.query("SELECT p.data AS part, m.data AS message FROM part p LEFT JOIN message m ON m.id = p.message_id WHERE p.session_id = ? ORDER BY p.time_created").all(sessionId) as Array<{ part: string | null; message: string | null }>
        for (const entry of parts) {
          const part = parseJson(entry.part)
          const message = parseJson(entry.message)
          const text = textOf(part)
          if (!text) continue
          if (message?.role === "user") {
            const clipped = truncate(text, 1000)
            firstUserMessage ??= clipped
            lastUserMessage = clipped
          }
        }
      }
      if (tables.has("message")) {
        const count = db.query("SELECT COUNT(*) AS count FROM message WHERE session_id = ?").get(sessionId) as { count: number }
        messageCount = count.count
      }
      const fields: DetailField[] = [
        { label: "Source", value: openCodeDbPath(this.dataDir) },
        { label: "Session", value: row.id },
      ]
      if (row.agent) fields.push({ label: "Agent", value: row.agent })
      if (row.version) fields.push({ label: "OpenCode version", value: row.version })
      if (models.length > 0) fields.push({ label: "Provider / model", value: models.join(", ") })
      return {
        sessionId: row.id,
        projectLocation: row.directory ?? undefined,
        createdAt: row.time_created ? new Date(row.time_created).toISOString() : undefined,
        title: row.title ?? undefined,
        messageCount,
        firstUserMessage,
        lastUserMessage,
        providerModels: models,
        warnings,
        fields,
      }
    } finally {
      db.close()
    }
  }
}
