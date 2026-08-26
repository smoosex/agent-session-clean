export type SessionSummary = {
  id: string
  sessionId?: string
  projectId: string
  projectPath: string
  filePath: string
  title: string
  createdAt?: string
  updatedAt: string
  sizeBytes: number
  recordCount: number
  messageCount: number
  firstUserMessage?: string
  lastUserMessage?: string
  providerModels: string[]
  warnings: string[]
}

export type SessionDetail = SessionSummary & {
  version?: number
  rawCwd?: string
  warningCount: number
}
