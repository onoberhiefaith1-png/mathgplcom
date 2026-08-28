// LINE IDENTITY — the permanent link between a question, its lines, its notes
// and its floating numbers.
//
// THE ONE LAW
//   A floating number belongs to the exact line it was generated from.
//   A note belongs to the exact line it was written on.
//   Preview joins them by that line's permanent `uid` — never by array
//   position, visual order, index, or equation text.
//
// The identity is minted once on the Highlighting Page (`uid`) and copied onto
// every generated floating line as `sourceUid`. It survives adding, deleting
// and reordering highlights, reloads, and every later stage.

import { repairShiftedFloatingLines } from "@/lib/lessonnotes/floatingCompile";

/** Deterministic uid for the synthetic "leading prose" note row. There can be
 *  at most one per question, so a fixed id keeps it permanently addressable. */
export const LEADING_NOTE_UID = "hl_leading_note";

let counter = 0;

/** Mint a fresh permanent line identity. Never derived from position. */
export const mintLineUid = (): string => {
  counter += 1;
  const rand = Math.random().toString(36).slice(2, 10);
  return `hl_${Date.now().toString(36)}${counter.toString(36)}${rand}`;
};

export interface IdentifiedHighlight {
  /** PERMANENT identity. Assigned once, never recomputed. */
  uid?: string;
  /** Legacy display/order number only — NOT an identity. */
  groupId?: number;
  payload?: string;
  notebookOnly?: boolean;
  precedingNotebook?: string;
  [key: string]: unknown;
}

export interface IdentifiedLine {
  /** The permanent uid of the highlight this floating line was generated from. */
  sourceUid?: string;
  /** Owning question (subsection) id — guards against cross-question joins. */
  questionId?: string;
  groupId?: number;
  equation?: string;
  fillers?: string[];
  table?: unknown;
  [key: string]: unknown;
}

/** True when every highlight already carries a permanent uid. */
export const highlightsHaveUids = (highlights: IdentifiedHighlight[] | null | undefined): boolean =>
  Array.isArray(highlights) &&
  highlights.length > 0 &&
  highlights.every((h) => typeof h?.uid === "string" && h.uid.length > 0);

/** Give every highlight a permanent uid, preserving any it already has.
 *  The synthetic leading-note row gets the fixed LEADING_NOTE_UID. */
/** DETERMINISTIC LEGACY IDENTITY.
 *  Rows saved before permanent identity existed must be given the SAME uid by
 *  every page that reads them (highlighting, generating, preview, smartboard) —
 *  otherwise each reader would mint its own and the join would break. So a
 *  legacy uid is derived from the row's own durable content (its display order
 *  number plus its payload), never from a random value. Newly created rows
 *  still get a minted uid, which is then persisted. */
const stableHash = (input: string): string => {
  let h = 2166136261;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0).toString(36);
};

export const legacyUid = (h: IdentifiedHighlight, index: number): string => {
  const order = typeof h?.groupId === "number" ? h.groupId : index + 1;
  const payload = String(h?.payload ?? "");
  const note = String(h?.precedingNotebook ?? "");
  return `hl_legacy_${order}_${stableHash(`${payload}|${note}|${h?.notebookOnly === true ? "n" : "e"}`)}`;
};

export const ensureHighlightUids = <T extends IdentifiedHighlight>(
  highlights: T[] | null | undefined,
): T[] => {
  const rows = Array.isArray(highlights) ? highlights : [];
  let leadingUsed = false;
  return rows.map((h, i) => {
    if (typeof h?.uid === "string" && h.uid) {
      if (h.uid === LEADING_NOTE_UID) leadingUsed = true;
      return h;
    }
    const isLeading = h?.notebookOnly === true && i === 0 && !leadingUsed;
    if (isLeading) leadingUsed = true;
    return { ...h, uid: isLeading ? LEADING_NOTE_UID : legacyUid(h, i) } as T;
  });
};

/**
 * ONE-TIME BACKFILL for notebooks saved before permanent identity existed.
 *
 * Their floating lines carry only the old positional `groupId` (and, in the
 * worst historical case, chips saved one line out of step). We repair that
 * pairing ONCE, adopt it, and stamp `sourceUid` on each line. From then on the
 * runtime read path uses `sourceUid` alone.
 *
 * Lines that already carry `sourceUid` are never touched.
 */
export const adoptLineIdentities = <H extends IdentifiedHighlight, L extends IdentifiedLine>(
  highlights: H[],
  lines: L[],
  questionId?: string,
): { highlights: H[]; lines: L[]; changed: boolean } => {
  const withUids = ensureHighlightUids(highlights);
  const uidChanged = withUids.some((h, i) => h.uid !== (highlights[i] as IdentifiedHighlight)?.uid);

  const needsAdoption = lines.some((l) => !l?.sourceUid);
  if (!needsAdoption) {
    return {
      highlights: withUids,
      lines,
      changed: uidChanged,
    };
  }

  // Repair the historical one-line chip shift before adopting the pairing, so
  // the identity we freeze in is the CORRECT one.
  const repaired = repairShiftedFloatingLines(lines as never) as unknown as L[];

  const floatable = withUids.filter((h) => h?.notebookOnly !== true);
  const byGroupId = new Map<number, H>();
  for (const h of floatable) {
    if (typeof h.groupId === "number") byGroupId.set(h.groupId, h);
  }
  const byEquation = new Map<string, H>();
  for (const h of floatable) {
    const key = String(h.payload ?? "").trim();
    if (key && !byEquation.has(key)) byEquation.set(key, h);
  }

  const claimed = new Set<string>();
  const nextLines = repaired.map((line) => {
    if (line?.sourceUid) {
      claimed.add(line.sourceUid);
      return line;
    }
    let owner: H | undefined;
    if (typeof line?.groupId === "number") {
      const hit = byGroupId.get(line.groupId);
      if (hit?.uid && !claimed.has(hit.uid)) owner = hit;
    }
    if (!owner) {
      const hit = byEquation.get(String(line?.equation ?? "").trim());
      if (hit?.uid && !claimed.has(hit.uid)) owner = hit;
    }
    if (!owner?.uid) return line;
    claimed.add(owner.uid);
    return { ...line, sourceUid: owner.uid, questionId: questionId ?? line.questionId } as L;
  });

  return { highlights: withUids, lines: nextLines, changed: true };
};

/** The ONLY way to look up a line's floating numbers: by permanent uid. */
export const linesByUid = <L extends IdentifiedLine>(lines: L[] | null | undefined): Map<string, L> => {
  const map = new Map<string, L>();
  for (const line of lines ?? []) {
    const uid = line?.sourceUid;
    if (typeof uid === "string" && uid && !map.has(uid)) map.set(uid, line);
  }
  return map;
};
