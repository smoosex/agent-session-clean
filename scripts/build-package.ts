import { mkdir, rm } from "node:fs/promises"
import path from "node:path"
import solidPlugin from "@opentui/solid/bun-plugin"

const outputDir = path.resolve("dist/npm")
await rm(outputDir, { recursive: true, force: true })
await mkdir(outputDir, { recursive: true })

const result = await Bun.build({
  entrypoints: [path.resolve("src/main.tsx")],
  outdir: outputDir,
  naming: "main.js",
  target: "bun",
  format: "esm",
  minify: true,
  packages: "external",
  plugins: [solidPlugin],
})

if (!result.success) {
  for (const log of result.logs) console.error(log)
  throw new Error("Package build failed")
}

console.log(`Built ${path.relative(process.cwd(), path.join(outputDir, "main.js"))}`)
