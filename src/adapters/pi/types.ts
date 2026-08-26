export type PiSessionHeader = {
  type: "session"
  version?: number
  id?: string
  timestamp?: string
  cwd?: string
  title?: string
  name?: string
}

export type PiMessage = {
  role?: string
  content?: unknown
  provider?: string
  model?: string
  modelId?: string
}

export type PiRecord = {
  type?: string
  timestamp?: string
  title?: string
  name?: string
  provider?: string
  model?: string
  modelId?: string
  message?: PiMessage
  [key: string]: unknown
}

export type ParsedPiSession = {
  header?: PiSessionHeader
  recordCount: number
  messageCount: number
  firstUserMessage?: string
  lastUserMessage?: string
  title?: string
  providerModels: string[]
  warnings: string[]
}
