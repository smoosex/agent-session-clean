import { createReadStream } from "node:fs"
import { createInterface } from "node:readline"
import { truncate } from "../../utils/truncate"
import type { ParsedCodexSession } from "./types"

type JsonRecord = Record<string, unknown>

type Message = {
  role: "user" | "assistant"
  text?: string
}

function asRecord(value: unknown): JsonRecord | undefined {
  return value && typeof value === "object" && !Array.isArray(value) ? value as JsonRecord : undefined
}

function stringValue(value: unknown): string | undefined {
  return typeof value === "string" && value.length > 0 ? value : undefined
}

function payloadOf(record: JsonRecord): JsonRecord | undefined {
  return asRecord(record.payload)
}

function field(record: JsonRecord, payload: JsonRecord | undefined, ...keys: string[]): string | undefined {
  for (const key of keys) {
    const value = stringValue(payload?.[key]) ?? stringValue(record[key])
    if (value) return value
  }
  return undefined
}

function textValue(value: unknown): string | undefined {
  if (typeof value === "string") return value
  const record = asRecord(value)
  if (!record) return undefined
  return stringValue(record.text) ?? stringValue(record.message)
}

function contentText(value: unknown): string | undefined {
  if (!Array.isArray(value)) return textValue(value)
  const text = value.map((part) => textValue(part)).filter((part): part is string => Boolean(part)).join(" ")
  return text || undefined
}

function responseMessage(payload: JsonRecord | undefined): Message | undefined {
  if (!payload || payload.type !== "message") return undefined
  const role = payload.role
  if (role !== "user" && role !== "assistant") return undefined
  return { role, text: contentText(payload.content) }
}

function eventMessage(payload: JsonRecord | undefined): Message | undefined {
  if (!payload) return undefined
  if (payload.type === "user_message") return { role: "user", text: textValue(payload.message) ?? textValue(payload.text) }
  if (payload.type === "agent_message") return { role: "assistant", text: textValue(payload.message) ?? textValue(payload.text) }
  if (payload.type !== "item_completed") return undefined
  const item = asRecord(payload.item)
  if (item?.type === "UserMessage") return { role: "user", text: contentText(item.content) }
  if (item?.type === "AgentMessage") return { role: "assistant", text: contentText(item.content) }
  return undefined
}

function addWarning(warnings: string[], message: string): void {
  if (!warnings.includes(message)) warnings.push(message)
}

function addProviderModel(providerModels: string[], provider: string | undefined, model: string | undefined): void {
  if (!provider && !model) return
  const value = provider && model ? `${provider}/${model}` : provider ?? model
  if (value && !providerModels.includes(value)) providerModels.push(value)
}

export async function parseCodexSessionFile(filePath: string, signal?: AbortSignal): Promise<ParsedCodexSession> {
  const result: ParsedCodexSession = {
    recordCount: 0,
    messageCount: 0,
    providerModels: [],
    warnings: [],
  }
  let firstLine = true
  let provider: string | undefined
  const responseMessages: Message[] = []
  const eventMessages: Message[] = []
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

      const type = stringValue(record.type)
      const payload = payloadOf(record)
      if (firstLine && type !== "session_meta") addWarning(result.warnings, "First record is not a Codex session header")
      if (type === "session_meta") {
        result.sessionId ??= field(record, payload, "id", "session_id", "thread_id")
        result.projectPath ??= field(record, payload, "cwd", "current_working_dir")
        result.createdAt ??= field(record, payload, "timestamp")
        result.title ??= field(record, payload, "title", "name")
        provider ??= field(record, payload, "model_provider", "provider")
        addProviderModel(result.providerModels, provider, field(record, payload, "model"))
      }
      if (type === "turn_context") {
        const turnProvider = field(record, payload, "model_provider", "provider") ?? provider
        addProviderModel(result.providerModels, turnProvider, field(record, payload, "model", "model_name"))
      }
      if (type === "response_item") {
        const message = responseMessage(payload)
        if (message) responseMessages.push(message)
      }
      if (type === "event_msg") {
        const message = eventMessage(payload)
        if (message) eventMessages.push(message)
      }
      firstLine = false
    }
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ABORT_ERR" || (error as Error).name === "AbortError") throw error
    addWarning(result.warnings, `Unable to read session: ${error instanceof Error ? error.message : String(error)}`)
  } finally {
    lines.close()
    stream.destroy()
  }

  const messages = eventMessages.length > 0 ? eventMessages : responseMessages
  result.messageCount = messages.length
  for (const message of messages) {
    if (message.role !== "user" || !message.text) continue
    const text = truncate(message.text, 1000)
    result.firstUserMessage ??= text
    result.lastUserMessage = text
    result.title ??= text
  }

  if (result.recordCount === 0) addWarning(result.warnings, "Session file is empty")
  if (!result.sessionId) addWarning(result.warnings, "Codex session header is missing id")
  if (!result.createdAt) addWarning(result.warnings, "Codex session header is missing timestamp")
  if (!result.projectPath) addWarning(result.warnings, "Codex session header is missing cwd")
  return result
}
