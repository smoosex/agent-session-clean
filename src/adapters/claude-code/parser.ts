import { createReadStream } from "node:fs"
import { createInterface } from "node:readline"
import path from "node:path"
import type { SessionParser } from "../../application/ports"
import type { ParsedSession, SessionSource } from "../../domain/scan"
import type { DetailField, SessionDetail, SessionSummary } from "../../domain/session"
import { truncate } from "../../utils/truncate"

export type ParseMode = "summary" | "full"

type JsonRecord = Record<string, unknown>

type ParsedClaudeCodeSession = {
  sessionId?: string
  projectPath?: string
  createdAt?: string
  title?: string
  version?: string
  recordCount: number
  messageCount: number
  firstUserMessage?: string
  lastUserMessage?: string
  providerModels: string[]
  warnings: string[]
}

function asRecord(value: unknown): JsonRecord | undefined {
  return value && typeof value === "object" && !Array.isArray(value) ? value as JsonRecord : undefined
}

function stringValue(value: unknown): string | undefined {
  return typeof value === "string" && value.length > 0 ? value : undefined
}

function addWarning(warnings: string[], message: string): void {
  if (!warnings.includes(message)) warnings.push(message)
}

function addProviderModel(providerModels: string[], model: string | undefined): void {
  if (model && !providerModels.includes(model)) providerModels.push(model)
}

function contentText(value: unknown): string | undefined {
  if (typeof value === "string") return value
  if (!Array.isArray(value)) {
    const record = asRecord(value)
    return stringValue(record?.text) ?? stringValue(record?.content)
  }
  const text = value.map((part) => {
    if (typeof part === "string") return part
    const record = asRecord(part)
    return stringValue(record?.text)
  }).filter((part): part is string => Boolean(part)).join(" ")
  return text || undefined
}

function isSkippableUserText(text: string): boolean {
  return text.includes("<command-name>") || text.includes("<command-message>") || text.includes("<local-command-caveat>") || text.includes("<local-command-stdout>")
}

function userText(record: JsonRecord): string | undefined {
  if (record.type !== "user" || record.isMeta === true) return undefined
  const message = asRecord(record.message)
  const text = contentText(message?.content) ?? contentText(record.content)
  if (!text || isSkippableUserText(text)) return undefined
  return text
}

function decodeProjectDir(name: string): string | undefined {
  if (!name.startsWith("-")) return undefined
  return name.replaceAll("-", "/")
}

export async function parseClaudeCodeSessionFile(filePath: string, signal?: AbortSignal, mode: ParseMode = "full"): Promise<ParsedClaudeCodeSession> {
  const result: ParsedClaudeCodeSession = { recordCount: 0, messageCount: 0, providerModels: [], warnings: [] }
  const stream = createReadStream(filePath, { encoding: "utf8", signal })
  const lines = createInterface({ input: stream, crlfDelay: Infinity })

  try {
    for await (const line of lines) {
      if (signal?.aborted) throw new DOMException("Scan aborted", "AbortError")
      result.recordCount += 1
      let decoded: unknown
      try {
        decoded = JSON.parse(line)
      } catch {
        addWarning(result.warnings, `Invalid JSON on line ${result.recordCount}`)
        continue
      }
      const record = asRecord(decoded)
      if (!record) {
        addWarning(result.warnings, `Record ${result.recordCount} is not an object`)
        continue
      }
      result.sessionId ??= stringValue(record.sessionId)
      result.projectPath ??= stringValue(record.cwd)
      result.createdAt ??= stringValue(record.timestamp)
      result.version ??= stringValue(record.version)
      const title = stringValue(record.aiTitle) ?? stringValue(record.customTitle)
      if (title) result.title = title
      if (mode === "summary") {
        if (result.sessionId && result.projectPath && (result.title || result.recordCount >= 16)) break
        continue
      }
      const text = userText(record)
      if (text) {
        result.messageCount += 1
        result.firstUserMessage ??= text
        result.lastUserMessage = text
        result.title ??= text
      } else if (record.type === "user" || record.type === "assistant") {
        result.messageCount += 1
      }
      const message = asRecord(record.message)
      addProviderModel(result.providerModels, stringValue(message?.model) ?? stringValue(record.model))
    }
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ABORT_ERR" || (error as Error).name === "AbortError") throw error
    addWarning(result.warnings, `Unable to read session: ${error instanceof Error ? error.message : String(error)}`)
  } finally {
    lines.close()
    stream.destroy()
  }

  if (!result.sessionId) {
    const base = path.basename(filePath, path.extname(filePath))
    if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(base)) result.sessionId = base
  }
  if (!result.projectPath) result.projectPath = decodeProjectDir(path.basename(path.dirname(filePath)))
  if (result.recordCount === 0) addWarning(result.warnings, "Session file is empty")
  if (!result.sessionId) addWarning(result.warnings, "Claude Code session is missing id")
  if (!result.projectPath) addWarning(result.warnings, "Claude Code session is missing cwd")
  return result
}

function detailFields(parsed: ParsedClaudeCodeSession, source: string): DetailField[] {
  const fields: DetailField[] = [{ label: "Source", value: source }]
  if (parsed.version) fields.push({ label: "Claude Code version", value: parsed.version })
  fields.push({ label: "Records", value: String(parsed.recordCount) })
  if (parsed.providerModels.length > 0) fields.push({ label: "Provider / model", value: parsed.providerModels.join(", ") })
  return fields
}

function toParsedSession(source: SessionSource, parsed: ParsedClaudeCodeSession, mode: ParseMode = "full"): ParsedSession {
  return {
    sessionId: parsed.sessionId,
    projectLocation: parsed.projectPath,
    createdAt: parsed.createdAt,
    title: parsed.title ?? path.basename(source.locator),
    messageCount: mode === "summary" ? undefined : parsed.messageCount,
    firstUserMessage: mode === "summary" ? undefined : parsed.firstUserMessage,
    lastUserMessage: mode === "summary" ? undefined : parsed.lastUserMessage,
    providerModels: mode === "summary" ? [] : parsed.providerModels,
    warnings: parsed.warnings,
    detailFields: mode === "summary" ? [{ label: "Source", value: source.locator }] : detailFields(parsed, source.locator),
  }
}

export class ClaudeCodeParser implements SessionParser {
  async parseSummary(source: SessionSource, signal?: AbortSignal): Promise<ParsedSession> {
    return toParsedSession(source, await parseClaudeCodeSessionFile(source.locator, signal, "summary"), "summary")
  }

  async loadDetail(session: SessionSummary, signal?: AbortSignal): Promise<SessionDetail> {
    const parsed = await parseClaudeCodeSessionFile(session.ref.sourceId, signal)
    const warnings = [...new Set([...session.warnings, ...parsed.warnings])]
    return {
      ...session,
      sessionId: parsed.sessionId ?? session.sessionId,
      projectLocation: parsed.projectPath ?? session.projectLocation,
      title: truncate(parsed.title ?? session.title, 160) || "Untitled session",
      createdAt: parsed.createdAt ?? session.createdAt,
      messageCount: parsed.messageCount,
      firstUserMessage: parsed.firstUserMessage,
      lastUserMessage: parsed.lastUserMessage,
      providerModels: parsed.providerModels,
      warnings,
      fields: detailFields(parsed, session.ref.sourceId),
      warningCount: warnings.length,
    }
  }
}
