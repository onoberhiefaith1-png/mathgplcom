// QUESTION + SOLUTION = ONE LEARNING ITEM.
//
// A Solution heading in the normal flow is bound to exactly one question
// heading through `ownerQuestionId` → `sectionId`. This module is the
// structural guarantee behind that link:
//
//   1. an orphaned Solution (its question was deleted) is removed together
//      with its body — a solution never exists on its own;
//   2. a Solution that drifted away from its question is moved back into that
//      question's section;
//   3. a legacy Solution with no owner is adopted by the question heading
//      directly above it, so old notes heal themselves on load.
//
// Pure: it takes and returns a plain TipTap JSON document.

export interface PairNode {
  type: string;
  attrs?: Record<string, unknown> | null;
  content?: PairNode[];
  text?: string;
}

const textOf = (n: PairNode): string => {
  if (typeof n.text === "string") return n.text;
  return (n.content ?? []).map(textOf).join("");
};

const level = (n: PairNode): number => Number((n.attrs as any)?.level ?? 6);

/** Same rule the editor uses for a Solution label. */
export const isSolutionHeadingText = (raw: string): boolean => {
  const t = String(raw ?? "").trim().toLowerCase().replace(/[:.\s]+$/, "");
  return t === "solution" || t === "worked solution" || /^solution\b/.test(t) || t.includes("worked solution");
};

const isHeading = (n: PairNode): boolean => n.type === "heading";
const isSolutionHeading = (n: PairNode): boolean => isHeading(n) && isSolutionHeadingText(textOf(n));
/** A question heading owns a durable id and is not itself a Solution. */
const isQuestionHeading = (n: PairNode): boolean =>
  isHeading(n) && !isSolutionHeading(n) && level(n) <= 2;

const ownerOf = (n: PairNode): string | null => {
  const id = (n.attrs as any)?.ownerQuestionId;
  return typeof id === "string" && id ? id : null;
};
const idOf = (n: PairNode): string | null => {
  const id = (n.attrs as any)?.sectionId;
  return typeof id === "string" && id ? id : null;
};

const questionIndexById = (top: PairNode[], qid: string): number =>
  top.findIndex((n) => isQuestionHeading(n) && idOf(n) === qid);

/** Exclusive end of the block a Solution heading at `i` owns: everything up to
 *  the next heading of level <= 3. */
const solutionBlockEnd = (top: PairNode[], i: number): number => {
  for (let j = i + 1; j < top.length; j += 1) {
    if (isHeading(top[j]) && level(top[j]) <= 3) return j;
  }
  return top.length;
};

/** Exclusive end of a question's own section. */
const questionSectionEnd = (top: PairNode[], start: number): number => {
  for (let j = start + 1; j < top.length; j += 1) {
    if (isQuestionHeading(top[j])) return j;
  }
  return top.length;
};

/**
 * Enforce the pairing across the whole document. Returns a new document when
 * something had to be repaired.
 */
export function enforceQuestionSolutionPairs<T extends { type: string; content?: PairNode[] }>(
  doc: T | null | undefined,
): { doc: T; changed: boolean } {
  if (!doc || !Array.isArray(doc.content)) return { doc: doc as T, changed: false };
  let top = [...doc.content];
  let changed = false;

  // ── 1. adopt unowned legacy Solutions ────────────────────────────────────
  for (let i = 0; i < top.length; i += 1) {
    if (!isSolutionHeading(top[i]) || ownerOf(top[i])) continue;
    let owner: string | null = null;
    for (let j = i - 1; j >= 0; j -= 1) {
      if (isQuestionHeading(top[j])) {
        owner = idOf(top[j]);
        if (!owner) {
          owner = `q_${Math.random().toString(36).slice(2, 10)}`;
          top[j] = { ...top[j], attrs: { ...(top[j].attrs ?? {}), sectionId: owner } };
        }
        break;
      }
      if (isSolutionHeading(top[j])) break;
    }
    if (!owner) continue;
    top[i] = { ...top[i], attrs: { ...(top[i].attrs ?? {}), ownerQuestionId: owner } };
    changed = true;
  }

  // ── 2. drop orphaned Solutions (question gone) ───────────────────────────
  for (let i = top.length - 1; i >= 0; i -= 1) {
    const owner = isSolutionHeading(top[i]) ? ownerOf(top[i]) : null;
    if (!owner) continue;
    if (questionIndexById(top, owner) >= 0) continue;
    const end = solutionBlockEnd(top, i);
    top = [...top.slice(0, i), ...top.slice(end)];
    changed = true;
  }

  // ── 3. re-home Solutions that drifted out of their question ──────────────
  // Bounded: at most one move per node.
  for (let guard = 0; guard < top.length + 1; guard += 1) {
    let moved = false;
    for (let i = 0; i < top.length; i += 1) {
      const owner = isSolutionHeading(top[i]) ? ownerOf(top[i]) : null;
      if (!owner) continue;
      const start = questionIndexById(top, owner);
      if (start < 0) continue;
      const sectionEnd = questionSectionEnd(top, start);
      if (i > start && i < sectionEnd) continue; // already partnered

      const end = solutionBlockEnd(top, i);
      const block = top.slice(i, end);
      const rest = [...top.slice(0, i), ...top.slice(end)];
      const freshStart = questionIndexById(rest, owner);
      const insertAt = freshStart < 0 ? rest.length : questionSectionEnd(rest, freshStart);
      top = [...rest.slice(0, insertAt), ...block, ...rest.slice(insertAt)];
      changed = true;
      moved = true;
      break;
    }
    if (!moved) break;
  }

  if (!changed) return { doc, changed: false };
  return { doc: { ...doc, content: top }, changed: true };
}

/**
 * Ordinal of every question heading in document order, keyed by its durable id.
 * Numbering of a Solution is derived from this map, never from position.
 */
export function questionOrdinals(
  top: PairNode[],
  isRepeatable: (headingText: string) => boolean,
): Map<string, number> {
  const out = new Map<string, number>();
  const counts = new Map<string, number>();
  for (const n of top) {
    if (!isQuestionHeading(n)) continue;
    const text = textOf(n).trim();
    if (!isRepeatable(text)) continue;
    const key = text.replace(/\s*\d*\s*:?\s*$/, "").toLowerCase();
    const next = (counts.get(key) ?? 0) + 1;
    counts.set(key, next);
    const id = idOf(n);
    if (id) out.set(id, next);
  }
  return out;
}
