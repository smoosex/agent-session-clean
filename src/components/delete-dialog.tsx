import { useTerminalDimensions } from "@opentui/solid"
import type { DeleteScope } from "../store/app-store"
import { colors } from "../theme/tokens"

export type DeleteAction = "confirm" | "cancel"

type DeleteDialogProps = {
  count: number
  projectCount?: number
  scope: DeleteScope
  action: DeleteAction
  onActionChange: (action: DeleteAction) => void
  onConfirm: () => void
  onCancel: () => void
}

export function DeleteDialog(props: DeleteDialogProps) {
  const dimensions = useTerminalDimensions()
  const popupHeight = 7
  const message = () => {
    if (props.scope !== "project") return `Delete ${props.count} ${props.count === 1 ? "session" : "sessions"}?`
    const projectCount = props.projectCount ?? 1
    return projectCount > 1 ? `Delete ${projectCount} projects and all ${props.count} sessions?` : `Delete this project and all ${props.count} sessions?`
  }
  const width = () => Math.min(Math.max(message().length + 4, 36), Math.max(20, dimensions().width - 4))
  const left = () => Math.max(0, Math.floor((dimensions().width - width()) / 2))
  const top = () => Math.max(0, Math.floor((dimensions().height - popupHeight) / 2))
  const select = (action: DeleteAction, callback: () => void) => {
    props.onActionChange(action)
    callback()
  }
  return (
    <box position="absolute" top={top()} left={left()} width={width()} height={popupHeight} flexDirection="column" flexShrink={0} backgroundColor={colors.panelAlt} zIndex={40} padding={1}>
      <box flexGrow={1} flexDirection="column">
        <text fg={colors.error} attributes={1}>Permanent deletion</text>
        <text fg={colors.text}>{message()}</text>
        <text fg={colors.warning}>This cannot be undone.</text>
      </box>
      <box height={1} flexDirection="row" justifyContent="flex-end" gap={2}>
        <box width={12} height={1} justifyContent="center" alignItems="center" backgroundColor={props.action === "confirm" ? colors.accent : colors.panelAlt} onMouseDown={() => select("confirm", props.onConfirm)}>
          <text fg={props.action === "confirm" ? colors.background : colors.text}>Confirm</text>
        </box>
        <box width={10} height={1} justifyContent="center" alignItems="center" backgroundColor={props.action === "cancel" ? colors.accent : colors.panelAlt} onMouseDown={() => select("cancel", props.onCancel)}>
          <text fg={props.action === "cancel" ? colors.background : colors.text}>Cancel</text>
        </box>
      </box>
    </box>
  )
}
