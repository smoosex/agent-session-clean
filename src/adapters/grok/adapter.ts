import os from "node:os"
import path from "node:path"
import type { AgentInfo } from "../../domain/agent"
import type { AgentAdapter } from "../../application/ports"
import { normalizeProjectPath } from "../../utils/paths"
import { GrokDeleter } from "./deleter"
import { GrokParser } from "./parser"
import { GrokScanner } from "./scanner"

export function defaultGrokSessionsDir(): string {
  const home = process.env.GROK_HOME || path.join(os.homedir(), ".grok")
  return path.join(home, "sessions")
}

export class GrokAdapter implements AgentAdapter {
  readonly id = "grok" as const
  readonly info: AgentInfo = {
    id: "grok",
    label: "Grok",
    status: "available",
    capabilities: { canDelete: true, canBulkDelete: true },
  }
  readonly sessionsDir: string
  readonly parser: GrokParser
  readonly scanner: GrokScanner
  readonly deleter: GrokDeleter

  constructor(sessionsDir?: string) {
    this.sessionsDir = normalizeProjectPath(sessionsDir ?? process.env.AGC_GROK_SESSIONS_DIR ?? defaultGrokSessionsDir())
    this.info.detail = this.sessionsDir
    this.parser = new GrokParser()
    this.scanner = new GrokScanner(this.sessionsDir, this.parser)
    this.deleter = new GrokDeleter(this.sessionsDir)
  }
}
