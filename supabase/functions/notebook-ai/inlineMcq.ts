/** Supplied MCQ content only. Never infer, solve, or replace an answer.
 *
 * This file is the single definition of a supplied multiple-choice question.
 * The parser, the arrangers, and MIXED_MCQ_GUIDANCE all read MCQ_RULE.
 * Do not describe a form here that the parser rejects, or accept a form the
 * prompt does not mention.
 */

export interface InlineMcq {
  text: string;
  options: { label: string; text: string }[];
  answer: string;
  /** Trailing Explanation / Reason / Working. Not part of the question body. */
  explanation?: string;
}

export const MCQ_RULE = {
  minOptions: 2,
  maxOptions: 6,
  letters: "ABCDEF",
  optionStyles: ["A.", "A)", "(A)", "A:", "A -", "a.", "(a)"],
  answerStyles: [
    "Correct Answer: B",
    "Answer: B",
    "Correct Answer: B. 7",
    "Correct Answer: B) x",
    "Correct option is B",
    "Correct Answer: True",
  ],
  trailingBlocks: ["Explanation", "Reason", "Working"],
  /** Kept verbatim inside the question. They are not session headings. */
  variantLabels: ["V1", "V1. Beginner/JSS:", "Intermediate/SSS:"],
} as const;

const LETTER = `[${MCQ_RULE.letters}]`;
const TRAIL = MCQ_RULE.trailingBlocks.join("|");

/** One sentence shared by the prompt, the structure retry, and the parser. */
export const MCQ_STRUCTURE_CLAUSE =
  `A stem, ${MCQ_RULE.minOptions} to ${MCQ_RULE.maxOptions} options ` +
  `(${MCQ_RULE.optionStyles.join(", ")}; True/False), and one declared answer ` +
  `(${MCQ_RULE.answerStyles.join("; ")}) is a multiple-choice question: no Solution and no Floating Numbers. ` +
  `Move a trailing ${MCQ_RULE.trailingBlocks.join(", ")} block into its own Explanation section; do not delete it and do not treat it as a Solution. ` +
  `Keep variant labels such as ${MCQ_RULE.variantLabels.join(", ")} exactly as written. ` +
  `Each variant with options and a declared answer is its own multiple-choice question; a variant with no options stays a worked question. ` +
  `Never infer or change the declared answer.`;

export const MIXED_MCQ_GUIDANCE =
  "Preserve supplied multiple-choice questions exactly: keep their question, option labels, option values, and declared correct answer. Never infer or change the answer. " +
  MCQ_STRUCTURE_CLAUSE +
  " Classify each question before creating its sessions. Keep Correct Answer in that question body, never under a Solution heading. " +
  "Worked questions elsewhere keep their own solutions. Do not turn MCQs into worked exercises or add interface button words to the content.";

const plainAnswer = (text: string) => text.trim().replace(/^#{1,6}\s+/, "").replace(/\*\*|__/g, "");

const ANSWER_LETTER_RE = new RegExp(
  `^(?:the\\s+)?(?:correct\\s+)?(?:answer|option)\\s*(?::|=|\\bis\\b|[-–—])\\s*(?:option\\s+)?(?:is\\s+)?\\(?(${LETTER})\\)?(?:[.)])?(?:\\s+\\S.*)?\\s*$`,
  "i",
);
const ANSWER_TF_RE = /^(?:the\s+)?(?:correct\s+)?(?:answer|option)\s*(?::|=|\bis\b|[-–—])\s*(?:is\s+)?(true|false)\s*$/i;

/** The declared choice on one answer line, or null. The letter or True/False word is kept; the option echo is ignored. */
export function declaredMcqAnswer(text: string): string | null {
  const plain = plainAnswer(text);
  const letter = plain.match(ANSWER_LETTER_RE);
  if (letter) return letter[1].toUpperCase();
  const tf = plain.match(ANSWER_TF_RE);
  if (tf) return tf[1].toLowerCase() === "true" ? "True" : "False";
  return null;
}

export const isMcqAnswerLabel = (text: string) => declaredMcqAnswer(text) != null;

const OPTION_RE = new RegExp(
  `(?:^|[\\n\\t ])(?:\\((${LETTER})\\)(?=\\s|$)|(${LETTER})\\s*(?:[.):]|[-–—])(?=\\s|$))`,
  "gi",
);
const EXTRA_OPTION_RE = /^(?:\([g-z]\)|[g-z]\s*(?:[.):]|[-–—]))(?:\s|$)/im;

/** A label on its own, or a label plus its sentence. "Working out the steps" is prose, not a label. */
const TRAIL_RE = new RegExp(
  `^(?:(${TRAIL})\\s*[.]?\\s*$|(${TRAIL})\\s*[:\\-–—]\\s*([\\s\\S]*))$`,
  "i",
);

/** Lines after a declared answer that are an explanation, not another question. */
export function explanationTail(lines: string[]): { body: string[] } | null {
  const first = lines.findIndex(l => l.trim());
  if (first < 0) return null;
  const label = lines[first].trim().match(TRAIL_RE);
  if (!label) return null;
  if (lines.some(l => /^(?:question|example|exercise|classwork|homework|assessment)\s+\d+/i.test(l.trim()))) return null;
  if (lines.some(l => /^(?:worked\s+)?solutions?\b/i.test(l.trim()))) return null;
  const body: string[] = [];
  const sentence = (label[3] ?? "").trim();
  if (sentence) body.push(sentence);
  for (const line of lines.slice(first + 1)) {
    if (line.trim()) body.push(line.replace(/[ \t]+$/g, ""));
  }
  return { body };
}

const BARE_VARIANT = /^v(\d{1,2})\s*$/i;
const LABELLED_VARIANT = /^v(\d{1,2})\.\s+\S/i;
const LEVEL_VARIANT = /^(?:beginner|intermediate|expert)(?:\/[A-Za-z0-9-]+)?\s*:/i;

/** A variant label written inside a question, not a tier heading such as "Beginner Practice". */
export function isInlineVariantLabel(line: string): boolean {
  const t = line.trim();
  return BARE_VARIANT.test(t) || LABELLED_VARIANT.test(t) || LEVEL_VARIANT.test(t);
}

/**
 * Split one question body into variants. A bare `V1` and the following
 * `V1. Beginner/JSS:` line stay in the same variant, word for word.
 * Returns null when the body is a single question.
 */
export function splitVariantLines(lines: string[]): string[][] | null {
  const starts: number[] = [];
  const prevNonEmpty = (i: number) => {
    for (let j = i - 1; j >= 0; j--) if (lines[j].trim()) return j;
    return -1;
  };
  for (let i = 0; i < lines.length; i++) {
    const t = lines[i].trim();
    if (!t) continue;
    const bare = BARE_VARIANT.exec(t);
    const labelled = LABELLED_VARIANT.exec(t);
    const level = LEVEL_VARIANT.test(t);
    if (!bare && !labelled && !level) continue;
    if (!bare) {
      const prev = prevNonEmpty(i);
      const prevBare = prev >= 0 ? BARE_VARIANT.exec(lines[prev].trim()) : null;
      const same = !!prevBare && (!labelled || prevBare[1] === labelled[1]);
      if (same && starts.length && starts[starts.length - 1] <= prev) continue;
    }
    starts.push(i);
  }
  if (starts.length < 2) return null;
  const slices: string[][] = [];
  for (let s = 0; s < starts.length; s++) {
    const from = s === 0 ? 0 : starts[s];
    const to = s + 1 < starts.length ? starts[s + 1] : lines.length;
    const slice = lines.slice(from, to);
    if (slice.some(l => l.trim())) slices.push(slice);
  }
  return slices.length >= 2 ? slices : null;
}

/** Drop a trailing explanation from an MCQ, keeping every explanation sentence. */
export function peelMcqExplanation(lines: string[]): { lines: string[]; explanation: string[] } | null {
  const idx = lines.findIndex(l => isMcqAnswerLabel(l));
  if (idx < 0 || idx >= lines.length - 1) return null;
  const tail = explanationTail(lines.slice(idx + 1));
  if (!tail) return null;
  const kept = lines.slice(0, idx + 1);
  if (!parseInlineMcq(kept.join("\n"))) return null;
  return { lines: kept, explanation: tail.body };
}

function cleanStem(stem: string): string | null {
  const text = stem.trim().replace(/^(?:Question|Example|Exercise|Classwork)\s+\d+\s*[:.)]?\s*/i, "");
  if (!text || /(?:^|\n)(?:Question|Example|Exercise)\s+\d+/i.test(text)) return null;
  return text;
}

function optionLabel(match: RegExpMatchArray): string {
  return (match[1] || match[2]).toUpperCase();
}

function letteredOptions(body: string): { text: string; options: { label: string; text: string }[] } | null {
  if (EXTRA_OPTION_RE.test(body)) return null;
  const inline = [...body.matchAll(OPTION_RE)];
  const validLabels = (matches: RegExpMatchArray[]) =>
    matches.length >= MCQ_RULE.minOptions && matches.length <= MCQ_RULE.maxOptions &&
    new Set(matches.map(optionLabel)).size === matches.length;
  // In a multiline question, prose can end in a set name such as "A.".
  // When that produces duplicate markers, try choices that start their own line.
  const rows = inline.filter((match) => {
    const index = match.index!;
    const lineStart = body.lastIndexOf("\n", index - 1) + 1;
    return index === 0 || match[0].startsWith("\n") || /^[ \t]*$/.test(body.slice(lineStart, index + 1));
  });
  const matches = validLabels(inline) ? inline : rows;
  if (!validLabels(matches)) return null;
  const text = cleanStem(body.slice(0, matches[0].index));
  if (!text) return null;
  const options = matches.map((m, i) => ({
    label: optionLabel(m),
    text: body.slice(m.index! + m[0].length, matches[i + 1]?.index ?? body.length).trim(),
  }));
  if (options.some(o => !o.text)) return null;
  return { text, options };
}

function trueFalseOptions(body: string, answer: string): { text: string; options: { label: string; text: string }[] } | null {
  const lines = body.split("\n");
  const marks = lines
    .map((line, index) => ({ index, word: line.trim().toLowerCase() }))
    .filter(row => row.word === "true" || row.word === "false");
  if (marks.length !== 2 || new Set(marks.map(row => row.word)).size !== 2) return null;
  const text = cleanStem(lines.slice(0, marks[0].index).join("\n"));
  if (!text) return null;
  const between = lines.slice(marks[0].index + 1, marks[1].index).some(line => line.trim());
  if (between) return null;
  const options = marks.map(row => {
    const label = row.word === "true" ? "True" : "False";
    return { label, text: lines[row.index].trim() };
  });
  if (!options.some(o => o.label.toLowerCase() === answer.toLowerCase() || o.text.toLowerCase() === answer.toLowerCase())) return null;
  return { text, options };
}

export function parseInlineMcq(source: string): InlineMcq | null {
  const lines = source.replace(/\r/g, "").split("\n").map(s => s.trimEnd()).filter(s => s.trim());
  const answerIndexes = lines.map((line, i) => declaredMcqAnswer(line) ? i : -1).filter(i => i >= 0);
  if (answerIndexes.length !== 1) return null;
  const answerAt = answerIndexes[0];
  const tail = lines.slice(answerAt + 1);
  let explanation: string | undefined;
  if (tail.length) {
    const peeled = explanationTail(tail);
    if (!peeled) return null;
    if (peeled.body.length) explanation = peeled.body.join("\n");
  }
  const declared = declaredMcqAnswer(lines[answerAt])!;
  const body = lines.slice(0, answerAt).join("\n");
  const lettered = letteredOptions(body);
  if (lettered) {
    let answer = declared;
    if (!lettered.options.some(o => o.label === answer)) {
      const byText = lettered.options.filter(o => o.text.trim().toLowerCase() === answer.toLowerCase());
      if (byText.length !== 1) return null;
      // The teacher named the option by its words ("True"). The choice is that option, not a different one.
      answer = byText[0].label;
    }
    return { text: lettered.text, options: lettered.options, answer, ...(explanation ? { explanation } : {}) };
  }
  if (declared !== "True" && declared !== "False") return null;
  const words = trueFalseOptions(body, declared);
  if (!words) return null;
  const answer = words.options.find(o => o.label.toLowerCase() === declared.toLowerCase())?.label ?? declared;
  return { text: words.text, options: words.options, answer, ...(explanation ? { explanation } : {}) };
}
