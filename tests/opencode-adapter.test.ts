import { mkdtemp, rm } from "node:fs/promises"
import os from "node:os"
import path from "node:path"
import { Database } from "bun:sqlite"
import { describe, expect, test } from "bun:test"
import { OpenCodeAdapter } from "../src/adapters/opencode/adapter"

async function makeOpenCodeData(): Promise<{ root: string; sessionId: string }> {
  const root = await mkdtemp(path.join(os.tmpdir(), "agc-opencode-"))
  const db = new Database(path.join(root, "opencode.db"))
  db.run(`CREATE TABLE project (id TEXT PRIMARY KEY, worktree TEXT)`)
  db.run(`CREATE TABLE session (id TEXT PRIMARY KEY, project_id TEXT, directory TEXT, title TEXT, version TEXT, agent TEXT, model TEXT, time_created INTEGER, time_updated INTEGER)`)
  db.run(`CREATE TABLE message (id TEXT PRIMARY KEY, session_id TEXT, time_created INTEGER, time_updated INTEGER, data TEXT)`)
  db.run(`CREATE TABLE part (id TEXT PRIMARY KEY, message_id TEXT, session_id TEXT, time_created INTEGER, time_updated INTEGER, data TEXT)`)
  db.run(`INSERT INTO project VALUES ('proj-1', '/work/app')`)
  db.run(`INSERT INTO session VALUES ('ses_abc123def', 'proj-1', '/work/app', 'Fix auth', '1.18.23', 'build', '{"id":"gpt","providerID":"opencode"}', 1700000000000, 1700000001000)`)
  db.run(`INSERT INTO message VALUES ('msg_1', 'ses_abc123def', 1700000000000, 1700000000000, '{"role":"user"}')`)
  db.run(`INSERT INTO part VALUES ('prt_1', 'msg_1', 'ses_abc123def', 1700000000000, 1700000000000, '{"type":"text","text":"Fix the login flow"}')`)
  db.close()
  const sessionFile = path.join(root, "storage", "session", "proj-1", "ses_abc123def.json")
  await Bun.write(sessionFile, "{}")
  await Bun.write(path.join(root, "storage", "message", "ses_abc123def", "msg_1.json"), "{}")
  return { root, sessionId: "ses_abc123def" }
}

describe("OpenCodeAdapter", () => {
  test("scans sqlite sessions by project directory", async () => {
    const fixture = await makeOpenCodeData()
    try {
      const adapter = new OpenCodeAdapter(fixture.root)
      const result = await adapter.scanner.scan()
      expect(result.agentId).toBe("opencode")
      expect(result.projects).toHaveLength(1)
      expect(result.projects[0]?.location).toBe(path.normalize("/work/app"))
      expect(result.sessions).toHaveLength(1)
      expect(result.sessions[0]?.sessionId).toBe(fixture.sessionId)
      expect(result.sessions[0]?.title).toBe("Fix auth")
      expect(result.sessions[0]?.messageCount).toBe(1)
      const detail = await adapter.parser.loadDetail(result.sessions[0]!)
      expect(detail.firstUserMessage).toBe("Fix the login flow")
      expect(detail.providerModels).toEqual(["opencode/gpt"])
    } finally {
      await rm(fixture.root, { recursive: true, force: true })
    }
  })

  test("deletes sqlite rows and storage files", async () => {
    const fixture = await makeOpenCodeData()
    try {
      const adapter = new OpenCodeAdapter(fixture.root)
      const scanned = await adapter.scanner.scan()
      const result = await adapter.deleter.deleteSessions(scanned.sessions)
      expect(result.items).toEqual([{ sessionId: scanned.sessions[0]!.id, success: true }])
      const after = await adapter.scanner.scan()
      expect(after.sessions).toHaveLength(0)
      expect(await Bun.file(path.join(fixture.root, "storage", "session", "proj-1", "ses_abc123def.json")).exists()).toBe(false)
    } finally {
      await rm(fixture.root, { recursive: true, force: true })
    }
  })
})
