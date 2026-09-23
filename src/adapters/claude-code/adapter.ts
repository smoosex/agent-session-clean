import os from "node:os"
import path from "node:path"
import type { AgentInfo } from "../../domain/agent"
import type { AgentAdapter } from "../../application/ports"
import { normalizeProjectPath } from "../../utils/paths"
import { ClaudeCodeDeleter } from "./deleter"
import { ClaudeCodeParser } from "./parser"
import { ClaudeCodeScanner } from "./scanner"

export function defaultClaudeCodeSessionsDir(): string {
  const configDir = process.env.CLAUDE_CONFIG_DIR || path.join(os.homedir(), ".claude")
  return path.join(configDir, "projects")
}

export class ClaudeCodeAdapter implements AgentAdapter {
  readonly id = "claude-code" as const
  readonly info: AgentInfo = {
    id: "claude-code",
    label: "Claude Code",
    status: "available",
    capabilities: { canDelete: true, canBulkDelete: true },
  }
  readonly sessionsDir: string
  readonly parser: ClaudeCodeParser
  readonly scanner: ClaudeCodeScanner
  readonly deleter: ClaudeCodeDeleter

  constructor(sessionsDir?: string) {
    this.sessionsDir = normalizeProjectPath(sessionsDir ?? process.env.ASC_CLAUDE_CODE_SESSIONS_DIR ?? defaultClaudeCodeSessionsDir())
    this.info.detail = this.sessionsDir
    this.parser = new ClaudeCodeParser()
    this.scanner = new ClaudeCodeScanner(this.sessionsDir, this.parser)
    this.deleter = new ClaudeCodeDeleter(this.sessionsDir)
  }
}
