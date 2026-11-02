/** Serializable presentation metadata; authored lesson math stays unchanged. */
export type SolutionTag = { sbOwner?: number; sbNote?: string; sbNoteLine?: number };
export function ownerAt(nodes: readonly SolutionTag[], index: number, path: readonly number[], fallback?: number): number | undefined {
  // Inside a container use that container; at a gap use the preceding equation.
  const at = path.length ? path[0] : Math.max(0, index - 1);
  for (let i = Math.min(at, nodes.length - 1); i >= 0; i--) {
    const node = nodes[i] as SolutionTag & { kind?: string; ch?: string };
    if (node.kind === "char" && !node.ch?.trim()) continue;
    if (node.sbOwner !== undefined) return node.sbOwner;
  }
  return nodes.find(n => n.sbOwner !== undefined)?.sbOwner ?? fallback;
}
export function shiftRows<T>(map: Record<number, T>, start: number, delta: number, end = Infinity): Record<number, T> {
  return Object.fromEntries(Object.entries(map).map(([key, value]) => {
    const row = Number(key);
    return [row >= start && row <= end ? row + delta : row, value];
  }));
}
export function solutionContains(row: number, start: number, end: number, locked: ReadonlySet<number>): boolean {
  return row >= start && row <= end && !locked.has(row) && !locked.has(Math.floor(row));
}
/** Preserve ownership through edits, including new nodes inserted within a structure. */
export function tagEditedNodes<T extends object>(before: readonly T[], after: readonly T[], owner: number, previousOwner = owner): T[] {
  return after.map(node => {
    const tagged = node as T & SolutionTag;
    return tagged.sbOwner !== undefined ? node : { ...node, sbOwner: before.includes(node) ? previousOwner : owner };
  });
}

/** Reflow ink and its protections together; never leave a stale lock on an equation. */
export function spliceSolution<T>(board: {
  ink: Record<number,T>; offsets: Record<number,number>; owners: Record<number,number>; locked: ReadonlySet<number>;
}, start: number, remove: number, insert: Record<number,T>, end = Infinity) {
  const count = Object.keys(insert).length;
  const remap = <V>(map: Record<number,V>) => shiftRows(
    Object.fromEntries(Object.entries(map).filter(([key]) => Number(key) < start || Number(key) >= start + remove)),
    start + remove, count - remove, end);
  return {
    ink: { ...remap(board.ink), ...insert }, offsets: remap(board.offsets), owners: remap(board.owners),
    locked: new Set([...Object.keys(remap(Object.fromEntries([...board.locked].map(r => [r,true])))).map(Number), ...Object.keys(insert).map(Number)]),
  };
}
