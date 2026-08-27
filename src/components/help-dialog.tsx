import { For } from "solid-js"
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

export function HelpDialog() {
  return (
    <box position="absolute" top={2} left="20%" width="60%" height={16} backgroundColor={colors.panelAlt} border borderColor={colors.accent} zIndex={30} padding={1}>
      <text fg={colors.accent} attributes={1}>Keyboard shortcuts</text>
      <For each={shortcuts}>{(shortcut) => <text fg={colors.text}>{shortcut[0]}  {shortcut[1]}</text>}</For>
      <text fg={colors.muted}>Press Esc to close</text>
    </box>
  )
}
