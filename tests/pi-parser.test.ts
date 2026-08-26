import { mkdtemp, rm } from "node:fs/promises"
import os from "node:os"
import path from "node:path"
import { describe, expect, test } from "bun:test"
import { parsePiSessionFile } from "../src/adapters/pi/parser"

async function tempSession(content: string): Promise<{ directory: string; file: string }> {
  const directory = await mkdtemp(path.join(os.tmpdir(), "agc-parser-"))
  const file = path.join(directory, "session.jsonl")
  await Bun.write(file, content)
  return { directory, file }
}

describe("parsePiSessionFile", () => {
  test("parses headers, messages, text parts and provider models", async () => {
    const fixture = await tempSession([
      JSON.stringify({ type: "session", version: 3, id: "session-1", timestamp: "2026-01-01T00:00:00.000Z", cwd: "/tmp/app" }),
      JSON.stringify({ type: "model_change", provider: "openai", modelId: "gpt-5" }),
      JSON.stringify({ type: "message", message: { role: "user", content: [{ type: "text", text: "Fix " }, { type: "image", data: "ignored" }, { type: "text", text: "login" }] } }),
      JSON.stringify({ type: "message", message: { role: "assistant", content: [{ type: "text", text: "Done" }] } }),
      JSON.stringify({ type: "message", message: { role: "user", content: "Add tests" } }),
    ].join("\n"))
    try {
      const parsed = await parsePiSessionFile(fixture.file)
      expect(parsed.header?.id).toBe("session-1")
      expect(parsed.header?.cwd).toBe("/tmp/app")
      expect(parsed.messageCount).toBe(3)
      expect(parsed.firstUserMessage).toBe("Fix login")
      expect(parsed.lastUserMessage).toBe("Add tests")
      expect(parsed.title).toBe("Fix login")
      expect(parsed.providerModels).toEqual(["openai/gpt-5"])
      expect(parsed.warnings).toEqual([])
    } finally {
      await rm(fixture.directory, { recursive: true, force: true })
    }
  })

  test("keeps a damaged file visible with warnings", async () => {
    const fixture = await tempSession("not-json\n{}\n")
    try {
      const parsed = await parsePiSessionFile(fixture.file)
      expect(parsed.recordCount).toBe(2)
      expect(parsed.warnings).toContain("Invalid JSON on line 1")
      expect(parsed.warnings).toContain("Session header is missing id")
      expect(parsed.warnings).toContain("Session header is missing cwd")
    } finally {
      await rm(fixture.directory, { recursive: true, force: true })
    }
  })

  test("reports empty files", async () => {
    const fixture = await tempSession("")
    try {
      const parsed = await parsePiSessionFile(fixture.file)
      expect(parsed.recordCount).toBe(0)
      expect(parsed.warnings).toContain("Session file is empty")
    } finally {
      await rm(fixture.directory, { recursive: true, force: true })
    }
  })
})
