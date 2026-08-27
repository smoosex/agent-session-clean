import { RGBA, type TerminalColors } from "@opentui/core"
import { createStore } from "solid-js/store"

function slot(terminal: TerminalColors | null | undefined, index: number) {
  return terminal?.palette[index] ?? undefined
}

export function createColors(terminal?: TerminalColors | null) {
  return {
    background: RGBA.defaultBackground(terminal?.defaultBackground ?? undefined),
    panel: "transparent" as const,
    panelAlt: RGBA.fromIndex(8, slot(terminal, 8)),
    border: RGBA.fromIndex(2, slot(terminal, 2)),
    text: RGBA.defaultForeground(terminal?.defaultForeground ?? undefined),
    muted: RGBA.fromIndex(8, slot(terminal, 8)),
    accent: RGBA.fromIndex(5, slot(terminal, 5)),
    cyan: RGBA.fromIndex(6, slot(terminal, 6)),
    error: RGBA.fromIndex(1, slot(terminal, 1)),
    warning: RGBA.fromIndex(3, slot(terminal, 3)),
    selected: RGBA.fromIndex(4, slot(terminal, 4)),
    overlay: RGBA.fromInts(0, 0, 0, 150),
  }
}

export const [colors, setColors] = createStore(createColors())

export function applyTerminalPalette(terminal: TerminalColors): void {
  setColors(createColors(terminal))
}
