import { lstat, realpath, unlink } from "node:fs/promises"
import path from "node:path"
import type { AgentId } from "../domain/agent"
import type { DeleteOptions, DeleteResult } from "../domain/operation"
import type { SessionSummary } from "../domain/session"

function isWithinRoot(rootPath: string, targetPath: string): boolean {
  const relative = path.relative(rootPath, targetPath)
  return relative.length > 0 && !relative.startsWith(`..${path.sep}`) && relative !== ".." && !path.isAbsolute(relative)
}

export async function deleteSessionFiles(agentId: AgentId, rootPath: string, sessions: readonly SessionSummary[], options?: DeleteOptions): Promise<DeleteResult> {
  const items: DeleteResult["items"] = []
  let resolvedRoot: string
  try {
    resolvedRoot = await realpath(rootPath)
  } catch (error) {
    return {
      items: sessions.map((session) => ({ sessionId: session.id, success: false, message: `Cannot access session directory: ${error instanceof Error ? error.message : String(error)}` })),
    }
  }

  for (const session of sessions) {
    if (options?.signal?.aborted) throw new DOMException("Delete aborted", "AbortError")
    if (session.agentId !== agentId || session.ref.agentId !== agentId) {
      items.push({ sessionId: session.id, success: false, message: "Session belongs to another agent" })
      continue
    }
    const targetPath = path.resolve(session.ref.sourceId)
    try {
      const stats = await lstat(targetPath)
      if (!stats.isFile()) {
        items.push({ sessionId: session.id, success: false, message: "Session source is not a regular file" })
        continue
      }
      if ((session.sizeBytes !== undefined && stats.size !== session.sizeBytes) || stats.mtime.toISOString() !== session.updatedAt) {
        items.push({ sessionId: session.id, success: false, message: "Session changed since the last scan" })
        continue
      }
      const resolvedTarget = await realpath(targetPath)
      if (!isWithinRoot(resolvedRoot, resolvedTarget)) {
        items.push({ sessionId: session.id, success: false, message: "Session is outside the configured session directory" })
        continue
      }
      await unlink(targetPath)
      items.push({ sessionId: session.id, success: true })
    } catch (error) {
      const code = (error as NodeJS.ErrnoException).code
      items.push({ sessionId: session.id, success: false, message: code === "ENOENT" ? "Session source no longer exists" : error instanceof Error ? error.message : String(error) })
    }
  }
  return { items }
}
