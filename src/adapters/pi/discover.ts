import type { ScanIssue } from "../types"
import { discoverJsonlFiles } from "../../services/discover-jsonl"

export type DiscoveredPiFiles = {
  files: string[]
  issues: ScanIssue[]
}

export function discoverPiFiles(rootPath: string, signal?: AbortSignal): Promise<DiscoveredPiFiles> {
  return discoverJsonlFiles(rootPath, "Pi", signal)
}
