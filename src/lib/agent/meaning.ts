// What the teacher meant, not what the microphone guessed.
//
// Pure, client-safe and testable: the vocabulary repair, the "is this real work"
// judgement and the parsing of the fast brain's answer live here so they can be
// checked without spending anything. The model call itself is in
// `fastTurn.server.ts`.

/** Words the recogniser mangles, and the MathGPL term actually meant. */
const REPAIRS: [RegExp, string][] = [
  [/\bfl(?:oo|o|u)[a-z]*ing numbers?\b/gi, "floating numbers"],
  [/\bfloating number\b/gi, "floating numbers"],
  [/\bsmart\s*(?:board|bored|bought|boat|ball)\b/gi, "smartboard"],
  [/\bless?on\s*notes?\b/gi, "lesson note"],
  [/\blesson\s*no+te?s?\b/gi, "lesson note"],
  [/\bmath\s*g\s*p\s*l\b/gi, "MathGPL"],
  [/\bmaths?\s*people\b/gi, "MathGPL"],
  [/\bslate\s*art(?:i|e)san\b/gi, "Slate Artisan"],
  [/\badventures?\b/gi, "Adventure"],
  [/\bsub\s*sessions?\b/gi, "session"],
  [/\bquadratics?\s*equations?\b/gi, "quadratic equations"],
  [/\bsimulation\s*equations?\b/gi, "simultaneous equations"],
  [/\bhighlight(?:ed)?\s*lines?\b/gi, "highlighted lines"],
];

/** The same sentence with MathGPL's own words spelled the way they exist. */
export function repairVocabulary(text: string): string {
  let out = text;
  for (const [pattern, replacement] of REPAIRS) out = out.replace(pattern, replacement);
  return out.replace(/\s{2,}/g, " ").trim();
}

/** Anything that changes something real, or needs proper thinking. */
const WORK =
  /\b(creat|make|add|writ|build|set up|setup|assign|attach|highlight|generate|publish|test|link|remove|delete|archive|move|edit|insert|repair|reorder|place|configure|approve|propose|upload|solve|work out|explain|research|search|find out|look up|study|plan|design|fix|check)/i;

/**
 * The real things in a teacher's workspace. Naming any of them means the answer
 * has to come from the workspace itself, never from the fast line — she must not
 * say "I can help with that" and leave the question unanswered.
 */
const REAL_THINGS =
  /\b(class(?:es)?|student|pupil|lesson note|note|notebook|assignment|homework|game|adventure|session|question|solution|smartboard|floating numbers|worksheet|test|assessment|mark|score|progress|workspace|quest|level|vault|curriculum|topic)/i;

/**
 * True when the turn needs the deep worker. A plain exchange — a greeting, a
 * yes, a thank you — is answered by the fast brain alone, which is both instant
 * and almost free. Anything that touches real work or real workspace data goes
 * to the worker that can actually look.
 */
export function looksLikeWork(text: string): boolean {
  return WORK.test(text) || REAL_THINGS.test(text);
}

export type FastTurn = {
  /** The instruction as a clean sentence: what Aura reasons from. */
  meaning: string;
  /** The line spoken immediately, before any deep work has finished. */
  reply: string;
  /** True when the deep worker must run to actually answer. */
  deep: boolean;
};

function firstObject(raw: string): string | null {
  const start = raw.indexOf("{");
  const end = raw.lastIndexOf("}");
  if (start === -1 || end <= start) return null;
  return raw.slice(start, end + 1);
}

/**
 * The fast brain's answer, read defensively. Anything unexpected falls back to
 * the repaired transcript, so a bad reply can never lose the teacher's turn.
 */
export function parseFastTurn(raw: string, heard: string): FastTurn {
  const fallback: FastTurn = {
    meaning: repairVocabulary(heard),
    reply: "",
    deep: looksLikeWork(heard),
  };
  const block = firstObject(raw ?? "");
  if (!block) return fallback;
  try {
    const parsed = JSON.parse(block) as Partial<Record<keyof FastTurn, unknown>>;
    const meaning = typeof parsed.meaning === "string" ? repairVocabulary(parsed.meaning) : "";
    const reply = typeof parsed.reply === "string" ? parsed.reply.trim() : "";
    const deep = typeof parsed.deep === "boolean" ? parsed.deep : fallback.deep;
    return {
      meaning: meaning || fallback.meaning,
      reply,
      deep,
    };
  } catch {
    return fallback;
  }
}
