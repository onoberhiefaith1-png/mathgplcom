// Tutor's Guide: turns a stored solution into a spoken, step-by-step script and
// coaches a student's line. Pure and on-device, so it works offline for free.
// It never invents mathematics: every line and every word comes from the
// stored solution and its teaching notes.

export type GuideLine = { equation: string; note?: string | null; fillers?: string[] };
export type GuideStep = { index: number; equation: string; speech: string; chips: string[] };

const WORDS: [RegExp, string][] = [
  [/\\frac\{([^}]*)\}\{([^}]*)\}/g, " $1 over $2 "],
  [/\^\{?2\}?/g, " squared "],
  [/\^\{?3\}?/g, " cubed "],
  [/\^\{?([^}\s]+)\}?/g, " to the power $1 "],
  [/\\sqrt\{([^}]*)\}/g, " the square root of $1 "],
  [/√/g, " the square root of "],
  [/\\times|×|\*/g, " times "],
  [/\\div|÷/g, " divided by "],
  [/\\cup|∪/g, " union "],
  [/\\cap|∩/g, " intersection "],
  [/\\in|∈/g, " is an element of "],
  [/\\subseteq|⊆/g, " is a subset of "],
  [/≤|\\le\b/g, " is less than or equal to "],
  [/≥|\\ge\b/g, " is greater than or equal to "],
  [/</g, " is less than "],
  [/>/g, " is greater than "],
  [/=/g, " equals "],
  [/\+/g, " plus "],
  [/[−–-]/g, " minus "],
  [/\//g, " over "],
  [/[{}\\]/g, " "],
];

/** Read an equation the way a teacher says it aloud. */
export function speakMath(equation: string): string {
  let s = equation;
  for (const [re, word] of WORDS) s = s.replace(re, word);
  return s.replace(/\s+/g, " ").trim();
}

/** Chips in the order the student will see them build the line. */
export function chipsFor(line: GuideLine): string[] {
  if (line.fillers?.length) return line.fillers.map(String).filter((c) => c.trim());
  return line.equation.split(/\s+/).filter(Boolean);
}

export function buildGuideScript(lines: GuideLine[]): GuideStep[] {
  return lines
    .filter((l) => l.equation?.trim())
    .map((l, index) => {
      const said = speakMath(l.equation);
      const note = l.note?.trim();
      const lead = index === 0 ? "We start with" : "Next,";
      return {
        index,
        equation: l.equation.trim(),
        chips: chipsFor(l),
        speech: note ? `${note} ${lead === "Next," ? "So we write" : lead} ${said}.` : `${lead} ${said}.`,
      };
    });
}

const strip = (s: string) => s.replace(/\s+/g, "").replace(/[−–]/g, "-").toLowerCase();
const nums = (s: string) => (strip(s).match(/-?\d+(\.\d+)?/g) ?? []).map(Number);

export type Coaching = { kind: "correct" | "sign" | "arithmetic" | "missing" | "different"; speech: string };

/** Compare a student's line with the expected line and say what to fix. */
export function coachLine(expected: string, written: string, note?: string | null): Coaching {
  const e = strip(expected);
  const w = strip(written);
  if (!w) return { kind: "missing", speech: `Write this step next: ${speakMath(expected)}.` };
  if (e === w) return { kind: "correct", speech: "Well done, that line is correct." };
  const why = note?.trim() ? ` Remember: ${note.trim()}` : "";
  if (e.replace(/-/g, "+") === w.replace(/-/g, "+")) {
    return { kind: "sign", speech: `Check your signs. It should be ${speakMath(expected)}.${why}` };
  }
  const en = nums(expected);
  const wn = nums(written);
  if (en.length === wn.length && en.length > 0 && e.replace(/[\d.]/g, "") === w.replace(/[\d.]/g, "")) {
    return { kind: "arithmetic", speech: `Check your working. The numbers should give ${speakMath(expected)}.${why}` };
  }
  return { kind: "different", speech: `Not quite. This step is ${speakMath(expected)}.${why}` };
}

export type GuideQuestion = "next" | "repeat" | "why" | "answer" | "previous" | null;

/** Recognise a student's spoken question about the Guide (offline, no AI). */
export function guideQuestion(text: string): GuideQuestion {
  const t = text.toLowerCase();
  if (/\b(why|how come|explain|reason)\b/.test(t)) return "why";
  if (/\b(again|repeat|say that|pardon)\b/.test(t)) return "repeat";
  if (/\b(back|previous|before)\b/.test(t)) return "previous";
  if (/\b(answer|final|result)\b/.test(t)) return "answer";
  if (/\b(next|continue|go on|then what|what now)\b/.test(t)) return "next";
  return null;
}

/** The spoken reply for a question asked at a given step. */
export function answerGuide(script: GuideStep[], lines: GuideLine[], at: number, q: GuideQuestion): { speech: string; step: number } {
  const step = Math.max(0, Math.min(at, script.length - 1));
  if (!script.length) return { speech: "There is no stored solution for this question yet.", step: 0 };
  switch (q) {
    case "why": {
      const note = lines.filter((l) => l.equation?.trim())[step]?.note?.trim();
      return { speech: note || `This step keeps both sides balanced: ${speakMath(script[step]!.equation)}.`, step };
    }
    case "previous": { const s = Math.max(0, step - 1); return { speech: script[s]!.speech, step: s }; }
    case "answer": { const s = script.length - 1; return { speech: `The final line is ${speakMath(script[s]!.equation)}.`, step: s }; }
    case "next": {
      if (step + 1 >= script.length) return { speech: "That was the last step. Well done.", step };
      return { speech: script[step + 1]!.speech, step: step + 1 };
    }
    default: return { speech: script[step]!.speech, step };
  }
}
