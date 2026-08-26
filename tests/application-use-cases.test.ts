import { describe, expect, test } from "bun:test"
import type { AgentAdapter } from "../src/application/ports"
import { deleteSessions } from "../src/application/use-cases/delete-sessions"
import { selectAll, toggleSelection } from "../src/domain/selection"
import type { SessionSummary } from "../src/domain/session"

function session(agentId: "pi" | "codex", id: string): SessionSummary {
  return {
    id,
    ref: { agentId, sourceId: `${id}.jsonl` },
    agentId,
    sessionId: id,
    projectId: `project:${agentId}:/work/app`,
    projectName: "/work/app",
    projectLocation: "/work/app",
    title: id,
    updatedAt: "2026-01-01T00:00:00.000Z",
    sizeBytes: 1,
    messageCount: 1,
    providerModels: [],
    warnings: [],
  }
}

function adapter(id: "pi" | "codex", deleter?: AgentAdapter["deleter"]): AgentAdapter {
  return {
    id,
    info: { id, label: id, status: "available", capabilities: { canDelete: Boolean(deleter), canBulkDelete: Boolean(deleter) } },
    scanner: { rootPath: "/tmp", detect: async () => ({ available: true }), scan: async () => ({ agentId: id, rootPath: "/tmp", projects: [], sessions: [], issues: [], scannedSources: 0, failedSources: 0 }) },
    parser: { parseSummary: async () => ({ providerModels: [], warnings: [], detailFields: [] }), loadDetail: async (value) => ({ ...value, fields: [], warningCount: 0 }) },
    deleter,
  }
}

describe("application use cases", () => {
  test("groups deletion requests by agent and reports unsupported agents", async () => {
    const deleted: string[] = []
    const pi = session("pi", "pi-1")
    const codex = session("codex", "codex-1")
    const piAdapter = adapter("pi", { deleteSessions: async (sessions) => {
      deleted.push(...sessions.map((value) => value.id))
      return { items: sessions.map((value) => ({ sessionId: value.id, success: true })) }
    } })
    const codexAdapter = adapter("codex")

    const result = await deleteSessions(new Map([["pi", piAdapter], ["codex", codexAdapter]]), [pi, codex])

    expect(deleted).toEqual(["pi-1"])
    expect(result.items).toEqual([
      { sessionId: "pi-1", success: true },
      { sessionId: "codex-1", success: false, message: "codex does not support deletion" },
    ])
  })

  test("keeps selection operations immutable", () => {
    const initial = new Set(["one"])
    const toggled = toggleSelection(initial, "one")
    const selected = selectAll(toggled, ["two", "three"])

    expect([...initial]).toEqual(["one"])
    expect([...toggled]).toEqual([])
    expect([...selected]).toEqual(["two", "three"])
  })
})
