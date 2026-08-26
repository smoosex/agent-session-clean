import { onMount } from "solid-js"
import type { AgentId } from "./domain/agent"
import type { AgentUseCases } from "./application/use-cases"
import { AppShell } from "./components/app-shell"
import { createAppStore } from "./store/app-store"

type AppProps = {
  useCases: AgentUseCases
  initialAgentId: AgentId
}

export function App(props: AppProps) {
  const store = createAppStore(props.useCases, props.initialAgentId)
  onMount(() => void store.scan())
  return <AppShell store={store} />
}
