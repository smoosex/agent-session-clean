import { RGBA } from "@opentui/core"

export const colors = {
  background: RGBA.defaultBackground(),
  panel: "transparent",
  panelAlt: RGBA.fromIndex(8),
  border: RGBA.fromIndex(2),
  text: RGBA.defaultForeground(),
  muted: RGBA.fromIndex(8),
  accent: RGBA.fromIndex(5),
  cyan: RGBA.fromIndex(6),
  error: RGBA.fromIndex(1),
  warning: RGBA.fromIndex(3),
  selected: RGBA.fromIndex(4),
  overlay: RGBA.fromInts(0, 0, 0, 150),
} as const
