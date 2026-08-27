import type { DeleteOptions, DeleteResult } from "../../domain/operation"
import type { SessionSummary } from "../../domain/session"
import type { SessionDeleter } from "../../application/ports"
import { deleteSessionFiles } from "../../services/delete-session-files"

export class CodexDeleter implements SessionDeleter {
  constructor(private readonly rootPath: string) {}

  deleteSessions(sessions: readonly SessionSummary[], options?: DeleteOptions): Promise<DeleteResult> {
    return deleteSessionFiles("codex", this.rootPath, sessions, options)
  }
}
