import { createReadStream } from "node:fs"
import { createInterface } from "node:readline"
import type { SessionParser } from "../../application/ports"
import type { ParsedSession, SessionSource } from "../../domain/scan"
import type { DetailField, SessionDetail, SessionSummary } from "../../domain/session"
import { truncate } from "../../utils/truncate"
import { messageRole, messageText, recordProviderModel, recordTitle } from "./text-summary"
import type { PiRecord, PiSessionHeader, ParsedPiSession } from "./types"

function asRecord(value: unknown): PiRecord | undefined {
  return value && typeof value === "object" && !Array.isArray(value) ? value as PiRecord : undefined
}

function asHeader(record: PiRecord): PiSessionHeader | undefined {
  if (record.type !== "session") return undefined
  return {
    type: "session",
    version: typeof record.version === "number" ? record.version : undefined,
    id: typeof record.id === "string" ? record.id : undefined,
    timestamp: typeof record.timestamp === "string" ? record.timestamp : undefined,
    cwd: typeof record.cwd === "string" ? record.cwd : undefined,
    title: typeof record.title === "string" ? record.title : undefined,
    name: typeof record.name === "string" ? record.name : undefined,
  }
}

function addWarning(warnings: string[], message: string): void {
  if (!warnings.includes(message)) warnings.push(message)
}

export async function parsePiSessionFile(filePath: string, signal?: AbortSignal): Promise<ParsedPiSession> {
  const result: ParsedPiSession = {
    recordCount: 0,
    messageCount: 0,
    providerModels: [],
    warnings: [],
  }
  let firstLine = true
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
        firstLine = false
        continue
      }
      const record = asRecord(decoded)
      if (!record) {
        addWarning(result.warnings, `Record ${result.recordCount} is not an object`)
        firstLine = false
        continue
      }
      if (firstLine) {
        result.header = asHeader(record)
        if (!result.header) addWarning(result.warnings, "First record is not a session header")
        if (result.header?.title || result.header?.name) result.title = result.header.title ?? result.header.name
      }
      firstLine = false
      const role = messageRole(record)
      const text = messageText(record.message)
      if (role === "user" && text) {
        result.messageCount += 1
        result.firstUserMessage ??= text
        result.lastUserMessage = text
        if (!result.title) result.title = text
      } else if (role) {
        result.messageCount += 1
      }
      const title = recordTitle(record)
      if (!result.title && title) result.title = title
      const providerModel = recordProviderModel(record)
      if (providerModel && !result.providerModels.includes(providerModel)) result.providerModels.push(providerModel)
    }
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ABORT_ERR" || (error as Error).name === "AbortError") throw error
    addWarning(result.warnings, `Unable to read session: ${error instanceof Error ? error.message : String(error)}`)
  } finally {
    lines.close()
    stream.destroy()
  }

  if (result.recordCount === 0) addWarning(result.warnings, "Session file is empty")
  if (!result.header?.id) addWarning(result.warnings, "Session header is missing id")
  if (!result.header?.timestamp) addWarning(result.warnings, "Session header is missing timestamp")
  if (!result.header?.cwd) addWarning(result.warnings, "Session header is missing cwd")
  return result
}

function detailFields(parsed: ParsedPiSession, source: string): DetailField[] {
  const fields: DetailField[] = [{ label: "Source", value: source }]
  if (parsed.header?.version !== undefined) fields.push({ label: "Pi version", value: String(parsed.header.version) })
  fields.push({ label: "Records", value: String(parsed.recordCount) })
  if (parsed.providerModels.length > 0) fields.push({ label: "Provider / model", value: parsed.providerModels.join(", ") })
  return fields
}

function toParsedSession(source: SessionSource, parsed: ParsedPiSession): ParsedSession {
  return {
    sessionId: parsed.header?.id,
    projectLocation: parsed.header?.cwd,
    createdAt: parsed.header?.timestamp,
    title: parsed.title ?? parsed.header?.title ?? parsed.header?.name,
    messageCount: parsed.messageCount,
    firstUserMessage: parsed.firstUserMessage,
    lastUserMessage: parsed.lastUserMessage,
    providerModels: parsed.providerModels,
    warnings: parsed.warnings,
    detailFields: detailFields(parsed, source.locator),
  }
}

export class PiParser implements SessionParser {
  async parseSummary(source: SessionSource, signal?: AbortSignal): Promise<ParsedSession> {
    return toParsedSession(source, await parsePiSessionFile(source.locator, signal))
  }

  async loadDetail(session: SessionSummary, signal?: AbortSignal): Promise<SessionDetail> {
    const parsed = await parsePiSessionFile(session.ref.sourceId, signal)
    const projectLocation = parsed.header?.cwd ?? session.projectLocation
    const warnings = [...new Set([...session.warnings, ...parsed.warnings])]
    return {
      ...session,
      sessionId: parsed.header?.id ?? session.sessionId,
      projectLocation,
      title: truncate(parsed.title ?? session.title, 160) || "Untitled session",
      createdAt: parsed.header?.timestamp ?? session.createdAt,
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
