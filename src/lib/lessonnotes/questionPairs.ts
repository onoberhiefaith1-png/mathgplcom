// QUESTION + SOLUTION = ONE LEARNING ITEM.
//
// A Solution heading in the normal flow is bound to exactly one question
// heading through `ownerQuestionId` → `sectionId`. This module is the
// structural guarantee behind that link:
//
//   1. a Solution whose owner cannot be found is re-attached to the question
//      above it — it is NEVER deleted automatically;
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

/** Remove Solution-button labels that leaked into a heading's text. */
export const stripChipWords = (raw: string): string =>
  String(raw ?? "").replace(/(\s+(ai|assign|floating|#))+\s*$/i, "").trimEnd();

const isHeading = (n: PairNode): boolean => n.type === "heading";
const isSolutionHeading = (n: PairNode): boolean => isHeading(n) && isSolutionHeadingText(textOf(n));
/** A question heading owns a durable id and is not itself a Solution. */
const QUESTION_WORDS = /^(example|exercise|classwork|class work|homework|home work|assignment|assessment|quiz|question|problem|activity|practice|task)\b/i;
/** Recognised by meaning (Example / Classwork …) OR by being a top-level id'd heading. */
const isQuestionHeading = (n: PairNode): boolean =>
  isHeading(n) && !isSolutionHeading(n) &&
  (QUESTION_WORDS.test(textOf(n).trim()) || (level(n) <= 2 && !!idOf(n)));

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

  // ── 0. Solution headings: strip stray button words, cap depth at 4 ───────
  // The editor only draws Solution buttons (AI / Assign / Floating) up to
  // level 4, so a deeper Solution is lifted to 4. Button labels that leaked
  // into the heading text ("Solution 1 ai assign floating") are removed.
  for (let i = 0; i < top.length; i += 1) {
    if (!isSolutionHeading(top[i])) continue;
    let node = top[i];
    const raw = textOf(node);
    const cleaned = stripChipWords(raw);
    if (cleaned !== raw && cleaned) {
      node = { ...node, content: [{ type: "text", text: cleaned }] };
      changed = true;
    }
    if (level(node) > 4) {
      node = { ...node, attrs: { ...(node.attrs ?? {}), level: 4 } };
      changed = true;
    }
    top[i] = node;
  }

  // ── 1. stale owners are NEVER a reason to delete ─────────────────────────
  // A Solution whose owner id no longer matches any question (AI Edit output,
  // a reload that re-minted ids, a demoted heading) loses the stale link and
  // is re-adopted below. The teacher's working is never silently removed.
  for (let i = 0; i < top.length; i += 1) {
    const owner = isSolutionHeading(top[i]) ? ownerOf(top[i]) : null;
    if (!owner || questionIndexById(top, owner) >= 0) continue;
    const attrs = { ...(top[i].attrs ?? {}) } as Record<string, unknown>;
    delete attrs.ownerQuestionId;
    top[i] = { ...top[i], attrs };
    changed = true;
  }

  // ── 2. adopt unowned Solutions by the question directly above ────────────
  for (let i = 0; i < top.length; i += 1) {
    if (!isSolutionHeading(top[i]) || ownerOf(top[i])) continue;
    let qIdx = -1;
    for (let j = i - 1; j >= 0; j -= 1) {
      if (isQuestionHeading(top[j])) { qIdx = j; break; }
      if (isSolutionHeading(top[j])) break;
    }
    if (qIdx < 0) continue;
    let owner = idOf(top[qIdx]);
    if (!owner) {
      owner = `q_${Math.random().toString(36).slice(2, 10)}`;
      top[qIdx] = { ...top[qIdx], attrs: { ...(top[qIdx].attrs ?? {}), sectionId: owner } };
    }
    const qLevel = level(top[qIdx]);
    const attrs: Record<string, unknown> = { ...(top[i].attrs ?? {}), ownerQuestionId: owner };
    // A Solution sits ONE level below its question — never beside it.
    if (level(top[i]) <= qLevel) attrs.level = Math.min(6, qLevel + 1);
    top[i] = { ...top[i], attrs };
    changed = true;
  }

  // ── 2b. owned Solutions at the same level as their question are demoted ──
  for (let i = 0; i < top.length; i += 1) {
    const owner = isSolutionHeading(top[i]) ? ownerOf(top[i]) : null;
    if (!owner) continue;
    const q = questionIndexById(top, owner);
    if (q < 0) continue;
    const qLevel = level(top[q]);
    if (level(top[i]) <= qLevel) {
      top[i] = { ...top[i], attrs: { ...(top[i].attrs ?? {}), level: Math.min(6, qLevel + 1) } };
      changed = true;
    }
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
