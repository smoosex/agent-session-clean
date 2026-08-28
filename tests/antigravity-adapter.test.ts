import { Database } from "bun:sqlite"
import { mkdir, mkdtemp, rm } from "node:fs/promises"
import os from "node:os"
import path from "node:path"
import { describe, expect, test } from "bun:test"
import { AntigravityAdapter } from "../src/adapters/antigravity/adapter"

const conversationId = "b55cd775-f205-4685-a7be-2ba6c5bfbb14"

async function makeAntigravityData(): Promise<{ root: string; conversationPath: string }> {
  const root = await mkdtemp(path.join(os.tmpdir(), "agc-antigravity-"))
  const conversations = path.join(root, "conversations")
  const brain = path.join(root, "brain", conversationId)
  await mkdir(conversations, { recursive: true })
  await mkdir(brain, { recursive: true })
  const conversationPath = path.join(conversations, `${conversationId}.db`)
  const conversation = new Database(conversationPath)
  conversation.run("CREATE TABLE trajectory_meta (trajectory_id TEXT PRIMARY KEY)")
  conversation.close()
  const summaries = new Database(path.join(root, "conversation_summaries.db"))
  summaries.run(`CREATE TABLE conversation_summaries (
    conversation_id TEXT PRIMARY KEY,
    title TEXT NOT NULL DEFAULT "",
    preview TEXT NOT NULL DEFAULT "",
    step_count INTEGER NOT NULL DEFAULT 0,
    last_modified_time TEXT NOT NULL,
    workspace_uris TEXT NOT NULL,
    project_id TEXT NOT NULL DEFAULT "",
    agent_name TEXT NOT NULL DEFAULT ""
  )`)
  summaries.query("INSERT INTO conversation_summaries VALUES (?, ?, ?, ?, ?, ?, ?, ?)").run(
    conversationId,
    "",
    "hello",
    3,
    "2026-08-28 07:55:13.728551+00:00",
    JSON.stringify(["file:///work/app"]),
    "default-cli-project",
    "",
  )
  summaries.close()
  await Bun.write(path.join(root, "history.jsonl"), [
    JSON.stringify({ display: "hello", timestamp: 1, workspace: "/work/app", conversationId }),
    JSON.stringify({ display: "again", timestamp: 2, workspace: "/work/app", conversationId }),
  ].join("\n"))
  await Bun.write(path.join(brain, "scratch"), "notes")
  return { root, conversationPath }
}

describe("AntigravityAdapter", () => {
  test("scans summaries and loads history prompts", async () => {
    const fixture = await makeAntigravityData()
    try {
      const adapter = new AntigravityAdapter(fixture.root)
      const result = await adapter.scanner.scan()
      expect(result.projects).toHaveLength(1)
      expect(result.projects[0]?.location).toBe(path.normalize("/work/app"))
      expect(result.sessions).toHaveLength(1)
      expect(result.sessions[0]?.sessionId).toBe(conversationId)
      expect(result.sessions[0]?.title).toBe("hello")
      expect(result.sessions[0]?.messageCount).toBe(3)
      const detail = await adapter.parser.loadDetail(result.sessions[0]!)
      expect(detail.firstUserMessage).toBe("hello")
      expect(detail.lastUserMessage).toBe("again")
    } finally {
      await rm(fixture.root, { recursive: true, force: true })
    }
  })

  test("deletes conversation files, brain dir, and summary row", async () => {
    const fixture = await makeAntigravityData()
    try {
      const adapter = new AntigravityAdapter(fixture.root)
      const scanned = await adapter.scanner.scan()
      const deleted = await adapter.deleter.deleteSessions(scanned.sessions)
      expect(deleted.items).toEqual([{ sessionId: scanned.sessions[0]!.id, success: true }])
      expect(await Bun.file(fixture.conversationPath).exists()).toBe(false)
      const after = await adapter.scanner.scan()
      expect(after.sessions).toHaveLength(0)
    } finally {
      await rm(fixture.root, { recursive: true, force: true })
    }
  })
})
