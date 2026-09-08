import { constants, Database } from "bun:sqlite"
import { lstat } from "node:fs/promises"
import { pathToFileURL } from "node:url"

async function exists(filePath: string): Promise<boolean> {
  try {
    await lstat(filePath)
    return true
  } catch {
    return false
  }
}

export async function openAntigravityDb(dbPath: string, readonly: boolean): Promise<Database> {
  await lstat(dbPath)
  let databasePath = dbPath
  let immutable = false
  if (readonly) {
    const [hasWal, hasShm] = await Promise.all([exists(`${dbPath}-wal`), exists(`${dbPath}-shm`)])
    if (!hasWal && !hasShm) {
      databasePath = `${pathToFileURL(dbPath).href}?immutable=1`
      immutable = true
    }
  }
  const db = immutable
    ? new Database(databasePath, constants.SQLITE_OPEN_READONLY | constants.SQLITE_OPEN_URI)
    : readonly
      ? new Database(databasePath, { readonly: true, create: false })
      : new Database(databasePath)
  db.run("PRAGMA busy_timeout = 3000")
  return db
}

export function tableNames(db: Database): Set<string> {
  const rows = db.query("SELECT name FROM sqlite_master WHERE type = 'table'").all() as Array<{ name: string }>
  return new Set(rows.map((row) => row.name))
}
