import { Database } from "bun:sqlite"
import { lstat, readdir, realpath, rm } from "node:fs/promises"
import path from "node:path"
import type { DeleteOptions, DeleteItemResult, DeleteResult } from "../../domain/operation"
import type { SessionSummary } from "../../domain/session"
import type { SessionDeleter } from "../../application/ports"

function isWithinRoot(rootPath: string, targetPath: string): boolean {
  const relative = path.relative(rootPath, targetPath)
  return relative.length > 0 && !relative.startsWith(`..${path.sep}`) && relative !== ".." && !path.isAbsolute(relative)
}

async function removeEmptyParent(resolvedRoot: string, directory: string): Promise<void> {
  if (!isWithinRoot(resolvedRoot, directory)) return
  try {
    const entries = await readdir(directory)
    if (entries.length > 0) return
    await rm(directory)
  } catch {
  }
}

function removeSearchDoc(rootPath: string, sessionId: string): void {
  const dbPath = path.join(rootPath, "session_search.sqlite")
  try {
    const db = new Database(dbPath)
    try {
      db.run("PRAGMA busy_timeout = 3000")
      db.query("DELETE FROM session_docs WHERE session_id = ?").run(sessionId)
    } finally {
      db.close()
    }
  } catch {
  }
}

export class GrokDeleter implements SessionDeleter {
  constructor(private readonly rootPath: string) {}

  async deleteSessions(sessions: readonly SessionSummary[], options?: DeleteOptions): Promise<DeleteResult> {
    const items: DeleteItemResult[] = []
    let resolvedRoot: string
    try {
      resolvedRoot = await realpath(this.rootPath)
    } catch (error) {
      return { items: sessions.map((session) => ({ sessionId: session.id, success: false, message: `Cannot access session directory: ${error instanceof Error ? error.message : String(error)}` })) }
    }
    for (const session of sessions) {
      if (options?.signal?.aborted) throw new DOMException("Delete aborted", "AbortError")
      if (session.agentId !== "grok" || session.ref.agentId !== "grok") {
        items.push({ sessionId: session.id, success: false, message: "Session belongs to another agent" })
        continue
      }
      const targetPath = path.resolve(session.ref.sourceId)
      try {
        const stats = await lstat(targetPath)
        if (!stats.isDirectory()) {
          items.push({ sessionId: session.id, success: false, message: "Grok session source is not a directory" })
          continue
        }
        const resolvedTarget = await realpath(targetPath)
        if (!isWithinRoot(resolvedRoot, resolvedTarget)) {
          items.push({ sessionId: session.id, success: false, message: "Session is outside the configured session directory" })
          continue
        }
        await rm(resolvedTarget, { recursive: true, force: true })
        await removeEmptyParent(resolvedRoot, path.dirname(resolvedTarget))
        if (session.sessionId) removeSearchDoc(this.rootPath, session.sessionId)
        items.push({ sessionId: session.id, success: true })
      } catch (error) {
        const code = (error as NodeJS.ErrnoException).code
        items.push({ sessionId: session.id, success: false, message: code === "ENOENT" ? "Session source no longer exists" : error instanceof Error ? error.message : String(error) })
      }
    }
    return { items }
  }
}
