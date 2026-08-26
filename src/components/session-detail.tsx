import { For, Show } from "solid-js"
import type { AppStore } from "../store/app-store"
import { colors } from "../theme/tokens"
import { formatBytes, formatDate } from "../utils/format"
import { EmptyState } from "./empty-state"
import { truncate } from "../utils/truncate"

type SessionDetailProps = {
  store: AppStore
  overlay?: boolean
  width?: `${number}%`
}

export function SessionDetail(props: SessionDetailProps) {
  return (
    <box flexDirection="column" flexGrow={1} flexShrink={1} minHeight={0} width={props.width ?? "33%"} minWidth={34} backgroundColor={colors.panel} border borderStyle="rounded" borderColor={props.store.focus() === "detail" ? colors.accent : colors.border} focusedBorderColor={colors.accent} focused={props.store.focus() === "detail"} position={props.overlay ? "absolute" : "relative"} top={props.overlay ? 0 : undefined} right={props.overlay ? 0 : undefined} height={props.overlay ? "100%" : undefined} zIndex={props.overlay ? 10 : undefined}>
      <text height={2} paddingX={1} fg={colors.accent} attributes={1}>[3] Session details</text>
      <Show when={!props.store.detailLoading()} fallback={<EmptyState title="Loading details" detail="Reading this session as a stream…" />}>
        <Show when={props.store.sessionDetail()} fallback={<EmptyState title="No session selected" detail="Select a session to inspect its metadata." />}>
          <scrollbox flexGrow={1} minHeight={0} padding={1} focused={props.store.focus() === "detail"}>
            <text fg={colors.text} attributes={1}>{props.store.sessionDetail()?.title}</text>
            <text fg={colors.muted}>Agent</text>
            <text fg={colors.text}>{props.store.sessionDetail()?.agentId}</text>
            <text fg={colors.muted}>Session ID</text>
            <text fg={colors.text}>{props.store.sessionDetail()?.sessionId ?? "Unknown"}</text>
            <text fg={colors.muted}>Project</text>
            <text fg={colors.text} wrapMode="word">{props.store.sessionDetail()?.projectLocation ?? props.store.sessionDetail()?.projectName}</text>
            <text fg={colors.muted}>Created</text>
            <text fg={colors.text}>{formatDate(props.store.sessionDetail()?.createdAt)}</text>
            <text fg={colors.muted}>Updated</text>
            <text fg={colors.text}>{formatDate(props.store.sessionDetail()?.updatedAt)}</text>
            <text fg={colors.muted}>Size · messages</text>
            <text fg={colors.text}>{formatBytes(props.store.sessionDetail()?.sizeBytes ?? 0)} · {props.store.sessionDetail()?.messageCount ?? 0}</text>
            <For each={props.store.sessionDetail()?.fields ?? []}>{(field) => (
              <>
                <text fg={colors.muted}>{field.label}</text>
                <text fg={colors.text} wrapMode="word">{field.value}</text>
              </>
            )}</For>
            <text fg={colors.muted}>First user message</text>
            <text fg={colors.text} wrapMode="word">{props.store.sessionDetail()?.firstUserMessage ? truncate(props.store.sessionDetail()?.firstUserMessage ?? "", 240) : "Unknown"}</text>
            <text fg={colors.muted}>Last user message</text>
            <text fg={colors.text} wrapMode="word">{props.store.sessionDetail()?.lastUserMessage ? truncate(props.store.sessionDetail()?.lastUserMessage ?? "", 240) : "Unknown"}</text>
            <Show when={(props.store.sessionDetail()?.warnings.length ?? 0) > 0}>
              <text fg={colors.warning}>Warnings</text>
              <For each={props.store.sessionDetail()?.warnings ?? []}>{(warning) => <text fg={colors.warning} wrapMode="word">! {warning}</text>}</For>
            </Show>
          </scrollbox>
        </Show>
      </Show>
    </box>
  )
}
