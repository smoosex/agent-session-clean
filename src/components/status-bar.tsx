import { Show } from "solid-js"
import type { AppStore } from "../store/app-store"
import { colors } from "../theme/tokens"

type StatusBarProps = {
  store: AppStore
}

export function StatusBar(props: StatusBarProps) {
  const statusText = () => {
    if (props.store.scanStatus() === "scanning") return "Scanning…"
    if (props.store.scanStatus() === "error") return "Scan error"
    if (props.store.issues().length > 0) return `Scan complete · ${props.store.issues().length} issues`
    return `Scan complete · ${props.store.scannedFiles()} files`
  }
  return (
    <box height={1} flexDirection="row" backgroundColor={colors.panelAlt} paddingX={1}>
      <text flexGrow={1} fg={props.store.scanStatus() === "error" ? colors.error : colors.cyan}>{statusText()} · {props.store.summary()}</text>
      <Show when={props.store.searchQuery()}><text fg={colors.warning}>Search: {props.store.searchQuery()} · </text></Show>
      <text fg={colors.muted}>↑↓/jk Navigate · 1-3 Focus · Tab Switch · / Search · r Refresh · ? Help · q Quit</text>
    </box>
  )
}
