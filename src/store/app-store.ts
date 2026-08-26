import { createEffect, createSignal, onCleanup } from "solid-js"
import type { AgentInfo } from "../domain/agent"
import type { ProjectSummary } from "../domain/project"
import type { SessionDetail, SessionSummary } from "../domain/session"
import type { AgentAdapter, ScanIssue, ScanStatus } from "../adapters/types"
import { listAgents } from "../adapters/registry"
import { formatBytes } from "../utils/format"

export type FocusArea = "agent" | "projects" | "sessions" | "detail"
export type SortMode = "updated-desc" | "updated-asc" | "name-asc" | "size-desc"

type AppStore = ReturnType<typeof createAppStore>

function searchableSession(session: SessionSummary): string {
  return [session.title, session.sessionId, session.firstUserMessage, session.lastUserMessage].filter(Boolean).join(" ").toLowerCase()
}

function sortSessions(sessions: SessionSummary[], sort: SortMode): SessionSummary[] {
  return [...sessions].sort((left, right) => {
    if (sort === "name-asc") return left.title.localeCompare(right.title)
    if (sort === "size-desc") return right.sizeBytes - left.sizeBytes
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

export function createAppStore(adapter: AgentAdapter) {
  const [agents] = createSignal<AgentInfo[]>(listAgents(adapter))
  const [activeAgentId] = createSignal(adapter.id)
  const [scanStatus, setScanStatus] = createSignal<ScanStatus>("idle")
  const [rootPath, setRootPath] = createSignal(adapter.info.detail ?? adapter.info.label)
  const [projects, setProjects] = createSignal<ProjectSummary[]>([])
  const [sessions, setSessions] = createSignal<SessionSummary[]>([])
  const [selectedProjectId, setSelectedProjectId] = createSignal<string>()
  const [selectedSessionId, setSelectedSessionId] = createSignal<string>()
  const [sessionDetail, setSessionDetail] = createSignal<SessionDetail>()
  const [focus, setFocus] = createSignal<FocusArea>("projects")
  const [searchQuery, setSearchQuery] = createSignal("")
  const [sort, setSort] = createSignal<SortMode>("updated-desc")
  const [issues, setIssues] = createSignal<ScanIssue[]>([])
  const [scannedFiles, setScannedFiles] = createSignal(0)
  const [failedFiles, setFailedFiles] = createSignal(0)
  const [detailLoading, setDetailLoading] = createSignal(false)
  const [lastScanAt, setLastScanAt] = createSignal<string>()
  let scanVersion = 0
  let detailVersion = 0
  let scanController: AbortController | undefined

  const queryMatches = (value: string | undefined, query: string): boolean => Boolean(value && value.toLowerCase().includes(query))

  const filteredProjects = () => {
    const query = searchQuery().trim().toLowerCase()
    const allProjects = projects()
    if (!query) return sortProjects(allProjects, sort())
    return sortProjects(allProjects.filter((project) => {
      if (queryMatches(project.path, query) || queryMatches(project.displayPath, query)) return true
      return sessions().some((session) => session.projectId === project.id && searchableSession(session).includes(query))
    }), sort())
  }

  const filteredSessions = () => {
    const projectId = selectedProjectId()
    if (!projectId) return []
    const query = searchQuery().trim().toLowerCase()
    const project = projects().find((candidate) => candidate.id === projectId)
    const projectMatches = Boolean(query && project && (queryMatches(project.path, query) || queryMatches(project.displayPath, query)))
    const projectSessions = sessions().filter((session) => session.projectId === projectId)
    if (!query || projectMatches) return sortSessions(projectSessions, sort())
    return sortSessions(projectSessions.filter((session) => searchableSession(session).includes(query)), sort())
  }

  const selectedProject = () => projects().find((project) => project.id === selectedProjectId())
  const selectedSession = () => sessions().find((session) => session.id === selectedSessionId())
  const summary = () => {
    const allSessions = sessions()
    const totalSize = allSessions.reduce((total, session) => total + session.sizeBytes, 0)
    return `${projects().length} projects · ${allSessions.length} sessions · ${formatBytes(totalSize)}`
  }

  async function loadDetail(sessionId: string | undefined): Promise<void> {
    const version = ++detailVersion
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
    setSessionDetail(undefined)
    setDetailLoading(true)
    try {
      const detail = await adapter.loadDetail(session)
      if (version === detailVersion && selectedSessionId() === sessionId) setSessionDetail(detail)
    } catch (error) {
      if (version !== detailVersion || selectedSessionId() !== sessionId) return
      setSessionDetail({ ...session, warnings: [...session.warnings, error instanceof Error ? error.message : String(error)], warningCount: session.warnings.length + 1 })
    } finally {
      if (version === detailVersion) setDetailLoading(false)
    }
  }

  function chooseProject(projectId: string | undefined, load = true): void {
    const project = filteredProjects().find((candidate) => candidate.id === projectId) ?? filteredProjects()[0]
    setSelectedProjectId(project?.id)
    const nextSession = project ? filteredSessionsFor(project.id)[0] : undefined
    setSelectedSessionId(nextSession?.id)
    setSessionDetail(undefined)
    if (load) void loadDetail(nextSession?.id)
  }

  function filteredSessionsFor(projectId: string): SessionSummary[] {
    const query = searchQuery().trim().toLowerCase()
    const project = projects().find((candidate) => candidate.id === projectId)
    const projectMatches = Boolean(query && project && (queryMatches(project.path, query) || queryMatches(project.displayPath, query)))
    const projectSessions = sessions().filter((session) => session.projectId === projectId)
    if (!query || projectMatches) return sortSessions(projectSessions, sort())
    return sortSessions(projectSessions.filter((session) => searchableSession(session).includes(query)), sort())
  }

  function chooseSession(sessionId: string | undefined, load = true): void {
    const session = filteredSessions().find((candidate) => candidate.id === sessionId) ?? filteredSessions()[0]
    setSelectedSessionId(session?.id)
    setSessionDetail(undefined)
    if (load) void loadDetail(session?.id)
  }

  function applyResult(result: Awaited<ReturnType<AgentAdapter["scan"]>>, previousProjectId?: string, previousSessionId?: string): void {
    setRootPath(result.rootPath)
    setProjects(result.projects)
    setSessions(result.sessions)
    setIssues(result.issues)
    setScannedFiles(result.scannedFiles)
    setFailedFiles(result.failedFiles)
    setLastScanAt(new Date().toISOString())
    const project = result.projects.find((candidate) => candidate.id === previousProjectId) ?? result.projects[0]
    const session = project ? result.sessions.filter((candidate) => candidate.projectId === project.id).sort((left, right) => (Date.parse(right.updatedAt) || 0) - (Date.parse(left.updatedAt) || 0)).find((candidate) => candidate.id === previousSessionId) ?? result.sessions.find((candidate) => candidate.projectId === project.id) : undefined
    setSelectedProjectId(project?.id)
    setSelectedSessionId(session?.id)
    setSessionDetail(undefined)
    if (session) void loadDetail(session.id)
  }

  async function scan(): Promise<void> {
    const version = ++scanVersion
    scanController?.abort()
    const controller = new AbortController()
    scanController = controller
    const previousProjectId = selectedProjectId()
    const previousSessionId = selectedSessionId()
    setScanStatus("scanning")
    try {
      const result = await adapter.scan({ signal: controller.signal })
      if (version !== scanVersion) return
      applyResult(result, previousProjectId, previousSessionId)
      setScanStatus(result.issues.some((issue) => issue.severity === "error") || (result.failedFiles > 0 && result.sessions.length === 0) ? "error" : "complete")
    } catch (error) {
      if (version !== scanVersion || (error as Error).name === "AbortError" || (error as NodeJS.ErrnoException).code === "ABORT_ERR") return
      setScanStatus("error")
      setIssues([{ message: error instanceof Error ? error.message : String(error), severity: "error" }])
      setProjects([])
      setSessions([])
      setSelectedProjectId(undefined)
      setSelectedSessionId(undefined)
      setSessionDetail(undefined)
    }
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

  onCleanup(() => scanController?.abort())

  return {
    agents,
    activeAgentId,
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
    sessionDetail,
    focus,
    searchQuery,
    sort,
    issues,
    scannedFiles,
    failedFiles,
    detailLoading,
    lastScanAt,
    summary,
    scan,
    chooseProject,
    chooseSession,
    loadDetail,
    setFocus,
    setSearchQuery,
    setSort,
  }
}

export type { AppStore }
