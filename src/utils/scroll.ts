import { CliRenderEvents, type CliRenderer, type ScrollBoxRenderable } from "@opentui/core"

export function keepChildInView(renderer: CliRenderer, scrollbox: ScrollBoxRenderable | undefined, childId: string): () => void {
  if (!scrollbox) return () => undefined
  let frames = 0
  const tryScroll = (): boolean => {
    const child = scrollbox.content.findDescendantById(childId)
    if (!child || child.height <= 0) return false
    scrollbox.scrollChildIntoView(childId)
    return true
  }
  if (tryScroll()) return () => undefined
  const onFrame = () => {
    frames += 1
    if (tryScroll() || frames >= 8) renderer.off(CliRenderEvents.FRAME, onFrame)
  }
  renderer.on(CliRenderEvents.FRAME, onFrame)
  return () => renderer.off(CliRenderEvents.FRAME, onFrame)
}
