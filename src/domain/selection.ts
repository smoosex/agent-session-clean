export type SelectionState = ReadonlySet<string>

export function toggleSelection(selection: SelectionState, id: string): Set<string> {
  const next = new Set(selection)
  if (next.has(id)) next.delete(id)
  else next.add(id)
  return next
}

export function selectAll(selection: SelectionState, ids: readonly string[]): Set<string> {
  const next = new Set(selection)
  for (const id of ids) next.add(id)
  return next
}

export function clearSelection(): Set<string> {
  return new Set()
}
