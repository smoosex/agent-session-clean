import { lstat, realpath, rm } from "node:fs/promises"
import path from "node:path"
import type { DeleteOptions, DeleteResult } from "../../domain/operation"
import type { SessionSummary } from "../../domain/session"
import type { SessionDeleter } from "../../application/ports"
import { openAntigravityDb, tableNames } from "./db"
import { antigravityConversationsDir, antigravitySessionIdPattern, antigravitySummariesDbPath } from "./paths"

function isWithinRoot(rootPath: string, targetPath: string): boolean {
  const relative = path.relative(rootPath, targetPath)
  return relative.length > 0 && !relative.startsWith(`..${path.sep}`) && relative !== ".." && !path.isAbsolute(relative)
}

async function removeIfWithin(root: string, target: string): Promise<void> {
  let resolved: string
  try {
    resolved = await realpath(target)
  } catch {
    try {
      await rm(target, { recursive: true, force: true })
    } catch {
    }
    return
  }
  if (!isWithinRoot(root, resolved) && resolved !== root) return
  await rm(resolved, { recursive: true, force: true })
}

export class AntigravityDeleter implements SessionDeleter {
  constructor(private readonly dataDir: string) {}

  async deleteSessions(sessions: readonly SessionSummary[], options?: DeleteOptions): Promise<DeleteResult> {
    const items: DeleteResult["items"] = []
    let resolvedRoot: string
    try {
      resolvedRoot = await realpath(this.dataDir)
    } catch (error) {
      return { items: sessions.map((session) => ({ sessionId: session.id, success: false, message: `Cannot access Antigravity data directory: ${error instanceof Error ? error.message : String(error)}` })) }
    }
    const dbPath = antigravitySummariesDbPath(this.dataDir)
    try {
      const stats = await lstat(dbPath)
      if (!stats.isFile()) return { items: sessions.map((session) => ({ sessionId: session.id, success: false, message: "Antigravity summaries database path is not a file" })) }
    } catch (error) {
      return { items: sessions.map((session) => ({ sessionId: session.id, success: false, message: error instanceof Error ? error.message : String(error) })) }
    }
    const db = await openAntigravityDb(dbPath, false)
    try {
      const tables = tableNames(db)
      const conversations = antigravityConversationsDir(resolvedRoot)
      for (const session of sessions) {
        if (options?.signal?.aborted) throw new DOMException("Delete aborted", "AbortError")
        if (session.agentId !== "antigravity" || session.ref.agentId !== "antigravity") {
          items.push({ sessionId: session.id, success: false, message: "Session belongs to another agent" })
          continue
        }
        const sourceId = session.ref.sourceId
        if (!antigravitySessionIdPattern.test(sourceId)) {
          items.push({ sessionId: session.id, success: false, message: "Invalid Antigravity session id" })
          continue
        }
        for (const name of [`${sourceId}.db`, `${sourceId}.db-wal`, `${sourceId}.db-shm`, `${sourceId}.pb`]) {
          await removeIfWithin(resolvedRoot, path.join(conversations, name))
        }
        await removeIfWithin(resolvedRoot, path.join(resolvedRoot, "brain", sourceId))
        await removeIfWithin(resolvedRoot, path.join(resolvedRoot, "presence", `${sourceId}.lock`))
        if (tables.has("conversation_summaries")) {
          try {
            db.query("DELETE FROM conversation_summaries WHERE conversation_id = ?").run(sourceId)
          } catch (error) {
            items.push({ sessionId: session.id, success: false, message: error instanceof Error ? error.message : String(error) })
            continue
          }
        }
        items.push({ sessionId: session.id, success: true })
      }
    } finally {
      db.close()
    }
    return { items }
  }
}
