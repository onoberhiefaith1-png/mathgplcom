// Deterministic Preserve arrangement.
//
// A long paste that already has Question / Solution markers and tier headings
// (Beginner Practice, Intermediate Practice, Expert Practice) was being sent to
// the model, which replaced all 36 items with an introduction. The verifier
// then refused that shell, so the teacher still never received the note.
// When the markers are already clear, arrange them here and do not call the model.
// The result goes through sessionArrange.ts, so it starts with a bold session
// ("**Beginner Practice**"), keeps the paste's own label ("**Question 1**"),
// and puts each Solution N directly under its question.
// Pure TS (no Deno imports) so vitest can import it. Generate does not use this.

import { isPracticeTierLine } from "./preserveContentVerifier.ts";
import { parseInlineMcq } from "./inlineMcq.ts";
import { prepareLessonImport, repairLessonNotation } from "./lessonImportNormalise.ts";
import { arrangeLessonSessions, parseSessionBlocks } from "./sessionArrange.ts";

const QUESTION_START =
  /^(example|exercise|classwork|class work|homework|home work|assessment|question|problem|q)\s*(?:no\.?\s*)?([A-Za-z]{0,4})(\d{1,3})\b\s*[.):\-–—]?\s*(.*)$/i;

const SOLUTION_BARE = /^(?:worked\s+)?solutions?(?:\s+(\d{1,3}))?\s*$/i;
const SOLUTION_COLON = /^(?:worked\s+)?solutions?(?:\s+(\d{1,3}))?\s*:\s*(.*)$/i;
const ANSWER_BARE = /^(?:answers?|workings?)(?:\s+(\d{1,3}))?\s*$/i;
const ANSWER_COLON = /^(?:answers?|workings?)(?:\s+(\d{1,3}))?\s*:\s*(.*)$/i;

function canonicalActivity(word: string): string {
  const w = word.toLowerCase().replace(/\s+/g, "");
  if (w === "example") return "Example";
  if (w === "classwork") return "Classwork";
  if (w === "homework") return "Homework";
  if (w === "assessment") return "Assessment";
  if (w === "exercise") return "Exercise";
  // The teacher's own word is the session name: **Question 1** stays Question.
  return "Question";
}

/** A bold / markdown session heading ("**Question 1**", "## Solution") is the same label. */
const unbold = (line: string) =>
  line.trim().replace(/^#{1,6}\s+/, "").replace(/^(\*\*|__)(.+?)\1\s*([:.]?)$/, "$2$3").trim();

function matchQuestion(line: string): { activity: string; n: number; label: string; rest: string } | null {
  const m = unbold(line).match(QUESTION_START);
  if (!m) return null;
  const n = Number(m[3]);
  if (!Number.isInteger(n) || n < 1) return null;
  const activity = canonicalActivity(m[1]);
  const prefix = m[2] ?? "";
  return { activity, n, label: `${activity} ${prefix}${n}`, rest: (m[4] ?? "").trim() };
}

function matchSolution(line: string): { n: number | null; rest: string } | null {
  const t = unbold(line);
  let m = t.match(SOLUTION_BARE);
  if (m) return { n: m[1] ? Number(m[1]) : null, rest: "" };
  m = t.match(SOLUTION_COLON);
  if (m) return { n: m[1] ? Number(m[1]) : null, rest: (m[2] ?? "").trim() };
  m = t.match(ANSWER_BARE);
  if (m) return { n: m[1] ? Number(m[1]) : null, rest: "" };
  m = t.match(ANSWER_COLON);
  if (m) return { n: m[1] ? Number(m[1]) : null, rest: (m[2] ?? "").trim() };
  return null;
}

/** Copy-paste damage only: flattened delimiters, boxed answers, operator macros.
 *  Sentences and values stay as the teacher wrote them. */
export function repairPreserveNotation(text: string): string {
  return repairLessonNotation(text);
}

type QuestionBlock = { activity: string; n: number; label: string; lines: string[] };
type SolutionBlock = { n: number; lines: string[] };
type Block =
  | { kind: "prose"; lines: string[] }
  | { kind: "tier"; line: string }
  | { kind: "pair"; q: QuestionBlock; s: SolutionBlock };

function tidy(lines: string[]): string[] {
  let start = 0;
  let end = lines.length;
  while (start < end && !lines[start].trim()) start += 1;
  while (end > start && !lines[end - 1].trim()) end -= 1;
  return lines.slice(start, end);
}

/** A closing remark after the last solution is the teacher's sentence, not more working. */
function peelClosing(lines: string[]): { body: string[]; closing: string[] } {
  let end = lines.length;
  while (end > 0 && !lines[end - 1].trim()) end -= 1;
  if (end === 0) return { body: lines, closing: [] };
  let start = end;
  while (start > 0 && lines[start - 1].trim()) start -= 1;
  let before = start;
  while (before > 0 && !lines[before - 1].trim()) before -= 1;
  if (before === 0) return { body: lines, closing: [] };
  const paragraph = lines.slice(start, end).map((l) => l.trim()).filter(Boolean).join(" ");
  const words = paragraph.split(/\s+/).filter((w) => /[A-Za-z]/.test(w));
  if (words.length < 12) return { body: lines, closing: [] };
  if (/[=^\\×÷≤≥≠√]/.test(paragraph)) return { body: lines, closing: [] };
  return { body: lines.slice(0, start), closing: lines.slice(start) };
}

function render(blocks: Block[]): string {
  const out: string[] = [];
  const push = (lines: string[]) => {
    const body = tidy(lines);
    if (!body.length) return;
    if (out.length) out.push("");
    out.push(...body);
  };
  for (const block of blocks) {
    if (block.kind === "prose") push(block.lines);
    else if (block.kind === "tier") push([block.line]);
    else {
      push([block.q.label, ...block.q.lines]);
      push([`Solution ${block.s.n}`, ...block.s.lines]);
    }
  }
  return out.join("\n").replace(/\n{3,}/g, "\n\n").trim();
}

/**
 * Arrange a paste that already labels every item as Question N / Solution
 * (optionally under tier headings) into lesson-note sessions.
 * Returns null when the markers are not clear enough to pair without guessing.
 * Null keeps the model path for ordinary pastes.
 */
export function arrangePreservePaste(source: string): string | null {
  const text = prepareLessonImport(source);
  if (!text.trim()) return null;
  // A complete mixed lesson is already explicit data. Keep declared MCQ
  // answers with their options and preserve worked solutions without a model.
  const arrangedMixed = arrangeLessonSessions(text);
  const mixed = parseSessionBlocks(arrangedMixed);
  const questionBlocks = mixed.filter(b => b.marker?.kind === "question");
  if (questionBlocks.some(b => parseInlineMcq(b.lines.join("\n"))) &&
    questionBlocks.every(b => {
      if (parseInlineMcq(b.lines.join("\n"))) return true;
      const next = mixed[mixed.indexOf(b) + 1];
      return next?.marker?.kind === "solution" && next.lines.some(line => line.trim()) &&
        (next.marker.n == null || b.marker?.n == null || next.marker.n === b.marker.n);
    })) return arrangedMixed;
  const lines = text.split("\n");

  const blocks: Block[] = [];
  let prose: string[] = [];
  let question: QuestionBlock | null = null;
  let solution: SolutionBlock | null = null;
  let mode: "prose" | "q" | "s" = "prose";
  let questions = 0;
  let solutions = 0;

  const flushProse = () => {
    if (prose.some((l) => l.trim())) blocks.push({ kind: "prose", lines: prose });
    prose = [];
  };
  const flushPair = () => {
    if (!question || !solution) return;
    blocks.push({ kind: "pair", q: question, s: solution });
    question = null;
    solution = null;
    mode = "prose";
  };

  for (const raw of lines) {
    const trimmed = raw.trim();
    const kept = raw.replace(/[ \t]+$/g, "");
    if (trimmed && isPracticeTierLine(trimmed)) {
      if (mode === "q") return null;
      if (mode === "s") flushPair();
      else flushProse();
      const heading = trimmed.replace(/^#{1,6}\s*/, "").replace(/[*_`]/g, "").trim();
      blocks.push({ kind: "tier", line: heading });
      mode = "prose";
      continue;
    }
    const started = trimmed ? matchQuestion(trimmed) : null;
    if (started) {
      if (mode === "q") return null;
      if (mode === "s") flushPair();
      else flushProse();
      question = {
        activity: started.activity,
        n: started.n,
        label: started.label,
        lines: started.rest ? [started.rest] : [],
      };
      solution = null;
      mode = "q";
      questions += 1;
      continue;
    }
    const solved = trimmed ? matchSolution(trimmed) : null;
    if (solved) {
      if (mode !== "q" || !question) return null;
      solution = { n: solved.n ?? question.n, lines: solved.rest ? [solved.rest] : [] };
      mode = "s";
      solutions += 1;
      continue;
    }
    if (mode === "q" && question) question.lines.push(kept);
    else if (mode === "s" && solution) solution.lines.push(kept);
    else prose.push(kept);
  }

  if (mode === "q") return null;
  if (mode === "s") flushPair();
  else flushProse();

  if (questions < 3 || solutions < 3 || questions !== solutions) return null;
  if (!blocks.some((b) => b.kind === "pair")) return null;

  for (let i = blocks.length - 1; i >= 0; i -= 1) {
    const block = blocks[i];
    if (block.kind !== "pair") continue;
    const peeled = peelClosing(block.s.lines);
    if (peeled.closing.length) {
      block.s = { ...block.s, lines: peeled.body };
      blocks.push({ kind: "prose", lines: peeled.closing });
    }
    break;
  }

  // Bold sessions, intro as the first session, question before solution.
  const arranged = arrangeLessonSessions(repairPreserveNotation(render(blocks))).trim();
  if (!arranged) return null;
  return arranged;
}
