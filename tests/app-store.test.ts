import { describe, expect, test } from "bun:test"
import type { AgentAdapter } from "../src/application/ports"
import type { ScanResult } from "../src/domain/scan"
import { createAgentUseCases } from "../src/application/use-cases"
import { createAppStore } from "../src/store/app-store"

const scanResult: ScanResult = {
  agentId: "pi",
  rootPath: "/tmp/sessions",
  scannedSources: 2,
  failedSources: 0,
  issues: [],
  projects: [
    { id: "project:pi:/work/app", agentId: "pi", name: "/work/app", location: "/work/app", displayPath: "/work/app", sessionCount: 1, totalSizeBytes: 10, updatedAt: "2026-02-02T00:00:00.000Z", warningCount: 0 },
    { id: "project:pi:/work/site", agentId: "pi", name: "/work/site", location: "/work/site", displayPath: "/work/site", sessionCount: 1, totalSizeBytes: 20, updatedAt: "2026-01-01T00:00:00.000Z", warningCount: 0 },
  ],
  sessions: [
    { id: "session:pi:new", ref: { agentId: "pi", sourceId: "/tmp/new.jsonl" }, agentId: "pi", sessionId: "new", projectId: "project:pi:/work/app", projectName: "/work/app", projectLocation: "/work/app", title: "Fix auth", updatedAt: "2026-02-02T00:00:00.000Z", sizeBytes: 10, messageCount: 1, firstUserMessage: "Fix auth", providerModels: [], warnings: [] },
    { id: "session:pi:old", ref: { agentId: "pi", sourceId: "/tmp/old.jsonl" }, agentId: "pi", sessionId: "old", projectId: "project:pi:/work/site", projectName: "/work/site", projectLocation: "/work/site", title: "Update docs", updatedAt: "2026-01-01T00:00:00.000Z", sizeBytes: 20, messageCount: 1, firstUserMessage: "Update docs", providerModels: [], warnings: [] },
  ],
}

function fakeAdapter(id: "pi" | "codex", result: ScanResult = scanResult): AgentAdapter {
  return {
    id,
    info: { id, label: id === "pi" ? "Pi" : "Codex", status: "available", capabilities: { canDelete: false, canBulkDelete: false } },
    scanner: { rootPath: result.rootPath, detect: async () => ({ available: true }), scan: async () => ({ ...result, agentId: id }) },
    parser: {
      parseSummary: async () => ({ providerModels: [], warnings: [], detailFields: [] }),
      loadDetail: async (session) => ({ ...session, fields: [], warningCount: session.warnings.length }),
    },
  }
}

describe("createAppStore", () => {
  test("selects the newest project and filters both panes", async () => {
    const adapter = fakeAdapter("pi")
    const store = createAppStore(createAgentUseCases(new Map([["pi", adapter]])), "pi")
    await store.scan()
    expect(store.selectedProjectId()).toBe("project:pi:/work/app")
    expect(store.selectedSessionId()).toBe("session:pi:new")
    store.setSearchQuery("docs")
    expect(store.filteredProjects().map((project) => project.id)).toEqual(["project:pi:/work/site"])
    expect(store.filteredSessions()).toHaveLength(0)
  })

  test("switches between registered agents and rescans", async () => {
    const codexResult: ScanResult = {
      ...scanResult,
      agentId: "codex",
      rootPath: "/tmp/codex-sessions",
      projects: [{ ...scanResult.projects[0]!, id: "project:codex:/work/codex", agentId: "codex", name: "/work/codex", location: "/work/codex", displayPath: "/work/codex" }],
      sessions: [{ ...scanResult.sessions[0]!, id: "session:codex:codex", ref: { agentId: "codex", sourceId: "/tmp/codex.jsonl" }, agentId: "codex", sessionId: "codex", projectId: "project:codex:/work/codex", projectName: "/work/codex", projectLocation: "/work/codex" }],
    }
    const pi = fakeAdapter("pi")
    const codex = fakeAdapter("codex", codexResult)
    const useCases = createAgentUseCases(new Map([["pi", pi], ["codex", codex]]))
    const store = createAppStore(useCases, "pi")

    await store.scan()
    store.setActiveAgent("codex")
    await new Promise((resolve) => setTimeout(resolve, 0))

    expect(store.activeAgentId()).toBe("codex")
    expect(store.rootPath()).toBe("/tmp/codex-sessions")
    expect(store.selectedSessionId()).toBe("session:codex:codex")
  })

  test("keeps the list position when the selected session disappears", async () => {
    const project = { id: "project:pi:/work/app", agentId: "pi" as const, name: "/work/app", location: "/work/app", displayPath: "/work/app", sessionCount: 3, totalSizeBytes: 30, updatedAt: "2026-03-03T00:00:00.000Z", warningCount: 0 }
    const sessions = [
      { id: "session:pi:first", ref: { agentId: "pi" as const, sourceId: "/tmp/first.jsonl" }, agentId: "pi" as const, sessionId: "first", projectId: project.id, projectName: project.name, projectLocation: project.location, title: "First", updatedAt: "2026-03-03T00:00:00.000Z", sizeBytes: 10, messageCount: 1, firstUserMessage: "First", providerModels: [], warnings: [] },
      { id: "session:pi:middle", ref: { agentId: "pi" as const, sourceId: "/tmp/middle.jsonl" }, agentId: "pi" as const, sessionId: "middle", projectId: project.id, projectName: project.name, projectLocation: project.location, title: "Middle", updatedAt: "2026-03-02T00:00:00.000Z", sizeBytes: 10, messageCount: 1, firstUserMessage: "Middle", providerModels: [], warnings: [] },
      { id: "session:pi:last", ref: { agentId: "pi" as const, sourceId: "/tmp/last.jsonl" }, agentId: "pi" as const, sessionId: "last", projectId: project.id, projectName: project.name, projectLocation: project.location, title: "Last", updatedAt: "2026-03-01T00:00:00.000Z", sizeBytes: 10, messageCount: 1, firstUserMessage: "Last", providerModels: [], warnings: [] },
    ]
    let current: ScanResult = {
      agentId: "pi",
      rootPath: "/tmp/sessions",
      scannedSources: 3,
      failedSources: 0,
      issues: [],
      projects: [project],
      sessions,
    }
    const adapter = fakeAdapter("pi", current)
    adapter.scanner.scan = async () => current
    const store = createAppStore(createAgentUseCases(new Map([["pi", adapter]])), "pi")
    await store.scan()
    store.chooseSession("session:pi:middle")
    current = {
      ...current,
      scannedSources: 2,
      projects: [{ ...project, sessionCount: 2, totalSizeBytes: 20 }],
      sessions: [sessions[0]!, sessions[2]!],
    }
    await store.scan()
    expect(store.selectedSessionId()).toBe("session:pi:last")
  })
})
