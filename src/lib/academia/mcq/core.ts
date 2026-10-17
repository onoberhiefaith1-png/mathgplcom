// Pure multiple-choice helpers shared by the web Academia and Mathemagine.

export interface McqOption { label: string; text: string }
export interface McqQuestion { n: number; text: string; options: McqOption[]; answer: string | null }
export interface McqIssue { n: number; message: string }
export type McqAnswers = Record<number, string>;

/** Flatten a lesson-note document (TipTap JSON) into text lines. */
export function docToLines(doc: unknown): string[] {
  const lines: string[] = [];
  const text = (n: any): string =>
    n?.type === "text" ? String(n.text ?? "") : Array.isArray(n?.content) ? n.content.map(text).join("") : "";
  const walk = (n: any) => {
    if (!n || typeof n !== "object") return;
    if (["paragraph", "heading", "listItem"].includes(n.type) || (n.type === "text")) {
      const t = text(n).trim();
      if (t) lines.push(...t.split(/\n+/).map((s) => s.trim()).filter(Boolean));
      return;
    }
    if (Array.isArray(n.content)) n.content.forEach(walk);
  };
  walk(doc);
  return lines;
}

const Q_RE = /^(?:question\s*)?(\d{1,3})\s*[.):]?\s*(.*)$/i;
const OPT_RE = /^\(?([A-Ea-e])[.)]\s*(.+)$/;
const ANS_RE = /^(?:correct\s+)?answer\s*[:\-]\s*\(?([A-Ea-e])\)?/i;

/** Parse "Question 1 / text / A. … / Correct Answer: B" blocks. */
export function parseMcq(lines: string[]): { questions: McqQuestion[]; issues: McqIssue[] } {
  const questions: McqQuestion[] = [];
  let cur: McqQuestion | null = null;
  for (const raw of lines) {
    const line = raw.trim();
    const ans = line.match(ANS_RE);
    if (ans && cur) { cur.answer = ans[1].toUpperCase(); continue; }
    // Several options on one line: "A. 3   B. 5   C. 7   D. 10"
    const inline = [...line.matchAll(/(?:^|\s)([A-E])[.)]\s*(.+?)(?=\s+[A-E][.)]\s|$)/g)];
    if (cur && inline.length >= 2 && inline[0].index === 0) {
      inline.forEach((m) => cur!.options.push({ label: m[1], text: m[2].trim() }));
      continue;
    }
    const opt = line.match(OPT_RE);
    if (opt && cur) { cur.options.push({ label: opt[1].toUpperCase(), text: opt[2].trim() }); continue; }
    const q = line.match(Q_RE);
    if (q && (/^question/i.test(line) || (!cur || cur.options.length > 0))) {
      cur = { n: questions.length + 1, text: q[2].trim(), options: [], answer: null };
      questions.push(cur);
      continue;
    }
    if (cur && cur.options.length === 0) cur.text = cur.text ? `${cur.text}\n${line}` : line;
  }
  const issues: McqIssue[] = [];
  for (const q of questions) {
    if (!q.text) issues.push({ n: q.n, message: "has no question text" });
    if (q.options.length < 2) issues.push({ n: q.n, message: "needs at least two options" });
    if (!q.answer) issues.push({ n: q.n, message: "has no correct answer" });
    else if (!q.options.some((o) => o.label === q.answer)) issues.push({ n: q.n, message: `answer ${q.answer} is not one of the options` });
  }
  return { questions, issues };
}

export type McqStatus = "correct" | "incorrect" | "unanswered";

export function statusOf(q: McqQuestion, answers: McqAnswers): McqStatus {
  const a = answers[q.n];
  if (!a) return "unanswered";
  return a === q.answer ? "correct" : "incorrect";
}

export function markPaper(questions: McqQuestion[], answers: McqAnswers) {
  const groups: Record<McqStatus, number[]> = { correct: [], incorrect: [], unanswered: [] };
  for (const q of questions) groups[statusOf(q, answers)].push(q.n);
  const total = questions.length;
  return {
    groups,
    correct: groups.correct.length,
    incorrect: groups.incorrect.length,
    unanswered: groups.unanswered.length,
    total,
    percent: total ? Math.round((groups.correct.length / total) * 100) : 0,
  };
}
