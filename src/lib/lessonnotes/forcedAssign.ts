/**
 * Forced Assign: build an MCQ or a floating-number question from ONLY the
 * lines the teacher highlighted. Never invent missing options or an answer,
 * and never pull in un-highlighted lines.
 */
import { declaredMcqAnswer, isMcqAnswerLabel } from "./inlineMcq";
import type { AssignmentEndpoint } from "./assignmentEndpoints";
import type { McqQuestion } from "@/lib/academia/mcq/core";

export type ForcedOption = { label: string; text: string };

export type ForcedMcq = {
  /** Number written at the start of the highlight ("10", "Question 10"), else null. */
  number: number | null;
  /** Question text without a leading number line. */
  stem: string;
  options: ForcedOption[];
  /** Declared answer letter or True/False, if the highlight included one. */
  answer: string | null;
};

const LETTERS = "ABCDEF";
const BARE_NUMBER_LINE = /^(?:(?:question|example|exercise|problem)\s+)?(\d{1,3})\s*(?:[.):–—-]\s*(.*))?$/i;
const OPTION_LINE = new RegExp(
  `^(?:\\(([${LETTERS}])\\)|([${LETTERS}])\\s*(?:[.):]|[-–—]))\\s*(.*)$`,
  "i",
);
const INLINE_OPTIONS = new RegExp(
  `(?:^|\\s)(?:\\(([${LETTERS}])\\)|([${LETTERS}])\\s*(?:[.):]|[-–—]))\\s*`,
  "gi",
);

export function highlightedLines(text: string): string[] {
  return String(text ?? "")
    .replace(/\r/g, "")
    .split("\n")
    .map((line) => line.trimEnd())
    .filter((line) => line.trim());
}

function optionLabel(a?: string, b?: string): string {
  return (a || b || "").toUpperCase();
}

function splitInlineOptions(line: string): ForcedOption[] | null {
  const matches = [...line.matchAll(INLINE_OPTIONS)];
  if (matches.length < 2 || matches[0]!.index !== 0) return null;
  return matches.map((m, i) => ({
    label: optionLabel(m[1], m[2]),
    text: line.slice(m.index! + m[0].length, matches[i + 1]?.index ?? line.length).trim(),
  })).filter((o) => o.text);
}

/** Read a highlight as an MCQ, accepting incomplete forms without errors. */
export function parseForcedMcq(text: string): ForcedMcq {
  const lines = highlightedLines(text);
  let number: number | null = null;
  const first = lines[0]?.trim() ?? "";
  const lead = first.match(BARE_NUMBER_LINE);
  const looksLikeOption = !!(first && (OPTION_LINE.test(first) || splitInlineOptions(first)));
  if (lead && !looksLikeOption) {
    number = Number(lead[1]);
    const rest = (lead[2] ?? "").trim();
    if (rest) lines[0] = rest;
    else lines.shift();
  }
  const options: ForcedOption[] = [];
  const stemParts: string[] = [];
  let answer: string | null = null;
  for (const raw of lines) {
    const line = raw.trim();
    if (!line) continue;
    if (isMcqAnswerLabel(line)) {
      answer = declaredMcqAnswer(line);
      continue;
    }
    const many = splitInlineOptions(line);
    if (many && many.length >= 2) {
      options.push(...many);
      continue;
    }
    const one = line.match(OPTION_LINE);
    if (one) {
      const text = (one[3] ?? "").trim();
      if (text) options.push({ label: optionLabel(one[1], one[2]), text });
      continue;
    }
    if (options.length === 0 && answer == null) stemParts.push(raw.trim());
  }
  return { number, stem: stemParts.join("\n").trim(), options, answer };
}

/** Student-facing question text: "Question 10" plus the stem, or the stem alone. */
export function formatForcedMcqText(mcq: ForcedMcq): string {
  if (mcq.number != null) {
    return mcq.stem ? `Question ${mcq.number}\n${mcq.stem}` : `Question ${mcq.number}`;
  }
  return mcq.stem;
}

/** Heading written back into the note so the normal Assign pipeline can find it. */
export function forcedMcqHeadingLabel(mcq: ForcedMcq): string {
  return mcq.number != null ? `Question ${mcq.number}` : "Question";
}

export function forcedMcqToQuestion(mcq: ForcedMcq, n = 1): McqQuestion {
  return {
    n,
    text: formatForcedMcqText(mcq),
    options: mcq.options.map((o) => ({ ...o })),
    answer: mcq.answer,
  };
}

export function hasConfirmedAnswer(mcq: Pick<ForcedMcq, "answer">): boolean {
  return !!mcq.answer;
}

/** A complete detected Assign already sits on this highlight. */
export function normalAssignCoversRange(
  endpoints: readonly AssignmentEndpoint[],
  from: number,
  to: number,
): boolean {
  return endpoints.some((endpoint) =>
    endpoint.kind !== "incomplete-mcq" &&
    from < endpoint.at &&
    to > endpoint.from,
  );
}

export type ForcedAssignPhase = "following" | "settled" | "hidden" | "loading";

export function forcedAssignPhase(input: {
  highlighting: boolean;
  hasHighlight: boolean;
  normalAssignHere: boolean;
  aiEditOpen: boolean;
  loading?: boolean;
}): ForcedAssignPhase {
  if (input.aiEditOpen) return "hidden";
  if (input.loading) return "loading";
  if (!input.hasHighlight) return "hidden";
  if (input.highlighting) return "following";
  // Stay on screen for as long as the text is highlighted, even when the
  // highlighted question already has its own Assign button. Hiding here made
  // the marker vanish the moment the teacher let go of the highlight.
  return "settled";
}

/** Keep the faint Assign cluster inside a notes card, never past its right edge. */
export const FORCED_ASSIGN_INSET = 10;

export function forcedAssignFrame(
  card: { left: number; right: number },
  inset: number = FORCED_ASSIGN_INSET,
): { left: number; maxWidth: number } {
  const left = card.left + inset;
  const maxWidth = Math.max(0, card.right - inset - left);
  return { left, maxWidth };
}

