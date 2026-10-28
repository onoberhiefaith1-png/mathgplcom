// Detects the *next* arithmetic sub-step a student needs while solving a
// fraction-addition / subtraction / mixed problem. Used by the helper rail.

import { useMemo } from "react";
import { Node } from "@/lib/mathboard/tokens";
import { Frac, parseExpr } from "@/lib/fraction-challenge/validator";

export type FractionStep =
  | { kind: "lcm"; numbers: number[] }
  | { kind: "division"; dividend: number; divisor: number }
  | { kind: "multiplication"; a: number; b: number }
  | { kind: "addition"; a: number; b: number; op: "+" | "-" }
  | { kind: "reciprocal"; a: number; b: number; c: number; d: number }
  | null;

export type ChallengeMode =
  | "addition" | "subtraction" | "mixed"
  | "multiplication" | "division" | "mul-div";

const gcd = (a: number, b: number): number => {
  a = Math.abs(a); b = Math.abs(b);
  while (b) [a, b] = [b, a % b];
  return a || 1;
};
const lcm = (a: number, b: number): number => Math.abs(a * b) / gcd(a, b);
const lcmAll = (nums: number[]): number => nums.reduce((acc, n) => lcm(acc, n), 1);

/** Pull denominators out of every top-level frac/mixed in the question nodes. */
const extractDenominators = (nodes: Node[]): number[] => {
  const out: number[] = [];
  for (const n of nodes) {
    if (n.kind === "frac" || n.kind === "mixed") {
      const d = parseExpr((n as any).den);
      if (d && d.d === 1 && d.n > 0) out.push(d.n);
    }
  }
  return out;
};

/** Pull all numerators (with whole adjustment for mixed). */
const extractNumerators = (nodes: Node[]): { num: number; den: number }[] => {
  const out: { num: number; den: number }[] = [];
  for (const n of nodes) {
    if (n.kind === "frac") {
      const num = parseExpr((n as any).num);
      const den = parseExpr((n as any).den);
      if (num && den && den.d === 1 && num.d === 1) out.push({ num: num.n, den: den.n });
    } else if (n.kind === "mixed") {
      const w = parseExpr((n as any).whole);
      const num = parseExpr((n as any).num);
      const den = parseExpr((n as any).den);
      if (w && num && den && den.d === 1 && num.d === 1 && w.d === 1) {
        out.push({ num: w.n * den.n + num.n, den: den.n });
      }
    }
  }
  return out;
};

/** Whether the student row already includes the LCM as a denominator. */
const hasDenominator = (studentNodes: Node[], lcmVal: number): boolean => {
  for (const n of studentNodes) {
    if (n.kind === "frac" || n.kind === "mixed") {
      const d = parseExpr((n as any).den);
      if (d && d.d === 1 && d.n === lcmVal) return true;
    }
  }
  return false;
};

/** Whether student row contains any frac at all. */
const hasFracs = (studentNodes: Node[]): boolean =>
  studentNodes.some((n) => n.kind === "frac" || n.kind === "mixed");

const nodesToFracs = (nodes: Node[]): { num: number; den: number }[] => extractNumerators(nodes);

/** Get top-level frac/mixed terms with their numerator+denominator (whole folded in). */
const extractTerms = (nodes: Node[]): { num: number; den: number }[] => extractNumerators(nodes);

const isMulDivKind = (m?: ChallengeMode) =>
  m === "multiplication" || m === "division" || m === "mul-div";

export const useFractionStep = (
  questionNodes: Node[] | null,
  studentNodes: Node[],
  mode?: ChallengeMode,
): FractionStep => {
  return useMemo<FractionStep>(() => {
    if (!questionNodes || questionNodes.length === 0) return null;

    // Mul/Div modes: helpers focus on numerator × numerator and denominator × denominator.
    if (isMulDivKind(mode)) {
      const terms = extractTerms(questionNodes);
      if (terms.length < 2) return null;

      // Find the operator between the first two terms.
      const firstOp = questionNodes.find(
        (n) => n.kind === "op" && ["*", "/", "·"].includes((n as any).op),
      );
      const op = (firstOp as any)?.op ?? "*";
      const [t1, t2] = terms;

      // Division → first hint is reciprocal (until student has a × in their row).
      const studentHasMul = studentNodes.some(
        (n) => n.kind === "op" && ((n as any).op === "*" || (n as any).op === "·"),
      );
      if (op === "/" && !studentHasMul) {
        return { kind: "reciprocal", a: t1.num, b: t1.den, c: t2.num, d: t2.den };
      }

      // After flipping (or for multiplication directly): show numerator × numerator
      // first; once student has produced a frac with the correct numerator, switch
      // to denominator × denominator.
      const numA = t1.num;
      const numB = op === "/" ? t2.den : t2.num;
      const denA = t1.den;
      const denB = op === "/" ? t2.num : t2.den;
      const expectedNumerator = numA * numB;

      const studentFracs = extractTerms(studentNodes);
      const hasNumeratorDone = studentFracs.some((f) => f.num === expectedNumerator);

      if (!hasNumeratorDone) {
        return { kind: "multiplication", a: numA, b: numB };
      }
      return { kind: "multiplication", a: denA, b: denB };
    }

    // ---- Addition / subtraction / mixed (existing behaviour) ----
    const denoms = extractDenominators(questionNodes);
    if (denoms.length < 2) return null;

    const sameDen = denoms.every((d) => d === denoms[0]);
    const lcmVal = lcmAll(denoms);

    const opNode = questionNodes.find(
      (n) => n.kind === "op" && ((n as any).op === "+" || (n as any).op === "-"),
    );
    const op = (opNode as any)?.op === "-" ? "-" : "+";

    const qFracs = extractTerms(questionNodes);

    if (!sameDen && !hasDenominator(studentNodes, lcmVal)) {
      return { kind: "lcm", numbers: Array.from(new Set(denoms)) };
    }

    if (!sameDen) {
      const studentFracs = extractTerms(studentNodes).filter((f) => f.den === lcmVal);
      if (studentFracs.length < denoms.length) {
        const pendingDen = denoms[studentFracs.length] ?? denoms[0];
        const multiplier = lcmVal / pendingDen;
        const qNum = qFracs[studentFracs.length]?.num ?? 1;
        if (studentNodes.length === 0) {
          return { kind: "division", dividend: lcmVal, divisor: pendingDen };
        }
        if (!hasFracs(studentNodes)) {
          return { kind: "multiplication", a: qNum, b: multiplier };
        }
        return { kind: "division", dividend: lcmVal, divisor: pendingDen };
      }
    }

    const targetFracs = sameDen
      ? qFracs
      : extractTerms(studentNodes).filter((f) => f.den === lcmVal);
    if (targetFracs.length >= 2) {
      return { kind: "addition", a: targetFracs[0].num, b: targetFracs[1].num, op };
    }

    return null;
  }, [questionNodes, studentNodes, mode]);
};
