import { onCleanup, onMount } from "solid-js"
import { CliRenderEvents, type TerminalColors } from "@opentui/core"
import { useRenderer } from "@opentui/solid"
import type { AgentId } from "./domain/agent"
import type { AgentUseCases } from "./application/use-cases"
import { AppShell } from "./components/app-shell"
import { createAppStore } from "./store/app-store"
import { applyTerminalPalette } from "./theme/tokens"

type AppProps = {
  useCases: AgentUseCases
  initialAgentId: AgentId
}

export function App(props: AppProps) {
  const renderer = useRenderer()
  const store = createAppStore(props.useCases, props.initialAgentId)
  onMount(() => {
    const apply = (terminal: TerminalColors) => applyTerminalPalette(terminal)
    renderer.on(CliRenderEvents.PALETTE, apply)
    void renderer.getPalette().then(apply).catch(() => undefined)
    void store.scan()
    onCleanup(() => renderer.off(CliRenderEvents.PALETTE, apply))
  })
  return <AppShell store={store} />
}
