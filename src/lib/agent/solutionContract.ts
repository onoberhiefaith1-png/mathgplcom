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

/** A line that opens with its condition ("For x = 1, …", "when x < 0, …"). */
const CONDITION_LEAD = /^\s*(?:for|if|when|whenever|with|where|since|given|at|let|because|as)\b/i;

/** More than one full relation on a line means two steps were merged. */
function relationCount(line: string): number {
  return (line.match(/=|<|>|≤|≥/g) ?? []).length;
}

/** A native structure directive occupies its own display line and continues
 *  the step above it (an equation whose result is a matrix, for example). */
const DIRECTIVE_LINE = /^\s*\[\[tool:[^\]]*\]\]\s*$/;
const mergeDirectiveLines = (lines: string[]): string[] => {
  const out: string[] = [];
  for (const line of lines) {
    if (DIRECTIVE_LINE.test(line) && out.length > 0) {
      out[out.length - 1] = `${out[out.length - 1]} ${line.trim()}`;
    } else {
      out.push(line);
    }
  }
  return out;
};

/** Line checks see a structure directive as one anonymous object, never as
 *  its inner attributes (which would read as extra equations). */
const checkable = (line: string): string => line.replace(/\[\[tool:[^\]]*\]\]/g, " M ");

export function checkSolution(question: string, lines: string[]): ContractFault | null {
  const kept = mergeDirectiveLines(
    lines.map((l) => l.trim()).filter((l) => l.length > 0),
  );
  if (kept.length === 0) return { reason: "the solution came back empty" };

  const q = norm(question);
  // Line one restates the question. A question written across several lines
  // (its own matrix data, for example) is restated across the same leading
  // lines, never merged onto one — the restatement ends where the question
  // ends and the working starts on the next line.
  let restateLines = 1;
  if (q.length > 0 && !norm(kept[0]!).includes(q)) {
    const norms = kept.map(norm);
    let acc = norms[0] ?? "";
    let end = 0;
    for (let i = 1; i < kept.length && acc.length < q.length; i++) {
      acc += norms[i] ?? "";
      end = i;
    }
    if (!acc.includes(q)) {
      return {
        reason:
          "line one must restate the question exactly as it was written, before any working begins",
      };
    }
    restateLines = end + 1;
  }

  const working = kept.slice(restateLines);
  if (working.length === 0) {
    return { reason: "there is no working after the question — the solution needs its micro-steps" };
  }

  for (const [index, line] of working.entries()) {
    const text = checkable(line);
    if (DANGLING.test(text)) {
      return {
        reason: `step ${index + 1} is cut off mid-equation ("${text.trim()}") — each line holds one complete step`,
      };
    }
    if (relationCount(text) > 1) {
      // A single running chain ("|1/n − 0| = 1/n ≤ 1/N < ε", a hypothesis
      // followed by its conclusion) is one board step. Relations only merge
      // two steps when a separator sits between two related segments
      // ("x = 3, y = 5", "x = 3 and y = 5").
      let probe = text;
      // A leading condition clause ("For x = 1, f(1) = 1", "when x < 0, …")
      // is the step's setup, never a second equation on the line.
      if (CONDITION_LEAD.test(probe)) probe = probe.replace(/^[^,;]*[,;]\s*/, "");
      const relatedSegments = probe
        .split(/[,;]|\band\b|\bor\b/i)
        .filter((seg) => relationCount(seg) > 0).length;
      if (relatedSegments > 1) {
        return {
          reason: `step ${index + 1} has more than one equation on the same line ("${text.trim()}") — write one step per line`,
        };
      }
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
