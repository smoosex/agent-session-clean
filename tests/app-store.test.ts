import { describe, expect, test } from "bun:test"
import type { AgentAdapter, AgentScanResult } from "../src/adapters/types"
import { createAppStore } from "../src/store/app-store"

const scanResult: AgentScanResult = {
  rootPath: "/tmp/sessions",
  scannedFiles: 2,
  failedFiles: 0,
  issues: [],
  projects: [
    { id: "project:/work/app", path: "/work/app", displayPath: "/work/app", sessionCount: 1, totalSizeBytes: 10, updatedAt: "2026-02-02T00:00:00.000Z", warningCount: 0 },
    { id: "project:/work/site", path: "/work/site", displayPath: "/work/site", sessionCount: 1, totalSizeBytes: 20, updatedAt: "2026-01-01T00:00:00.000Z", warningCount: 0 },
  ],
  sessions: [
    { id: "session:new", sessionId: "new", projectId: "project:/work/app", projectPath: "/work/app", filePath: "/tmp/new.jsonl", title: "Fix auth", updatedAt: "2026-02-02T00:00:00.000Z", sizeBytes: 10, recordCount: 2, messageCount: 1, firstUserMessage: "Fix auth", providerModels: [], warnings: [] },
    { id: "session:old", sessionId: "old", projectId: "project:/work/site", projectPath: "/work/site", filePath: "/tmp/old.jsonl", title: "Update docs", updatedAt: "2026-01-01T00:00:00.000Z", sizeBytes: 20, recordCount: 2, messageCount: 1, firstUserMessage: "Update docs", providerModels: [], warnings: [] },
  ],
}

function fakeAdapter(): AgentAdapter {
  return {
    id: "pi",
    info: { id: "pi", label: "Pi", status: "available" },
    detect: async () => ({ available: true }),
    scan: async () => scanResult,
    loadDetail: async (session) => ({ ...session, warningCount: session.warnings.length }),
  }
}

describe("createAppStore", () => {
  test("selects the newest project and filters both panes", async () => {
    const store = createAppStore(fakeAdapter())
    await store.scan()
    expect(store.selectedProjectId()).toBe("project:/work/app")
    expect(store.selectedSessionId()).toBe("session:new")
    store.setSearchQuery("docs")
    expect(store.filteredProjects().map((project) => project.id)).toEqual(["project:/work/site"])
    expect(store.filteredSessions()).toHaveLength(0)
  })
})
