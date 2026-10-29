// The lesson-note solution contract.
//
// A solution is only saved when it is written the way a teacher writes on a
// board: the question restated first, then one micro-step per line, and never an
// equation chopped into pieces across lines. Pure and client-safe so it can be
// tested on its own.

export type ContractFault = { reason: string };

const SUPERSCRIPTS: Record<string, string> = {
  "⁰":"0", "¹":"1", "²":"2", "³":"3", "⁴":"4", "⁵":"5", "⁶":"6", "⁷":"7", "⁸":"8", "⁹":"9",
  "⁺":"+", "⁻":"-", "ⁿ":"n", "ⁱ":"i",
};

const norm = (text: string) =>
  text
    .toLowerCase()
    .replace(/[−–—]/g, "-")
    .replace(/[⁰¹²³⁴⁵⁶⁷⁸⁹⁺⁻ⁿⁱ]+/g, run => "^" + Array.from(run, char => SUPERSCRIPTS[char]).join(""))
    .replace(/\\\\?[a-z]+/g, " ")
    .replace(/[\s{}$]+/g, "")
    .replace(/[^\p{L}\p{N}+\-*/^=().,<>≤≥]/gu, "");

/** A line that ends mid-thought: an equation continued on the next line. */
const DANGLING = /(=|\+|-|\*|\/|\^|,|\(|\bor\b|\band\b|\\times|\\div)\s*$/i;

/** Formatting attributes and parallel matrix cells are not extra equations. */
function outsideStructures(line: string): string {
  return line
    .replace(/\[\[tool:[\s\S]*?\]\]/g, "M")
    .replace(/\\begin\{(bmatrix|pmatrix|matrix|vmatrix|Vmatrix|Bmatrix|cases)\}[\s\S]*?\\end\{\1\}/g, "M")
    // Bounds belong to their operator, e.g. sum_{k=1}^{n}, not the main relation.
    .replace(/[_^]\{[^{}]*\}/g, "");
}

function isStructure(line: string): boolean {
  return /^\s*(?:\[\[tool:structure\b[\s\S]*\]\]|\\begin\{(?:[pbBvV]?matrix|cases)\}[\s\S]*\\end\{(?:[pbBvV]?matrix|cases)\})\s*$/.test(line);
}

function relationCount(line: string): number {
  return (outsideStructures(line).match(/=|<|>|≤|≥/g) ?? []).length;
}

/** A proof's monotone inequality chain is one bound, not unrelated equations. */
function isBoundChain(line: string): boolean {
  const text = outsideStructures(line);
  const relations = text.match(/=|<|>|≤|≥/g) ?? [];
  const fewer = relations.some(r => r === "<" || r === "≤");
  const greater = relations.some(r => r === ">" || r === "≥");
  return fewer !== greater && relations.filter(r => r === "=").length <= 1 &&
    !/\b(and|or|then)\b|[;,]/i.test(text) &&
    text.split(/=|<|>|≤|≥/).every(part => part.trim());
}

export function checkSolution(question: string, lines: string[]): ContractFault | null {
  const kept = lines.map((l) => l.trim()).filter((l) => l.length > 0);
  if (kept.length === 0) return { reason: "the solution came back empty" };

  const q = norm(question);
  let restatedLines = 1;
  let restatement = norm(kept[0]!);
  // Native objects put a multi-line question on several display lines. Match
  // its entire leading sequence, never search later working for a stray match.
  while (q && q.startsWith(restatement) && restatement !== q && restatedLines < kept.length) {
    restatement += norm(kept[restatedLines++]);
  }
  if (q.length > 0 && !restatement.includes(q)) {
    return {
      reason:
        "line one must restate the question exactly as it was written, before any working begins",
    };
  }

  const working = kept.slice(restatedLines);
  if (working.length === 0) {
    return { reason: "there is no working after the question — the solution needs its micro-steps" };
  }

  for (const [index, line] of working.entries()) {
    // A named expression or equality sign may introduce an editable matrix on
    // the following display line. An ordinary chopped equation is still refused.
    const introducesStructure = /(?:=|[×+−-])\s*$/.test(line) && isStructure(working[index + 1] ?? "") &&
      (line.trim() !== "=" || isStructure(working[index - 1] ?? ""));
    if (DANGLING.test(outsideStructures(line)) && !introducesStructure) {
      return {
        reason: `step ${index + 1} is cut off mid-equation ("${line}") — each line holds one complete step`,
      };
    }
    if (relationCount(line) > 1 && !isBoundChain(line)) {
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
    "and never putting unrelated equations on one line.",
    "Keep a matrix as one editable object; its formatting attributes are not equations.",
    "A matrix may follow its introducing expression on the next display line.",
    "A justified monotone inequality chain is one proof step.",
  ].join(" ");
}
