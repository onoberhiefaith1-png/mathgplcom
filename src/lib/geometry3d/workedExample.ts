// Exam-style worked example generator.
//
// Turns the live solid into a question + full marking-scheme solution the
// teacher can read out, copy to the board, or paste into a lesson note.

import { shapeMath, type Working } from "./formulaLibrary";
import { formatMeasure, formatValue, unitSuffix } from "./units";
import type { Solid3D } from "./scene3d";

export type ExampleTopic = "volume" | "totalSA" | "lateralSA";

export interface WorkedExample {
  title: string;
  question: string;
  steps: { label: string; line: string }[];
  answer: string;
  marks: number;
}

const TOPIC_TITLE: Record<ExampleTopic, string> = {
  volume: "Volume",
  totalSA: "Total surface area",
  lateralSA: "Curved / lateral surface area",
};

export function workedExample(
  solid: Solid3D, topic: ExampleTopic, unit: string, decimals: number,
): WorkedExample | null {
  const m = shapeMath(solid);
  const working: Working | null =
    topic === "volume" ? m.volume : topic === "totalSA" ? m.totalSA : m.lateralSA;
  if (!working) return null;

  const u = unitSuffix(unit, 1).trim();
  const dimList = m.dimensions
    .map((d) => `${d.label.toLowerCase()} ${d.symbol} = ${formatValue(d.value, decimals)}${u ? ` ${u}` : ""}`)
    .join(", ");

  const question =
    `A ${m.name.toLowerCase()} has ${dimList || "the dimensions shown"}. ` +
    `Calculate its ${TOPIC_TITLE[topic].toLowerCase()}${decimals > 0 ? `, correct to ${decimals} decimal place${decimals === 1 ? "" : "s"}` : ""}.`;

  const steps: { label: string; line: string }[] = [];
  (working.steps ?? []).forEach((s, i) => steps.push({ label: `Step ${i + 1}`, line: s }));
  steps.push({ label: `Step ${steps.length + 1}`, line: `Formula: ${working.formula}` });
  steps.push({ label: `Step ${steps.length + 1}`, line: `Substitute: ${working.substitution}` });
  steps.push({ label: `Step ${steps.length + 1}`, line: `Evaluate: ${working.calculation}` });

  const answer = `${TOPIC_TITLE[topic] === "Volume" ? "V" : "A"} = ${formatMeasure(working.value, unit, decimals, working.power)}`;

  return {
    title: `${m.name} — ${TOPIC_TITLE[topic]}`,
    question,
    steps,
    answer,
    marks: steps.length + 1,
  };
}

/** Plain-text version for copying to the clipboard or a lesson note. */
export function workedExampleText(ex: WorkedExample): string {
  return [
    ex.title,
    "",
    `Question: ${ex.question}`,
    "",
    "Solution:",
    ...ex.steps.map((s) => `  ${s.label}: ${s.line}`),
    `  Answer: ${ex.answer}`,
    "",
    `[${ex.marks} marks]`,
  ].join("\n");
}
