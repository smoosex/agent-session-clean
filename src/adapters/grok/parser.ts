import { createReadStream } from "node:fs"
import { lstat, readFile } from "node:fs/promises"
import { createInterface } from "node:readline"
import path from "node:path"
import type { SessionParser } from "../../application/ports"
import type { ParsedSession, SessionSource } from "../../domain/scan"
import type { DetailField, SessionDetail, SessionSummary } from "../../domain/session"
import { truncate } from "../../utils/truncate"

type JsonRecord = Record<string, unknown>

export type GrokSummaryFile = {
  sessionId?: string
  projectPath?: string
  title?: string
  createdAt?: string
  updatedAt?: string
  messageCount?: number
  model?: string
  warnings: string[]
}

function asRecord(value: unknown): JsonRecord | undefined {
  return value && typeof value === "object" && !Array.isArray(value) ? value as JsonRecord : undefined
}

function stringValue(value: unknown): string | undefined {
  return typeof value === "string" && value.length > 0 ? value : undefined
}

function numberValue(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined
}

function contentText(value: unknown): string | undefined {
  if (typeof value === "string") return value
  if (!Array.isArray(value)) return stringValue(asRecord(value)?.text)
  const text = value.map((part) => typeof part === "string" ? part : stringValue(asRecord(part)?.text)).filter((part): part is string => Boolean(part)).join(" ")
  return text || undefined
}

function userQuery(text: string): string | undefined {
  const match = text.match(/<user_query>\s*([\s\S]*?)\s*<\/user_query>/)
  if (match?.[1]) return match[1].trim() || undefined
  if (text.includes("<system-reminder>") || text.includes("<user_info>") || text.includes("<image_files>")) return undefined
  const trimmed = text.trim()
  return trimmed || undefined
}

export function decodeGrokProjectDir(name: string): string | undefined {
  try {
    const decoded = decodeURIComponent(name)
    return decoded.startsWith("/") ? decoded : undefined
  } catch {
    return undefined
  }
}

export async function readGrokSummary(sessionDir: string): Promise<GrokSummaryFile> {
  const warnings: string[] = []
  const fallbackId = path.basename(sessionDir)
  const fallbackCwd = decodeGrokProjectDir(path.basename(path.dirname(sessionDir)))
  try {
    const raw = await readFile(path.join(sessionDir, "summary.json"), "utf8")
    const parsed = asRecord(JSON.parse(raw))
    if (!parsed) return { sessionId: fallbackId, projectPath: fallbackCwd, warnings: ["Grok summary.json is not an object"] }
    const info = asRecord(parsed.info)
    return {
      sessionId: stringValue(info?.id) ?? fallbackId,
      projectPath: stringValue(info?.cwd) ?? fallbackCwd,
      title: stringValue(parsed.generated_title) ?? stringValue(parsed.session_summary),
      createdAt: stringValue(parsed.created_at),
      updatedAt: stringValue(parsed.updated_at) ?? stringValue(parsed.last_active_at),
      messageCount: numberValue(parsed.num_chat_messages) ?? numberValue(parsed.num_messages),
      model: stringValue(parsed.current_model_id),
      warnings,
    }
  } catch (error) {
    const code = (error as NodeJS.ErrnoException).code
    if (code !== "ENOENT") warnings.push(`Unable to read Grok summary: ${error instanceof Error ? error.message : String(error)}`)
    return { sessionId: fallbackId, projectPath: fallbackCwd, warnings }
  }
}

async function readChatHistory(sessionDir: string, signal?: AbortSignal): Promise<{ firstUserMessage?: string; lastUserMessage?: string; warnings: string[] }> {
  const warnings: string[] = []
  const filePath = path.join(sessionDir, "chat_history.jsonl")
  try {
    await lstat(filePath)
  } catch {
    return { warnings }
  }
  const stream = createReadStream(filePath, { encoding: "utf8", signal })
  const lines = createInterface({ input: stream, crlfDelay: Infinity })
  let firstUserMessage: string | undefined
  let lastUserMessage: string | undefined
  let lineNumber = 0
  try {
    for await (const line of lines) {
      if (signal?.aborted) throw new DOMException("Scan aborted", "AbortError")
      lineNumber += 1
      let decoded: unknown
      try {
        decoded = JSON.parse(line)
      } catch {
        warnings.push(`Invalid JSON on line ${lineNumber}`)
        continue
      }
      const record = asRecord(decoded)
      if (!record || record.type !== "user" || record.synthetic_reason) continue
      const text = userQuery(contentText(record.content) ?? "")
      if (!text) continue
      const clipped = truncate(text, 1000)
      firstUserMessage ??= clipped
      lastUserMessage = clipped
    }
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ABORT_ERR" || (error as Error).name === "AbortError") throw error
    warnings.push(`Unable to read chat history: ${error instanceof Error ? error.message : String(error)}`)
  } finally {
    lines.close()
    stream.destroy()
  }
  return { firstUserMessage, lastUserMessage, warnings }
}

function detailFields(summary: GrokSummaryFile, source: string): DetailField[] {
  const fields: DetailField[] = [{ label: "Source", value: source }]
  if (summary.model) fields.push({ label: "Provider / model", value: summary.model })
  if (summary.messageCount !== undefined) fields.push({ label: "Messages", value: String(summary.messageCount) })
  return fields
}

function toParsedSession(source: SessionSource, summary: GrokSummaryFile): ParsedSession {
  return {
    sessionId: summary.sessionId,
    projectLocation: summary.projectPath,
    createdAt: summary.createdAt,
    title: summary.title ?? path.basename(source.locator),
    messageCount: summary.messageCount,
    providerModels: summary.model ? [summary.model] : [],
    warnings: summary.warnings,
    detailFields: [{ label: "Source", value: source.locator }],
  }
}

export class GrokParser implements SessionParser {
  async parseSummary(source: SessionSource): Promise<ParsedSession> {
    return toParsedSession(source, await readGrokSummary(source.locator))
  }

  async loadDetail(session: SessionSummary, signal?: AbortSignal): Promise<SessionDetail> {
    const summary = await readGrokSummary(session.ref.sourceId)
    const history = await readChatHistory(session.ref.sourceId, signal)
    const warnings = [...new Set([...session.warnings, ...summary.warnings, ...history.warnings])]
    return {
      ...session,
      sessionId: summary.sessionId ?? session.sessionId,
      projectLocation: summary.projectPath ?? session.projectLocation,
      title: truncate(summary.title ?? session.title, 160) || session.title,
      createdAt: summary.createdAt ?? session.createdAt,
      messageCount: summary.messageCount,
      firstUserMessage: history.firstUserMessage,
      lastUserMessage: history.lastUserMessage,
      providerModels: summary.model ? [summary.model] : session.providerModels,
      warnings,
      fields: detailFields(summary, session.ref.sourceId),
      warningCount: warnings.length,
    }
  }
}
