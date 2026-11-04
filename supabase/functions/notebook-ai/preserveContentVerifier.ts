// Preserve-content check: the arranged note must still contain the paste's
// problems, numbers, and methods. It does not demand fuller solutions.
// Pure TS (no Deno imports) so vitest can import it.

const SOLUTION_LINE = /^(?:worked\s+)?solutions?\b/i;
const LABELED = /^(example|exercise|classwork|class work|homework|home work|assessment|question|problem|q)\s*(?:no\.?\s*)?(\d{1,3})\b/i;
const NUMBERED = /^(\d{1,3})[.)]\s+\S/;
const STRUCTURAL = /^(introduction|objectives|explanation|example|exercise|classwork|class work|homework|home work|assessment|summary|solution|canvas)\b/i;

const METHODS: Array<[string, RegExp]> = [
  ["quadratic formula", /quadratic formula|\\frac\{-b\s*\\pm|-b\s*±|b\^?\{?2\}?\s*-\s*4ac/i],
  ["completing the square", /complet(e|ing) the square/i],
  ["factorisation", /factori[sz]/i],
  ["substitution", /substitut/i],
  ["elimination", /eliminat/i],
];

function normalizeLine(raw: string): string {
  return raw
    .trim()
    .replace(/^#{1,6}\s*/, "")
    .replace(/[*_`]/g, "")
    .trim();
}

function familyOf(word: string): string {
  const w = word.toLowerCase().replace(/\s+/g, "");
  if (w === "q" || w === "problem" || w === "question") return "item";
  return w;
}

function pushKey(keys: string[], seen: Set<string>, key: string) {
  if (seen.has(key)) return;
  seen.add(key);
  keys.push(key);
}

/** Labeled problems win. Bare "1." lines count only when the paste has no labels,
 *  so working steps numbered inside a solution are not extra problems. */
export function preserveItemKeys(text: string): string[] {
  const labeled: string[] = [];
  const numbered: string[] = [];
  const seenLabeled = new Set<string>();
  const seenNumbered = new Set<string>();
  for (const raw of String(text ?? "").split("\n")) {
    const line = normalizeLine(raw);
    if (!line || SOLUTION_LINE.test(line)) continue;
    const named = line.match(LABELED);
    if (named) {
      pushKey(labeled, seenLabeled, `${familyOf(named[1])}:${named[2]}`);
      continue;
    }
    const n = line.match(NUMBERED);
    if (n) pushKey(numbered, seenNumbered, `item:${n[1]}`);
  }
  return labeled.length ? labeled : numbered;
}

export function hasSessionLabels(text: string): boolean {
  return String(text ?? "").split("\n").some((raw) => STRUCTURAL.test(normalizeLine(raw)));
}

const numbersOf = (s: string) => (s.match(/-?\d+(?:\.\d+)?/g) ?? []).filter((x) => x !== "0");

/** Defects are instructions for one faithful retry. Empty means the draft kept the paste. */
export function verifyPreserveContent(source: string, output: string): string[] {
  const defects: string[] = [];
  const src = preserveItemKeys(source);
  const out = preserveItemKeys(output);

  if (src.length > 0 && !hasSessionLabels(output)) {
    defects.push("The output is not in lesson-note sessions. Put each problem on its own label line (Example N, Exercise N, Classwork N, Homework N, or Assessment N) and put each existing solution under Solution N. Do not change the words.");
  }
  if (src.length === 0 && out.length > 0) {
    defects.push(`The paste has no numbered problems but the output added ${out.length}. Do not add problems.`);
  } else if (src.length > 0 && out.length < src.length) {
    defects.push(`The paste has ${src.length} problems but the output has ${out.length}. Restore every original problem. Do not drop any.`);
  } else if (src.length > 0 && out.length > src.length) {
    defects.push(`The paste has ${src.length} problems but the output has ${out.length}. Remove every problem that was not in the paste. Do not invent problems.`);
  }

  const outNums = new Set(numbersOf(output));
  const missing = [...new Set(numbersOf(source))].filter((x) => !outNums.has(x));
  if (missing.length > 0 && missing.length >= Math.max(2, numbersOf(source).length * 0.25)) {
    defects.push(`Numbers from the pasted material are missing: ${missing.slice(0, 8).join(", ")}. Keep the teacher's numbers exactly.`);
  }

  for (const [name, re] of METHODS) {
    if (re.test(source) && !re.test(output)) {
      defects.push(`The paste uses ${name}. Keep that method — do not replace it.`);
    }
  }
  return defects;
}

export function preserveContentCorrection(defects: string[]): string {
  return `PRESERVE CHECK FAILED — the draft changed the teacher's content. Fix only the points below.
Keep every question and solution as written. Do not upgrade difficulty, do not standardise wording, do not add problems, do not remove problems, and do not write a solution that was not in the paste.
Still arrange each existing problem into lesson-note sessions (a label line such as Exercise N, then the original question; Solution N, then the original working, only when that working was in the paste).
${defects.map((d) => `- ${d}`).join("\n")}
Return the full corrected note and nothing else.`;
}
