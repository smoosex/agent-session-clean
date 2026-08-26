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
  return (
    <box position="relative" width={28}>
      <text fg={colors.cyan}>Agent [ ● {active()?.label ?? "Pi"} ▾ ]</text>
      <Show when={props.open}>
        <box position="absolute" top={1} left={0} width={30} height={6} backgroundColor={colors.panelAlt} border borderColor={colors.accent} zIndex={20} padding={1}>
          <For each={props.store.agents()}>{(agent: AgentInfo, index) => (
            <box backgroundColor={index() === props.selectedIndex ? colors.selected : colors.panelAlt}><text fg={index() === props.selectedIndex ? colors.text : colors.muted}>{index() === props.selectedIndex ? "▌ " : "  "}{agent.label} · {agent.status === "available" ? "ready" : "Coming soon"}</text></box>
          )}</For>
        </box>
      </Show>
    </box>
  )
}
