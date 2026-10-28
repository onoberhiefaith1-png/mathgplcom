// Phase 5 — the lesson Aura performs out loud.
//
// A teaching script is the only thing that links her voice to the board: each
// step is one sentence she says, optionally tied to the mathematical line the
// board should be sitting on while she says it. Client-safe on purpose: the
// cockpit plays it and the board follows it.

export type TeachingStep = {
  /** One spoken sentence — a single micro-step, never a paragraph. */
  say: string;
  /** 1-based board line this sentence belongs to, or null for an aside. */
  line: number | null;
};

export type TeachingScript = {
  title: string;
  steps: TeachingStep[];
};

/** A lesson longer than this is a lecture, not a taught step sequence. */
export const MAX_TEACHING_STEPS = 40;

const clean = (value: unknown): string =>
  typeof value === "string" ? value.replace(/\s+/g, " ").trim() : "";

const lineOf = (value: unknown): number | null => {
  if (typeof value !== "number" || !Number.isFinite(value)) return null;
  const line = Math.round(value);
  return line >= 1 ? line : null;
};

/**
 * Build a script from the two parallel lists the agent supplies: what she says,
 * and which board line each sentence belongs to.
 */
export function buildTeachingScript(
  say: unknown,
  lines: unknown,
  title: unknown,
): TeachingScript {
  if (!Array.isArray(say)) throw new Error('Argument "say" must be a list of sentences.');
  const boardLines = Array.isArray(lines) ? lines : [];
  const steps: TeachingStep[] = [];
  say.forEach((sentence, index) => {
    const said = clean(sentence);
    if (!said) return;
    steps.push({ say: said, line: lineOf(boardLines[index]) });
  });
  if (steps.length === 0) throw new Error('Argument "say" has nothing to speak.');
  if (steps.length > MAX_TEACHING_STEPS) {
    throw new Error(`A taught sequence is at most ${MAX_TEACHING_STEPS} spoken steps.`);
  }
  return { title: clean(title) || "Lesson", steps };
}

/** Read a script back off a tool result; null when it isn't one. */
export function parseTeachingScript(value: unknown): TeachingScript | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const raw = value as { title?: unknown; steps?: unknown };
  if (!Array.isArray(raw.steps)) return null;
  const steps: TeachingStep[] = [];
  for (const entry of raw.steps) {
    if (!entry || typeof entry !== "object") continue;
    const said = clean((entry as { say?: unknown }).say);
    if (!said) continue;
    steps.push({ say: said, line: lineOf((entry as { line?: unknown }).line) });
  }
  if (steps.length === 0) return null;
  return { title: clean(raw.title) || "Lesson", steps: steps.slice(0, MAX_TEACHING_STEPS) };
}
