// Preserve-content check: the arranged note must still contain the paste's
// problems, numbers, solutions, and sentences. It does not demand fuller
// solutions, and it does not accept an invented introduction in their place.
// Pure TS (no Deno imports) so vitest can import it.

const SOLUTION_LINE = /^(?:worked\s+)?solutions?\b/i;
const LABELED = /^(example|exercise|classwork|class work|homework|home work|assessment|question|problem|q)\s*(?:no\.?\s*)?(\d{1,3})\b/i;
const NUMBERED = /^(?:\(\s*)?(\d{1,3})[.)]\s+\S/;
const STRUCTURAL = /^(introduction|objectives|explanation|example|exercise|question|classwork|class work|homework|home work|assessment|summary|solution|canvas)\b/i;
const SOLUTION_LABEL = /^(?:worked\s+)?solutions?(?:\s+\d{1,3})?$/i;
const ANSWER_LABEL = /^(?:answers?|workings?)(?:\s+\d{1,3})?$/i;
const PRACTICE_TIERS = /\b(?:structured\s+)?practice\s+tiers?\b/i;

export const PRESERVE_REFUSAL =
  "Preserve content refused this draft because it dropped pasted problems or replaced them with an introduction. Nothing was inserted.";

function normalizeLine(raw: string): string {
  return raw
    .trim()
    .replace(/^#{1,6}\s*/, "")
    .replace(/^>\s*/, "")
    .replace(/^(?:[-*•]\s+)+/, "")
    .replace(/[*_`]/g, "")
    .trim();
}

/** A tier heading by itself. Restarts 1-based numbering so Beginner 1–12 and
 *  Intermediate 1–12 stay separate problems. "Beginner Practice" is the same
 *  break as "Beginner". */
export function isPracticeTierLine(raw: string): boolean {
  const line = normalizeLine(raw).replace(/[:.#\s]+$/g, "").trim();
  if (!line) return false;
  if (/^(?:beginner|intermediate|expert|foundation|higher|core|extension)(?:\s+(?:level|practice|questions?|tier|section))?$/i.test(line)) {
    return true;
  }
  // "V1. Beginner/JSS" is the same kind of section break as "Beginner Practice".
  if (/^(?:[A-Za-z]{1,3}\d{1,3}\.\s+)?(?:beginner|intermediate|expert)(?:\/[A-Za-z0-9-]+)?$/i.test(line)) {
    return true;
  }
  return /^(?:level|tier|part|section)\s+\d{1,3}$/i.test(line);
}

function familyOf(word: string): string {
  const w = word.toLowerCase().replace(/\s+/g, "");
  if (w === "q" || w === "problem" || w === "question") return "item";
  return w;
}

export function isSolutionLabel(line: string): boolean {
  const t = normalizeLine(line).replace(/[:.#\s]+$/g, "").trim();
  return SOLUTION_LABEL.test(t) || ANSWER_LABEL.test(t);
}

function pushCounted(keys: string[], key: string) {
  keys.push(`${key}#${keys.length}`);
}

/** Labeled problems win, and each occurrence counts — restarted "Question 1"
 *  under the next tier is another problem. Bare "1." lines count only when
 *  the paste has no labels, so working steps numbered inside a solution are
 *  not extra problems. Within one tier, a repeated bare number is still one
 *  item (the question, not the step that reuses its number). */
export function preserveItemKeys(text: string): string[] {
  const labeled: string[] = [];
  const numbered: string[] = [];
  let seenNumbered = new Set<string>();
  for (const raw of String(text ?? "").split("\n")) {
    const line = normalizeLine(raw);
    if (!line || SOLUTION_LINE.test(line) || isSolutionLabel(line)) continue;
    if (isPracticeTierLine(line)) {
      seenNumbered = new Set();
      continue;
    }
    const named = line.match(LABELED);
    if (named) {
      pushCounted(labeled, `${familyOf(named[1])}:${named[2]}`);
      continue;
    }
    const n = line.match(NUMBERED);
    if (!n || seenNumbered.has(n[1])) continue;
    seenNumbered.add(n[1]);
    pushCounted(numbered, `item:${n[1]}`);
  }
  return labeled.length ? labeled : numbered;
}

export function solutionMarkerCount(text: string): number {
  let n = 0;
  for (const raw of String(text ?? "").split("\n")) {
    if (isSolutionLabel(raw)) n += 1;
  }
  return n;
}

export function hasSessionLabels(text: string): boolean {
  return String(text ?? "").split("\n").some((raw) => STRUCTURAL.test(normalizeLine(raw)));
}

const numbersOf = (s: string) => (s.match(/-?\d+(?:\.\d+)?/g) ?? []).filter((x) => x !== "0");

/** A glued paste power such as 25 may be restored as 2^{5}. That is notation
 *  repair, not a missing number. A number that simply disappeared still fails. */
function numberSurvives(token: string, output: string, outNums: Set<string>): boolean {
  if (outNums.has(token)) return true;
  if (!/^\d{2,4}$/.test(token)) return false;
  for (let i = 1; i < token.length; i += 1) {
    const base = String(Number(token.slice(0, i)));
    const expRaw = token.slice(i);
    const exp = String(Number(expRaw));
    if (
      output.includes(`${base}^{${exp}}`) ||
      output.includes(`${base}^${exp}`) ||
      output.includes(`${base}^{${expRaw}}`) ||
      output.includes(`${base}^${expRaw}`)
    ) return true;
  }
  return false;
}

const METHODS: Array<[string, RegExp]> = [
  ["quadratic formula", /quadratic formula|\\frac\{-b\s*\\pm|-b\s*±|b\^?\{?2\}?\s*-\s*4ac/i],
  ["completing the square", /complet(e|ing) the square/i],
  ["factorisation", /factori[sz]/i],
  ["substitution", /substitut/i],
  ["elimination", /eliminat/i],
];

function significantWords(raw: string): string[] {
  return raw
    .toLowerCase()
    .replace(/\\[a-z]+/gi, " ")
    .replace(/[^a-z\s]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length >= 4);
}

function stemWords(line: string): string[] {
  const stripped = line
    .replace(/^(?:example|exercise|classwork|class work|homework|home work|assessment|question|problem|q)\s*(?:no\.?\s*)?\d{1,3}\b[:.)\s-]*/i, "")
    .replace(/^\(?\s*\d{1,3}[.)]\s+/, "");
  return significantWords(stripped);
}

/** Sentences the paste actually teaches. Labels and bare answers are not sentences. */
export function preserveAnchorLines(text: string): string[][] {
  const anchors: string[][] = [];
  for (const raw of String(text ?? "").split("\n")) {
    const line = normalizeLine(raw);
    if (!line || isSolutionLabel(line)) continue;
    if (/^(introduction|objectives|explanation|summary|canvas)\b/i.test(line) && stemWords(line).length === 0) continue;
    const words = stemWords(line);
    if (words.length) anchors.push(words);
  }
  return anchors;
}

function wordSet(text: string): Set<string> {
  const set = new Set<string>();
  for (const raw of String(text ?? "").split("\n")) {
    for (const w of significantWords(normalizeLine(raw))) set.add(w);
  }
  return set;
}

function lineKept(words: string[], hay: Set<string>): boolean {
  if (!words.length) return true;
  const hit = words.filter((w) => hay.has(w)).length;
  return hit / words.length >= 0.67;
}

function inventedSentences(source: string, output: string): string[] {
  const hay = wordSet(source);
  const invented: string[] = [];
  for (const raw of String(output ?? "").split("\n")) {
    const line = normalizeLine(raw);
    if (!line || isSolutionLabel(line) || isPracticeTierLine(line)) continue;
    // A number-line or table object is structure, not a sentence the teacher wrote.
    if (/^\[\[tool:[^\]]+\]\]$/.test(line)) continue;
    if (STRUCTURAL.test(line) || LABELED.test(line)) continue;
    const words = significantWords(line);
    if (words.length < 2) continue;
    const hit = words.filter((w) => hay.has(w)).length;
    if (hit / words.length < 0.5) invented.push(line);
  }
  return invented;
}

export function isIntroOnlyShell(output: string): boolean {
  const lines = String(output ?? "").split("\n").map(normalizeLine).filter(Boolean);
  const framed = lines.some((l) => /^(introduction|explanation)\b/i.test(l));
  if (!framed) return false;
  return preserveItemKeys(output).length === 0 && solutionMarkerCount(output) === 0;
}

export function isProblemRich(source: string): boolean {
  return preserveItemKeys(source).length >= 3 || solutionMarkerCount(source) >= 3;
}

/** A draft that threw away a problem-rich paste. Warnings are not enough:
 *  this result must not be inserted. */
export function preserveContentCollapsed(source: string, output: string): boolean {
  const src = preserveItemKeys(source);
  const out = preserveItemKeys(output);
  if (src.length >= 3 && out.length * 2 < src.length) return true;
  const srcSol = solutionMarkerCount(source);
  const outSol = solutionMarkerCount(output);
  if (srcSol >= 3 && outSol * 2 < srcSol) return true;
  if (isProblemRich(source) && isIntroOnlyShell(output)) return true;
  const anchors = preserveAnchorLines(source);
  if (anchors.length >= 6) {
    const hay = wordSet(output);
    const kept = anchors.filter((w) => lineKept(w, hay)).length;
    if (kept * 2 < anchors.length) return true;
  }
  const srcLen = source.trim().length;
  const outLen = output.trim().length;
  if (srcLen >= 800 && src.length >= 3 && outLen * 2 < srcLen) return true;
  return false;
}

/** Defects are instructions for one faithful retry. Empty means the draft kept the paste. */
export function verifyPreserveContent(source: string, output: string): string[] {
  const defects: string[] = [];
  const src = preserveItemKeys(source);
  const out = preserveItemKeys(output);

  if (src.length > 0 && !hasSessionLabels(output)) {
    defects.push("The output is not in lesson-note sessions. Start with a bold session line, put each problem on its own bold label line (**Question N**, **Example N**, **Exercise N**, **Classwork N**, **Homework N**, or **Assessment N**) and put each existing solution under Solution N, after its question. Do not change the words.");
  }
  if (src.length === 0 && out.length > 0) {
    defects.push(`The paste has no numbered problems but the output added ${out.length}. Do not add problems.`);
  } else if (src.length > 0 && out.length < src.length) {
    defects.push(`The paste has ${src.length} problems but the output has ${out.length}. Restore every original problem. Do not drop any.`);
  } else if (src.length > 0 && out.length > src.length) {
    defects.push(`The paste has ${src.length} problems but the output has ${out.length}. Remove every problem that was not in the paste. Do not invent problems.`);
  }

  const srcSol = solutionMarkerCount(source);
  const outSol = solutionMarkerCount(output);
  if (srcSol > 0 && outSol < srcSol) {
    defects.push(`The paste has ${srcSol} solutions but the output has ${outSol}. Restore every solution that was in the paste. Do not drop solutions and do not replace them with an explanation.`);
  }

  const outNums = new Set(numbersOf(output));
  const missing = [...new Set(numbersOf(source))].filter((x) => !numberSurvives(x, output, outNums));
  if (missing.length > 0 && missing.length >= Math.max(2, numbersOf(source).length * 0.25)) {
    defects.push(`Numbers from the pasted material are missing: ${missing.slice(0, 8).join(", ")}. Keep the teacher's numbers exactly.`);
  }

  for (const [name, re] of METHODS) {
    if (re.test(source) && !re.test(output)) {
      defects.push(`The paste uses ${name}. Keep that method — do not replace it.`);
    }
  }

  if (isProblemRich(source) && isIntroOnlyShell(output)) {
    defects.push("The output is an introduction-only shell. It dropped the pasted problems and solutions and invented lesson prose. Delete the introduction and explanation. Restore every problem and every solution from the paste, in order. Do not summarise. Do not invent practice tiers.");
  }

  if (PRACTICE_TIERS.test(output) && !PRACTICE_TIERS.test(source)) {
    defects.push("The output invented practice tiers that are not in the paste. Do not summarise the problems into tiers. Restore every problem and solution.");
  }

  const invented = inventedSentences(source, output);
  const longInvented = invented.filter((line) => significantWords(line).length >= 5);
  if (longInvented.length >= 1 || invented.length >= 2) {
    defects.push("The output added sentences that are not in the paste. Do not invent an introduction, explanation, or summary. Delete every sentence the teacher did not write.");
  }

  const anchors = preserveAnchorLines(source);
  if (anchors.length >= 4) {
    const hay = wordSet(output);
    const kept = anchors.filter((w) => lineKept(w, hay)).length;
    if (kept / anchors.length < 0.8) {
      defects.push(`The output dropped the teacher's sentences (${kept} of ${anchors.length} kept). Keep every problem and every solution. Do not summarise and do not replace them with an introduction or explanation.`);
    }
  }

  const srcLen = source.trim().length;
  if (srcLen >= 800 && output.trim().length < srcLen * 0.45 && src.length >= 3) {
    defects.push("The output is far shorter than the paste. Do not summarise. Restore every sentence, problem, and solution.");
  }

  return defects;
}

export interface PreserveAttempt {
  content: string;
  defects: string[];
}

/** One retry when the first draft fails. Prefer whichever draft has fewer
 *  defects. A draft that still collapses a problem-rich paste is refused —
 *  it must not be inserted, even if it was the better of two bad drafts. */
export function selectPreserveDraft(
  source: string,
  first: PreserveAttempt,
  retry: PreserveAttempt | null,
): { content: string; defects: string[]; rejected: boolean } {
  let chosen = first;
  if (first.defects.length > 0 && retry && retry.defects.length <= first.defects.length) {
    chosen = retry;
  }
  const rejected = preserveContentCollapsed(source, chosen.content);
  return {
    content: rejected ? "" : chosen.content,
    defects: chosen.defects,
    rejected,
  };
}

export function preserveRefusalMessage(defects: string[]): string {
  const detail = defects[0]?.trim();
  if (!detail) return PRESERVE_REFUSAL;
  const clip = detail.length > 280 ? `${detail.slice(0, 277)}...` : detail;
  return `${PRESERVE_REFUSAL} ${clip}`;
}

export function preserveContentCorrection(defects: string[]): string {
  return `PRESERVE CHECK FAILED — the draft changed the teacher's content. Fix only the points below.
Keep every question and solution as written. Do not upgrade difficulty, do not standardise wording, do not add problems, do not remove problems, and do not write a solution that was not in the paste.
Do not summarise the paste. Do not invent an introduction, explanation, or summary. Do not replace problems and solutions with textbook prose or practice tiers.
If the draft is only an introduction, delete it and put every original problem and every original solution back.
Still arrange each existing problem into lesson-note sessions. Start with a bold session line (the paste's own heading, or **Introduction** / **Question 1** when it has none). Each problem: its bold label line such as **Question N** or **Exercise N**, then the original question; then Solution N with the original working, only when that working was in the paste. Never a solution before its question, and never the question repeated inside its solution.
${defects.map((d) => `- ${d}`).join("\n")}
Return the full corrected note and nothing else.`;
}
