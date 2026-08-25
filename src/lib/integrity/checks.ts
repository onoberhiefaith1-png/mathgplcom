/**
 * Individual check runners for one requirement.
 *
 * The rules are deliberately conservative:
 * - a check only reports PASS when it actually proved something;
 * - a check it cannot run reports UNKNOWN, never PASS;
 * - `manual` checks always report UNKNOWN with MANUAL — REQUIRES HUMAN CONFIRMATION.
 *
 * Nothing here reads or writes application data, and nothing here changes the
 * standard: the registry stays the source of truth.
 */
import type { CheckSpec, Requirement, RequirementStatus } from "./types";

export const MANUAL_NOTE = "MANUAL — REQUIRES HUMAN CONFIRMATION";

export interface CheckOutcome {
  kind: CheckSpec["kind"];
  target: string;
  status: RequirementStatus;
  detail: string;
}

export interface RequirementOutcome {
  requirementId: string;
  status: RequirementStatus;
  evidence: string;
  reason: string | null;
  checks: CheckOutcome[];
}

/** Every source file in the app, loaded lazily so only inspected files are fetched. */
const SOURCES = import.meta.glob("/src/**/*.{ts,tsx}", {
  query: "?raw",
  import: "default",
}) as Record<string, () => Promise<string>>;

const sourceKey = (path: string) => (path.startsWith("/") ? path : `/${path}`);

export function moduleExists(path: string): boolean {
  return Boolean(SOURCES[sourceKey(path)]);
}

async function readSource(path: string): Promise<string | null> {
  const loader = SOURCES[sourceKey(path)];
  if (!loader) return null;
  try {
    return await loader();
  } catch {
    return null;
  }
}

async function runModuleCheck(spec: CheckSpec): Promise<CheckOutcome> {
  const base = { kind: spec.kind, target: spec.target } as const;
  const src = await readSource(spec.target);
  if (src === null) {
    return { ...base, status: "FAIL", detail: `file not found: ${spec.target}` };
  }
  const missing = (spec.expects ?? []).filter((name) => !src.includes(name));
  if (missing.length) {
    return {
      ...base,
      status: "PARTIAL",
      detail: `file exists but these are missing: ${missing.join(", ")}`,
    };
  }
  return {
    ...base,
    status: "PASS",
    detail: spec.expects?.length
      ? `file exists and declares ${spec.expects.join(", ")}`
      : "file exists",
  };
}

function normaliseRoute(path: string): string {
  const trimmed = path.replace(/\/+$/, "") || "/";
  return trimmed.replace(/\$[^/]+/g, "$param").replace(/:[^/]+/g, "$param");
}

function runRouteCheck(spec: CheckSpec, routePaths: Set<string>): CheckOutcome {
  const base = { kind: spec.kind, target: spec.target } as const;
  const wanted = normaliseRoute(spec.target);
  const known = new Set([...routePaths].map(normaliseRoute));
  if (known.has(wanted)) {
    return { ...base, status: "PASS", detail: "route resolves in the router" };
  }
  return { ...base, status: "FAIL", detail: `no route matches ${spec.target}` };
}

function runDatabaseCheck(
  spec: CheckSpec,
  tables: Record<string, { exists: boolean; detail: string }>,
): CheckOutcome {
  const base = { kind: spec.kind, target: spec.target } as const;
  const result = tables[spec.target];
  if (!result) {
    return { ...base, status: "UNKNOWN", detail: "database could not be inspected" };
  }
  return result.exists
    ? { ...base, status: "PASS", detail: result.detail }
    : { ...base, status: "FAIL", detail: result.detail };
}

function unrunnable(spec: CheckSpec, why: string): CheckOutcome {
  return { kind: spec.kind, target: spec.target, status: "UNKNOWN", detail: why };
}

/** Worst status wins — an audit is only as strong as its weakest proof. */
const RANK: Record<RequirementStatus, number> = {
  FAIL: 0,
  MISSING: 1,
  PARTIAL: 2,
  UNKNOWN: 3,
  PASS: 4,
};

export function worst(statuses: RequirementStatus[]): RequirementStatus {
  return statuses.reduce<RequirementStatus>(
    (acc, s) => (RANK[s] < RANK[acc] ? s : acc),
    "PASS",
  );
}

export interface RunContext {
  routePaths: Set<string>;
  tables: Record<string, { exists: boolean; detail: string }>;
}

/**
 * Audits one requirement against the standard.
 *
 * Two rules keep the result honest in both directions:
 * - A run may DEGRADE a requirement only on a check that actually ran and found
 *   a problem (missing file, missing route, missing table, missing symbol).
 * - A run may IMPROVE a requirement only on a `test` or `behaviour` proof that
 *   actually passed. Structural checks alone never turn PARTIAL or UNKNOWN into
 *   PASS, and a check that could not run never counts as evidence either way —
 *   it is recorded as unverified and leaves the recorded status in place.
 */
export async function auditRequirement(
  req: Requirement,
  ctx: RunContext,
): Promise<RequirementOutcome> {
  const checks: CheckOutcome[] = [];
  for (const spec of req.validation) {
    if (spec.kind === "module") checks.push(await runModuleCheck(spec));
    else if (spec.kind === "route") checks.push(runRouteCheck(spec, ctx.routePaths));
    else if (spec.kind === "database") checks.push(runDatabaseCheck(spec, ctx.tables));
    else if (spec.kind === "manual") checks.push(unrunnable(spec, MANUAL_NOTE));
    else if (spec.kind === "test")
      checks.push(unrunnable(spec, `test suite ${spec.target} must be run in the build channel`));
    else checks.push(unrunnable(spec, "behaviour probe could not be run here"));
  }

  const structural = worst(checks.map((c) => c.status));
  const provenByDeepCheck = checks.some(
    (c) => (c.kind === "test" || c.kind === "behaviour") && c.status === "PASS",
  );

  let status = structural;
  let reason: string | null = null;

  if (req.status !== "PASS" && !provenByDeepCheck) {
    status = worst([structural, req.status]);
    reason =
      req.notes ??
      (req.status === "UNKNOWN"
        ? "The audit could not verify this behaviour from the available implementation evidence."
        : "The feature exists, but part of the approved behaviour is incomplete or incorrect.");
  } else if (status !== "PASS") {
    reason = checks
      .filter((c) => c.status !== "PASS")
      .map((c) => `${c.kind} ${c.target}: ${c.detail}`)
      .join(" · ");
  }

  const evidence = checks.length
    ? checks.map((c) => `${c.kind} ${c.target} → ${c.status}`).join(" · ")
    : "no checks declared";

  return { requirementId: req.id, status, evidence, reason, checks };
}
