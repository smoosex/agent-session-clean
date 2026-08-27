import { lstat } from "node:fs/promises"
import path from "node:path"
import type { AgentId } from "../domain/agent"
import type { ProjectSummary } from "../domain/project"
import type { ParsedSession, ScanOptions, ScanResult, SessionSource } from "../domain/scan"
import type { SessionSummary } from "../domain/session"
import type { SessionParser } from "../application/ports"
import { discoverJsonlFiles } from "./discover-jsonl"
import { displayPath, normalizeProjectPath, projectId } from "../utils/paths"
import { truncate } from "../utils/truncate"

function timestampValue(value: string | undefined): number {
  if (!value) return 0
  const parsed = Date.parse(value)
  return Number.isFinite(parsed) ? parsed : 0
}

function sortByUpdated<T extends { updatedAt: string }>(items: T[]): T[] {
  return items.sort((left, right) => timestampValue(right.updatedAt) - timestampValue(left.updatedAt))
}

function isFailedWarning(warning: string): boolean {
  return warning.startsWith("Invalid JSON") || warning.includes("Unable to read") || warning.startsWith("First record is not")
}

export async function scanSessionFiles(rootPath: string, agentId: AgentId, agentLabel: string, parser: SessionParser, options: ScanOptions = {}): Promise<ScanResult> {
  const discovered = await discoverJsonlFiles(rootPath, agentLabel, options.signal)
  const issues = [...discovered.issues]
  const sessions: SessionSummary[] = []
  let failedSources = 0

  for (const filePath of discovered.files) {
    if (options.signal?.aborted) throw new DOMException("Scan aborted", "AbortError")
    let fileStat
    try {
      fileStat = await lstat(filePath)
    } catch (error) {
      failedSources += 1
      issues.push({ location: filePath, message: `Cannot read file metadata: ${error instanceof Error ? error.message : String(error)}`, severity: "error" })
      continue
    }
    if (!fileStat.isFile()) {
      failedSources += 1
      issues.push({ location: filePath, message: "Session path is not a regular file", severity: "warning" })
      continue
    }

    const source: SessionSource = {
      ref: { agentId, sourceId: filePath },
      locator: filePath,
      sizeBytes: fileStat.size,
      updatedAt: fileStat.mtime.toISOString(),
      createdAt: fileStat.birthtime.getTime() > 0 ? fileStat.birthtime.toISOString() : undefined,
    }

    let parsed: ParsedSession
    try {
      parsed = await parser.parseSummary(source, options.signal)
    } catch (error) {
      if ((error as Error).name === "AbortError" || (error as NodeJS.ErrnoException).code === "ABORT_ERR") throw error
      failedSources += 1
      issues.push({ location: filePath, message: `Cannot parse session: ${error instanceof Error ? error.message : String(error)}`, severity: "error" })
      continue
    }

    const rawProjectLocation = parsed.projectLocation || path.dirname(filePath)
    const normalizedProjectLocation = normalizeProjectPath(rawProjectLocation)
    const warnings = [...new Set(parsed.warnings)]
    for (const warning of warnings) issues.push({ location: filePath, message: warning, severity: "warning" })
    if (warnings.some(isFailedWarning)) failedSources += 1
    if (fileStat.size === 0 && !warnings.includes("Session file is empty")) {
      warnings.push("Session file is empty")
      issues.push({ location: filePath, message: "Session file is empty", severity: "warning" })
    }

    const updatedAt = source.updatedAt
    const createdAt = parsed.createdAt ?? source.createdAt
    const id = parsed.sessionId ? `session:${agentId}:${parsed.sessionId}:${filePath}` : `source:${agentId}:${filePath}`
    const scopedProjectId = projectId(normalizedProjectLocation, agentId)
    sessions.push({
      id,
      ref: source.ref,
      agentId,
      sessionId: parsed.sessionId,
      projectId: scopedProjectId,
      projectName: parsed.projectName ?? displayPath(normalizedProjectLocation),
      projectLocation: normalizedProjectLocation,
      title: truncate(parsed.title ?? "Untitled session", 96) || "Untitled session",
      createdAt,
      updatedAt,
      sizeBytes: source.sizeBytes,
      messageCount: parsed.messageCount,
      firstUserMessage: parsed.firstUserMessage,
      lastUserMessage: parsed.lastUserMessage,
      providerModels: parsed.providerModels,
      warnings,
    })
  }

  const projectMap = new Map<string, ProjectSummary>()
  for (const session of sessions) {
    const current = projectMap.get(session.projectId)
    const warningCount = session.warnings.length
    if (current) {
      current.sessionCount += 1
      current.totalSizeBytes += session.sizeBytes ?? 0
      current.warningCount += warningCount
      if (timestampValue(session.updatedAt) > timestampValue(current.updatedAt)) current.updatedAt = session.updatedAt
      continue
    }
    projectMap.set(session.projectId, {
      id: session.projectId,
      agentId,
      name: session.projectName,
      location: session.projectLocation,
      displayPath: session.projectName,
      sessionCount: 1,
      totalSizeBytes: session.sizeBytes ?? 0,
      updatedAt: session.updatedAt,
      warningCount,
    })
  }

  return {
    agentId,
    rootPath: path.resolve(rootPath),
    projects: sortByUpdated([...projectMap.values()]),
    sessions: sortByUpdated(sessions),
    issues,
    scannedSources: discovered.files.length,
    failedSources,
  }
}
