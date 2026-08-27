import type { AgentInfo } from "../../domain/agent"
import type { AgentAdapter } from "../../application/ports"
import { normalizeProjectPath } from "../../utils/paths"
import { OpenCodeDeleter } from "./deleter"
import { OpenCodeParser } from "./parser"
import { defaultOpenCodeDataDir } from "./paths"
import { OpenCodeScanner } from "./scanner"

export class OpenCodeAdapter implements AgentAdapter {
  readonly id = "opencode" as const
  readonly info: AgentInfo = {
    id: "opencode",
    label: "OpenCode",
    status: "available",
    capabilities: { canDelete: true, canBulkDelete: true },
  }
  readonly dataDir: string
  readonly parser: OpenCodeParser
  readonly scanner: OpenCodeScanner
  readonly deleter: OpenCodeDeleter

  constructor(dataDir?: string) {
    this.dataDir = normalizeProjectPath(dataDir ?? defaultOpenCodeDataDir())
    this.info.detail = this.dataDir
    this.parser = new OpenCodeParser(this.dataDir)
    this.scanner = new OpenCodeScanner(this.dataDir)
    this.deleter = new OpenCodeDeleter(this.dataDir)
  }
}
