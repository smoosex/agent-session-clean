import type { SessionSummary } from "./session"

export type DeleteOptions = {
  signal?: AbortSignal
}

export type DeleteItemResult = {
  sessionId: string
  success: boolean
  message?: string
}

export type DeleteResult = {
  items: DeleteItemResult[]
}

export type DeleteSessions = (
  sessions: readonly SessionSummary[],
  options?: DeleteOptions,
) => Promise<DeleteResult>
