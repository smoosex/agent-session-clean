import { createEffect, For, Show } from "solid-js"
import type { ScrollBoxRenderable } from "@opentui/core"
import type { ProjectSummary } from "../domain/project"
import type { AppStore } from "../store/app-store"
import { colors } from "../theme/tokens"
import { formatBytes, formatRelativeTime } from "../utils/format"
import { EmptyState } from "./empty-state"

type ProjectListProps = {
  store: AppStore
  width?: `${number}%`
}

export function ProjectList(props: ProjectListProps) {
  let scrollbox: ScrollBoxRenderable | undefined

  createEffect(() => {
    const projects = props.store.filteredProjects()
    const selectedId = props.store.selectedProjectId()
    if (!selectedId || !projects.some((project) => project.id === selectedId)) return
    queueMicrotask(() => scrollbox?.scrollChildIntoView(`project-item-${selectedId}`))
  })

  return (
    <box flexDirection="column" flexGrow={1} flexShrink={1} minHeight={0} width={props.width ?? "28%"} minWidth={24} backgroundColor={colors.panel} border borderColor={props.store.focus() === "projects" ? colors.accent : colors.border} focusedBorderColor={colors.accent} focused={props.store.focus() === "projects"}>
      <text height={2} paddingX={1} fg={colors.accent} attributes={1}>[1] Projects</text>
      <Show when={props.store.filteredProjects().length > 0} fallback={<EmptyState title="No projects found" detail={props.store.searchQuery() ? "Try a different search." : "The Pi session directory is empty."} />}>
        <scrollbox ref={(element) => { scrollbox = element }} flexGrow={1} minHeight={0}>
          <For each={props.store.filteredProjects()}>{(project: ProjectSummary) => {
            const selected = () => props.store.selectedProjectId() === project.id
            return (
              <box id={`project-item-${project.id}`} height={3} paddingX={1} backgroundColor={selected() ? colors.selected : colors.panel}>
                <text fg={selected() ? colors.text : colors.muted}>{selected() ? "▌ " : "  "}{project.displayPath}</text>
                <text fg={colors.muted}>  {project.sessionCount} sessions · {formatBytes(project.totalSizeBytes)}</text>
                <text fg={project.warningCount > 0 ? colors.warning : colors.muted}>{project.warningCount > 0 ? `  ! ${project.warningCount} warnings` : `  ${formatRelativeTime(project.updatedAt)}`}</text>
              </box>
            )
          }}</For>
        </scrollbox>
      </Show>
    </box>
  )
}
