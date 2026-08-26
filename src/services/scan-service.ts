import { lstat } from "node:fs/promises"
import path from "node:path"
import type { ProjectSummary } from "../domain/project"
import type { SessionSummary } from "../domain/session"
import type { ScanIssue, AgentScanResult, ScanOptions } from "../adapters/types"
import { parsePiSessionFile } from "../adapters/pi/parser"
import { discoverJsonlFiles } from "./discover-jsonl"
import { displayPath, normalizeProjectPath, projectId } from "../utils/paths"
import { truncate } from "../utils/truncate"

export type ParsedSessionFile = {
  sessionId?: string
  projectPath?: string
  createdAt?: string
  title?: string
  recordCount: number
  messageCount: number
  firstUserMessage?: string
  lastUserMessage?: string
  providerModels: string[]
  warnings: string[]
}

type SessionFileParser = (filePath: string, signal?: AbortSignal) => Promise<ParsedSessionFile>

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

export async function scanSessionFiles(rootPath: string, agentLabel: string, parseFile: SessionFileParser, options: ScanOptions = {}): Promise<AgentScanResult> {
  const discovered = await discoverJsonlFiles(rootPath, agentLabel, options.signal)
  const issues = [...discovered.issues]
  const sessions: SessionSummary[] = []
  let failedFiles = 0

  for (const filePath of discovered.files) {
    if (options.signal?.aborted) throw new DOMException("Scan aborted", "AbortError")
    let fileStat
    try {
      fileStat = await lstat(filePath)
    } catch (error) {
      failedFiles += 1
      issues.push({ path: filePath, message: `Cannot read file metadata: ${error instanceof Error ? error.message : String(error)}`, severity: "error" })
      continue
    }
    if (!fileStat.isFile()) {
      failedFiles += 1
      issues.push({ path: filePath, message: "Session path is not a regular file", severity: "warning" })
      continue
    }

    let parsed
    try {
      parsed = await parseFile(filePath, options.signal)
    } catch (error) {
      if ((error as Error).name === "AbortError" || (error as NodeJS.ErrnoException).code === "ABORT_ERR") throw error
      failedFiles += 1
      issues.push({ path: filePath, message: `Cannot parse session: ${error instanceof Error ? error.message : String(error)}`, severity: "error" })
      continue
    }

    const rawProjectPath = parsed.projectPath || path.dirname(filePath)
    const normalizedProjectPath = normalizeProjectPath(rawProjectPath)
    const warnings = [...new Set(parsed.warnings)]
    for (const warning of warnings) issues.push({ path: filePath, message: warning, severity: "warning" })
    if (warnings.some(isFailedWarning)) failedFiles += 1
    if (fileStat.size === 0 && !warnings.includes("Session file is empty")) {
      warnings.push("Session file is empty")
      issues.push({ path: filePath, message: "Session file is empty", severity: "warning" })
    }

    const updatedAt = fileStat.mtime.toISOString()
    const createdAt = parsed.createdAt ?? (fileStat.birthtime.getTime() > 0 ? fileStat.birthtime.toISOString() : undefined)
    const id = parsed.sessionId ? `session:${parsed.sessionId}:${filePath}` : `file:${filePath}`
    sessions.push({
      id,
      sessionId: parsed.sessionId,
      projectId: projectId(normalizedProjectPath),
      projectPath: normalizedProjectPath,
      filePath,
      title: truncate(parsed.title ?? "Untitled session", 96) || "Untitled session",
      createdAt,
      updatedAt,
      sizeBytes: fileStat.size,
      recordCount: parsed.recordCount,
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
      current.totalSizeBytes += session.sizeBytes
      current.warningCount += warningCount
      if (timestampValue(session.updatedAt) > timestampValue(current.updatedAt)) current.updatedAt = session.updatedAt
      continue
    }
    projectMap.set(session.projectId, {
      id: session.projectId,
      path: session.projectPath,
      displayPath: displayPath(session.projectPath),
      sessionCount: 1,
      totalSizeBytes: session.sizeBytes,
      updatedAt: session.updatedAt,
      warningCount,
    })
  }

  return {
    rootPath: path.resolve(rootPath),
    projects: sortByUpdated([...projectMap.values()]),
    sessions: sortByUpdated(sessions),
    issues,
    scannedFiles: discovered.files.length,
    failedFiles,
  }
}

export function scanPiSessions(rootPath: string, options: ScanOptions = {}): Promise<AgentScanResult> {
  return scanSessionFiles(rootPath, "Pi", async (filePath, signal) => {
    const parsed = await parsePiSessionFile(filePath, signal)
    return {
      sessionId: parsed.header?.id,
      projectPath: parsed.header?.cwd,
      createdAt: parsed.header?.timestamp,
      title: parsed.title ?? parsed.header?.title ?? parsed.header?.name,
      recordCount: parsed.recordCount,
      messageCount: parsed.messageCount,
      firstUserMessage: parsed.firstUserMessage,
      lastUserMessage: parsed.lastUserMessage,
      providerModels: parsed.providerModels,
      warnings: parsed.warnings,
    }
  }, options)
}
