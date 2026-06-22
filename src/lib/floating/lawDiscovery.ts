// Law Discovery — analyses a teacher correction and proposes a new law.
// The proposal stays pending in floating_law_drafts until the teacher
// explicitly Approves it (then promoted to floating_law_library).

export interface LawDraft {
  name: string;
  reason: string;
  rule: string;
  conditions: string[];
  exceptions: string[];
  examples: Array<{ input: string; output: string }>;
}

export interface DraftInput {
  original: string;
  beforeChips: string[];
  afterChips: string[];
  beforeLawIds: string[];
  reason?: string;
}

/** Heuristic synthesiser — fast, local, no AI call. The teacher always
 *  edits / approves before this becomes an official law. */
export const proposeLaw = (input: DraftInput): LawDraft | null => {
  const { beforeChips, afterChips, original } = input;
  const before = beforeChips.join(" | ");
  const after = afterChips.join(" | ");
  if (before === after) return null;

  const addedShells = afterChips.filter((c) => /[□()]/.test(c) && !beforeChips.includes(c));
  const splitOps = afterChips.filter((c) => /^[+\-−]/.test(c)).length
    - beforeChips.filter((c) => /^[+\-−]/.test(c)).length;

  let name = "Teacher Correction";
  let rule = "When the existing laws do not match this pattern, follow the teacher's transformation.";
  const conditions: string[] = [];
  const exceptions: string[] = [];

  if (addedShells.length > 0) {
    name = `Add ${addedShells[0]} Shell`;
    rule = `When the original contains a structure equivalent to ${addedShells[0]}, emit it as an empty shell and extract its contents.`;
    conditions.push(`Original contains a ${addedShells[0]}-like construct.`);
  } else if (splitOps > 0) {
    name = "Split on Visible Operator";
    rule = "Split the original on top-level + / − that the prior laws missed.";
    conditions.push("A top-level + or − exists that the prior pass kept fused.");
  }

  return {
    name,
    reason: input.reason ?? `Teacher changed "${before}" → "${after}".`,
    rule,
    conditions,
    exceptions,
    examples: [{ input: original, output: after }],
  };
};
