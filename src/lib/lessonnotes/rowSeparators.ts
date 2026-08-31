// `\\` is a ROW SEPARATOR inside a matrix environment and a HARD LINE BREAK
// anywhere else. Models emit it as a general break in teacher-facing question
// text ("shade: \\ a) A' \\ b) (A ∪ B)'"), where it used to survive as visible
// source and glue every part of a multi-part question into one unsplittable
// blob — so the parts never became separate solvable units and Problem Check
// reported "no mathematical expression".
//
// Matrix bodies are left byte-identical; everywhere else the separator becomes
// a real newline.

const MATRIX_ENV = /\\begin\{(bmatrix|pmatrix|matrix|vmatrix|Vmatrix|Bmatrix)\}([\s\S]*?)\\end\{\1\}/g;

function outside(s: string): string {
  return s
    .replace(/\\newline\s*/g, "\n")
    .replace(/[ \t]*\\{2,}[ \t]*/g, "\n")
    .replace(/\n{3,}/g, "\n\n");
}

export function breakRowSeparators(text: string): string {
  if (!text) return text;
  const re = new RegExp(MATRIX_ENV.source, "g");
  let out = "";
  let last = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text))) {
    out += outside(text.slice(last, m.index)) + m[0];
    last = m.index + m[0].length;
  }
  out += outside(text.slice(last));
  return out;
}
