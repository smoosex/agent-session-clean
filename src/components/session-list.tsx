import { createEffect, For, Show } from "solid-js"
import type { ScrollBoxRenderable } from "@opentui/core"
import type { SessionSummary } from "../domain/session"
import type { AppStore } from "../store/app-store"
import { colors } from "../theme/tokens"
import { formatBytes, formatRelativeTime } from "../utils/format"
import { EmptyState } from "./empty-state"

type SessionListProps = {
  store: AppStore
  width?: `${number}%`
}

export function SessionList(props: SessionListProps) {
  let scrollbox: ScrollBoxRenderable | undefined

  createEffect(() => {
    const sessions = props.store.filteredSessions()
    const selectedId = props.store.selectedSessionId()
    if (!selectedId || !sessions.some((session) => session.id === selectedId)) return
    queueMicrotask(() => scrollbox?.scrollChildIntoView(`session-item-${selectedId}`))
  })

  return (
    <box flexDirection="column" flexGrow={1} flexShrink={1} minHeight={0} width={props.width ?? "39%"} minWidth={30} backgroundColor={colors.panel} border borderStyle="rounded" borderColor={props.store.focus() === "sessions" ? colors.accent : colors.border} focusedBorderColor={colors.accent} focused={props.store.focus() === "sessions"}>
      <text height={2} paddingX={1} fg={colors.accent} attributes={1}>[2] Sessions</text>
      <Show when={props.store.filteredSessions().length > 0} fallback={<EmptyState title="No sessions in this project" detail={props.store.searchQuery() ? "Try a different search." : "Try another project or press r to rescan."} />}>
        <scrollbox ref={(element) => { scrollbox = element }} flexGrow={1} minHeight={0} contentOptions={{ gap: 1 }}>
          <For each={props.store.filteredSessions()}>{(session: SessionSummary) => {
            const selected = () => props.store.selectedSessionId() === session.id
            const marked = () => props.store.selectedSessionIds().has(session.id)
            return (
              <box id={`session-item-${session.id}`} height={3} flexDirection="row" backgroundColor={selected() || marked() ? colors.selected : colors.panel}>
                <text width={2} paddingLeft={1} fg={marked() ? colors.warning : colors.muted}>{marked() ? "✓" : " "}</text>
                <box flexGrow={1} flexDirection="column" paddingLeft={1} paddingRight={1}>
                  <text fg={selected() ? colors.muted : colors.text}>{session.title}</text>
                  <text fg={colors.muted}>{formatRelativeTime(session.updatedAt)} · {formatBytes(session.sizeBytes ?? 0)} · {session.messageCount ?? 0} messages</text>
                  <text fg={session.warnings.length > 0 ? colors.warning : colors.muted}>{session.warnings.length > 0 ? `! ${session.warnings.length} parse warnings` : session.sessionId ?? "no session id"}</text>
                </box>
              </box>
            )
          }}</For>
        </scrollbox>
      </Show>
    </box>
  )
}
