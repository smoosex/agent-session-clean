import { lstat } from "node:fs/promises"
import type { AgentDetection } from "../../domain/agent"
import type { ScanOptions, ScanResult } from "../../domain/scan"
import type { SessionParser, SessionScanner } from "../../application/ports"
import { scanSessionFiles } from "../../services/scan-service"

export class PiScanner implements SessionScanner {
  readonly rootPath: string
  private readonly parser: SessionParser

  constructor(rootPath: string, parser: SessionParser) {
    this.rootPath = rootPath
    this.parser = parser
  }

  async detect(): Promise<AgentDetection> {
    try {
      const stats = await lstat(this.rootPath)
      if (!stats.isDirectory()) return { available: false, location: this.rootPath, reason: "Session path is not a directory" }
      return { available: true, location: this.rootPath }
    } catch (error) {
      return { available: false, location: this.rootPath, reason: error instanceof Error ? error.message : String(error) }
    }
  }

  scan(options?: ScanOptions): Promise<ScanResult> {
    return scanSessionFiles(this.rootPath, "pi", "Pi", this.parser, options)
  }
}
