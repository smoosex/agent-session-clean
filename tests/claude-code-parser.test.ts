import { mkdir, mkdtemp, rm } from "node:fs/promises"
import os from "node:os"
import path from "node:path"
import { describe, expect, test } from "bun:test"
import { ClaudeCodeAdapter } from "../src/adapters/claude-code/adapter"
import { parseClaudeCodeSessionFile } from "../src/adapters/claude-code/parser"

const sessionId = "5e5eaa38-fd37-48a7-8c93-b9c006e14746"

function sessionLines(): string[] {
  return [
    JSON.stringify({ type: "mode", mode: "normal", sessionId }),
    JSON.stringify({ type: "user", isMeta: true, message: { role: "user", content: "<local-command-caveat>ignore</local-command-caveat>" }, sessionId }),
    JSON.stringify({ type: "user", timestamp: "2026-06-13T14:52:53.152Z", cwd: "/work/tetris", sessionId, version: "2.1.174", message: { role: "user", content: "制作一个终端版本的俄罗斯方块" } }),
    JSON.stringify({ type: "ai-title", aiTitle: "Create a terminal Tetris game", sessionId }),
    "not-json",
    JSON.stringify({ type: "assistant", sessionId, message: { role: "assistant", model: "kimi-k2.7-code", content: [{ type: "text", text: "好的" }] } }),
  ]
}

describe("parseClaudeCodeSessionFile", () => {
  test("parses cwd, titles and skips command wrappers", async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), "agc-cc-"))
    const filePath = path.join(root, "-work-tetris", `${sessionId}.jsonl`)
    try {
      await mkdir(path.dirname(filePath), { recursive: true })
      await Bun.write(filePath, sessionLines().join("\n"))
      const result = await parseClaudeCodeSessionFile(filePath)
      expect(result.sessionId).toBe(sessionId)
      expect(result.projectPath).toBe("/work/tetris")
      expect(result.title).toBe("Create a terminal Tetris game")
      expect(result.firstUserMessage).toBe("制作一个终端版本的俄罗斯方块")
      expect(result.providerModels).toEqual(["kimi-k2.7-code"])
      expect(result.warnings).toContain("Invalid JSON on line 5")
    } finally {
      await rm(root, { recursive: true, force: true })
    }
  })

  test("summary stops after cwd and title", async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), "agc-cc-"))
    const filePath = path.join(root, `${sessionId}.jsonl`)
    try {
      await Bun.write(filePath, sessionLines().join("\n"))
      const result = await parseClaudeCodeSessionFile(filePath, undefined, "summary")
      expect(result.sessionId).toBe(sessionId)
      expect(result.projectPath).toBe("/work/tetris")
      expect(result.title).toBe("Create a terminal Tetris game")
      expect(result.recordCount).toBe(4)
      expect(result.messageCount).toBe(0)
      expect(result.warnings).toEqual([])
    } finally {
      await rm(root, { recursive: true, force: true })
    }
  })
})

describe("ClaudeCodeAdapter", () => {
  test("deletes jsonl and file-history for a session", async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), "agc-cc-home-"))
    try {
      const projects = path.join(root, "projects", "-work-app")
      const filePath = path.join(projects, `${sessionId}.jsonl`)
      await mkdir(projects, { recursive: true })
      await mkdir(path.join(root, "file-history", sessionId), { recursive: true })
      await Bun.write(filePath, sessionLines().join("\n"))
      await Bun.write(path.join(root, "file-history", sessionId, "snap"), "x")
      const adapter = new ClaudeCodeAdapter(path.join(root, "projects"))
      const scanned = await adapter.scanner.scan()
      expect(scanned.sessions).toHaveLength(1)
      expect(scanned.sessions[0]?.projectLocation).toBe(path.normalize("/work/tetris"))
      const deleted = await adapter.deleter.deleteSessions(scanned.sessions)
      expect(deleted.items).toEqual([{ sessionId: scanned.sessions[0]!.id, success: true }])
      expect(await Bun.file(filePath).exists()).toBe(false)
      expect(await Bun.file(path.join(root, "file-history", sessionId, "snap")).exists()).toBe(false)
    } finally {
      await rm(root, { recursive: true, force: true })
    }
  })
})
