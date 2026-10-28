// Completeness verifier — ensures every salient element from the source
// question/highlight appears somewhere in the generated equations.
//
// We do not enforce 1:1 character match; algebra rewrites legitimately
// introduce/derive new symbols. We only flag when something that was
// in the source is MISSING from the output entirely.

const STRUCT_MARKERS: Array<[string, RegExp]> = [
  ["∫", /∫|\\int\b/],
  ["√", /√|\\sqrt\b/],
  ["=", /=/],
  ["±", /±|\\pm\b/],
  ["fraction", /\\(?:d|t)?frac\b|□\/□|\//],
  ["bracket", /[\(\[]/],
  ["abs", /\|[^|]+\|/],
  ["matrix", /\\begin\{[bp]?matrix\}/],
  ["integral-d", /\bd[a-zA-Z]\b/],
];

const fingerprint = (src: string): {
  identifiers: Set<string>;
  numbers: Set<string>;
  structures: Set<string>;
} => {
  const identifiers = new Set<string>();
  const numbers = new Set<string>();
  const structures = new Set<string>();
  if (!src) return { identifiers, numbers, structures };

  // Identifiers: letters, Greek, function names, subscripted vars.
  const idRe = /[A-Za-zα-ωΑ-Ωπρθφλμσ]+(?:[₀-₉]+|_\{[^}]+\}|_[A-Za-z0-9])?/g;
  const NOISE = new Set(["d","dx","dy","dt","D","DX"]); // d-letters tracked separately
  let m: RegExpExecArray | null;
  while ((m = idRe.exec(src))) {
    const tok = m[0];
    if (NOISE.has(tok)) continue;
    if (tok.length === 1 && /[A-Za-z]/.test(tok)) identifiers.add(tok);
    else identifiers.add(tok);
  }
  // Numbers
  const numRe = /\d+(?:\.\d+)?/g;
  while ((m = numRe.exec(src))) numbers.add(m[0]);
  // Structures
  for (const [name, rx] of STRUCT_MARKERS) {
    if (rx.test(src)) structures.add(name);
  }
  return { identifiers, numbers, structures };
};

export interface CompletenessResult {
  ok: boolean;
  missingIdentifiers: string[];
  missingNumbers: string[];
  missingStructures: string[];
}

export const verifyCompleteness = (
  source: string,
  generated: string,
): CompletenessResult => {
  const src = fingerprint(source);
  const gen = fingerprint(generated);
  const missingIdentifiers: string[] = [];
  const missingNumbers: string[] = [];
  const missingStructures: string[] = [];
  for (const id of src.identifiers) if (!gen.identifiers.has(id)) missingIdentifiers.push(id);
  for (const n of src.numbers) if (!gen.numbers.has(n)) missingNumbers.push(n);
  for (const s of src.structures) if (!gen.structures.has(s)) missingStructures.push(s);
  return {
    ok: missingIdentifiers.length === 0 && missingNumbers.length === 0 && missingStructures.length === 0,
    missingIdentifiers,
    missingNumbers,
    missingStructures,
  };
};

export const summariseMissing = (r: CompletenessResult): string => {
  const parts: string[] = [];
  if (r.missingIdentifiers.length) parts.push(`identifiers: ${r.missingIdentifiers.join(", ")}`);
  if (r.missingNumbers.length) parts.push(`numbers: ${r.missingNumbers.join(", ")}`);
  if (r.missingStructures.length) parts.push(`structures: ${r.missingStructures.join(", ")}`);
  return parts.join(" | ");
};
