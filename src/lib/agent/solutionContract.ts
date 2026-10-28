// The lesson-note solution contract.
//
// A solution is only saved when it is written the way a teacher writes on a
// board: the question restated first, then one micro-step per line, and never an
// equation chopped into pieces across lines. Pure and client-safe so it can be
// tested on its own.

export type ContractFault = { reason: string };

const norm = (text: string) =>
  text
    .toLowerCase()
    .replace(/\\\\?[a-z]+/g, " ")
    .replace(/[\s{}$]+/g, "")
    .replace(/[^a-z0-9+\-*/^=().,]/g, "");

/** A line that ends mid-thought: an equation continued on the next line. */
const DANGLING = /(=|\+|-|\*|\/|\^|,|\(|\bor\b|\band\b|\\times|\\div)\s*$/i;

/** More than one full relation on a line means two steps were merged. */
function relationCount(line: string): number {
  return (line.match(/=|<|>|≤|≥/g) ?? []).length;
}

export function checkSolution(question: string, lines: string[]): ContractFault | null {
  const kept = lines.map((l) => l.trim()).filter((l) => l.length > 0);
  if (kept.length === 0) return { reason: "the solution came back empty" };

  const first = kept[0]!;
  const q = norm(question);
  if (q.length > 0 && !norm(first).includes(q)) {
    return {
      reason:
        "line one must restate the question exactly as it was written, before any working begins",
    };
  }

  const working = kept.slice(1);
  if (working.length === 0) {
    return { reason: "there is no working after the question — the solution needs its micro-steps" };
  }

  for (const [index, line] of working.entries()) {
    if (DANGLING.test(line)) {
      return {
        reason: `step ${index + 1} is cut off mid-equation ("${line}") — each line holds one complete step`,
      };
    }
    if (relationCount(line) > 1) {
      return {
        reason: `step ${index + 1} has more than one equation on the same line ("${line}") — write one step per line`,
      };
    }
  }
  return null;
}

/** The correction sent back to the generator when the first attempt fails. */
export function retryInstruction(fault: ContractFault): string {
  return [
    "The previous attempt was rejected because",
    `${fault.reason}.`,
    "Rewrite it as a classroom board solution: line one restates the question word for word,",
    "then one complete micro-step on each following line, never splitting an equation across lines",
    "and never putting two equations on one line.",
  ].join(" ");
}
