// Upscale verifier — two-layer check for AI Edit (content + mathematics).
// Pure TS (no Deno imports) so it can be unit-tested from vitest.

export interface UpscaleReport {
  kept: number;
  completed: number;
  reconstructed: number;
  visuals: number;
  review: string[];
}

const REPORT_RE = /^\s*\[\[upscale\b([^\]]*)\]\]\s*$/im;

export function extractUpscaleReport(content: string): { content: string; report: UpscaleReport | null } {
  const m = content.match(REPORT_RE);
  if (!m) return { content, report: null };
  const attrs: Record<string, string> = {};
  for (const a of m[1].matchAll(/(\w+)\s*=\s*"([^"]*)"/g)) attrs[a[1]] = a[2];
  const n = (k: string) => {
    const v = parseInt(attrs[k] ?? "0", 10);
    return Number.isFinite(v) && v >= 0 ? v : 0;
  };
  const report: UpscaleReport = {
    kept: n("kept"),
    completed: n("completed"),
    reconstructed: n("reconstructed"),
    visuals: n("visuals"),
    review: (attrs.review ?? "").split(";").map((s) => s.trim()).filter(Boolean),
  };
  return { content: content.replace(REPORT_RE, "").replace(/\n{3,}/g, "\n\n").trim(), report };
}

const PROBLEM_HEAD = /^\s*(?:#{1,6}\s*)?(example|classwork|exercise|homework|assessment|practice|question|worked problem)\b[^\n]*$/i;

interface Unit { heading: string; body: string[] }

function units(text: string): Unit[] {
  const out: Unit[] = [];
  let cur: Unit | null = null;
  for (const line of text.split("\n")) {
    if (/^\s*#{1,6}\s/.test(line) || PROBLEM_HEAD.test(line)) {
      cur = PROBLEM_HEAD.test(line) ? { heading: line.trim(), body: [] } : null;
      if (cur) out.push(cur);
      continue;
    }
    if (cur && line.trim()) cur.body.push(line.trim());
  }
  return out;
}

const numbersOf = (s: string) => (s.match(/-?\d+(?:\.\d+)?/g) ?? []).filter((x) => x !== "0");

const METHODS: Array<[string, RegExp]> = [
  ["quadratic formula", /quadratic formula|\\frac\{-b\s*\\pm|-b\s*±|b\^?\{?2\}?\s*-\s*4ac/i],
  ["completing the square", /complet(e|ing) the square/i],
  ["factorisation", /factori[sz]/i],
  ["substitution", /substitut/i],
  ["elimination", /eliminat/i],
];

/** Defects are phrased as instructions for a targeted retry. */
export function verifyUpscale(source: string, output: string, report: UpscaleReport | null): string[] {
  const defects: string[] = [];
  const src = units(source);
  const out = units(output);

  // Content layer — nothing the teacher wrote is dropped.
  if (src.length && out.length < src.length) {
    defects.push(`The source has ${src.length} problem items but the output has ${out.length}. Restore every original Example/Classwork/Homework item — do not drop content.`);
  }
  const outNums = new Set(numbersOf(output));
  const reconstructed = (report?.reconstructed ?? 0) > 0;
  if (!reconstructed) {
    const missing = [...new Set(numbersOf(source))].filter((x) => !outNums.has(x));
    if (missing.length > 0 && missing.length >= Math.max(2, numbersOf(source).length * 0.25)) {
      defects.push(`Numbers from the teacher's material are missing: ${missing.slice(0, 8).join(", ")}. Preserve the teacher's numbers exactly.`);
    }
  }
  for (const [name, re] of METHODS) {
    if (re.test(source) && !re.test(output)) {
      defects.push(`The teacher uses ${name}. Keep that method — do not replace it with another one.`);
    }
  }

  // Mathematics layer — every problem has a solution.
  for (const u of out) {
    if (/\bsummary\b/i.test(u.heading)) continue;
    if (u.body.length < 3) {
      defects.push(`"${u.heading.replace(/^#+\s*/, "")}" has no complete solution. Every problem needs its question and a full micro-step solution using the lesson's method.`);
    }
  }
  return defects;
}

export function upscaleCorrection(defects: string[]): string {
  return `UPSCALING CHECK FAILED — fix exactly these and output the full corrected content again (keep the [[upscale …]] report line):\n${defects.map((d) => `- ${d}`).join("\n")}`;
}
