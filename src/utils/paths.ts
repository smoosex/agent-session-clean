import os from "node:os"
import path from "node:path"

export function resolveHomePath(value: string): string {
  if (value === "~") return os.homedir()
  if (value.startsWith(`~${path.sep}`)) return path.join(os.homedir(), value.slice(2))
  return path.resolve(value)
}

export function normalizeProjectPath(value: string): string {
  const resolved = path.isAbsolute(value) ? value : path.resolve(value)
  return path.normalize(resolved)
}

export function displayPath(value: string): string {
  const home = path.normalize(os.homedir())
  const normalized = path.normalize(value)
  if (normalized === home) return "~"
  if (normalized.startsWith(`${home}${path.sep}`)) return `~${normalized.slice(home.length)}`
  return normalized
}

export function projectId(projectPath: string, agentId?: string): string {
  const normalized = normalizeProjectPath(projectPath)
  return agentId ? `project:${agentId}:${normalized}` : `project:${normalized}`
}
