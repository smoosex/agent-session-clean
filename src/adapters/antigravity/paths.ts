import os from "node:os"
import path from "node:path"
import { normalizeProjectPath } from "../../utils/paths"

export function defaultAntigravityDataDir(): string {
  if (process.env.ASC_ANTIGRAVITY_DATA_DIR) return normalizeProjectPath(process.env.ASC_ANTIGRAVITY_DATA_DIR)
  const geminiHome = process.env.GEMINI_HOME || path.join(os.homedir(), ".gemini")
  return path.join(geminiHome, "antigravity-cli")
}

export function antigravitySummariesDbPath(dataDir: string): string {
  return path.join(dataDir, "conversation_summaries.db")
}

export function antigravityConversationsDir(dataDir: string): string {
  return path.join(dataDir, "conversations")
}

export const antigravitySessionIdPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export function workspacePath(uris: string | null | undefined): string | undefined {
  if (!uris) return undefined
  let first: unknown = uris
  try {
    const parsed = JSON.parse(uris) as unknown
    first = Array.isArray(parsed) ? parsed[0] : parsed
  } catch {
  }
  if (typeof first !== "string" || first.length === 0) return undefined
  if (first.startsWith("file://")) {
    try {
      return decodeURIComponent(first.slice("file://".length))
    } catch {
      return first.slice("file://".length)
    }
  }
  return first
}
