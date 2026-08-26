import { lstat, readdir } from "node:fs/promises"
import path from "node:path"
import type { ScanIssue } from "../domain/scan"

export type DiscoveredJsonlFiles = {
  files: string[]
  issues: ScanIssue[]
}

export async function discoverJsonlFiles(rootPath: string, agentLabel: string, signal?: AbortSignal): Promise<DiscoveredJsonlFiles> {
  const files: string[] = []
  const issues: ScanIssue[] = []
  const root = path.resolve(rootPath)

  let rootStat
  try {
    rootStat = await lstat(root)
  } catch (error) {
    const code = (error as NodeJS.ErrnoException).code
    issues.push({ location: root, message: code === "ENOENT" ? `${agentLabel} session directory does not exist` : `Cannot access ${agentLabel} session directory: ${error instanceof Error ? error.message : String(error)}`, severity: "error" })
    return { files, issues }
  }
  if (!rootStat.isDirectory()) {
    issues.push({ location: root, message: `${agentLabel} session path is not a directory`, severity: "error" })
    return { files, issues }
  }

  async function visit(directory: string): Promise<void> {
    if (signal?.aborted) throw new DOMException("Scan aborted", "AbortError")
    let entries
    try {
      entries = await readdir(directory, { withFileTypes: true })
    } catch (error) {
      issues.push({ location: directory, message: `Cannot read directory: ${error instanceof Error ? error.message : String(error)}`, severity: "error" })
      return
    }
    for (const entry of entries) {
      if (signal?.aborted) throw new DOMException("Scan aborted", "AbortError")
      const entryPath = path.join(directory, entry.name)
      if (entry.isSymbolicLink()) {
        issues.push({ location: entryPath, message: "Skipped symbolic link", severity: "warning" })
        continue
      }
      if (entry.isDirectory()) {
        await visit(entryPath)
        continue
      }
      if (!entry.isFile()) {
        issues.push({ location: entryPath, message: "Skipped non-regular file", severity: "warning" })
        continue
      }
      if (path.extname(entry.name).toLowerCase() !== ".jsonl") {
        issues.push({ location: entryPath, message: "Skipped non-JSONL file", severity: "warning" })
        continue
      }
      files.push(entryPath)
    }
  }

  await visit(root)
  files.sort()
  return { files, issues }
}
