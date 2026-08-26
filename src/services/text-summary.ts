import { cleanText, truncate } from "../utils/truncate"
import type { PiMessage, PiRecord } from "../adapters/pi/types"

export function messageRole(record: PiRecord): string | undefined {
  return typeof record.message?.role === "string" ? record.message.role : undefined
}

export function messageText(message: PiMessage | undefined): string | undefined {
  if (!message) return undefined
  if (typeof message.content === "string") return truncate(message.content, 1000)
  if (!Array.isArray(message.content)) return undefined
  const text = message.content
    .flatMap((part) => {
      if (!part || typeof part !== "object") return []
      const candidate = part as { type?: unknown; text?: unknown }
      return candidate.type === "text" && typeof candidate.text === "string" ? [candidate.text] : []
    })
    .join(" ")
  return text ? truncate(text, 1000) : undefined
}

export function recordProviderModel(record: PiRecord): string | undefined {
  const provider = typeof record.provider === "string" ? record.provider : record.message?.provider
  const model = typeof record.modelId === "string" ? record.modelId : typeof record.model === "string" ? record.model : record.message?.modelId ?? record.message?.model
  if (!provider && !model) return undefined
  if (provider && model) return `${provider}/${model}`
  return provider ?? model
}

export function recordTitle(record: PiRecord): string | undefined {
  const value = record.title ?? record.name
  return typeof value === "string" ? cleanText(value) : undefined
}
