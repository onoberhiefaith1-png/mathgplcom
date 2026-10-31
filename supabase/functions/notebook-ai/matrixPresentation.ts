// Canonicalize only explicit, fully specified matrix data. Never infer rows
// from a flattened saved node or invent a missing value.
function directiveParams(source: string): Record<string, string> {
  const params: Record<string, string> = {};
  for (const attr of source.matchAll(/([\w-]+)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s]+))/g)) {
    params[attr[1]] = attr[2] ?? attr[3] ?? attr[4];
  }
  return params;
}

export function normalizeMatrixDirectives(text: string): string {
  let out = text.replace(/\[matrix\s+([^\]\n]*)\]/gi, (original, attributes: string) => {
    const params = directiveParams(attributes);
    if (params.kind && params.kind !== "matrix") return original;
    const candidate = `[[tool:structure kind="matrix" ${attributes}]]`;
    return matrixPresentationIssues(candidate).length ? original : candidate;
  });
  // A native structure occupies its own display line; surrounding question
  // wording is retained in order, never treated as a different question.
  out = out.replace(/\[\[tool:structure\s+[^\]]*\]\]/g, (directive, offset: number, source: string) => {
    if (directiveParams(directive).kind !== "matrix") return directive;
    const before = source.slice(0, offset), after = source.slice(offset + directive.length);
    return `${/(?:^|\n)[ \t]*$/.test(before) ? "" : "\n"}${directive}${/^[ \t]*(?:\n|$)/.test(after) ? "" : "\n"}`;
  });
  return out;
}

/** Structural checks only: this cannot establish the correctness of a proof.
 * Used by bounded repairs and the final refusal gate before saving content. */
export function matrixPresentationIssues(text: string): string[] {
  const problems: string[] = [];
  if (/\[matrix\s+[^\]\n]*\b(?:rows|cols|slots)\s*=/i.test(text)) {
    problems.push("Unsupported matrix shorthand reached the lesson; use the native editable matrix structure with explicit rows, cols and slots.");
  }
  for (const match of text.matchAll(/\[\[tool:structure\s+([^\]]*)\]\]/g)) {
    const params: Record<string, string> = {};
    for (const attr of match[1].matchAll(/([\w-]+)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s]+))/g)) {
      params[attr[1]] = attr[2] ?? attr[3] ?? attr[4];
    }
    if (params.kind !== "matrix") continue;
    const rows = Number(params.rows), cols = Number(params.cols);
    const slots = params.slots?.split("|") ?? [];
    if (!Number.isInteger(rows) || rows < 1 || !Number.isInteger(cols) || cols < 1) {
      problems.push("Matrix dimensions must be explicit positive integer rows and cols.");
    } else if (slots.length !== rows * cols) {
      problems.push(`A ${rows} by ${cols} matrix needs ${rows * cols} slots in row-major order; received ${slots.length}. Keep blank and zero slots in position.`);
    }
  }
  for (const match of text.matchAll(/\\begin\{(bmatrix|pmatrix|matrix|vmatrix|Vmatrix|Bmatrix)\}([\s\S]*?)\\end\{\1\}/g)) {
    const rows = match[2].split(/\\\\/).map(row => row.trim()).filter(Boolean).map(row => row.split("&"));
    if (!rows.length || rows.some(row => row.length !== rows[0].length)) {
      problems.push("Matrix rows have inconsistent column counts; restore the original dimensions and cell positions.");
    }
  }
  return problems;
}
