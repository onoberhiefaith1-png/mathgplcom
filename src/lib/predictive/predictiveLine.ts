// PREDICTIVE LINE ENGINE — one shared mathematical route engine.
//
// The Smartboard and the Game both consume this module. It owns NO marking, no
// rewards and no Vault logic: it answers one question, in memory, with no
// network call —
//
//   "Given the teacher's expected line, the Floating Numbers available on this
//    line and what the student has written so far, is the line already
//    equivalent, and if not what is the shortest remaining route to it?"
//
// Equivalence itself is NOT reimplemented here: it reuses the app's existing
// exact-fraction polynomial canonicaliser (`equationsEquivalent`). The engine
// only searches the finite space of Floating Numbers the teacher generated.

import { equationsEquivalent, normEq } from "@/lib/smartboard/rowAscii";
import { linearize, parseLine, structurallyEquivalent } from "@/lib/math/structure";

export type PredictStatus = "empty" | "incomplete" | "complete" | "no_route" | "incomplete_structure";

export interface RouteMap {
  /** The teacher's line, unchanged. */
  expected: string;
  /** Normalised target, cached so every keystroke compares cheaply. */
  target: string;
  /** Does the expected line state a relation? Then only a full one can complete it. */
  isEquation: boolean;
  /** The finite building blocks the student can actually place. */
  atoms: string[];
  /** Cache key: question + line + the atoms themselves. */
  key: string;
}

export interface Prediction {
  status: PredictStatus;
  /** Student construction + shortest valid remaining route. */
  predictive: string;
  /** The atoms the route still needs, in order. */
  remaining: string[];
  /** True only when the local engine PROVED equivalence. */
  complete: boolean;
  /** For an unfinished structure: what to finish, in plain words. */
  missing?: string;
  /** The single piece that would finish the current correct route (shown red). */
  completionToken?: string | null;
}

/** Search budget — kept small so a prediction never costs a visible frame. */
const MAX_ROUTE_ATOMS = 6;
const MAX_NODES = 4000;

const clean = (value: string | null | undefined) => String(value ?? "").trim();

const splitEq = (s: string) => {
  const i = s.indexOf("=");
  return i < 0 ? { lhs: s, rhs: null as string | null } : { lhs: s.slice(0, i), rhs: s.slice(i + 1) };
};

/**
 * An equation target is a complete statement. A one-sided fragment (the shape a
 * Vault code usually has) can never complete the line — the same rule the
 * authoritative marking service enforces.
 */
export const hasCompleteShape = (expected: string, student: string): boolean => {
  const target = splitEq(linearize(expected).replace(/<=|>=|!=|<|>/g, "="));
  if (target.rhs === null) return clean(student).length > 0;
  const written = splitEq(linearize(student).replace(/<=|>=|!=|<|>/g, "="));
  return written.rhs !== null && written.lhs.trim().length > 0 && written.rhs.trim().length > 0;
};

/**
 * Set-aware, side-order-free proof: `{1,2,3} = A` equals `A = {3,2,1}`.
 * Only fires when a set literal is present, so ordinary algebra is untouched.
 */
const canonSet = (side: string): string =>
  side.replace(/\\?\{([^{}]*)\\?\}/g, (_m, body: string) =>
    `{${body.split(",").map((m) => m.replace(/\s+/g, "")).filter(Boolean).sort().join(",")}}`,
  ).replace(/\s+/g, "");
export const setEquivalent = (expected: string, student: string): boolean => {
  if (!/\{/.test(expected) || !/\{/.test(student)) return false;
  const e = splitEq(expected); const s = splitEq(student);
  if (e.rhs === null || s.rhs === null) return canonSet(expected) === canonSet(student);
  const [el, er, sl, sr] = [e.lhs, e.rhs, s.lhs, s.rhs].map(canonSet);
  if (!sl || !sr) return false;
  return (el === sl && er === sr) || (el === sr && er === sl);
};

/** Is this written line already the expected mathematics? Local proof only. */
export const provesEquivalent = (expected: string, student: string): boolean => {
  const e = clean(expected);
  const s = clean(student);
  if (!e || !s) return false;
  if (!hasCompleteShape(e, s)) return false;
  if (setEquivalent(e, s)) return true;
  if (parseLine(s).state !== "valid") return false;
  try {
    if (equationsEquivalent(e, s)) return true;
  } catch {
    /* fall through to structural proof */
  }
  return structurallyEquivalent(e, s);
};

export const buildRouteMap = (input: {
  expectedAscii: string;
  atoms: readonly string[];
  keyPrefix?: string;
}): RouteMap => {
  const expected = clean(input.expectedAscii);
  const atoms = input.atoms.map((a) => clean(a)).filter((a) => a.length > 0);
  return {
    expected,
    target: normEq(expected),
    isEquation: expected.includes("="),
    atoms,
    key: `${input.keyPrefix ?? ""}|${expected}|${atoms.join("\u0001")}`,
  };
};

/** Whitespace/glyph-only tidy — safe for matching single symbols like `+`. */
const plain = (value: string): string =>
  String(value ?? "")
    .replace(/\\d?frac\s*\{([^{}]*)\}\s*\{([^{}]*)\}/g, "$1/$2")
    .replace(/\\sqrt\s*\{([^{}]*)\}/g, "√$1")
    .replace(/[{}]/g, "")
    .toLowerCase()
    .replace(/\s+/g, "")
    .replace(/−/g, "-")
    .replace(/[×·]/g, "*")
    .replace(/÷/g, "/");

/** The atoms still unplaced: each atom the student already wrote is consumed once. */
export const remainingAtoms = (atoms: readonly string[], studentAscii: string): string[] => {
  let rest = plain(studentAscii);
  const left: string[] = [];
  for (const atom of atoms) {
    const piece = plain(atom);
    const at = piece ? rest.indexOf(piece) : -1;
    if (at >= 0) rest = rest.slice(0, at) + rest.slice(at + piece.length);
    else left.push(atom);
  }
  return left;

};

const joinRoute = (student: string, route: readonly string[]): string =>
  [clean(student), ...route.map((r) => clean(r))].filter((p) => p.length > 0).join(" ");

/**
 * Shortest valid remaining route, searched breadth-first over the remaining
 * Floating Numbers so the first hit is always a shortest one. Equal-length
 * routes resolve deterministically by the teacher's atom order.
 *
 * The student's own writing is the ANCHOR: a route that continues from what the
 * student already wrote always wins. Only when no continuation whatsoever can
 * reach the expected mathematics do we fall back to a route that places the
 * student's text later in the line — a re-routing map never rewrites the road
 * already travelled.
 */
const searchRoute = (
  map: RouteMap,
  student: string,
  pool: readonly string[],
): { route: string[]; predictive: string } | null => {
  if (pool.length === 0) return null;
  // A fraction is ONE structure built from two Floating Numbers: offer every
  // numerator/denominator pair as a single composite step.
  const moves: Array<{ piece: string; uses: number[] }> = pool.map((p, i) => ({ piece: p, uses: [i] }));
  const operand = (a: string) => !/^(=|<|>|≤|≥|\+|-|−|×|÷|\*|\/)$/.test(a.trim());
  const wantsFractions = /\\frac|\//.test(map.expected);
  for (let i = 0; wantsFractions && i < pool.length && pool.length <= 6; i++)
    for (let j = 0; j < pool.length; j++)
      if (i !== j && operand(pool[i]) && operand(pool[j]))
        moves.push({ piece: `\\frac{${pool[i]}}{${pool[j]}}`, uses: [i, j] });
  let frontier: Array<{ route: string[]; used: number[] }> = [{ route: [], used: [] }];
  let nodes = 0;
  const depth = Math.min(MAX_ROUTE_ATOMS, pool.length);
  let fallback: { route: string[]; predictive: string } | null = null;
  for (let d = 0; d < depth; d++) {
    const next: Array<{ route: string[]; used: number[] }> = [];
    for (const state of frontier) {
      for (const move of moves) {
        if (move.uses.some((u) => state.used.includes(u))) continue;
        if (++nodes > MAX_NODES) return fallback;
        const route = [...state.route, move.piece];
        // Preferred: the student keeps writing forward from here.
        const after = joinRoute(student, route);
        if (provesEquivalent(map.expected, after)) return { route, predictive: after };
        if (!fallback) {
          const before = joinRoute(route.join(" "), [student]);
          if (provesEquivalent(map.expected, before)) fallback = { route, predictive: before };
        }
        next.push({ route, used: [...state.used, ...move.uses] });
      }
    }
    if (next.length === 0) break;
    frontier = next;
  }
  return fallback;
};

/** Routes already proved equivalent, per line — the Completion Token's answer is ready before it is placed. */
const preEvaluated = new Map<string, Set<string>>();
const rememberProved = (key: string, line: string) => {
  if (preEvaluated.size > 64) preEvaluated.clear();
  const set = preEvaluated.get(key) ?? new Set<string>();
  set.add(normEq(line));
  preEvaluated.set(key, set);
};
export const isPreEvaluated = (key: string, line: string): boolean =>
  preEvaluated.get(key)?.has(normEq(line)) ?? false;

export const predict = (input: {
  routeMap: RouteMap;
  studentAscii: string;
  /** Desktop keyboard fallback: free mathematics is judged when no atom route exists. */
  allowFreeInput?: boolean;
}): Prediction => {
  const map = input.routeMap;
  const student = clean(input.studentAscii);

  // PRE-EVALUATED: this exact line was already proved as a predicted route —
  // confirm instantly, no second search.
  if (student && preEvaluated.get(map.key)?.has(normEq(student))) {
    return { status: "complete", predictive: student, remaining: [], complete: true, completionToken: null };
  }

  // Already there — the mark can land on this very keystroke.
  if (student && provesEquivalent(map.expected, student)) {
    return { status: "complete", predictive: student, remaining: [], complete: true };
  }

  const pool = remainingAtoms(map.atoms, student);

  // Nothing written yet: the first prediction is simply the teacher's line.
  if (!student) {
    return { status: "empty", predictive: map.expected, remaining: pool, complete: false };
  }

  // Structure first: an unfinished fraction/root/bracket is NOT a dead end.
  const parsed = parseLine(student);
  const pending = parsed.state === "incomplete" && !/^[^=<>]*[=<>]$/.test(student.trim());

  const found = searchRoute(map, student, pool);
  if (found) {
    rememberProved(map.key, found.predictive);
    return {
      status: "incomplete",
      predictive: found.predictive,
      remaining: found.route,
      complete: false,
      completionToken: found.route.length ? found.route[found.route.length - 1] : null,
    };
  }

  // No Floating-Number route survives from here. On a keyboard surface the
  // student may still type their way to an equivalent line, so the expected
  // line stays the destination rather than declaring a dead end.
  if (pending) {
    return {
      status: "incomplete_structure",
      predictive: map.expected,
      remaining: [],
      complete: false,
      missing: parsed.missing,
    };
  }
  if (input.allowFreeInput) {
    return { status: "incomplete", predictive: map.expected, remaining: [], complete: false };
  }
  return { status: "no_route", predictive: "", remaining: [], complete: false };
};

/** One small cache so a route map is built once per line, not per keystroke. */
const maps = new Map<string, RouteMap>();

export const routeMapFor = (input: {
  expectedAscii: string;
  atoms: readonly string[];
  keyPrefix?: string;
}): RouteMap => {
  const built = buildRouteMap(input);
  const cached = maps.get(built.key);
  if (cached) return cached;
  if (maps.size > 64) maps.clear();
  maps.set(built.key, built);
  return built;
};

export const PREDICTIVE_NO_ROUTE_LABEL = "NO VALID ROUTE";
