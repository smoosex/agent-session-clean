import { createEffect, createSignal, onCleanup } from "solid-js"
import type { AgentId, AgentInfo } from "../domain/agent"
import type { DeleteResult } from "../domain/operation"
import type { ProjectSummary } from "../domain/project"
import type { ScanIssue, ScanStatus } from "../domain/scan"
import type { SessionDetail, SessionSummary } from "../domain/session"
import { clearSelection, selectAll, toggleSelection } from "../domain/selection"
import type { AgentUseCases } from "../application/use-cases"
import { formatBytes } from "../utils/format"

export type FocusArea = "agent" | "projects" | "sessions" | "detail"
export type SortMode = "updated-desc" | "updated-asc" | "name-asc" | "size-desc"
export type DeleteStatus = "idle" | "deleting" | "complete" | "error"
export type DeleteScope = "session" | "project"

type AppStore = ReturnType<typeof createAppStore>

function searchableSession(session: SessionSummary): string {
  return [session.title, session.sessionId, session.ref.sourceId, session.firstUserMessage, session.lastUserMessage].filter(Boolean).join(" ").toLowerCase()
}

function sortSessions(sessions: SessionSummary[], sort: SortMode): SessionSummary[] {
  return [...sessions].sort((left, right) => {
    if (sort === "name-asc") return left.title.localeCompare(right.title)
    if (sort === "size-desc") return (right.sizeBytes ?? 0) - (left.sizeBytes ?? 0)
    const leftTime = Date.parse(left.updatedAt) || 0
    const rightTime = Date.parse(right.updatedAt) || 0
    return sort === "updated-asc" ? leftTime - rightTime : rightTime - leftTime
  })
}

function sortProjects(projects: ProjectSummary[], sort: SortMode): ProjectSummary[] {
  return [...projects].sort((left, right) => {
    if (sort === "name-asc") return left.displayPath.localeCompare(right.displayPath)
    if (sort === "size-desc") return right.totalSizeBytes - left.totalSizeBytes
    const leftTime = Date.parse(left.updatedAt) || 0
    const rightTime = Date.parse(right.updatedAt) || 0
    return sort === "updated-asc" ? leftTime - rightTime : rightTime - leftTime
  })
}

function pickRemaining<T extends { id: string }>(nextItems: readonly T[], previousId: string | undefined, previousItems: readonly T[]): T | undefined {
  const current = nextItems.find((item) => item.id === previousId)
  if (current) return current
  const index = previousItems.findIndex((item) => item.id === previousId)
  if (index < 0) return nextItems[0]
  return nextItems[Math.min(index, nextItems.length - 1)]
}

export function createAppStore(services: AgentUseCases, initialAgentId: AgentId = services.agents[0]?.id ?? "pi") {
  const [agents] = createSignal<AgentInfo[]>(services.agents)
  const [activeAgentId, setActiveAgentIdSignal] = createSignal<AgentId>(initialAgentId)
  const [scanStatus, setScanStatus] = createSignal<ScanStatus>("idle")
  const initialAgent = services.agents.find((agent) => agent.id === initialAgentId)
  const [rootPath, setRootPath] = createSignal(initialAgent?.detail ?? initialAgent?.label ?? initialAgentId)
  const [projects, setProjects] = createSignal<ProjectSummary[]>([])
  const [sessions, setSessions] = createSignal<SessionSummary[]>([])
  const [selectedProjectId, setSelectedProjectId] = createSignal<string>()
  const [selectedSessionId, setSelectedSessionId] = createSignal<string>()
  const [selectedProjectIds, setSelectedProjectIds] = createSignal<Set<string>>(new Set())
  const [selectedSessionIds, setSelectedSessionIds] = createSignal<Set<string>>(new Set())
  const [sessionDetail, setSessionDetail] = createSignal<SessionDetail>()
  const [focus, setFocus] = createSignal<FocusArea>("projects")
  const [searchQuery, setSearchQuery] = createSignal("")
  const [sort, setSort] = createSignal<SortMode>("updated-desc")
  const [issues, setIssues] = createSignal<ScanIssue[]>([])
  const [scannedSources, setScannedSources] = createSignal(0)
  const [failedSources, setFailedSources] = createSignal(0)
  const [detailLoading, setDetailLoading] = createSignal(false)
  const [deleteStatus, setDeleteStatus] = createSignal<DeleteStatus>("idle")
  const [lastDeleteResult, setLastDeleteResult] = createSignal<DeleteResult>()
  const [lastScanAt, setLastScanAt] = createSignal<string>()
  let scanVersion = 0
  let detailVersion = 0
  let deleteVersion = 0
  let scanController: AbortController | undefined
  let detailController: AbortController | undefined
  let deleteController: AbortController | undefined

  const queryMatches = (value: string | undefined, query: string): boolean => Boolean(value && value.toLowerCase().includes(query))

  const filteredProjects = () => {
    const query = searchQuery().trim().toLowerCase()
    const allProjects = projects()
    if (!query) return sortProjects(allProjects, sort())
    return sortProjects(allProjects.filter((project) => {
      if (queryMatches(project.name, query) || queryMatches(project.location, query) || queryMatches(project.displayPath, query)) return true
      return sessions().some((session) => session.projectId === project.id && searchableSession(session).includes(query))
    }), sort())
  }

  const filteredSessions = () => {
    const projectId = selectedProjectId()
    if (!projectId) return []
    const query = searchQuery().trim().toLowerCase()
    const project = projects().find((candidate) => candidate.id === projectId)
    const projectMatches = Boolean(query && project && (queryMatches(project.name, query) || queryMatches(project.location, query) || queryMatches(project.displayPath, query)))
    const projectSessions = sessions().filter((session) => session.projectId === projectId)
    if (!query || projectMatches) return sortSessions(projectSessions, sort())
    return sortSessions(projectSessions.filter((session) => searchableSession(session).includes(query)), sort())
  }

  const selectedProject = () => projects().find((project) => project.id === selectedProjectId())
  const selectedSession = () => sessions().find((session) => session.id === selectedSessionId())
  const summary = () => {
    const allSessions = sessions()
    const totalSize = allSessions.reduce((total, session) => total + (session.sizeBytes ?? 0), 0)
    return `${projects().length} projects · ${allSessions.length} sessions · ${formatBytes(totalSize)}`
  }

  async function loadDetail(sessionId: string | undefined): Promise<void> {
    const version = ++detailVersion
    detailController?.abort()
    if (!sessionId) {
      setSessionDetail(undefined)
      setDetailLoading(false)
      return
    }
    const session = sessions().find((candidate) => candidate.id === sessionId)
    if (!session) {
      setSessionDetail(undefined)
      setDetailLoading(false)
      return
    }
    const controller = new AbortController()
    detailController = controller
    setSessionDetail(undefined)
    setDetailLoading(true)
    try {
      const detail = await services.loadSessionDetail(session, controller.signal)
      if (version === detailVersion && selectedSessionId() === sessionId) setSessionDetail(detail)
    } catch (error) {
      if (version !== detailVersion || selectedSessionId() !== sessionId) return
      if ((error as Error).name === "AbortError" || (error as NodeJS.ErrnoException).code === "ABORT_ERR") return
      const warning = error instanceof Error ? error.message : String(error)
      setSessionDetail({ ...session, warnings: [...session.warnings, warning], fields: [], warningCount: session.warnings.length + 1 })
    } finally {
      if (version === detailVersion) setDetailLoading(false)
    }
  }

  function filteredSessionsFor(projectId: string): SessionSummary[] {
    const query = searchQuery().trim().toLowerCase()
    const project = projects().find((candidate) => candidate.id === projectId)
    const projectMatches = Boolean(query && project && (queryMatches(project.name, query) || queryMatches(project.location, query) || queryMatches(project.displayPath, query)))
    const projectSessions = sessions().filter((session) => session.projectId === projectId)
    if (!query || projectMatches) return sortSessions(projectSessions, sort())
    return sortSessions(projectSessions.filter((session) => searchableSession(session).includes(query)), sort())
  }

  function chooseProject(projectId: string | undefined, load = true): void {
    const visibleProjects = filteredProjects()
    const project = visibleProjects.find((candidate) => candidate.id === projectId) ?? visibleProjects[0]
    setSelectedProjectId(project?.id)
    const nextSession = project ? filteredSessionsFor(project.id)[0] : undefined
    setSelectedSessionId(nextSession?.id)
    setSessionDetail(undefined)
    if (load) void loadDetail(nextSession?.id)
  }

  function chooseSession(sessionId: string | undefined, load = true): void {
    const visibleSessions = filteredSessions()
    const session = visibleSessions.find((candidate) => candidate.id === sessionId) ?? visibleSessions[0]
    setSelectedSessionId(session?.id)
    setSessionDetail(undefined)
    if (load) void loadDetail(session?.id)
  }

  function applyResult(result: Awaited<ReturnType<AgentUseCases["scanSessions"]>>, previousProjectId?: string, previousSessionId?: string): void {
    const previousProjects = filteredProjects()
    const previousSessions = filteredSessions()
    setRootPath(result.rootPath)
    setProjects(result.projects)
    setSessions(result.sessions)
    setIssues(result.issues)
    setScannedSources(result.scannedSources)
    setFailedSources(result.failedSources)
    setLastScanAt(new Date().toISOString())
    setSelectedProjectIds((current) => new Set([...current].filter((id) => result.projects.some((project) => project.id === id))))
    setSelectedSessionIds((current) => new Set([...current].filter((id) => result.sessions.some((session) => session.id === id))))
    const project = pickRemaining(filteredProjects(), previousProjectId, previousProjects)
    setSelectedProjectId(project?.id)
    const session = pickRemaining(project ? filteredSessionsFor(project.id) : [], previousSessionId, previousSessions)
    setSelectedSessionId(session?.id)
    setSessionDetail(undefined)
    if (session) void loadDetail(session.id)
  }

  function setActiveAgent(agentId: AgentId): void {
    const nextAgent = agents().find((agent) => agent.id === agentId)
    if (!nextAgent || nextAgent.id === activeAgentId()) return
    scanController?.abort()
    detailController?.abort()
    deleteController?.abort()
    scanVersion += 1
    detailVersion += 1
    deleteVersion += 1
    setActiveAgentIdSignal(agentId)
    setRootPath(nextAgent.detail ?? nextAgent.label)
    setScanStatus("idle")
    setDeleteStatus("idle")
    setProjects([])
    setSessions([])
    setIssues([])
    setScannedSources(0)
    setFailedSources(0)
    setSelectedProjectId(undefined)
    setSelectedSessionId(undefined)
    setSelectedProjectIds(clearSelection())
    setSelectedSessionIds(clearSelection())
    setSessionDetail(undefined)
    void scan()
  }

  async function scan(): Promise<void> {
    const agentId = activeAgentId()
    const version = ++scanVersion
    scanController?.abort()
    const controller = new AbortController()
    scanController = controller
    const previousProjectId = selectedProjectId()
    const previousSessionId = selectedSessionId()
    setScanStatus("scanning")
    try {
      const result = await services.scanSessions(agentId, { signal: controller.signal })
      if (version !== scanVersion || activeAgentId() !== agentId) return
      applyResult(result, previousProjectId, previousSessionId)
      setScanStatus(result.issues.some((issue) => issue.severity === "error") || (result.failedSources > 0 && result.sessions.length === 0) ? "error" : "complete")
    } catch (error) {
      if (version !== scanVersion || (error as Error).name === "AbortError" || (error as NodeJS.ErrnoException).code === "ABORT_ERR") return
      setScanStatus("error")
      setIssues([{ message: error instanceof Error ? error.message : String(error), severity: "error" }])
      setProjects([])
      setSessions([])
      setSelectedProjectId(undefined)
      setSelectedSessionId(undefined)
      setSelectedSessionIds(clearSelection())
      setSessionDetail(undefined)
    }
  }

  async function deleteSessions(targets: readonly SessionSummary[]): Promise<DeleteResult | undefined> {
    const currentAgentId = activeAgentId()
    const currentAgentTargets = targets.filter((session) => session.agentId === currentAgentId && session.ref.agentId === currentAgentId)
    if (currentAgentTargets.length === 0) return undefined
    const version = ++deleteVersion
    deleteController?.abort()
    const controller = new AbortController()
    deleteController = controller
    setDeleteStatus("deleting")
    try {
      const result = await services.deleteSessions(currentAgentTargets, { signal: controller.signal })
      if (version !== deleteVersion) return result
      setLastDeleteResult(result)
      const failed = result.items.filter((item) => !item.success)
      setDeleteStatus(failed.length > 0 ? "error" : "complete")
      setSelectedSessionIds(new Set(failed.map((item) => item.sessionId)))
      await scan()
      if (version === deleteVersion && failed.length > 0) {
        const targetById = new Map(currentAgentTargets.map((session) => [session.id, session]))
        setIssues((current) => [...current, ...failed.map((item) => ({
          location: targetById.get(item.sessionId)?.ref.sourceId,
          message: item.message ?? "Unable to delete session",
          severity: "error" as const,
        }))])
        setScanStatus("error")
      }
      return result
    } catch (error) {
      if ((error as Error).name === "AbortError" || (error as NodeJS.ErrnoException).code === "ABORT_ERR") return undefined
      if (version === deleteVersion) {
        setDeleteStatus("error")
        setIssues([{ message: error instanceof Error ? error.message : String(error), severity: "error" }])
      }
      return undefined
    }
  }

  async function deleteSelected(): Promise<DeleteResult | undefined> {
    const selected = sessions().filter((session) => selectedSessionIds().has(session.id))
    return deleteSessions(selected)
  }

  function toggleProject(projectId: string): void {
    setSelectedProjectIds((current) => toggleSelection(current, projectId))
  }

  function toggleSession(sessionId: string): void {
    setSelectedSessionIds((current) => toggleSelection(current, sessionId))
  }

  function selectAllVisibleSessions(): void {
    setSelectedSessionIds((current) => selectAll(current, filteredSessions().map((session) => session.id)))
  }

  function clearSelectedSessions(): void {
    setSelectedSessionIds(clearSelection())
  }

  createEffect(() => {
    const visibleProjects = filteredProjects()
    const currentProject = selectedProjectId()
    if (!visibleProjects.some((project) => project.id === currentProject)) {
      const nextProject = visibleProjects[0]
      setSelectedProjectId(nextProject?.id)
      const nextSession = nextProject ? filteredSessionsFor(nextProject.id)[0] : undefined
      setSelectedSessionId(nextSession?.id)
      setSessionDetail(undefined)
      if (nextSession) void loadDetail(nextSession.id)
      return
    }
    const visibleSessions = filteredSessions()
    if (!visibleSessions.some((session) => session.id === selectedSessionId())) {
      const nextSession = visibleSessions[0]
      setSelectedSessionId(nextSession?.id)
      setSessionDetail(undefined)
      if (nextSession) void loadDetail(nextSession.id)
    }
  })

  onCleanup(() => {
    scanController?.abort()
    detailController?.abort()
    deleteController?.abort()
  })

  return {
    agents,
    activeAgentId,
    setActiveAgent,
    scanStatus,
    rootPath,
    projects,
    sessions,
    filteredProjects,
    filteredSessions,
    selectedProject,
    selectedSession,
    selectedProjectId,
    selectedSessionId,
    selectedProjectIds,
    selectedSessionIds,
    sessionDetail,
    focus,
    searchQuery,
    sort,
    issues,
    scannedSources,
    failedSources,
    detailLoading,
    deleteStatus,
    lastDeleteResult,
    lastScanAt,
    summary,
    scan,
    deleteSessions,
    deleteSelected,
    chooseProject,
    chooseSession,
    loadDetail,
    toggleProject,
    toggleSession,
    selectAllVisibleSessions,
    clearSelectedSessions,
    setFocus,
    setSearchQuery,
    setSort,
  }
}

export type { AppStore }
