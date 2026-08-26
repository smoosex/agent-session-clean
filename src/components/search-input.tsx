import { onMount } from "solid-js"
import { InputRenderable } from "@opentui/core"
import type { AppStore } from "../store/app-store"
import { colors } from "../theme/tokens"

type SearchInputProps = {
  store: AppStore
  onClose: () => void
}

export function SearchInput(props: SearchInputProps) {
  let inputRef: InputRenderable | undefined
  onMount(() => inputRef?.focus())
  return (
    <box flexGrow={1} height={1} backgroundColor={colors.panelAlt}>
      <text fg={colors.cyan}>/ </text>
      <input ref={inputRef} flexGrow={1} value={props.store.searchQuery()} placeholder="Search projects, sessions, IDs, messages" textColor={colors.text} cursorColor={colors.cyan} backgroundColor={colors.panelAlt} focusedBackgroundColor={colors.panelAlt} onInput={(value) => props.store.setSearchQuery(value)} onSubmit={props.onClose} />
    </box>
  )
}
