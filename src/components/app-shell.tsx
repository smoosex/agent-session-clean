import { Show, createSignal } from "solid-js"
import { useKeyboard, useRenderer, useTerminalDimensions } from "@opentui/solid"
import type { AppStore, FocusArea, SortMode } from "../store/app-store"
import { colors } from "../theme/tokens"
import { AgentSelector } from "./agent-selector"
import { HelpDialog } from "./help-dialog"
import { IssuePanel } from "./issue-panel"
import { ProjectList } from "./project-list"
import { SearchInput } from "./search-input"
import { SessionDetail } from "./session-detail"
import { SessionList } from "./session-list"
import { StatusBar } from "./status-bar"

type AppShellProps = {
  store: AppStore
}

const focusOrder: FocusArea[] = ["agent", "projects", "sessions", "detail"]

export function AppShell(props: AppShellProps) {
  const renderer = useRenderer()
  const dimensions = useTerminalDimensions()
  const [searchOpen, setSearchOpen] = createSignal(false)
  const [helpOpen, setHelpOpen] = createSignal(false)
  const [agentOpen, setAgentOpen] = createSignal(false)
  const [agentIndex, setAgentIndex] = createSignal(0)

  const layout = () => dimensions().width >= 120 ? "wide" : dimensions().width >= 90 ? "medium" : "narrow"
  const moveProject = (delta: number) => {
    const items = props.store.filteredProjects()
    if (items.length === 0) return
    const current = items.findIndex((project) => project.id === props.store.selectedProjectId())
    const next = Math.max(0, Math.min(items.length - 1, (current < 0 ? 0 : current) + delta))
    props.store.chooseProject(items[next]?.id)
  }
  const moveSession = (delta: number) => {
    const items = props.store.filteredSessions()
    if (items.length === 0) return
    const current = items.findIndex((session) => session.id === props.store.selectedSessionId())
    const next = Math.max(0, Math.min(items.length - 1, (current < 0 ? 0 : current) + delta))
    props.store.chooseSession(items[next]?.id)
  }
  const cycleFocus = (delta: number) => {
    const current = focusOrder.indexOf(props.store.focus())
    const next = (current + delta + focusOrder.length) % focusOrder.length
    props.store.setFocus(focusOrder[next] ?? "projects")
  }
  const closeSearch = () => setSearchOpen(false)
  const cycleSort = () => {
    const modes: SortMode[] = ["updated-desc", "updated-asc", "name-asc", "size-desc"]
    const current = modes.indexOf(props.store.sort())
    props.store.setSort(modes[(current + 1) % modes.length] ?? "updated-desc")
  }

  useKeyboard((key) => {
    if (searchOpen()) {
      if (key.name === "escape") closeSearch()
      return
    }
    if (helpOpen()) {
      if (key.name === "escape" || key.name === "question") setHelpOpen(false)
      return
    }
    if (agentOpen()) {
      if (key.name === "escape") {
        setAgentOpen(false)
        return
      }
      if (key.name === "up" || key.name === "k") {
        setAgentIndex((index) => Math.max(0, index - 1))
        return
      }
      if (key.name === "down" || key.name === "j") {
        setAgentIndex((index) => Math.min(props.store.agents().length - 1, index + 1))
        return
      }
      if (key.name === "return" || key.name === "enter") {
        const agent = props.store.agents()[agentIndex()]
        if (agent?.status === "available") {
          props.store.setActiveAgent(agent.id)
          props.store.setFocus("projects")
        }
        setAgentOpen(false)
        return
      }
      return
    }

    if (key.ctrl && key.name === "c") {
      renderer.destroy()
      return
    }
    if (key.name === "q") {
      renderer.destroy()
      return
    }
    if (key.name === "r") {
      void props.store.scan()
      return
    }
    if (key.name === "s") {
      cycleSort()
      return
    }
    if (key.name === "question" || key.sequence === "?") {
      setHelpOpen(true)
      return
    }
    if (key.name === "slash" || key.sequence === "/") {
      setSearchOpen(true)
      return
    }
    if (key.name === "tab") {
      cycleFocus(key.shift ? -1 : 1)
      return
    }
    if (key.name === "1") {
      props.store.setFocus("projects")
      return
    }
    if (key.name === "2") {
      props.store.setFocus("sessions")
      return
    }
    if (key.name === "3") {
      props.store.setFocus("detail")
      return
    }
    if (key.name === "up" || key.name === "k") {
      if (props.store.focus() === "projects") {
        key.preventDefault()
        moveProject(-1)
      }
      if (props.store.focus() === "sessions") {
        key.preventDefault()
        moveSession(-1)
      }
      return
    }
    if (key.name === "down" || key.name === "j") {
      if (props.store.focus() === "projects") {
        key.preventDefault()
        moveProject(1)
      }
      if (props.store.focus() === "sessions") {
        key.preventDefault()
        moveSession(1)
      }
      return
    }
    if (key.name === "return" || key.name === "enter") {
      if (props.store.focus() === "agent") {
        setAgentOpen(true)
        return
      }
      if (props.store.focus() === "sessions" && layout() !== "wide") {
        props.store.setFocus("detail")
        return
      }
      if (props.store.focus() === "detail" && layout() !== "wide") {
        props.store.setFocus("sessions")
      }
    }
  })

  return (
    <box width="100%" height="100%" flexDirection="column" backgroundColor={colors.background} position="relative" overflow="hidden">
      <box height={searchOpen() ? 4 : 3} marginX={1} flexDirection="column" paddingX={1} backgroundColor={colors.panel} border borderStyle="rounded" borderColor={props.store.focus() === "agent" ? colors.accent : colors.border} position="relative" overflow="visible" zIndex={agentOpen() ? 100 : 0}>
        <box height={1} flexDirection="row" alignItems="center">
          <text width={31} fg={colors.text} attributes={1}>AGC · Agent Session Clean</text>
          <AgentSelector store={props.store} open={agentOpen()} selectedIndex={agentIndex()} />
          <text flexGrow={1} fg={colors.muted}>  {props.store.rootPath()}</text>
          <Show when={!searchOpen()}><text fg={colors.cyan}>{props.store.scanStatus() === "scanning" ? "Scanning…" : props.store.summary()}</text></Show>
        </box>
        <Show when={searchOpen()}><SearchInput store={props.store} onClose={closeSearch} /></Show>
      </box>
      <box flexGrow={1} flexShrink={1} flexBasis={0} minHeight={0} overflow="hidden" flexDirection="row" position="relative" gap={1} paddingX={1}>
        <Show when={layout() === "wide"}>
          <ProjectList store={props.store} width="28%" />
          <SessionList store={props.store} width="39%" />
          <SessionDetail store={props.store} width="33%" />
        </Show>
        <Show when={layout() === "medium"}>
          <ProjectList store={props.store} width="32%" />
          <SessionList store={props.store} width="68%" />
          <Show when={props.store.focus() === "detail"}><SessionDetail store={props.store} overlay width="70%" /></Show>
        </Show>
        <Show when={layout() === "narrow"}>
          <Show when={props.store.focus() === "detail"}><SessionDetail store={props.store} width="100%" /></Show>
          <Show when={props.store.focus() !== "detail" && props.store.focus() !== "sessions"}><ProjectList store={props.store} width="100%" /></Show>
          <Show when={props.store.focus() === "sessions"}><SessionList store={props.store} width="100%" /></Show>
        </Show>
      </box>
      <Show when={props.store.issues().length > 0}>
        <box paddingX={1}>
          <IssuePanel store={props.store} />
        </box>
      </Show>
      <StatusBar store={props.store} />
      <Show when={helpOpen()}><HelpDialog /></Show>
    </box>
  )
}
