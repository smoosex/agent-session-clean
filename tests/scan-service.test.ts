import { mkdir, mkdtemp, rm, stat, utimes } from "node:fs/promises"
import os from "node:os"
import path from "node:path"
import { describe, expect, test } from "bun:test"
import { scanPiSessions } from "../src/services/scan-service"

async function makeSession(root: string, directory: string, id: string, cwd: string, timestamp: string, title: string): Promise<string> {
  const targetDirectory = path.join(root, directory)
  await mkdir(targetDirectory, { recursive: true })
  const target = path.join(targetDirectory, `${id}.jsonl`)
  await Bun.write(target, [
    JSON.stringify({ type: "session", version: 3, id, timestamp, cwd }),
    JSON.stringify({ type: "message", message: { role: "user", content: [{ type: "text", text: title }] } }),
  ].join("\n"))
  const date = new Date(timestamp)
  await utimes(target, date, date)
  return target
}

describe("scanPiSessions", () => {
  test("groups projects and sorts sessions without changing files", async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), "agc-scan-"))
    try {
      const newest = await makeSession(root, "encoded-one", "new", "/work/app", "2026-02-02T00:00:00.000Z", "Newest")
      const older = await makeSession(root, "encoded-two", "old", "/work/app", "2026-01-01T00:00:00.000Z", "Older")
      await makeSession(root, "encoded-three", "other", "/work/site", "2026-01-15T00:00:00.000Z", "Other")
      const before = await stat(newest)
      const contentBefore = await Bun.file(newest).text()

      const result = await scanPiSessions(root)

      expect(result.projects).toHaveLength(2)
      expect(result.projects[0]?.path).toBe(path.normalize("/work/app"))
      expect(result.projects[0]?.sessionCount).toBe(2)
      expect(result.sessions.map((session) => session.sessionId)).toEqual(["new", "other", "old"])
      expect(result.sessions.find((session) => session.sessionId === "new")?.title).toBe("Newest")
      expect(await Bun.file(newest).text()).toBe(contentBefore)
      const after = await stat(newest)
      expect(after.mode).toBe(before.mode)
      expect(after.mtimeMs).toBe(before.mtimeMs)
    } finally {
      await rm(root, { recursive: true, force: true })
    }
  })

  test("keeps malformed and non-jsonl files in scan issues", async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), "agc-scan-"))
    try {
      await Bun.write(path.join(root, "broken.jsonl"), "broken")
      await Bun.write(path.join(root, "notes.txt"), "ignored")
      const result = await scanPiSessions(root)
      expect(result.scannedFiles).toBe(1)
      expect(result.failedFiles).toBe(1)
      expect(result.issues.some((issue) => issue.message.includes("Invalid JSON"))).toBe(true)
      expect(result.issues.some((issue) => issue.message === "Skipped non-JSONL file")).toBe(true)
    } finally {
      await rm(root, { recursive: true, force: true })
    }
  })
})
