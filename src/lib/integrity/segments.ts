/**
 * Segment rollups for the Audit Dashboard.
 *
 * A segment is a domain that already exists in the permanent standard — nothing
 * is invented here. Totals are always folded from individual requirement results
 * so re-auditing one segment updates the global figures automatically.
 */
import { ALL_DOMAINS } from "./standard";
import type { Requirement, RequirementDomain, RequirementStatus } from "./types";
import { worst } from "./checks";

export type ResultMap = Record<string, { status: RequirementStatus; reason?: string | null; evidence?: string | null }>;

export interface Counts {
  total: number;
  PASS: number;
  PARTIAL: number;
  UNKNOWN: number;
  FAIL: number;
  MISSING: number;
}

export function emptyCounts(): Counts {
  return { total: 0, PASS: 0, PARTIAL: 0, UNKNOWN: 0, FAIL: 0, MISSING: 0 };
}

/** The status in force right now: the latest audit result, else the recorded Phase 1 status. */
export function effectiveStatus(req: Requirement, results: ResultMap): RequirementStatus {
  return results[req.id]?.status ?? req.status;
}

export function countRequirements(reqs: Requirement[], results: ResultMap): Counts {
  const counts = emptyCounts();
  for (const r of reqs) {
    counts[effectiveStatus(r, results)] += 1;
    counts.total += 1;
  }
  return counts;
}

export interface SegmentRow {
  key: string;
  title: string;
  summary: string;
  counts: Counts;
  status: RequirementStatus;
  lastAuditedAt: string | null;
  runCount: number;
}

export function segmentRows(
  results: ResultMap,
  meta: Record<string, { lastAuditedAt: string | null; runCount: number }> = {},
): SegmentRow[] {
  return ALL_DOMAINS.map((d) => {
    const counts = countRequirements(d.requirements, results);
    return {
      key: d.key,
      title: d.title,
      summary: d.summary,
      counts,
      status: worst(d.requirements.map((r) => effectiveStatus(r, results))),
      lastAuditedAt: meta[d.key]?.lastAuditedAt ?? null,
      runCount: meta[d.key]?.runCount ?? 0,
    };
  });
}

export function globalCounts(results: ResultMap): Counts {
  const counts = emptyCounts();
  for (const d of ALL_DOMAINS) {
    const c = countRequirements(d.requirements, results);
    counts.total += c.total;
    counts.PASS += c.PASS;
    counts.PARTIAL += c.PARTIAL;
    counts.UNKNOWN += c.UNKNOWN;
    counts.FAIL += c.FAIL;
    counts.MISSING += c.MISSING;
  }
  return counts;
}

export function domainByKey(key: string): RequirementDomain | undefined {
  return ALL_DOMAINS.find((d) => d.key.toLowerCase() === key.toLowerCase());
}

/** Problem segments first, so the broken area is visible immediately. */
export function sortForDashboard(rows: SegmentRow[]): SegmentRow[] {
  const rank: Record<RequirementStatus, number> = { FAIL: 0, MISSING: 1, PARTIAL: 2, UNKNOWN: 3, PASS: 4 };
  return [...rows].sort((a, b) => rank[a.status] - rank[b.status] || a.title.localeCompare(b.title));
}
