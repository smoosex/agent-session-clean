import { realpath, rm } from "node:fs/promises"
import path from "node:path"
import type { DeleteOptions, DeleteResult } from "../../domain/operation"
import type { SessionSummary } from "../../domain/session"
import type { SessionDeleter } from "../../application/ports"
import { deleteSessionFiles } from "../../services/delete-session-files"

const sessionIdPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

function isWithinRoot(rootPath: string, targetPath: string): boolean {
  const relative = path.relative(rootPath, targetPath)
  return relative.length > 0 && !relative.startsWith(`..${path.sep}`) && relative !== ".." && !path.isAbsolute(relative)
}

export class ClaudeCodeDeleter implements SessionDeleter {
  constructor(private readonly rootPath: string) {}

  async deleteSessions(sessions: readonly SessionSummary[], options?: DeleteOptions): Promise<DeleteResult> {
    const result = await deleteSessionFiles("claude-code", this.rootPath, sessions, options)
    const configDir = path.dirname(path.resolve(this.rootPath))
    let resolvedConfig: string | undefined
    try {
      resolvedConfig = await realpath(configDir)
    } catch {
      return result
    }
    for (const item of result.items) {
      if (!item.success) continue
      const session = sessions.find((entry) => entry.id === item.sessionId)
      const sourceId = session?.sessionId
      if (!sourceId || !sessionIdPattern.test(sourceId)) continue
      const historyPath = path.join(resolvedConfig, "file-history", sourceId)
      try {
        const resolved = await realpath(historyPath)
        if (!isWithinRoot(resolvedConfig, resolved)) continue
        await rm(resolved, { recursive: true, force: true })
      } catch {
      }
    }
    return result
  }
}
