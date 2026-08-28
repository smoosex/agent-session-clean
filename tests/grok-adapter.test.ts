import { mkdir, mkdtemp, rm } from "node:fs/promises"
import os from "node:os"
import path from "node:path"
import { describe, expect, test } from "bun:test"
import { GrokAdapter } from "../src/adapters/grok/adapter"

const sessionId = "019fb0fb-b6c9-7b83-9cc3-d63ea62010a6"

async function makeGrokSession(): Promise<{ root: string; sessionDir: string }> {
  const root = await mkdtemp(path.join(os.tmpdir(), "agc-grok-"))
  const sessionDir = path.join(root, encodeURIComponent("/work/app"), sessionId)
  await mkdir(sessionDir, { recursive: true })
  await Bun.write(path.join(sessionDir, "summary.json"), JSON.stringify({
    info: { id: sessionId, cwd: "/work/app" },
    generated_title: "Code Review Entire Project",
    created_at: "2026-07-31T05:55:10.590059Z",
    updated_at: "2026-07-31T06:32:06.709542Z",
    num_chat_messages: 2,
    current_model_id: "grok-4.5",
  }))
  await Bun.write(path.join(sessionDir, "chat_history.jsonl"), [
    JSON.stringify({ type: "system", content: "You are Grok" }),
    JSON.stringify({ type: "user", synthetic_reason: "system_reminder", content: [{ type: "text", text: "<system-reminder>ignore</system-reminder>" }] }),
    JSON.stringify({ type: "user", content: [{ type: "text", text: "<user_query>\n对这个项目进行code review\n</user_query>" }] }),
    JSON.stringify({ type: "assistant", content: "ok" }),
  ].join("\n"))
  return { root, sessionDir }
}

describe("GrokAdapter", () => {
  test("scans summary.json and loads user queries from chat history", async () => {
    const fixture = await makeGrokSession()
    try {
      const adapter = new GrokAdapter(fixture.root)
      const result = await adapter.scanner.scan()
      expect(result.projects).toHaveLength(1)
      expect(result.projects[0]?.location).toBe(path.normalize("/work/app"))
      expect(result.sessions).toHaveLength(1)
      expect(result.sessions[0]?.sessionId).toBe(sessionId)
      expect(result.sessions[0]?.title).toBe("Code Review Entire Project")
      expect(result.sessions[0]?.providerModels).toEqual(["grok-4.5"])
      const detail = await adapter.parser.loadDetail(result.sessions[0]!)
      expect(detail.firstUserMessage).toBe("对这个项目进行code review")
    } finally {
      await rm(fixture.root, { recursive: true, force: true })
    }
  })

  test("deletes the session directory", async () => {
    const fixture = await makeGrokSession()
    try {
      const adapter = new GrokAdapter(fixture.root)
      const scanned = await adapter.scanner.scan()
      const deleted = await adapter.deleter.deleteSessions(scanned.sessions)
      expect(deleted.items).toEqual([{ sessionId: scanned.sessions[0]!.id, success: true }])
      expect(await Bun.file(path.join(fixture.sessionDir, "summary.json")).exists()).toBe(false)
      const after = await adapter.scanner.scan()
      expect(after.sessions).toHaveLength(0)
    } finally {
      await rm(fixture.root, { recursive: true, force: true })
    }
  })
})
