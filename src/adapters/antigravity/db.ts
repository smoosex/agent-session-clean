import { Database } from "bun:sqlite"
import { lstat } from "node:fs/promises"

export async function openAntigravityDb(dbPath: string, readonly: boolean): Promise<Database> {
  await lstat(dbPath)
  const db = readonly ? new Database(dbPath, { readonly: true, create: false }) : new Database(dbPath)
  db.run("PRAGMA busy_timeout = 3000")
  return db
}

export function tableNames(db: Database): Set<string> {
  const rows = db.query("SELECT name FROM sqlite_master WHERE type = 'table'").all() as Array<{ name: string }>
  return new Set(rows.map((row) => row.name))
}
