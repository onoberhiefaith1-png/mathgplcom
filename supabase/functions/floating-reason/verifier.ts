// Verification Engine — coverage check + reconstruction test.
// The Floating Numbers Engine MUST NOT approve a chip set unless:
//   (a) every element of the original equation is accounted for, and
//   (b) the chips reconstruct back to the original canonical form.

import { detectElements, fingerprint, type MathElement, labelOf } from "./elementDetector.ts";

export interface CoverageEntry {
  key: string;        // `${kind}:${value}`
  label: string;
  required: number;
  found: number;
}

export interface VerificationReport {
  originalElements: MathElement[];
  generatedElements: MathElement[];
  coverage: CoverageEntry[];
  missing: CoverageEntry[];
  extra: CoverageEntry[];
  coveragePct: number;
  reconstructed: string;
  originalCanonical: string;
  exactMatch: boolean;
  status: "PASS" | "FAIL";
}

/** Normalise a string for reconstruction equality. */
const canonicalise = (s: string): string => {
  if (!s) return "";
  return s
    .replace(/\s+/g, "")
    .replace(/[−–]/g, "-")
    .replace(/[×·]/g, "*")
    .replace(/÷/g, "/")
    .replace(/\\left|\\right/g, "")
    .replace(/\\cdot/g, "*")
    .replace(/\\times/g, "*")
    .replace(/\\div/g, "/")
    .replace(/\\frac/g, "frac")
    .toLowerCase();
};

/** Re-assemble chips into a single string for the reconstruction test.
 *  Chips already carry their own signs (e.g. "-b", "+1"). The result is
 *  the canonical form of `chips.join("")`. */
export const reconstruct = (chips: string[]): string => {
  return canonicalise(chips.join(""));
};

export const verify = (
  original: string,
  chips: string[],
): VerificationReport => {
  const originalElements = detectElements(original);
  // Strip a single leading "+" each chip carries for grouping purposes; the
  // detector will see it again as a real operator if present in the joined
  // form, so we DON'T mutate chips for reconstruction, only for the
  // element-by-element fingerprint.
  const generatedElements = detectElements(chips.join(" "));

  const reqFp = fingerprint(originalElements);
  const gotFp = fingerprint(generatedElements);

  const keys = new Set([...Object.keys(reqFp), ...Object.keys(gotFp)]);
  const coverage: CoverageEntry[] = [];
  const missing: CoverageEntry[] = [];
  const extra: CoverageEntry[] = [];

  for (const key of keys) {
    const required = reqFp[key] ?? 0;
    const found = gotFp[key] ?? 0;
    const [kind, ...rest] = key.split(":");
    const value = rest.join(":");
    const sample: MathElement = { kind: kind as MathElement["kind"], value, raw: value };
    const entry: CoverageEntry = { key, label: labelOf(sample), required, found };
    if (required > 0) coverage.push(entry);
    if (found < required) missing.push({ ...entry, found });
    if (found > required && required === 0) extra.push(entry);
  }

  // Coverage % — proportion of required elements that are present.
  const totalRequired = coverage.reduce((a, c) => a + c.required, 0);
  const totalFound = coverage.reduce((a, c) => a + Math.min(c.found, c.required), 0);
  const coveragePct = totalRequired === 0 ? 100 : Math.round((totalFound / totalRequired) * 100);

  const reconstructed = reconstruct(chips);
  const originalCanonical = canonicalise(original);
  const exactMatch = reconstructed === originalCanonical;

  const status: "PASS" | "FAIL" = missing.length === 0 && exactMatch ? "PASS" : "FAIL";

  return {
    originalElements,
    generatedElements,
    coverage,
    missing,
    extra,
    coveragePct,
    reconstructed,
    originalCanonical,
    exactMatch,
    status,
  };
};
