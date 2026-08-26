import { render } from "@opentui/solid"
import { PiAdapter } from "./adapters/pi/adapter"
import { createAgentRegistry } from "./adapters/registry"
import { App } from "./app"

function optionValue(args: string[], name: string): string | undefined {
  const index = args.indexOf(name)
  return index >= 0 ? args[index + 1] : undefined
}

const sessionsDir = optionValue(process.argv.slice(2), "--pi-sessions-dir")
const adapter = new PiAdapter(sessionsDir)
const registry = createAgentRegistry(adapter)
const activeAdapter = registry.get("pi") ?? adapter

await render(() => <App adapter={activeAdapter} />, {
  exitOnCtrlC: true,
  backgroundColor: "#17151d",
  targetFps: 30,
})
