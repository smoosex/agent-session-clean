import { mkdtemp, rm } from "node:fs/promises"
import os from "node:os"
import path from "node:path"
import { describe, expect, test } from "bun:test"
import { PiDeleter } from "../src/adapters/pi/deleter"
import type { SessionSummary } from "../src/domain/session"

function makeSession(filePath: string, sizeBytes: number, updatedAt: string): SessionSummary {
  return {
    id: "session:pi:one",
    ref: { agentId: "pi", sourceId: filePath },
    agentId: "pi",
    sessionId: "one",
    projectId: "project:pi:/work/app",
    projectName: "/work/app",
    projectLocation: "/work/app",
    title: "One",
    updatedAt,
    sizeBytes,
    messageCount: 1,
    providerModels: [],
    warnings: [],
  }
}

describe("PiDeleter", () => {
  test("permanently deletes a session inside the configured root", async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), "agc-delete-"))
    const filePath = path.join(root, "session.jsonl")
    try {
      await Bun.write(filePath, "session")
      const stats = await Bun.file(filePath).stat()
      const result = await new PiDeleter(root).deleteSessions([makeSession(filePath, stats.size, stats.mtime.toISOString())])
      expect(result.items).toEqual([{ sessionId: "session:pi:one", success: true }])
      expect(await Bun.file(filePath).exists()).toBe(false)
    } finally {
      await rm(root, { recursive: true, force: true })
    }
  })

  test("rejects a session outside the configured root", async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), "agc-delete-"))
    const outside = await mkdtemp(path.join(os.tmpdir(), "agc-outside-"))
    const filePath = path.join(outside, "session.jsonl")
    try {
      await Bun.write(filePath, "session")
      const stats = await Bun.file(filePath).stat()
      const result = await new PiDeleter(root).deleteSessions([makeSession(filePath, stats.size, stats.mtime.toISOString())])
      expect(result.items[0]?.success).toBe(false)
      expect(result.items[0]?.message).toContain("outside")
      expect(await Bun.file(filePath).exists()).toBe(true)
    } finally {
      await rm(root, { recursive: true, force: true })
      await rm(outside, { recursive: true, force: true })
    }
  })
})
