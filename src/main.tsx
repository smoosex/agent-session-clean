import { render } from "@opentui/solid"
import { CodexAdapter } from "./adapters/codex/adapter"
import { PiAdapter } from "./adapters/pi/adapter"
import { createAgentRegistry } from "./adapters/registry"
import { App } from "./app"

function optionValue(args: string[], name: string): string | undefined {
  const index = args.indexOf(name)
  return index >= 0 ? args[index + 1] : undefined
}

const args = process.argv.slice(2)
const piSessionsDir = optionValue(args, "--pi-sessions-dir")
const codexSessionsDir = optionValue(args, "--codex-sessions-dir")
const piAdapter = new PiAdapter(piSessionsDir)
const codexAdapter = new CodexAdapter(codexSessionsDir)
const registry = createAgentRegistry(piAdapter, codexAdapter)
const activeAdapter = registry.get("pi") ?? piAdapter

await render(() => <App adapter={activeAdapter} adapters={registry} />, {
  exitOnCtrlC: true,
  backgroundColor: "#17151d",
  targetFps: 30,
})
