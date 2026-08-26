export type ParsedCodexSession = {
  sessionId?: string
  projectPath?: string
  createdAt?: string
  title?: string
  recordCount: number
  messageCount: number
  firstUserMessage?: string
  lastUserMessage?: string
  providerModels: string[]
  warnings: string[]
}
