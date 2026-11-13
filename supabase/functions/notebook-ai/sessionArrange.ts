import { isMcqAnswerLabel, parseInlineMcq } from "./inlineMcq.ts";
import {
  lessonImportDefects,
  prepareLessonImport,
  repairLessonNotation,
} from "./lessonImportNormalise.ts";

// LESSON-NOTE SESSIONS — the one deterministic arranger every compose path
// (Preserve, Generate, Split into segments) runs its output through, so the
// Smartboard "Next" walks real sessions instead of one run-on dump.
//
// Rules (product decision):
//   1. The note ALWAYS starts with a session. A heading at the top ("Practice",
//      "Beginner Practice") is that session and the text under it belongs to
//      it. Text before the first marker is never dropped: when the first
//      marker is a group heading it is lifted to the top and the intro sits
//      under it; otherwise an explicit session is invented ("Question 1" when
//      the intro reads as a question, "Introduction" otherwise).
//   2. Session headings are bold and alone on their line: **Practice**,
//      **Question 1**, **Example 1**. "Question 1. Solve x" becomes
//      **Question 1** with "Solve x" on the next line.
//   3. Inside a session the question comes BEFORE its solution. A Solution
//      that sits before (or away from) its question is moved under it, and a
//      leading copy of the question inside the solution is removed.
//   4. Markers: topic headings (bold / markdown), Question N, Example N,
//      Exercise N, Classwork N, Homework N, Assessment N, Beginner /
//      Intermediate / Expert Practice, Practice, Exercise, Section A, …
//
// Pure TS (no Deno / React imports) so the client and vitest can import it.

export type SessionMarkerKind = "question" | "solution" | "label" | "group";

export interface SessionMarker {
  kind: SessionMarkerKind;
  /** Canonical heading text ("Question 3", "Beginner Practice", "Solution"). */
  title: string;
  /** Number on a question / solution marker, else null. */
  n: number | null;
  /** Text that followed the label on the same line ("Question 1. Solve x"). */
  rest: string;
  /** Written as a bold / markdown heading in the source. */
  explicit: boolean;
}

const QUESTION_RE =
  /^(question|problem|q|example|exercise|classwork|class work|homework|home work|assessment|assignment|activity|task|practice)\s*(?:no\.?\s*)?([A-Za-z]{0,4})(\d{1,3})\b\s*([.):\-–—]?)\s*(.*)$/i;
/** "V1. Beginner/JSS" is a level section even without a markdown heading. */
const LEVEL_HEADING =
  /^(?:[A-Za-z]{1,3}\d{1,3}\.\s+)?(?:beginner|intermediate|expert)(?:\/[A-Za-z0-9-]+)?$/i;
const SOLUTION_RE =
  /^(?:worked\s+)?(?:solutions?|answers?|workings?)(?:\s+(?:to\s+)?(?:question|example|exercise|q)?\s*(\d{1,3}))?\s*(?:[:.]\s*(.*))?$/i;
const LABEL_RE =
  /^(introduction|intro|objectives?|explanation|summary|conclusion|recap|notes?|key (?:ideas|points|facts)|definitions?|worked examples?|examples|exercises?|classwork|class work|homework|home work|assessment|practice(?: questions| exercises?| problems)?|questions)$/i;
const TIER_RE =
  /^(?:(?:beginner|intermediate|expert|advanced|foundation|higher|core|extension|basic|challenge)(?:\s+(?:level|practice|questions?|tier|section|problems?|exercises?))?|(?:level|tier|part|section|paper)\s+(?:\d{1,3}|[a-z]))$/i;

/** Strip markdown heading / emphasis wrapping from a whole line. */
function unwrap(line: string): { text: string; explicit: boolean } {
  let t = String(line ?? "").trim();
  let explicit = false;
  const hash = t.match(/^#{1,6}\s+(.+?)\s*#*$/);
  if (hash) {
    t = hash[1].trim();
    explicit = true;
  }
  const bold = t.match(/^(\*\*|__)(.+?)\1\s*([:.]?)$/);
  if (bold) {
    t = `${bold[2].trim()}${bold[3] ?? ""}`;
    explicit = true;
  }
  return { text: t.replace(/^[*_]+|[*_]+$/g, "").trim(), explicit };
}

const canonicalWord = (w: string): string => {
  const k = w.toLowerCase().replace(/\s+/g, "");
  if (k === "q" || k === "problem" || k === "question") return "Question";
  if (k === "classwork") return "Classwork";
  if (k === "homework") return "Homework";
  return k.charAt(0).toUpperCase() + k.slice(1);
};

const collapse = (s: string) => s.replace(/\s+/g, " ").trim();

/** Classify one line as a session marker, or null for ordinary content. */
export function sessionMarkerAt(line: string): SessionMarker | null {
  const raw = String(line ?? "").trim();
  if (!raw || raw.length > 160 || isMcqAnswerLabel(raw)) return null;
  const { text, explicit } = unwrap(raw);
  if (!text) return null;
  const sol = text.match(SOLUTION_RE);
  if (sol) {
    return {
      kind: "solution",
      title: "Solution",
      n: sol[1] ? Number(sol[1]) : null,
      rest: (sol[2] ?? "").trim(),
      explicit,
    };
  }
  const q = text.match(QUESTION_RE);
  if (q) {
    const rest = (q[5] ?? "").trim();
    const sep = q[4] ?? "";
    const word = canonicalWord(q[1]);
    const prefix = q[2] ?? "";
    const n = Number(q[3]);
    // "Example 2 shows that…" is prose; a question label is followed by
    // punctuation, nothing, or (for Question / Q) the question itself.
    // "Question V1" keeps the teacher's prefix so it is not also a body line.
    if (!rest || sep || explicit || word === "Question") {
      return { kind: "question", title: `${word} ${prefix}${n}`, n, rest, explicit };
    }
  }
  const bare = text.replace(/[:.]+$/, "").trim();
  if (LABEL_RE.test(bare)) {
    return { kind: "label", title: collapse(bare.charAt(0).toUpperCase() + bare.slice(1)), n: null, rest: "", explicit };
  }
  if (TIER_RE.test(bare)) {
    return { kind: "group", title: collapse(bare), n: null, rest: "", explicit };
  }
  if (LEVEL_HEADING.test(bare)) {
    return { kind: "group", title: collapse(bare), n: null, rest: "", explicit: true };
  }
  // A bold / markdown heading that is not a sentence is a topic session.
  if (explicit && bare.length <= 80 && !/=/.test(bare) && !/[.?!]$/.test(text)) {
    return { kind: "group", title: collapse(bare), n: null, rest: "", explicit };
  }
  return null;
}

/** Bold heading line exactly as the arranged note writes it. */
export const boldSession = (title: string): string => `**${title}**`;

const QUESTIONISH =
  /\?|^(?:\(?\d{1,3}[.)]\s+)?(?:find|solve|simplify|calculate|evaluate|work out|write|expand|factori[sz]e|show|prove|identify|determine|express|convert|given|if|what|how|which|state|explain|draw|sketch|estimate|round|use|complete|plot|list|describe|compare|order|rearrange|make)\b/i;

/** Does the opening text read as a question rather than an introduction? */
export function looksLikeQuestion(lines: string[]): boolean {
  const first = lines.map((l) => l.trim()).find(Boolean) ?? "";
  return QUESTIONISH.test(first);
}

export interface SessionBlock {
  marker: SessionMarker | null;
  lines: string[];
}

const squash = (s: string) =>
  String(s ?? "")
    .toLowerCase()
    .replace(/\\[()[\]]|\$/g, "")
    .replace(/[*_`]/g, "")
    .replace(/^\s*(?:question|problem|q)\s*\d{1,3}\s*[.):\-–—]?\s*/i, "")
    .replace(/[\s.,;:!?]+/g, "");

/** Drop a leading copy of the question from a solution body (no echo). */
export function stripQuestionEcho(question: string[], solution: string[]): string[] {
  const whole = question.map(squash).join("");
  if (!whole) return solution;
  let consumed = "";
  for (let i = 0; i < solution.length; i += 1) {
    const s = squash(solution[i]);
    if (!s) continue;
    consumed += s;
    if (consumed === whole) {
      const rest = solution.slice(i + 1);
      // Never leave a solution empty because the "echo" was all it had.
      return rest.some((l) => l.trim()) ? rest : solution;
    }
    if (!whole.startsWith(consumed)) break;
  }
  return solution;
}

const tidy = (lines: string[]): string[] => {
  let a = 0;
  let b = lines.length;
  while (a < b && !lines[a].trim()) a += 1;
  while (b > a && !lines[b - 1].trim()) b -= 1;
  return lines.slice(a, b).map((l) => l.replace(/[ \t]+$/g, ""));
};

export interface ArrangeOptions {
  /** Number to give an invented first question (a later segment of a test). */
  firstQuestion?: number;
}

const PRACTICE_LABEL = /exercise|practice|classwork|class work|homework|home work|assessment|questions|examples/i;
const NUMBERED_RE = /^\(?(\d{1,3})[.)]\s+(\S.*)$/;

/** Parse text into marker blocks (a preamble first, with marker null). A
 *  bare numbered line ("3. Solve …") is a question only when the paste labels
 *  none of its questions and the number continues the sequence, so numbered
 *  working steps under a Solution stay with that solution. */
export function parseSessionBlocks(text: string): SessionBlock[] {
  const lines = String(text ?? "").replace(/^\uFEFF/, "").replace(/\r\n?/g, "\n").split("\n");
  const markers = lines.map((l) => (l.trim() ? sessionMarkerAt(l) : null));
  const labelled = markers.some((m) => m?.kind === "question");
  const blocks: SessionBlock[] = [{ marker: null, lines: [] }];
  let last = 0;
  let prevBlank = true;
  lines.forEach((line, i) => {
    let m = markers[i];
    const numbered = line.trim().match(NUMBERED_RE);
    const answerOffset = numbered ? lines.slice(i + 1).findIndex(isMcqAnswerLabel) : -1;
    const numberedMcq = !!numbered && answerOffset >= 0 && !!parseInlineMcq([numbered[2], ...lines.slice(i + 1, i + 2 + answerOffset)].join("\n"));
    if (!m && (!labelled || numberedMcq)) {
      const num = line.trim().match(NUMBERED_RE);
      const cur = blocks[blocks.length - 1].marker;
      if (num) {
        const n = Number(num[1]);
        const inWorking = cur?.kind === "solution" && !prevBlank;
        // A later segment of a numbered test opens at its own number (11. …).
        const opening = last === 0 && cur == null;
        const restart = opening || (n === 1 && (last === 0 || cur?.kind === "group" || cur?.kind === "label"));
        // A numbered list under Introduction / Objectives / Summary is prose.
        const teaching = cur?.kind === "label" && !PRACTICE_LABEL.test(cur.title);
        if (numberedMcq || (!inWorking && !teaching && (n === last + 1 || restart))) {
          m = { kind: "question", title: `Question ${n}`, n, rest: num[2].trim(), explicit: false };
        }
      }
    }
    prevBlank = !line.trim();
    if (m) {
      if (m.kind === "question" && m.n != null) last = m.n;
      if (m.kind === "group" || m.kind === "label") last = 0;
      blocks.push({ marker: m, lines: m.rest ? [m.rest] : [] });
      return;
    }
    blocks[blocks.length - 1].lines.push(line);
  });
  if (!blocks[0].lines.some((l) => l.trim())) blocks.shift();
  return blocks;
}

const isQ = (b: SessionBlock) => b.marker?.kind === "question";
const isS = (b: SessionBlock) => b.marker?.kind === "solution";
const opensGroup = (b: SessionBlock) => b.marker?.kind === "group" || b.marker?.kind === "label";

/** Within one group, put every solution straight under its own question. */
function orderGroup(group: SessionBlock[]): SessionBlock[] {
  const owner = new Map<number, number>(); // solution index → question index
  const taken = new Set<number>();
  group.forEach((b, i) => {
    if (!isS(b)) return;
    const n = b.marker!.n;
    let prevQ = -1;
    for (let j = i - 1; j >= 0; j -= 1) if (isQ(group[j])) { prevQ = j; break; }
    const free = (j: number) => j >= 0 && !taken.has(j);
    let q = -1;
    if (free(prevQ) && (n == null || group[prevQ].marker!.n === n)) q = prevQ;
    if (q < 0 && n != null) {
      group.forEach((c, j) => {
        if (isQ(c) && c.marker!.n === n && free(j) && (q < 0 || Math.abs(j - i) < Math.abs(q - i))) q = j;
      });
    }
    if (q < 0 && free(prevQ)) q = prevQ;
    if (q >= 0) { owner.set(i, q); taken.add(q); }
  });
  const attached = new Map<number, SessionBlock[]>();
  owner.forEach((q, s) => attached.set(q, [...(attached.get(q) ?? []), group[s]]));
  const out: SessionBlock[] = [];
  group.forEach((b, i) => {
    if (owner.has(i)) return;
    out.push(b);
    for (const sol of attached.get(i) ?? []) {
      out.push({
        marker: { ...sol.marker!, n: b.marker!.n },
        lines: stripQuestionEcho(b.lines, sol.lines),
      });
    }
  });
  return out;
}

/**
 * Arrange lesson-note text into bold, ordered sessions. Idempotent: running
 * it on its own output returns the same text. Nothing is dropped except a
 * solution's verbatim copy of its own question.
 */
export function arrangeLessonSessions(text: string, opts: ArrangeOptions = {}): string {
  const src = String(text ?? "");
  if (!src.trim()) return src.trim();
  let blocks = parseSessionBlocks(src);

  // ── 1. Always start with a session ────────────────────────────────────
  if (blocks.length && !blocks[0].marker) {
    const intro = blocks[0];
    const next = blocks[1];
    if (next && opensGroup(next) && !looksLikeQuestion(intro.lines)) {
      // "Beginner Practice" names the set the intro opens: lift it to the
      // top so the intro is that session's own content, word for word.
      blocks = [{ marker: next.marker, lines: [...intro.lines, "", ...next.lines] }, ...blocks.slice(2)];
    } else {
      const hasQuestions = blocks.some(isQ);
      const first = next?.marker;
      // Text straight before a Solution is that solution's question.
      const asQuestion = first?.kind === "solution" || (!hasQuestions && looksLikeQuestion(intro.lines));
      const n = first?.kind === "solution" && first.n != null ? first.n : (opts.firstQuestion ?? 1);
      intro.marker = asQuestion
        ? { kind: "question", title: `Question ${n}`, n, rest: "", explicit: true }
        : { kind: "label", title: "Introduction", n: null, rest: "", explicit: true };
    }
  }

  // ── 2. Question before solution, each solution under its own question ──
  const ordered: SessionBlock[] = [];
  let start = 0;
  for (let i = 1; i <= blocks.length; i += 1) {
    if (i === blocks.length || opensGroup(blocks[i])) {
      ordered.push(...orderGroup(blocks.slice(start, i)));
      start = i;
    }
  }

  // A declared MCQ answer is content, not a worked Solution. Repair legacy/model
  // answer-only Solution blocks before rendering, using the same strict parser.
  for (let i = 0; i + 1 < ordered.length; i++) {
    const q = ordered[i], next = ordered[i + 1];
    const answerRows = next.lines.filter(line => line.trim());
    if (isQ(q) && isS(next) && answerRows.length === 1 &&
      isMcqAnswerLabel(answerRows[0]) && parseInlineMcq([...q.lines, ...answerRows].join("\n"))) {
      q.lines.push(...answerRows);
      ordered.splice(i + 1, 1);
    }
  }

  // ── 3. Render: bold session headings alone on their line ───────────────
  const out: string[] = [];
  for (const b of ordered) {
    if (out.length) out.push("");
    const m = b.marker!;
    if (m.kind === "solution") out.push(m.n != null ? `Solution ${m.n}` : "Solution");
    else out.push(boldSession(m.title));
    out.push(...tidy(b.lines));
  }
  return out.join("\n").replace(/\n{3,}/g, "\n\n").trim();
}

/**
 * Last gate before a composed lesson is previewed or saved. Normalise the
 * export, arrange sessions, then repair notation. A second repair runs when
 * a delimiter is still visible so a broken lesson is not what the teacher sees.
 */
export function finaliseLessonImport(text: string, opts: ArrangeOptions = {}): string {
  const prepared = prepareLessonImport(text);
  let out = repairLessonNotation(arrangeLessonSessions(prepared, opts));
  if (lessonImportDefects(out).length) out = repairLessonNotation(out);
  return out.trim();
}
