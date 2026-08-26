import { For } from "solid-js"
import type { ScanIssue } from "../domain/scan"
import type { AppStore } from "../store/app-store"
import { colors } from "../theme/tokens"
import { truncate } from "../utils/truncate"

type IssuePanelProps = {
  store: AppStore
}

export function IssuePanel(props: IssuePanelProps) {
  const hasError = () => props.store.issues().some((issue) => issue.severity === "error")
  const formatIssue = (issue: ScanIssue) => {
    const prefix = issue.severity === "error" ? "✕" : "!"
    return truncate(`${prefix} ${issue.location ? `${issue.location}: ` : ""}${issue.message}`, 180)
  }

  return (
    <box height={6} flexDirection="column" backgroundColor={colors.panel} border borderStyle="rounded" borderColor={hasError() ? colors.error : colors.warning}>
      <text height={1} paddingX={1} fg={hasError() ? colors.error : colors.warning} attributes={1}>[!] Issues ({props.store.issues().length})</text>
      <scrollbox flexGrow={1} paddingX={1}>
        <For each={props.store.issues()}>{(issue) => <text fg={issue.severity === "error" ? colors.error : colors.warning}>{formatIssue(issue)}</text>}</For>
      </scrollbox>
    </box>
  )
}
