// Split a long pasted test / script into segments the AI can process one at a
// time. A single huge paste makes the notebook-ai request so long that the
// connection drops; a segment holds at most the model's "strength limit" of
// questions and ALWAYS ends on a complete question — never mid-question.
//
// Units:
//   - A QUESTION starts at a labelled line ("Question 3", "Exercise 4", "Q5.")
//     or a numbered line ("3.", "3)", "(3)") that continues the numbering.
//     Everything after it (sub-parts, working, "Solution", answers) belongs to
//     it until the next question starts.
//   - A PARAGRAPH is a group of questions: a short heading-like paragraph just
//     before a question ("Section B", "## Intermediate Practice") opens a new
//     group, travels with that group's first question, and numbering may
//     restart at 1 inside it.
//   - Text before the first question (title, instructions) rides with
//     segment 1.
//   - A paste with no recognisable questions falls back to blank-line
//     paragraphs as the unit, so it still splits on whole paragraphs.
//
// Pure TS, no React — unit tested in __tests__/splitTestSegments.test.ts.

/**
 * The model's strength limit: how many whole questions one AI Edit request
 * handles reliably before the notebook-ai connection risks dropping. No
 * capacity constant existed in the codebase, so this is the single source of
 * truth; AiEditPanel accepts `questionsPerSegment` to override it.
 */
export const DEFAULT_QUESTIONS_PER_SEGMENT = 10;

/**
 * Soft character ceiling per segment. A segment stops early (still on a whole
 * question) once adding the next question would pass this; a single question
 * longer than this still becomes its own segment, never cut.
 */
export const DEFAULT_MAX_SEGMENT_CHARS = 6000;

export interface TestSegment {
  /** 0-based segment index. */
  index: number;
  /** Exact source text of this segment (whole questions only). */
  text: string;
  /** Number of question units in the segment. */
  questionCount: number;
  /** 1-based ordinal of the first / last question across the whole test. */
  firstQuestion: number;
  lastQuestion: number;
}

export interface SplitOptions {
  questionsPerSegment?: number;
  maxChars?: number;
}

const LABELLED_QUESTION =
  /^(?:example|exercise|classwork|class work|homework|home work|assessment|assignment|question|problem|task|activity|practice|q)\s*(?:no\.?\s*)?(\d{1,3})\b\s*[.):\-–—]?/i;
const NUMBERED_QUESTION = /^(?:\((\d{1,3})\)|(\d{1,3})\s*[.)])(?:\s+\S|$)/;
const GROUP_HEADING =
  /^(?:#{1,6}\s+\S|(?:section|part|paper|tier|level|beginner|intermediate|expert|advanced|foundation|higher)\b)/i;

/** Strip markdown emphasis / heading marks that wrap a question label. */
const bare = (line: string): string =>
  line
    .trim()
    .replace(/^#{1,6}\s+/, "")
    .replace(/^[*_]+/, "")
    .replace(/[*_]+(?=\s|$)/, "")
    .trim();

/** Does this line start a question? Returns its number, or null. */
export function questionNumberAt(
  line: string,
): { n: number; labelled: boolean } | null {
  const t = bare(line);
  if (!t) return null;
  let m = t.match(LABELLED_QUESTION);
  if (m) return { n: Number(m[1]), labelled: true };
  m = t.match(NUMBERED_QUESTION);
  if (m) return { n: Number(m[1] ?? m[2]), labelled: false };
  return null;
}

const isBlank = (l: string) => !l.trim();

/** A short heading-like paragraph that names a group of questions. */
function isGroupHeading(lines: string[]): boolean {
  if (!lines.length || lines.length > 2) return false;
  return lines.every((l) => {
    const t = l.trim();
    if (t.length > 80 || /[=]/.test(t)) return false;
    if (GROUP_HEADING.test(t)) return true;
    if (/\d/.test(t)) return false;
    const letters = t.replace(/[^A-Za-z]/g, "");
    return letters.length >= 3 && letters === letters.toUpperCase();
  });
}

const SOLUTION_LINE =
  /^(?:worked\s+)?(?:solutions?|answers?|workings?|steps?|method)\b(?:\s+\d{1,3})?\s*[:.]?/i;

/** Line indices where each question starts (ignoring sub-numbering). */
export function findQuestionStarts(lines: string[]): number[] {
  // A test that labels its questions ("Question 3", "Q3") uses ONLY those
  // labels as boundaries; bare "1." lines are then working steps or parts.
  const labelledOnly = lines.some((l) => questionNumberAt(l)?.labelled);
  const starts: number[] = [];
  let last = 0;
  // Numbered steps under "Solution" / "Answer" stay with their question
  // until a blank line closes that working.
  let inWorking = false;
  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i];
    if (isBlank(line)) {
      inWorking = false;
      continue;
    }
    const q = questionNumberAt(line);
    if (!q) {
      if (SOLUTION_LINE.test(bare(line))) inWorking = true;
      continue;
    }
    if (labelledOnly && !q.labelled) continue;
    if (!q.labelled && inWorking) continue;
    const prevBlank = i === 0 || isBlank(lines[i - 1]);
    const prevHeading = i > 0 && GROUP_HEADING.test(lines[i - 1].trim());
    const accept =
      q.labelled ||
      starts.length === 0 ||
      q.n === last + 1 ||
      // A new paragraph group may restart its numbering.
      (q.n === 1 && (prevBlank || prevHeading));
    if (!accept) continue;
    starts.push(i);
    last = q.n;
    inWorking = false;
  }
  return starts;
}

/** Move a group heading paragraph that ends one unit onto the next unit. */
function pullGroupHeadings(lines: string[], starts: number[]): number[] {
  return starts.map((s, k) => {
    if (k === 0) return s;
    let j = s - 1;
    while (j > starts[k - 1] && isBlank(lines[j])) j -= 1;
    let top = j;
    while (top > starts[k - 1] && !isBlank(lines[top - 1])) top -= 1;
    if (top <= starts[k - 1]) return s;
    // The heading paragraph must be separated from the previous question.
    if (!isBlank(lines[top - 1])) return s;
    return isGroupHeading(lines.slice(top, j + 1)) ? top : s;
  });
}

/** Blank-line paragraphs, used when no questions are recognisable. */
function paragraphStarts(lines: string[]): number[] {
  const starts: number[] = [];
  for (let i = 0; i < lines.length; i += 1) {
    if (!isBlank(lines[i]) && (i === 0 || isBlank(lines[i - 1])))
      starts.push(i);
  }
  return starts;
}

interface UnitRange {
  from: number;
  to: number;
}

/** Whole-question line ranges [from, to) — preamble joins the first. */
function questionUnitRanges(lines: string[]): UnitRange[] {
  let starts = findQuestionStarts(lines);
  if (!starts.length) starts = paragraphStarts(lines);
  if (!starts.length) return [];
  starts = pullGroupHeadings(lines, starts);
  starts[0] = 0;
  return starts
    .map((from, k) => ({
      from,
      to: k + 1 < starts.length ? starts[k + 1] : lines.length,
    }))
    .filter((r) => lines.slice(r.from, r.to).some((l) => !isBlank(l)));
}

const toLines = (text: string) =>
  String(text ?? "")
    .replace(/\r\n?/g, "\n")
    .split("\n");

/** Split the paste into whole-question units (preamble joins the first). */
export function splitIntoQuestionUnits(text: string): string[] {
  const lines = toLines(text);
  return questionUnitRanges(lines).map((r) =>
    lines.slice(r.from, r.to).join("\n").trim(),
  );
}

/**
 * Pack whole questions into segments of at most `questionsPerSegment`
 * questions (and roughly `maxChars`). With a limit of 10, question 10 ends
 * segment 1 and question 11 starts segment 2. Segment text is the exact
 * source slice, so the teacher's layout is kept.
 */
export function splitTestSegments(
  text: string,
  opts: SplitOptions = {},
): TestSegment[] {
  const perSeg = Math.max(
    1,
    Math.floor(opts.questionsPerSegment ?? DEFAULT_QUESTIONS_PER_SEGMENT),
  );
  const maxChars = Math.max(1, opts.maxChars ?? DEFAULT_MAX_SEGMENT_CHARS);
  const lines = toLines(text);
  const units = questionUnitRanges(lines);
  const segments: TestSegment[] = [];
  let cur: UnitRange[] = [];
  let curChars = 0;
  let first = 1;
  const flush = () => {
    if (!cur.length) return;
    segments.push({
      index: segments.length,
      text: lines
        .slice(cur[0].from, cur[cur.length - 1].to)
        .join("\n")
        .trim(),
      questionCount: cur.length,
      firstQuestion: first,
      lastQuestion: first + cur.length - 1,
    });
    first += cur.length;
    cur = [];
    curChars = 0;
  };
  for (const unit of units) {
    const size = lines.slice(unit.from, unit.to).join("\n").length;
    if (cur.length && (cur.length >= perSeg || curChars + size > maxChars))
      flush();
    cur.push(unit);
    curChars += size + 1;
  }
  flush();
  return segments;
}

/** Where a segment sits in the whole test — what AI Edit sends with each run. */
export interface SegmentPosition {
  index: number;
  total: number;
  firstQuestion: number;
  lastQuestion: number;
}

/** One short line telling the model which slice of the test this is. */
export function segmentNote(pos: SegmentPosition): string {
  return `Segment ${pos.index + 1} of ${pos.total} of a longer test (questions ${pos.firstQuestion}–${pos.lastQuestion}). Output only these questions; no introduction, summary, or earlier segments.`;
}

/** Short per-segment instruction: the base instruction plus position, nothing else. */
export function segmentInstruction(base: string, pos: SegmentPosition): string {
  const ask = String(base ?? "").trim();
  return ask ? `${ask}\n${segmentNote(pos)}` : segmentNote(pos);
}

const norm = (s: string) =>
  String(s ?? "")
    .replace(/\s+/g, " ")
    .trim();

/**
 * Remove an echo of the teacher's own script from a proposal. Returns the
 * proposal without a verbatim leading copy of the source; returns "" when the
 * proposal is nothing but the source echoed back.
 */
export function stripEchoedSource(source: string, proposed: string): string {
  const src = norm(source);
  const out = String(proposed ?? "");
  if (!src || src.length < 20) return out;
  const flat = norm(out);
  if (flat === src) return "";
  if (!flat.startsWith(src)) return out;
  // Drop the leading echo line by line so the remaining layout is kept.
  const lines = out.split("\n");
  let consumed = "";
  for (let i = 0; i < lines.length; i += 1) {
    consumed = norm(`${consumed} ${lines[i]}`);
    if (consumed === src)
      return lines
        .slice(i + 1)
        .join("\n")
        .replace(/^\s*\n/, "")
        .trim();
    if (!src.startsWith(consumed)) break;
  }
  return out;
}
