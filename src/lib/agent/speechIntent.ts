// Speech is an imperfect signal, not the meaning.
//
// What the microphone returns is tidied on its way to Aura the way a person
// hears a sentence: filler words dropped, stutters collapsed, noise fragments
// removed, and stray non-English scraps (a mishearing, never a language change)
// thrown away. The screen still shows what was heard, so nothing is hidden.

/** Filler that carries no instruction. */
const FILLERS = [
  "um",
  "umm",
  "uh",
  "uhh",
  "erm",
  "er",
  "ah",
  "eh",
  "hmm",
  "mmm",
  "like",
  "you know",
  "i mean",
  "sort of",
  "kind of",
  "basically",
  "actually",
];

/** Latin letters, digits and ordinary punctuation — the English signal. */
const LATIN = /[A-Za-z0-9]/;
/** Scripts that only appear here when the microphone has misheard English. */
const FOREIGN_SCRIPT =
  /[\u0400-\u04FF\u0590-\u05FF\u0600-\u06FF\u0900-\u097F\u1100-\u11FF\u3040-\u30FF\u3130-\u318F\u3400-\u4DBF\u4E00-\u9FFF\uAC00-\uD7AF]/;

/** True when a heard slice is mostly not English writing. */
export function looksMisheard(text: string): boolean {
  const letters = [...text].filter((ch) => /\S/.test(ch));
  if (letters.length === 0) return false;
  const foreign = letters.filter((ch) => FOREIGN_SCRIPT.test(ch)).length;
  const latin = letters.filter((ch) => LATIN.test(ch)).length;
  return foreign > 0 && foreign >= latin;
}

/** Strip the non-English scraps out of a mixed line. */
function dropForeign(text: string): string {
  return text
    .split(/\s+/)
    .filter((word) => !(FOREIGN_SCRIPT.test(word) && !LATIN.test(word)))
    .join(" ");
}

function removeFillers(text: string): string {
  let out = text;
  for (const filler of FILLERS) {
    const pattern = new RegExp(
      `(^|[\\s,.;:!?])${filler.replace(/ /g, "\\s+")}(?=$|[\\s,.;:!?])`,
      "gi",
    );
    out = out.replace(pattern, "$1");
  }
  return out;
}

/** "I want, I want you to" → "I want you to"; "the the note" → "the note". */
function collapseRepeats(text: string): string {
  let out = text.replace(/\b(\w+)([\s,]+\1\b)+/gi, "$1");
  // Repeated short phrases: "I want to I want to open" → "I want to open".
  out = out.replace(/\b((?:\w+\s){1,3}\w+)[\s,]+\1\b/gi, "$1");
  return out;
}

/** Lone noise scraps: a one- or two-letter island that is not a real word. */
const REAL_SHORT = new Set([
  "a",
  "i",
  "an",
  "as",
  "at",
  "be",
  "by",
  "do",
  "go",
  "he",
  "if",
  "in",
  "is",
  "it",
  "me",
  "my",
  "no",
  "of",
  "ok",
  "on",
  "or",
  "so",
  "to",
  "up",
  "us",
  "we",
]);

function dropNoise(text: string): string {
  return text
    .split(/\s+/)
    .filter((word) => {
      const bare = word.replace(/[^A-Za-z0-9]/g, "").toLowerCase();
      if (!bare) return /[0-9]/.test(word) || word.length > 1;
      if (bare.length > 2) return true;
      if (/[0-9]/.test(bare)) return true;
      return REAL_SHORT.has(bare);
    })
    .join(" ");
}

function tidyPunctuation(text: string): string {
  return text
    .replace(/\s*\.{2,}\s*/g, " ")
    .replace(/\s+([,.;:!?])/g, "$1")
    .replace(/([,;:])\s*(?=[,.;:!?])/g, "")
    .replace(/^[\s,.;:]+/, "")
    .replace(/\s{2,}/g, " ")
    .trim();
}

/**
 * The spoken turn as an instruction: the intended sentence, not the raw sound.
 * Returns an empty string when nothing meaningful was said.
 */
export function cleanSpokenText(raw: string): string {
  if (!raw) return "";
  let text = dropForeign(raw);
  text = removeFillers(text);
  text = collapseRepeats(text);
  text = dropNoise(text);
  text = tidyPunctuation(text);
  // A single leftover filler word is not an instruction.
  if (FILLERS.includes(text.toLowerCase())) return "";
  return text;
}
