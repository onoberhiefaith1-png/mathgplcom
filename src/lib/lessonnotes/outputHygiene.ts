// Client-side mirror of supabase/functions/notebook-ai/outputHygiene.ts.
// Last line of defence: AI (or pasted) text must never reach the notebook as
// raw markdown, JSON, HTML, escape residue or AI placeholders.
//
// Renderer-safe math templates (\frac{}{}, \sqrt{}, x^{n}, x_{n}, \sl{}) are
// deliberately preserved — they become real stacked math downstream.

import { repairMangledMacros } from "@/lib/lessonnotes/macroRepair";


const unwrapJson = (s: string): string => {
  const t = s.trim();
  if (!t || (t[0] !== "{" && t[0] !== "[")) return s;
  try {
    const parsed = JSON.parse(t);
    if (typeof parsed === "string") return parsed;
    if (Array.isArray(parsed)) {
      return parsed.filter((v) => typeof v === "string").join("\n");
    }
    if (parsed && typeof parsed === "object") {
      for (const key of ["content", "text", "output", "result", "answer", "solution"]) {
        const v = (parsed as Record<string, unknown>)[key];
        if (typeof v === "string") return v;
        if (Array.isArray(v)) return v.filter((x) => typeof x === "string").join("\n");
      }
      const vals = Object.values(parsed).filter((v) => typeof v === "string") as string[];
      if (vals.length) return vals.join("\n");
    }
  } catch {
    /* not JSON */
  }
  return s;
};

const decodeEscapes = (s: string): string =>
  s
    .replace(/\\r\\n|\\n/g, "\n")
    .replace(/\\t/g, "  ")
    .replace(/\\"/g, '"')
    .replace(/\\'/g, "'");

const stripMarkdown = (s: string): string => {
  let out = s;
  out = out.replace(/```[a-zA-Z0-9]*\n?/g, "").replace(/```/g, "");
  out = out.replace(/~~~[a-zA-Z0-9]*\n?/g, "").replace(/~~~/g, "");
  out = out.replace(/`([^`\n]*)`/g, "$1").replace(/`/g, "");
  out = out.replace(/\*\*\*([^*\n]+)\*\*\*/g, "$1");
  out = out.replace(/\*\*([^*\n]+)\*\*/g, "$1");
  out = out.replace(/(?<![\w*])\*([^*\n]+)\*(?![\w*])/g, "$1");
  out = out.replace(/___([^_\n]+)___/g, "$1");
  out = out.replace(/__([^_\n]+)__/g, "$1");
  out = out.replace(/~~([^~\n]+)~~/g, "$1");
  out = out.replace(/\*\*/g, "").replace(/(?<![\w{[(^_])\*(?![\w*])/g, "");
  out = out.replace(/^[ \t]{0,3}#{1,6}[ \t]*/gm, "");
  out = out.replace(/^[ \t]{0,3}>[ \t]?/gm, "");
  out = out.replace(/^[ \t]{0,4}[-*+][ \t]+/gm, "");
  out = out.replace(/^[ \t]{0,3}([-*_])(?:[ \t]*\1){2,}[ \t]*$/gm, "");
  out = out.replace(/^[ \t]*\|?[ \t]*:?-{2,}:?[ \t]*(\|[ \t]*:?-{2,}:?[ \t]*)+\|?[ \t]*$/gm, "");
  // Markdown table row → ONE CELL PER LINE. Joining cells on a single line
  // merged a calculation step with its explanation into one math object
  // (`log_2 2 + … log_2(2 × y × z)`), which is what produced run-together
  // lesson-note lines. One micro-step per line is the classroom standard.
  out = out.replace(/^[ \t]*\|(.+)\|[ \t]*$/gm, (_m, row: string) =>
    row.split("|").map((c) => c.trim()).filter(Boolean).join("\n"),
  );
  out = out.replace(/!?\[([^\]\n]*)\]\([^)\n]*\)/g, "$1");
  return out;
};

const stripTagsAndPlaceholders = (s: string): string => {
  let out = s;
  out = out.replace(/<\/?[a-zA-Z][a-zA-Z0-9-]*(\s[^<>]*)?\/?>/g, "");
  out = out.replace(/\{\{[^{}]*\}\}/g, "");
  out = out.replace(/\[(?:insert|your|add|todo|placeholder|tbd|fill)[^\]\n]*\]/gi, "");
  out = out.replace(/\bTODO\b:?/g, "");
  out = out.replace(
    /^[ \t]*(?:Solution|Answer|Problem|Question|Reasoning|Output|Response)\s*:\s*/gim,
    "",
  );
  out = out.replace(/\b(?:ACTIVE_QUESTION|QUESTION_LOCK|LESSON SO FAR|HIDDEN DRAFT)\b\s*:?\s*/g, "");
  return out;
};

/** Deterministic, idempotent presentation cleaner. Never throws. */
export function sanitizePresentation(input: string): string {
  if (!input) return "";
  let out = unwrapJson(input);
  // JSON transport can eat the backslash of a macro (`\frac` → FORM FEED +
  // "rac"). Restore it before anything else reads the text.
  out = repairMangledMacros(out);
  out = decodeEscapes(out);
  out = stripMarkdown(out);
  out = stripTagsAndPlaceholders(out);
  return out
    .replace(/\r\n/g, "\n")
    .replace(/[ \t]+$/gm, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}
