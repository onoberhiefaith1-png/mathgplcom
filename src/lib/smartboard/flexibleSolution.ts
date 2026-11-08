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

/** Conservative reconstruction for legacy rows with no per-equation tags. */
export function legacyOwnerAt(parts: readonly string[], index: number, path: readonly number[], equations: readonly { owner: number; text: string }[]): number | undefined {
  const clean = (text: string) => text.normalize("NFC").replace(/\s+/g, "");
  const chunks = parts.map(clean);
  const source = chunks.join("");
  const spans: { owner: number; start: number; end: number }[] = [];
  let previousEnd = 0;
  for (const equation of equations) {
    const text = clean(equation.text);
    if (!text) continue;
    const start = source.indexOf(text, previousEnd);
    if (start < 0) continue;
    spans.push({ owner: equation.owner, start, end: start + text.length });
    previousEnd = start + text.length;
  }
  if (!spans.length) return undefined;
  const rootIndex = path.length ? path[0] : Math.max(0, index - 1);
  const position = path.length ? chunks.slice(0, rootIndex).join("").length
    : Math.max(0, chunks.slice(0, rootIndex + 1).join("").length - 1);
  return spans.filter(span => span.start <= position).at(-1)?.owner ?? spans[0].owner;
}
/** Find an entire legacy note only when all its paragraphs match exactly. */
export function legacyNoteRange(rows: Record<number,string>, locked: ReadonlySet<number>, selected: number,
  notes: readonly (readonly string[])[], start: number, end: number): [number,number] {
  const clean=(text:string)=>text.normalize("NFC").replace(/\s+/g," ").trim();
  for(const paragraphs of notes) {
    if(!paragraphs.length) continue;
    for(let first=Math.max(start,selected-paragraphs.length+1);first<=selected;first++) {
      const last=first+paragraphs.length-1;
      if(last<selected||last>end)continue;
      if(paragraphs.every((text,i)=>locked.has(first+i)&&clean(rows[first+i]??"")===clean(text))) return [first,last];
    }
  }
  return [selected,selected];
}

/** Contract measured caption slack visually, without renumbering saved ink rows. */
export function captionSlackShift(line: number, captions: readonly { at: number; px: number }[]): number {
  return captions.reduce((sum, caption) => sum + (line >= caption.at ? Math.min(0, caption.px) : 0), 0);
}

/** Reverse visual reflow without fixed-point oscillation at tall ink blocks.
 * Caption contractions divide the board into monotone ranges. Prefer the
 * latest visible range, then binary-search its actual rendered row tops. */
export function unshiftSolutionY(y:number, pitch:number, margin:number, captions:readonly {at:number;px:number}[], shift:(row:number)=>number):number {
  if (!Number.isFinite(y) || !Number.isFinite(pitch) || pitch <= 0) return y;
  const top = (row:number) => margin + row * pitch + shift(row);
  const contractions = captions.filter(c => c.px < 0 && Number.isFinite(c.at) && c.at >= 0)
    .map(c => Math.ceil(c.at)).sort((a,b) => a-b);
  let first = 0;
  for (const row of contractions) if (y >= top(row)) first = row;
  if (y < top(first)) return y;
  const end = contractions.find(row => row > first) ?? Infinity;
  // Within this range shifts only grow, so this is a strict upper bound.
  let high = Math.min(end, Math.max(first + 1, Math.floor((y - margin - shift(first)) / pitch) + 1));
  let low = first;
  while (low + 1 < high) {
    const mid = Math.floor((low + high) / 2);
    if (top(mid) <= y + 1e-7) low = mid;
    else high = mid;
  }
  // Expanded ink belongs to its source row, not to invisible rows inside it.
  // This also keeps blank portions of a wrapped, protected note protected.
  if (top(low + 1) - top(low) > pitch + 1e-7) return margin + low * pitch;
  return y - shift(low);
}
