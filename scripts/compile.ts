import path from "node:path"
import solidPlugin from "@opentui/solid/bun-plugin"

type Libc = "glibc" | "musl"

type ReleaseTarget = {
  bunTarget: Bun.Build.CompileTarget
  name: string
  libc?: Libc
}

const targets: ReleaseTarget[] = [
  { bunTarget: "bun-darwin-arm64", name: "asc-darwin-arm64" },
  { bunTarget: "bun-darwin-x64", name: "asc-darwin-x64" },
  { bunTarget: "bun-linux-x64", name: "asc-linux-x64", libc: "glibc" },
  { bunTarget: "bun-linux-arm64", name: "asc-linux-arm64", libc: "glibc" },
  { bunTarget: "bun-linux-x64-musl", name: "asc-linux-x64-musl", libc: "musl" },
  { bunTarget: "bun-linux-arm64-musl", name: "asc-linux-arm64-musl", libc: "musl" },
  { bunTarget: "bun-windows-x64", name: "asc-windows-x64.exe" },
  { bunTarget: "bun-windows-arm64", name: "asc-windows-arm64.exe" },
]

function hostTarget(): ReleaseTarget {
  const arch = process.arch === "arm64" || process.arch === "x64" ? process.arch : undefined
  if (!arch) throw new Error(`Unsupported architecture: ${process.arch}`)
  if (process.platform === "darwin") return targets.find((target) => target.bunTarget === `bun-darwin-${arch}`) ?? fail(arch)
  if (process.platform === "linux") return targets.find((target) => target.bunTarget === `bun-linux-${arch}`) ?? fail(arch)
  if (process.platform === "win32") return targets.find((target) => target.name.startsWith(`asc-windows-${arch}`)) ?? fail(arch)
  throw new Error(`Unsupported platform: ${process.platform}`)
}

function fail(arch: string): never {
  throw new Error(`No compile target for ${process.platform}/${arch}`)
}

function selectedTargets(): ReleaseTarget[] {
  const args = process.argv.slice(2)
  if (args.includes("--all")) return targets
  const index = args.indexOf("--target")
  if (index >= 0) {
    const name = args[index + 1]
    const match = targets.find((target) => target.bunTarget === name || target.name === name)
    if (!match) throw new Error(`Unknown target: ${name}`)
    return [match]
  }
  return [hostTarget()]
}

async function compile(target: ReleaseTarget): Promise<void> {
  const outfile = path.resolve("dist", target.name)
  const define: Record<string, string> = {}
  if (target.libc) define["process.env.OPENTUI_LIBC"] = JSON.stringify(target.libc)
  console.log(`Compiling ${target.bunTarget} -> ${outfile}`)
  const result = await Bun.build({
    entrypoints: [path.resolve("src/main.tsx")],
    target: "bun",
    plugins: [solidPlugin],
    define,
    compile: {
      target: target.bunTarget,
      outfile,
      autoloadBunfig: false,
      autoloadDotenv: false,
    },
  })
  if (!result.success) {
    for (const log of result.logs) console.error(log)
    throw new Error(`Compile failed: ${target.name}`)
  }
}

const selected = selectedTargets()
for (const target of selected) await compile(target)
console.log(`Built ${selected.length} executable${selected.length === 1 ? "" : "s"} in dist/`)
