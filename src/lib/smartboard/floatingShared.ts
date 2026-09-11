// Identity model for the floating-number workspace on the LIVE CLASSROOM board.
//
// The classroom board is one shared workspace, so the floating numbers must have
// real identity. Two chips can hold the same value and still be different
// objects, and two lines can hold the same equation — addressing either by array
// position is what previously let an action on line 1 reveal line 2, merge chips
// or scramble the arrangement on the student's screen.
//
// A chipId is content-anchored: reservoir + line + slot + token. If a receiver
// ever held a different arrangement, the ids would simply not match and nothing
// would be misapplied to the wrong chip.

import type { FloatingLineShared, FloatingShared } from "@/hooks/useSmartboardSync";
import type { Reservoir, ReservoirLine } from "@/lib/smartboard/presentation";

/** Deterministic identity for the exact ordered lesson structure. */
export function floatingSourceFingerprint(reservoirs: Reservoir[]): string {
  const source = reservoirs.map((reservoir) => ({
    beatId: reservoir.beatId,
    lines: reservoir.lines.map((line, lineIdx) => ({
      id: line.lineId ?? line.sourceUid ?? line.groupId ?? lineIdx,
      equation: line.equation,
      containers: line.containers,
      chips: reservoir.fragments.slice(line.fragmentStart, line.fragmentEnd),
    })),
  }));
  const text = JSON.stringify(source);
  let hash = 2166136261;
  for (let i = 0; i < text.length; i++) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(36);
}

export const floatingLineId = (resId: string, lineIdx: number, equation: string): string =>
  `${resId}|L${lineIdx}|${equation}`;

export const floatingChipId = (lineId: string, slotIdx: number, token: string): string =>
  `${lineId}|C${slotIdx}|${token}`;

/** Publish-side: the teacher's arrangement, exactly as built for their board. */
export function buildFloatingLines(resId: string, reservoir: Reservoir): FloatingLineShared[] {
  const fragments = reservoir.fragments ?? [];
  const lines = reservoir.lines ?? [];
  if (lines.length === 0) {
    return [
      {
        lineId: floatingLineId(resId, 0, reservoir.caption ?? ""),
        lineIdx: 0,
        chips: fragments.map((token, absIdx) => ({
          chipId: floatingChipId(floatingLineId(resId, 0, reservoir.caption ?? ""), absIdx, token),
          token,
          absIdx,
        })),
      },
    ];
  }
  return lines.map((line, lineIdx) => {
    const lineId = line.lineId || line.sourceUid || floatingLineId(resId, lineIdx, line.equation ?? "");
    return {
    lineId,
    lineIdx,
    chips: Array.from({ length: Math.max(0, line.fragmentEnd - line.fragmentStart) }, (_, n) => {
      const absIdx = line.fragmentStart + n;
      const token = fragments[absIdx] ?? "";
      return { chipId: floatingChipId(lineId, n, token), token, absIdx };
    }),
  }});
}

/**
 * Receive-side: rebuild a Reservoir that IS the publisher's arrangement, so the
 * receiving board renders the shared object rather than deriving its own chips.
 * Line grouping, order, spacing and slot indexes are preserved verbatim.
 */
export function reservoirFromShared(shared: FloatingShared, template?: Reservoir): Reservoir {
  const fragments: string[] = [];
  const lines: ReservoirLine[] = [];
  for (const line of shared.lines) {
    const templateLine = template?.lines?.[line.lineIdx];
    const start = fragments.length;
    for (const chip of line.chips) fragments.push(chip.token);
    lines.push({
      ...(templateLine ?? { equation: "", fillers: [], containers: [] }),
      // The published object owns the exact chip sequence. Do not retain a
      // receiver-local filler list that may have a different order or length.
      fillers: line.chips.map((chip) => chip.token),
      fragmentStart: start,
      fragmentEnd: fragments.length,
    } as ReservoirLine);
  }
  return {
    beatId: template?.beatId ?? shared.resId,
    caption: template?.caption ?? "",
    fragments,
    lines,
  };
}

/** Map published chipIds to positions in the rebuilt shared arrangement. */
export function sharedChipPositions(shared: FloatingShared): Map<string, number> {
  const map = new Map<string, number>();
  let pos = 0;
  for (const line of shared.lines) {
    for (const chip of line.chips) {
      map.set(chip.chipId, pos);
      pos += 1;
    }
  }
  return map;
}

/** Consumed chipIds → indexes of the rebuilt shared arrangement. */
export function sharedConsumedSet(shared: FloatingShared, chipIds: string[]): Set<number> {
  const positions = sharedChipPositions(shared);
  const out = new Set<number>();
  for (const id of chipIds) {
    const at = positions.get(id);
    if (at != null) out.add(at);
  }
  return out;
}

/** Consumed chipIds → the rebuilt arrangement's order (used-zone ordering). */
export function sharedUsedOrderIdx(shared: FloatingShared, chipIds: string[]): number[] {
  const positions = sharedChipPositions(shared);
  return chipIds.map((id) => positions.get(id)).filter((n): n is number => n != null);
}

/** Publish-side: local absolute indexes → chipIds of the published arrangement. */
export function chipIdsForAbsIdx(lines: FloatingLineShared[], absIdxs: number[]): string[] {
  const byAbs = new Map<number, string>();
  for (const line of lines) for (const chip of line.chips) byAbs.set(chip.absIdx, chip.chipId);
  return absIdxs.map((i) => byAbs.get(i)).filter((s): s is string => !!s);
}

/** Which shared line a chipId belongs to — proof that an operation cannot cross lines. */
export function lineIdOfChip(shared: FloatingShared, chipId: string): string | null {
  for (const line of shared.lines) {
    if (line.chips.some((c) => c.chipId === chipId)) return line.lineId;
  }
  return null;
}
