import { lstat, readdir, realpath, rm } from "node:fs/promises"
import path from "node:path"
import type { DeleteOptions, DeleteResult } from "../../domain/operation"
import type { SessionSummary } from "../../domain/session"
import type { SessionDeleter } from "../../application/ports"
import { openOpenCodeDb, tableNames } from "./db"
import { openCodeDbPath, openCodeSessionIdPattern, openCodeStorageDir } from "./paths"

const sessionTables = ["part", "message", "session_message", "session_pending", "session_share", "todo", "instruction_entry", "instruction_state", "session_v2", "session"]

function isWithinRoot(rootPath: string, targetPath: string): boolean {
  const relative = path.relative(rootPath, targetPath)
  return relative.length > 0 && !relative.startsWith(`..${path.sep}`) && relative !== ".." && !path.isAbsolute(relative)
}

async function removeIfWithin(root: string, target: string): Promise<void> {
  let resolved: string
  try {
    resolved = await realpath(target)
  } catch {
    return
  }
  if (!isWithinRoot(root, resolved) && resolved !== root) return
  await rm(resolved, { recursive: true, force: true })
}

export class OpenCodeDeleter implements SessionDeleter {
  constructor(private readonly dataDir: string) {}

  async deleteSessions(sessions: readonly SessionSummary[], options?: DeleteOptions): Promise<DeleteResult> {
    const items: DeleteResult["items"] = []
    let resolvedRoot: string
    try {
      resolvedRoot = await realpath(this.dataDir)
    } catch (error) {
      return { items: sessions.map((session) => ({ sessionId: session.id, success: false, message: `Cannot access OpenCode data directory: ${error instanceof Error ? error.message : String(error)}` })) }
    }
    const dbPath = openCodeDbPath(this.dataDir)
    try {
      const stats = await lstat(dbPath)
      if (!stats.isFile()) return { items: sessions.map((session) => ({ sessionId: session.id, success: false, message: "OpenCode database path is not a file" })) }
    } catch (error) {
      return { items: sessions.map((session) => ({ sessionId: session.id, success: false, message: error instanceof Error ? error.message : String(error) })) }
    }
    const db = await openOpenCodeDb(dbPath, false)
    try {
      const tables = tableNames(db)
      const storageRoot = openCodeStorageDir(resolvedRoot)
      for (const session of sessions) {
        if (options?.signal?.aborted) throw new DOMException("Delete aborted", "AbortError")
        if (session.agentId !== "opencode" || session.ref.agentId !== "opencode") {
          items.push({ sessionId: session.id, success: false, message: "Session belongs to another agent" })
          continue
        }
        const sourceId = session.ref.sourceId
        if (!openCodeSessionIdPattern.test(sourceId)) {
          items.push({ sessionId: session.id, success: false, message: "Invalid OpenCode session id" })
          continue
        }
        const sessionTable = tables.has("session") ? "session" : tables.has("session_v2") ? "session_v2" : undefined
        if (!sessionTable) {
          items.push({ sessionId: session.id, success: false, message: "OpenCode database has no session table" })
          continue
        }
        const row = db.query(`SELECT id, project_id FROM ${sessionTable} WHERE id = ?`).get(sourceId) as { id: string; project_id: string | null } | null
        if (!row) {
          items.push({ sessionId: session.id, success: false, message: "OpenCode session was not found" })
          continue
        }
        const messageIds = tables.has("message")
          ? (db.query("SELECT id FROM message WHERE session_id = ?").all(sourceId) as Array<{ id: string }>).map((item) => item.id)
          : []
        const deleteRows = db.transaction(() => {
          if (tables.has("event")) db.query("DELETE FROM event WHERE aggregate_id = ?").run(sourceId)
          for (const table of sessionTables) {
            if (!tables.has(table)) continue
            if (table === "session" || table === "session_v2") db.query(`DELETE FROM ${table} WHERE id = ?`).run(sourceId)
            else db.query(`DELETE FROM ${table} WHERE session_id = ?`).run(sourceId)
          }
        })
        try {
          deleteRows()
        } catch (error) {
          items.push({ sessionId: session.id, success: false, message: error instanceof Error ? error.message : String(error) })
          continue
        }
        await removeIfWithin(resolvedRoot, path.join(storageRoot, "session", row.project_id ?? "", sourceId + ".json"))
        await removeIfWithin(resolvedRoot, path.join(storageRoot, "message", sourceId))
        await removeIfWithin(resolvedRoot, path.join(storageRoot, "todo", sourceId + ".json"))
        await removeIfWithin(resolvedRoot, path.join(storageRoot, "agent-usage-reminder", sourceId + ".json"))
        await removeIfWithin(resolvedRoot, path.join(storageRoot, "session_diff", sourceId))
        for (const messageId of messageIds) await removeIfWithin(resolvedRoot, path.join(storageRoot, "part", messageId))
        const projectDir = path.join(storageRoot, "session", row.project_id ?? "")
        try {
          const leftover = await readdir(projectDir)
          if (leftover.length === 0) await removeIfWithin(resolvedRoot, projectDir)
        } catch {
        }
        items.push({ sessionId: session.id, success: true })
      }
    } finally {
      db.close()
    }
    return { items }
  }
}
