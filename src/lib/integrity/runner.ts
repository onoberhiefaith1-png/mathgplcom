/**
 * Segment-scoped audit runner.
 *
 * Always triggered by the administrator, never scheduled. One segment at a time:
 * a run touches only the requirement ids belonging to that segment, so improving
 * one page never re-runs or disturbs the rest of the system.
 */
import { auditRequirement, type RequirementOutcome, type RunContext } from "./checks";
import { checkTablesExist } from "./audit.functions";
import { domainByKey } from "./segments";
import type { Requirement } from "./types";

export interface Progress {
  index: number;
  total: number;
  requirementId: string;
  status: RequirementOutcome["status"];
}

async function inspectTables(reqs: Requirement[]) {
  const tables = [
    ...new Set(
      reqs.flatMap((r) => r.validation.filter((v) => v.kind === "database").map((v) => v.target)),
    ),
  ];
  if (!tables.length) return {};
  try {
    return await checkTablesExist({ data: { tables } });
  } catch {
    return {};
  }
}

export async function runSegmentAudit(
  segmentKey: string,
  routePaths: Set<string>,
  onProgress?: (p: Progress) => void,
): Promise<RequirementOutcome[]> {
  const domain = domainByKey(segmentKey);
  if (!domain) throw new Error(`Unknown audit segment: ${segmentKey}`);

  const ctx: RunContext = { routePaths, tables: await inspectTables(domain.requirements) };
  const outcomes: RequirementOutcome[] = [];

  for (let i = 0; i < domain.requirements.length; i += 1) {
    const req = domain.requirements[i];
    const outcome = await auditRequirement(req, ctx);
    outcomes.push(outcome);
    onProgress?.({
      index: i + 1,
      total: domain.requirements.length,
      requirementId: req.id,
      status: outcome.status,
    });
  }
  return outcomes;
}

/** Re-audit a single requirement, used by the Review / Fix drawer. */
export async function runRequirementAudit(
  req: Requirement,
  routePaths: Set<string>,
): Promise<RequirementOutcome> {
  const ctx: RunContext = { routePaths, tables: await inspectTables([req]) };
  return auditRequirement(req, ctx);
}
