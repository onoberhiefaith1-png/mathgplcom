/**
 * MathGPL Permanent System Standard — record types.
 *
 * These types describe the *standard*, not the app. A requirement record says
 * what MathGPL was approved to do, where that behaviour currently lives, how to
 * validate it, and what may be used to restore it. The future
 * Administrator-triggered CHECK SYSTEM screen reads this registry directly.
 *
 * Rules baked into the shape:
 * - `status` describes the approved BEHAVIOUR, never code similarity. A refactor
 *   that still satisfies the requirement is PASS.
 * - Anything not evidenced by project history or current code is UNKNOWN.
 * - `permanent` only becomes "approved" through an explicit Administrator action
 *   recorded in the database, never by an agent editing this file.
 */

export type RequirementStatus =
  | "PASS"
  | "PARTIAL"
  | "FAIL"
  | "MISSING"
  | "UNKNOWN";

export type PermanentStatus =
  | "PENDING"
  | "APPROVED_PERMANENT"
  | "CHANGED_BY_OWNER"
  | "RETIRED";

export type Severity = "CRITICAL" | "HIGH" | "MEDIUM" | "LOW";

/** How a requirement can be verified when CHECK SYSTEM runs. */
export type CheckKind =
  /** A route path must resolve in the router. */
  | "route"
  /** A file must exist and export the named symbols. */
  | "module"
  /** A database table/column/policy/function must exist. */
  | "database"
  /** A vitest suite must pass. */
  | "test"
  /** A scripted browser interaction must succeed. */
  | "behaviour"
  /** No automated proof is possible — the Administrator confirms by eye. */
  | "manual";

export interface CheckSpec {
  kind: CheckKind;
  /** Route path, module path, table name, test file, or a human instruction. */
  target: string;
  /** Named exports / columns / policies that must be present. */
  expects?: string[];
  notes?: string;
}

export interface ImplementationRef {
  /** Repository-relative file paths. */
  files?: string[];
  /** Components, hooks or functions that carry the behaviour. */
  symbols?: string[];
  /** Router paths the requirement is reachable through. */
  routes?: string[];
  /** Database tables the requirement reads or writes. */
  tables?: string[];
  /** RPCs / database functions. */
  dbFunctions?: string[];
  /** RLS policies, capabilities or grants that gate it. */
  permissions?: string[];
  /** Anything else: storage buckets, edge functions, external services. */
  other?: string[];
}

export interface Requirement {
  /** Stable identifier, e.g. "AREA-004". Never reused, never renumbered. */
  id: string;
  name: string;
  /** Domain label; matches the owning domain file. */
  category: string;
  /**
   * Where the requirement comes from: the discussion, decision, plan file or
   * memory that approved it. "code-evidenced" means the requirement was read
   * off an existing, clearly intentional implementation.
   */
  source: string;
  /** What must always be true. */
  requirement: string;
  /** Approved behaviour, in operational detail. */
  behaviour: string[];
  /** Approved UI: what is displayed and how it responds. */
  ui?: string[];
  /** Approved data: what must exist and how it relates. */
  data?: string[];
  /** Approved permissions: who may see, edit or control it. */
  permissions?: string[];
  /** Where the approved behaviour currently lives. */
  implementation: ImplementationRef;
  /** Other requirement ids that must be re-checked when this one changes. */
  dependencies?: string[];
  /** How the system proves the requirement still holds. */
  validation: CheckSpec[];
  /**
   * Verified approved implementation usable for restoration: a plan file, an
   * archived decision, a test that pins the behaviour, or "NONE" when no safe
   * source exists (correction must then ask the Administrator).
   */
  restorationSource: string;
  status: RequirementStatus;
  /** Only set when status is not PASS. */
  severity?: Severity;
  permanent: PermanentStatus;
  notes?: string;
}

export interface RequirementDomain {
  /** Short key used in ids and in the report, e.g. "AREA". */
  key: string;
  title: string;
  /** One-line description of the domain's responsibility. */
  summary: string;
  /**
   * What was inspected to build this domain and what is still unproven. Written
   * so gaps are visible instead of implied.
   */
  coverage: string;
  requirements: Requirement[];
}

export const statusOrder: RequirementStatus[] = [
  "FAIL",
  "MISSING",
  "PARTIAL",
  "UNKNOWN",
  "PASS",
];

/** Aggregate counts for a CHECK SYSTEM report. */
export function summarise(domains: RequirementDomain[]) {
  const counts: Record<RequirementStatus, number> = {
    PASS: 0,
    PARTIAL: 0,
    FAIL: 0,
    MISSING: 0,
    UNKNOWN: 0,
  };
  let total = 0;
  for (const d of domains) {
    for (const r of d.requirements) {
      counts[r.status] += 1;
      total += 1;
    }
  }
  return { total, counts };
}
