import { colors } from "../theme/tokens"

type EmptyStateProps = {
  title: string
  detail: string
}

export function EmptyState(props: EmptyStateProps) {
  return (
    <box flexGrow={1} padding={2} justifyContent="center" alignItems="center">
      <text fg={colors.muted}>{props.title}</text>
      <text fg={colors.muted} wrapMode="word" width="100%">{props.detail}</text>
    </box>
  )
}
