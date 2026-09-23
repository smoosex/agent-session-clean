import os from "node:os"
import path from "node:path"
import type { AgentInfo } from "../../domain/agent"
import type { AgentAdapter } from "../../application/ports"
import { normalizeProjectPath } from "../../utils/paths"
import { CodexDeleter } from "./deleter"
import { CodexParser } from "./parser"
import { CodexScanner } from "./scanner"

export const defaultCodexHome = path.join(os.homedir(), ".codex")
export const defaultCodexSessionsDir = path.join(defaultCodexHome, "sessions")

export class CodexAdapter implements AgentAdapter {
  readonly id = "codex" as const
  readonly info: AgentInfo = {
    id: "codex",
    label: "Codex",
    status: "available",
    capabilities: { canDelete: true, canBulkDelete: true },
  }
  readonly sessionsDir: string
  readonly parser: CodexParser
  readonly scanner: CodexScanner
  readonly deleter: CodexDeleter

  constructor(sessionsDir?: string) {
    const defaultDir = process.env.CODEX_HOME ? path.join(process.env.CODEX_HOME, "sessions") : defaultCodexSessionsDir
    this.sessionsDir = normalizeProjectPath(sessionsDir ?? process.env.ASC_CODEX_SESSIONS_DIR ?? defaultDir)
    this.info.detail = this.sessionsDir
    this.parser = new CodexParser()
    this.scanner = new CodexScanner(this.sessionsDir, this.parser)
    this.deleter = new CodexDeleter(this.sessionsDir)
  }
}
