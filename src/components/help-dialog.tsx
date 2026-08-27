import { For } from "solid-js"
import { useTerminalDimensions } from "@opentui/solid"
import { colors } from "../theme/tokens"

const shortcuts = [
  ["↑↓ / j k", "Navigate current list"],
  ["g / G", "Jump to first / last item"],
  ["Tab / Shift+Tab", "Switch focus"],
  ["1 2 3", "Focus projects / sessions / details"],
  ["Enter", "Open selector or confirm choice"],
  ["← / →", "Switch confirm / cancel"],
  ["Space", "Select project or session"],
  ["Esc", "Clear selected items"],
  ["d", "Delete current or marked items"],
  ["/", "Search"],
  ["r", "Rescan"],
  ["s", "Cycle sort order"],
  ["?", "This help"],
  ["q", "Quit"],
]

const title = "Keyboard shortcuts"
const footer = "Press Esc to close"
const contentWidth = Math.max(title.length, footer.length, ...shortcuts.map((shortcut) => (shortcut[0] ?? "").length + 2 + (shortcut[1] ?? "").length))
const contentHeight = shortcuts.length + 2

export function HelpDialog() {
  const dimensions = useTerminalDimensions()
  const width = () => Math.min(contentWidth + 2, Math.max(24, dimensions().width - 4))
  const height = () => Math.min(contentHeight + 2, Math.max(8, dimensions().height - 2))
  const left = () => Math.max(0, Math.floor((dimensions().width - width()) / 2))
  const top = () => Math.max(0, Math.floor((dimensions().height - height()) / 2))
  return (
    <box position="absolute" top={top()} left={left()} width={width()} height={height()} flexDirection="column" flexShrink={0} backgroundColor={colors.panelAlt} zIndex={30} paddingX={1} paddingTop={1} paddingBottom={1}>
      <text fg={colors.accent} attributes={1}>{title}</text>
      <For each={shortcuts}>{(shortcut) => <text fg={colors.text}>{shortcut[0]}  {shortcut[1]}</text>}</For>
      <text fg={colors.text}>{footer}</text>
    </box>
  )
}
