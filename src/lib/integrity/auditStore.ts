/**
 * Persistence for audit runs, per-requirement results and repair orders.
 * Admin-only at the database level; this module only reads and writes audit
 * records — never application data and never the standard.
 */
import { supabase } from "@/integrations/supabase/client";
import type { RequirementStatus } from "./types";
import type { RequirementOutcome } from "./checks";
import type { ResultMap } from "./segments";

export interface AuditRunRow {
  id: string;
  segment_key: string;
  run_no: number;
  started_at: string;
  finished_at: string | null;
  total: number;
  pass_count: number;
  partial_count: number;
  unknown_count: number;
  fail_count: number;
  missing_count: number;
}

/** Latest stored result per requirement, across every segment. */
export async function loadLatestResults(): Promise<ResultMap> {
  const { data, error } = await supabase
    .from("integrity_requirement_results")
    .select("requirement_id, status, reason, evidence, created_at")
    .order("created_at", { ascending: false });
  if (error) throw error;
  const map: ResultMap = {};
  for (const row of data ?? []) {
    if (map[row.requirement_id]) continue; // first hit is the newest
    map[row.requirement_id] = {
      status: row.status as RequirementStatus,
      reason: row.reason,
      evidence: row.evidence,
    };
  }
  return map;
}

export async function loadRunMeta(): Promise<Record<string, { lastAuditedAt: string | null; runCount: number }>> {
  const { data, error } = await supabase
    .from("integrity_audit_runs")
    .select("segment_key, finished_at, started_at")
    .order("started_at", { ascending: false });
  if (error) throw error;
  const meta: Record<string, { lastAuditedAt: string | null; runCount: number }> = {};
  for (const row of data ?? []) {
    const entry = meta[row.segment_key] ?? { lastAuditedAt: null, runCount: 0 };
    if (!entry.lastAuditedAt) entry.lastAuditedAt = row.finished_at ?? row.started_at;
    entry.runCount += 1;
    meta[row.segment_key] = entry;
  }
  return meta;
}

export async function loadSegmentHistory(segmentKey: string): Promise<AuditRunRow[]> {
  const { data, error } = await supabase
    .from("integrity_audit_runs")
    .select("*")
    .eq("segment_key", segmentKey)
    .order("run_no", { ascending: false });
  if (error) throw error;
  return (data ?? []) as AuditRunRow[];
}

export async function saveRun(
  segmentKey: string,
  outcomes: RequirementOutcome[],
): Promise<AuditRunRow> {
  const { data: last } = await supabase
    .from("integrity_audit_runs")
    .select("run_no")
    .eq("segment_key", segmentKey)
    .order("run_no", { ascending: false })
    .limit(1)
    .maybeSingle();

  const { data: auth } = await supabase.auth.getUser();
  const tally = (s: RequirementStatus) => outcomes.filter((o) => o.status === s).length;

  const { data: run, error } = await supabase
    .from("integrity_audit_runs")
    .insert({
      segment_key: segmentKey,
      run_no: (last?.run_no ?? 0) + 1,
      actor: auth.user?.id ?? null,
      finished_at: new Date().toISOString(),
      total: outcomes.length,
      pass_count: tally("PASS"),
      partial_count: tally("PARTIAL"),
      unknown_count: tally("UNKNOWN"),
      fail_count: tally("FAIL"),
      missing_count: tally("MISSING"),
    })
    .select("*")
    .single();
  if (error) throw error;

  const { error: resultsError } = await supabase.from("integrity_requirement_results").insert(
    outcomes.map((o) => ({
      run_id: run.id,
      segment_key: segmentKey,
      requirement_id: o.requirementId,
      status: o.status,
      evidence: o.evidence,
      reason: o.reason,
      check_details: o.checks as unknown as never,
    })),
  );
  if (resultsError) throw resultsError;

  return run as AuditRunRow;
}

export async function createRepairOrder(order: {
  requirementId: string;
  segmentKey: string;
  standardSnapshot: unknown;
  restorationSource: string | null;
  scope: string;
}) {
  const { data: auth } = await supabase.auth.getUser();
  const { data, error } = await supabase
    .from("integrity_repair_orders")
    .insert({
      requirement_id: order.requirementId,
      segment_key: order.segmentKey,
      standard_snapshot: order.standardSnapshot as never,
      restoration_source: order.restorationSource,
      scope: order.scope,
      created_by: auth.user?.id ?? null,
    })
    .select("*")
    .single();
  if (error) throw error;
  return data;
}

export async function loadRepairOrders(requirementId: string) {
  const { data, error } = await supabase
    .from("integrity_repair_orders")
    .select("*")
    .eq("requirement_id", requirementId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data ?? [];
}
