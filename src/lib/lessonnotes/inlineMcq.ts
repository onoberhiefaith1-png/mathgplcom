/** Supplied MCQ content only. Never infer, solve, or replace an answer. */
export interface InlineMcq {
  text: string;
  options: { label: string; text: string }[];
  answer: string;
}

export const isMcqAnswerLabel = (text: string) =>
  /^(?:correct\s+)?answer\s*(?::|=|\bis\b|[-–—])\s*\(?[A-E]\)?\s*[.)]?\s*$/i.test(text.trim());

export function parseInlineMcq(source: string): InlineMcq | null {
  const lines = source.replace(/\r/g, "").split("\n").map(s => s.trim()).filter(Boolean);
  const answers = lines.filter(isMcqAnswerLabel);
  if (answers.length !== 1) return null;
  const answerAt = lines.indexOf(answers[0]);
  // Content after the answer belongs to another block, not to this question.
  if (answerAt !== lines.length - 1) return null;
  const answer = answers[0].match(/\(?([A-E])\)?\s*[.)]?\s*$/i)![1].toUpperCase();
  const body = lines.slice(0, answerAt).join("\n");
  const matches = [...body.matchAll(/(?:^|[\n\t ]+)\(?([A-E])[.)]\s+/gi)];
  if (matches.length < 2 || matches.length > 5) return null;
  const labels = matches.map(m => m[1].toUpperCase());
  if (new Set(labels).size !== labels.length || !labels.includes(answer)) return null;
  const text = body.slice(0, matches[0].index).trim().replace(/^(?:Question|Example|Exercise|Classwork)\s+\d+\s*[:.)]?\s*/i, "");
  if (!text || /(?:^|\n)(?:Question|Example|Exercise)\s+\d+/i.test(text)) return null;
  const options = matches.map((m, i) => ({
    label: m[1].toUpperCase(),
    text: body.slice(m.index! + m[0].length, matches[i + 1]?.index ?? body.length).trim(),
  }));
  if (options.some(o => !o.text)) return null;
  return { text, options, answer };
}

export const MIXED_MCQ_GUIDANCE = "Preserve supplied multiple-choice questions exactly: keep their question, option labels, option values, and declared correct answer. Never infer or change the answer. A question with options and a declared correct answer has no generated Solution or Floating Numbers section. Worked questions elsewhere keep their own solutions. Do not turn MCQs into worked exercises or add interface button words to the content.";
