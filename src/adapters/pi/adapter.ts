import os from "node:os"
import path from "node:path"
import type { AgentInfo } from "../../domain/agent"
import type { AgentAdapter } from "../../application/ports"
import { normalizeProjectPath } from "../../utils/paths"
import { PiDeleter } from "./deleter"
import { PiParser } from "./parser"
import { PiScanner } from "./scanner"

export const defaultPiSessionsDir = path.join(os.homedir(), ".pi", "agent", "sessions")

export class PiAdapter implements AgentAdapter {
  readonly id = "pi" as const
  readonly info: AgentInfo = {
    id: "pi",
    label: "Pi",
    status: "available",
    capabilities: { canDelete: true, canBulkDelete: true },
  }
  readonly sessionsDir: string
  readonly parser: PiParser
  readonly scanner: PiScanner
  readonly deleter: PiDeleter

  constructor(sessionsDir?: string) {
    this.sessionsDir = normalizeProjectPath(sessionsDir ?? process.env.ASC_PI_SESSIONS_DIR ?? defaultPiSessionsDir)
    this.info.detail = this.sessionsDir
    this.parser = new PiParser()
    this.scanner = new PiScanner(this.sessionsDir, this.parser)
    this.deleter = new PiDeleter(this.sessionsDir)
  }
}
