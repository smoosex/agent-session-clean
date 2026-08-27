import { mkdir, mkdtemp, rm } from "node:fs/promises"
import os from "node:os"
import path from "node:path"
import { describe, expect, test } from "bun:test"
import { parseCodexSessionFile } from "../src/adapters/codex/parser"

async function makeCodexSession(): Promise<string> {
  const root = await mkdtemp(path.join(os.tmpdir(), "agc-codex-"))
  const filePath = path.join(root, "2026", "08", "rollout-test.jsonl")
  await mkdir(path.dirname(filePath), { recursive: true })
  await Bun.write(filePath, [
    JSON.stringify({ timestamp: "2026-08-26T10:00:00.000Z", type: "session_meta", payload: { id: "codex-1", timestamp: "2026-08-26T10:00:00.000Z", cwd: "/work/codex", model_provider: "openai" } }),
    JSON.stringify({ timestamp: "2026-08-26T10:00:01.000Z", type: "turn_context", payload: { model: "gpt-5.6-luna", model_provider: "openai" } }),
    JSON.stringify({ timestamp: "2026-08-26T10:00:02.000Z", type: "response_item", payload: { type: "message", role: "developer", content: [{ type: "input_text", text: "instructions" }] } }),
    JSON.stringify({ timestamp: "2026-08-26T10:00:03.000Z", type: "event_msg", payload: { type: "item_completed", item: { type: "UserMessage", content: [{ type: "Text", text: "Fix the Codex adapter" }] } } }),
    JSON.stringify({ timestamp: "2026-08-26T10:00:04.000Z", type: "event_msg", payload: { type: "item_completed", item: { type: "AgentMessage", content: [{ type: "Text", text: "I will inspect the session format." }] } } }),
  ].join("\n"))
  return filePath
}

describe("parseCodexSessionFile", () => {
  test("parses rollout metadata, event messages and model", async () => {
    const filePath = await makeCodexSession()
    try {
      const result = await parseCodexSessionFile(filePath)
      expect(result.sessionId).toBe("codex-1")
      expect(result.projectPath).toBe("/work/codex")
      expect(result.title).toBe("Fix the Codex adapter")
      expect(result.messageCount).toBe(2)
      expect(result.firstUserMessage).toBe("Fix the Codex adapter")
      expect(result.providerModels).toEqual(["openai", "openai/gpt-5.6-luna"])
      expect(result.warnings).toEqual([])
    } finally {
      await rm(path.dirname(path.dirname(path.dirname(filePath))), { recursive: true, force: true })
    }
  })

  test("summary stops after session_meta", async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), "agc-codex-"))
    const filePath = path.join(root, "rollout-test.jsonl")
    try {
      await Bun.write(filePath, [
        JSON.stringify({ timestamp: "2026-08-26T10:00:00.000Z", type: "session_meta", payload: { id: "codex-1", timestamp: "2026-08-26T10:00:00.000Z", cwd: "/work/codex" } }),
        "not-json",
        JSON.stringify({ timestamp: "2026-08-26T10:00:03.000Z", type: "event_msg", payload: { type: "item_completed", item: { type: "UserMessage", content: [{ type: "Text", text: "Fix the Codex adapter" }] } } }),
      ].join("\n"))
      const result = await parseCodexSessionFile(filePath, undefined, "summary")
      expect(result.sessionId).toBe("codex-1")
      expect(result.projectPath).toBe("/work/codex")
      expect(result.recordCount).toBe(1)
      expect(result.messageCount).toBe(0)
      expect(result.title).toBeUndefined()
      expect(result.warnings).toEqual([])
    } finally {
      await rm(root, { recursive: true, force: true })
    }
  })

  test("keeps malformed rollout files visible with warnings", async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), "agc-codex-"))
    const filePath = path.join(root, "broken.jsonl")
    try {
      await Bun.write(filePath, "broken")
      const result = await parseCodexSessionFile(filePath)
      expect(result.recordCount).toBe(1)
      expect(result.warnings).toContain("Invalid JSON on line 1")
      expect(result.warnings).toContain("Codex session header is missing id")
    } finally {
      await rm(root, { recursive: true, force: true })
    }
  })
})
