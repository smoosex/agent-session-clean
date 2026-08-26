import { For, Show } from "solid-js"
import type { AgentInfo } from "../domain/agent"
import type { AppStore } from "../store/app-store"
import { colors } from "../theme/tokens"

type AgentSelectorProps = {
  store: AppStore
  open: boolean
  selectedIndex: number
}

export function AgentSelector(props: AgentSelectorProps) {
  const active = () => props.store.agents().find((agent) => agent.id === props.store.activeAgentId())
  const optionLines = () => props.store.agents().map((agent) => `${agent.label}${agent.id === props.store.activeAgentId() ? " *" : ""}`)
  const popupWidth = () => Math.max(1, ...optionLines().map((line) => line.length)) + 4
  const popupHeight = () => Math.max(1, optionLines().length) + 2

  return (
    <box position="relative" width={28}>
      <text fg={colors.cyan}>Agent [ ● {active()?.label ?? "Pi"} ▾ ]</text>
      <Show when={props.open}>
        <box position="absolute" top={1} left={0} width={popupWidth()} height={popupHeight()} backgroundColor={colors.panelAlt} paddingX={2} paddingY={1} zIndex={100}>
          <For each={props.store.agents()}>{(agent: AgentInfo, index) => (
            <text bg={index() === props.selectedIndex ? colors.selected : colors.panel} fg={index() === props.selectedIndex ? colors.muted : colors.text}>{agent.label}{agent.id === props.store.activeAgentId() ? " *" : ""}</text>
          )}</For>
        </box>
      </Show>
    </box>
  )
}
