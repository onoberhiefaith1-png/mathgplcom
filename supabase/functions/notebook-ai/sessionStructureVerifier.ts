// Session-structure verifier: every question session must be followed by its
// own numbered Solution session. Pure TS (vitest-testable).

export type SessionType = "question" | "solution" | "other";
export interface Session { title: string; type: SessionType; activity: string | null; num: number | null; body: string[] }

const QUESTION_RE = /^(example|classwork|exercise|homework|assessment|practice|question|worked problem)\b\s*(?:no\.?\s*)?(\d+)?/i;
const SOLUTION_RE = /^(?:worked\s+)?solution\b\s*(?:to\s+\w+\s*)?(?:no\.?\s*)?(\d+)?/i;
const HEAD_RE = /^\s*#{1,6}\s+(.+?)\s*#*\s*$/;
const WORKING_RE = /^(?:\$\$?)?\s*[^=\n]{1,80}=[^=\n]+|^(add|subtract|divide|multiply|therefore|hence|so\b|substitut|simplif|expand|collect)/i;

export function parseSessions(text: string): Session[] {
  const out: Session[] = [];
  let cur: Session | null = null;
  for (const raw of text.split("\n")) {
    const h = raw.match(HEAD_RE);
    if (h) {
      const t = h[1].replace(/[*_:]/g, "").trim();
      const s = t.match(SOLUTION_RE);
      const q = !s && t.match(QUESTION_RE);
      cur = s
        ? { title: t, type: "solution", activity: null, num: s[1] ? +s[1] : null, body: [] }
        : q
        ? { title: t, type: "question", activity: q[1].toLowerCase(), num: q[2] ? +q[2] : null, body: [] }
        : { title: t, type: "other", activity: null, num: null, body: [] };
      out.push(cur);
      continue;
    }
    if (cur && raw.trim()) cur.body.push(raw.trim());
  }
  return out;
}

export interface StructureStats { paired: number; missing: number }

export function verifySessionStructure(text: string): { defects: string[]; stats: StructureStats } {
  const s = parseSessions(text);
  const defects: string[] = [];
  let paired = 0, missing = 0;
  // Only enforce when the draft is session-structured at all.
  if (!s.some((x) => x.type === "question")) return { defects, stats: { paired, missing } };
  s.forEach((x, i) => {
    if (x.type !== "question") return;
    const next = s[i + 1];
    const label = x.title;
    if (!next || next.type !== "solution") {
      missing++;
      defects.push(`"${label}" has no Solution session directly after it`);
    } else {
      paired++;
      if (x.num != null && next.num != null && x.num !== next.num)
        defects.push(`"${label}" is followed by "${next.title}" — numbering must match`);
      if (!next.body.length) defects.push(`"${next.title}" is empty`);
    }
    if (x.body.some((l) => /^\**\s*solution\s*:?\**$/i.test(l) || /^solution\s*:/i.test(l)))
      defects.push(`"${label}" contains its solution inside the question session`);
    else if (x.body.filter((l) => WORKING_RE.test(l)).length >= 3)
      defects.push(`"${label}" appears to contain working — move it into its Solution session`);
  });
  // All-questions-then-all-solutions pattern.
  for (let i = 0; i + 1 < s.length; i++) {
    if (s[i].type === "solution" && s[i + 1].type === "solution")
      defects.push(`Two Solution sessions in a row ("${s[i].title}", "${s[i + 1].title}") — pair each with its question`);
  }
  return { defects: [...new Set(defects)], stats: { paired, missing } };
}

export function sessionStructureCorrection(defects: string[]): string {
  return `STRUCTURE REJECTED — every question needs its own Solution session straight after it (Question N → Solution N). Fix:\n- ${defects.join("\n- ")}\nReturn the full corrected content with the same questions, values and methods, plus the [[upscale …]] line.`;
}
