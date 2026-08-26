import { onMount } from "solid-js"
import type { AgentAdapter } from "./adapters/types"
import { AppShell } from "./components/app-shell"
import { createAppStore } from "./store/app-store"

type AppProps = {
  adapter: AgentAdapter
}

export function App(props: AppProps) {
  const store = createAppStore(props.adapter)
  onMount(() => void store.scan())
  return <AppShell store={store} />
}
