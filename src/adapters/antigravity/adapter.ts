import type { AgentInfo } from "../../domain/agent"
import type { AgentAdapter } from "../../application/ports"
import { normalizeProjectPath } from "../../utils/paths"
import { AntigravityDeleter } from "./deleter"
import { AntigravityParser } from "./parser"
import { defaultAntigravityDataDir } from "./paths"
import { AntigravityScanner } from "./scanner"

export class AntigravityAdapter implements AgentAdapter {
  readonly id = "antigravity" as const
  readonly info: AgentInfo = {
    id: "antigravity",
    label: "Antigravity",
    status: "available",
    capabilities: { canDelete: true, canBulkDelete: true },
  }
  readonly dataDir: string
  readonly parser: AntigravityParser
  readonly scanner: AntigravityScanner
  readonly deleter: AntigravityDeleter

  constructor(dataDir?: string) {
    this.dataDir = normalizeProjectPath(dataDir ?? defaultAntigravityDataDir())
    this.info.detail = this.dataDir
    this.parser = new AntigravityParser(this.dataDir)
    this.scanner = new AntigravityScanner(this.dataDir)
    this.deleter = new AntigravityDeleter(this.dataDir)
  }
}
