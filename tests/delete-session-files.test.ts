import { mkdtemp, rm } from "node:fs/promises"
import os from "node:os"
import path from "node:path"
import { describe, expect, test } from "bun:test"
import { PiDeleter } from "../src/adapters/pi/deleter"
import type { SessionSummary } from "../src/domain/session"

function makeSession(filePath: string, sizeBytes: number, updatedAt: string, id = "session:pi:one"): SessionSummary {
  return {
    id,
    ref: { agentId: "pi", sourceId: filePath },
    agentId: "pi",
    sessionId: id,
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

  test("removes a session folder when every jsonl in it is deleted", async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), "agc-delete-"))
    const folder = path.join(root, "--work-app--")
    const first = path.join(folder, "one.jsonl")
    const second = path.join(folder, "two.jsonl")
    try {
      await Bun.write(first, "one")
      await Bun.write(second, "two")
      const firstStats = await Bun.file(first).stat()
      const secondStats = await Bun.file(second).stat()
      const result = await new PiDeleter(root).deleteSessions([
        makeSession(first, firstStats.size, firstStats.mtime.toISOString(), "session:pi:one"),
        makeSession(second, secondStats.size, secondStats.mtime.toISOString(), "session:pi:two"),
      ])
      expect(result.items.every((item) => item.success)).toBe(true)
      expect(await Bun.file(first).exists()).toBe(false)
      expect(await Bun.file(folder).exists()).toBe(false)
    } finally {
      await rm(root, { recursive: true, force: true })
    }
  })

  test("keeps a session folder when other jsonl files remain", async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), "agc-delete-"))
    const folder = path.join(root, "--work-app--")
    const first = path.join(folder, "one.jsonl")
    const second = path.join(folder, "two.jsonl")
    try {
      await Bun.write(first, "one")
      await Bun.write(second, "two")
      const firstStats = await Bun.file(first).stat()
      const result = await new PiDeleter(root).deleteSessions([makeSession(first, firstStats.size, firstStats.mtime.toISOString())])
      expect(result.items).toEqual([{ sessionId: "session:pi:one", success: true }])
      expect(await Bun.file(first).exists()).toBe(false)
      expect(await Bun.file(second).exists()).toBe(true)
    } finally {
      await rm(root, { recursive: true, force: true })
    }
  })
})
