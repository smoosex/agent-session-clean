import { lstat, readdir, realpath, rm, unlink } from "node:fs/promises"
import path from "node:path"
import type { AgentId } from "../domain/agent"
import type { DeleteOptions, DeleteItemResult, DeleteResult } from "../domain/operation"
import type { SessionSummary } from "../domain/session"

function isWithinRoot(rootPath: string, targetPath: string): boolean {
  const relative = path.relative(rootPath, targetPath)
  return relative.length > 0 && !relative.startsWith(`..${path.sep}`) && relative !== ".." && !path.isAbsolute(relative)
}

function isJsonl(name: string): boolean {
  return path.extname(name).toLowerCase() === ".jsonl"
}

type ValidTarget = {
  session: SessionSummary
  targetPath: string
  resolvedTarget: string
}

async function removeEmptyParents(resolvedRoot: string, directory: string, signal?: AbortSignal): Promise<void> {
  let current = directory
  while (isWithinRoot(resolvedRoot, current)) {
    if (signal?.aborted) throw new DOMException("Delete aborted", "AbortError")
    let entries
    try {
      entries = await readdir(current)
    } catch {
      return
    }
    if (entries.length > 0) return
    try {
      await rm(current)
    } catch {
      return
    }
    current = path.dirname(current)
  }
}

async function validateSession(agentId: AgentId, resolvedRoot: string, session: SessionSummary): Promise<ValidTarget | DeleteItemResult> {
  if (session.agentId !== agentId || session.ref.agentId !== agentId) {
    return { sessionId: session.id, success: false, message: "Session belongs to another agent" }
  }
  const targetPath = path.resolve(session.ref.sourceId)
  try {
    const stats = await lstat(targetPath)
    if (!stats.isFile()) return { sessionId: session.id, success: false, message: "Session source is not a regular file" }
    if ((session.sizeBytes !== undefined && stats.size !== session.sizeBytes) || stats.mtime.toISOString() !== session.updatedAt) {
      return { sessionId: session.id, success: false, message: "Session changed since the last scan" }
    }
    const resolvedTarget = await realpath(targetPath)
    if (!isWithinRoot(resolvedRoot, resolvedTarget)) {
      return { sessionId: session.id, success: false, message: "Session is outside the configured session directory" }
    }
    return { session, targetPath, resolvedTarget }
  } catch (error) {
    const code = (error as NodeJS.ErrnoException).code
    return { sessionId: session.id, success: false, message: code === "ENOENT" ? "Session source no longer exists" : error instanceof Error ? error.message : String(error) }
  }
}

export async function deleteSessionFiles(agentId: AgentId, rootPath: string, sessions: readonly SessionSummary[], options?: DeleteOptions): Promise<DeleteResult> {
  const items: DeleteItemResult[] = []
  let resolvedRoot: string
  try {
    resolvedRoot = await realpath(rootPath)
  } catch (error) {
    return {
      items: sessions.map((session) => ({ sessionId: session.id, success: false, message: `Cannot access session directory: ${error instanceof Error ? error.message : String(error)}` })),
    }
  }

  const valid: ValidTarget[] = []
  for (const session of sessions) {
    if (options?.signal?.aborted) throw new DOMException("Delete aborted", "AbortError")
    const result = await validateSession(agentId, resolvedRoot, session)
    if ("success" in result) items.push(result)
    else valid.push(result)
  }

  const groups = new Map<string, ValidTarget[]>()
  for (const target of valid) {
    const directory = path.dirname(target.resolvedTarget)
    const group = groups.get(directory) ?? []
    group.push(target)
    groups.set(directory, group)
  }

  for (const [directory, group] of groups) {
    if (options?.signal?.aborted) throw new DOMException("Delete aborted", "AbortError")
    const deleteNames = new Set(group.map((target) => path.basename(target.resolvedTarget)))
    let entries
    try {
      entries = await readdir(directory, { withFileTypes: true })
    } catch (error) {
      items.push(...group.map((target) => ({ sessionId: target.session.id, success: false, message: error instanceof Error ? error.message : String(error) })))
      continue
    }
    const leftoverJsonl = entries.some((entry) => entry.isFile() && isJsonl(entry.name) && !deleteNames.has(entry.name))
    const hasSubdir = entries.some((entry) => entry.isDirectory())
    if (!leftoverJsonl && !hasSubdir && directory !== resolvedRoot && isWithinRoot(resolvedRoot, directory)) {
      try {
        await rm(directory, { recursive: true, force: true })
        items.push(...group.map((target) => ({ sessionId: target.session.id, success: true })))
        await removeEmptyParents(resolvedRoot, path.dirname(directory), options?.signal)
        continue
      } catch (error) {
        items.push(...group.map((target) => ({ sessionId: target.session.id, success: false, message: error instanceof Error ? error.message : String(error) })))
        continue
      }
    }
    for (const target of group) {
      if (options?.signal?.aborted) throw new DOMException("Delete aborted", "AbortError")
      try {
        await unlink(target.targetPath)
        items.push({ sessionId: target.session.id, success: true })
      } catch (error) {
        const code = (error as NodeJS.ErrnoException).code
        items.push({ sessionId: target.session.id, success: false, message: code === "ENOENT" ? "Session source no longer exists" : error instanceof Error ? error.message : String(error) })
      }
    }
    await removeEmptyParents(resolvedRoot, directory, options?.signal)
  }

  return { items }
}
