import os from "node:os"
import path from "node:path"
import { normalizeProjectPath } from "../../utils/paths"

export function defaultOpenCodeDataDir(): string {
  if (process.env.ASC_OPENCODE_DATA_DIR) return normalizeProjectPath(process.env.ASC_OPENCODE_DATA_DIR)
  if (process.env.OPENCODE_DATA_DIR) return normalizeProjectPath(process.env.OPENCODE_DATA_DIR)
  const appName = process.env.OPENCODE_APPNAME || "opencode"
  const xdg = process.env.XDG_DATA_HOME
  if (xdg) return normalizeProjectPath(path.join(xdg, appName))
  return path.join(os.homedir(), ".local", "share", appName)
}

export function openCodeDbPath(dataDir: string): string {
  return path.join(dataDir, "opencode.db")
}

export function openCodeStorageDir(dataDir: string): string {
  return path.join(dataDir, "storage")
}

export const openCodeSessionIdPattern = /^ses_[A-Za-z0-9]+$/
