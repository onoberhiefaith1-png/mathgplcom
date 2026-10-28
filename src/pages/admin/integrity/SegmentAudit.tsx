/**
 * Segment audit page — SEGMENTS → REQUIREMENTS → EVIDENCE → STATUS → CORRECTION → RE-AUDIT.
 *
 * Shows only the requirements that belong to this segment. Auditing here checks
 * only these requirements against the existing standard; the standard itself is
 * never created, weakened or retired by an audit.
 */
import { Fragment, useMemo, useState } from "react";
import { Link, useParams } from "@/lib/router-compat";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, ClipboardCopy, History, Loader2, PlayCircle, RefreshCw } from "lucide-react";

import DashboardShell from "@/components/accounts/DashboardShell";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import {
  createRepairOrder,
  loadLatestResults,
  loadSegmentHistory,
  saveRun,
} from "@/lib/integrity/auditStore";
import { countRequirements, domainByKey, effectiveStatus } from "@/lib/integrity/segments";
import { runRequirementAudit, runSegmentAudit } from "@/lib/integrity/runner";
import { useRoutePaths } from "@/lib/integrity/useRoutePaths";
import type { Requirement } from "@/lib/integrity/types";
import { StatusPill, STATUS_MEANING } from "./statusUi";

const repairOrderText = (req: Requirement, segmentKey: string) =>
  [
    `REPAIR ORDER — ${req.id}`,
    `Segment: ${segmentKey}`,
    `Requirement: ${req.name}`,
    "",
    "Approved standard:",
    req.requirement,
    ...req.behaviour.map((b) => `- ${b}`),
    "",
    `Restoration source: ${req.restorationSource || "CORRECTION SOURCE UNAVAILABLE"}`,
    `Scope: ${(req.implementation.files ?? []).join(", ") || "see implementation map"}`,
    `Required tests: ${req.validation.map((v) => `${v.kind}:${v.target}`).join(", ")}`,
    "",
    "Do not change the standard. Correct the implementation to match it, then Re-audit.",
  ].join("\n");

const SegmentAudit = () => {
  const { segment = "" } = useParams<{ segment: string }>();
  const domain = domainByKey(segment);
  const { toast } = useToast();
  const qc = useQueryClient();
  const routePaths = useRoutePaths();

  const [running, setRunning] = useState(false);
  const [progress, setProgress] = useState("");
  const [openId, setOpenId] = useState<string | null>(null);
  const [live, setLive] = useState<Record<string, { status: string; reason: string | null; evidence: string }>>({});

  const results = useQuery({ queryKey: ["integrity", "results"], queryFn: loadLatestResults });
  const history = useQuery({
    queryKey: ["integrity", "history", domain?.key],
    queryFn: () => loadSegmentHistory(domain!.key),
    enabled: Boolean(domain),
  });

  const counts = useMemo(
    () => (domain ? countRequirements(domain.requirements, results.data ?? {}) : null),
    [domain, results.data],
  );

  if (!domain) {
    return (
      <DashboardShell title="Unknown segment" subtitle="This audit segment is not part of the standard.">
        <Link to="/admin/integrity" className="text-sm underline">
          Back to the Audit Dashboard
        </Link>
      </DashboardShell>
    );
  }

  const audit = async () => {
    setRunning(true);
    setProgress("");
    try {
      const outcomes = await runSegmentAudit(domain.key, routePaths, (p) =>
        setProgress(`${p.index} / ${p.total} — ${p.requirementId} ${p.status}`),
      );
      await saveRun(domain.key, outcomes);
      setLive({});
      await qc.invalidateQueries({ queryKey: ["integrity"] });
      toast({ title: `${domain.title} audited`, description: `${outcomes.length} requirements checked.` });
    } catch (error) {
      toast({ title: "Audit failed", description: (error as Error).message, variant: "destructive" });
    } finally {
      setRunning(false);
      setProgress("");
    }
  };

  const reauditOne = async (req: Requirement) => {
    try {
      const outcome = await runRequirementAudit(req, routePaths);
      setLive((prev) => ({
        ...prev,
        [req.id]: { status: outcome.status, reason: outcome.reason, evidence: outcome.evidence },
      }));
      toast({ title: `${req.id} re-audited`, description: `Result: ${outcome.status}` });
    } catch (error) {
      toast({ title: "Re-audit failed", description: (error as Error).message, variant: "destructive" });
    }
  };

  const raiseRepairOrder = async (req: Requirement) => {
    try {
      await createRepairOrder({
        requirementId: req.id,
        segmentKey: domain.key,
        standardSnapshot: { requirement: req.requirement, behaviour: req.behaviour, ui: req.ui ?? [] },
        restorationSource: req.restorationSource || null,
        scope: (req.implementation.files ?? []).join(", "),
      });
      await navigator.clipboard?.writeText(repairOrderText(req, domain.key)).catch(() => undefined);
      toast({
        title: "Repair order recorded",
        description: "Copied to your clipboard — apply it, then Re-audit this requirement.",
      });
    } catch (error) {
      toast({ title: "Could not record repair order", description: (error as Error).message, variant: "destructive" });
    }
  };

  return (
    <DashboardShell
      title={`${domain.title} — Audit`}
      subtitle={domain.summary}
      actions={
        <Button onClick={() => void audit()} disabled={running}>
          {running ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <PlayCircle className="h-3.5 w-3.5" />}
          {history.data?.length ? "Audit again" : "Audit this segment"}
        </Button>
      }
    >
      <div className="space-y-6">
        <Link to="/admin/integrity" className="inline-flex items-center gap-1.5 text-xs text-dash-surface/70 hover:text-dash-surface">
          <ArrowLeft className="h-3.5 w-3.5" /> All segments
        </Link>

        <div className="rounded-2xl border border-dash-border bg-dash-surface/95 p-5 text-slate-700 shadow-[var(--shadow-dash)]">
          <p className="text-sm font-medium text-slate-900">
            {counts?.total} requirements → {counts?.PASS} PASS → {counts?.PARTIAL} PARTIAL → {counts?.UNKNOWN} UNKNOWN →{" "}
            {(counts?.FAIL ?? 0) + (counts?.MISSING ?? 0)} FAIL
          </p>
          <p className="mt-2 text-xs leading-relaxed text-slate-500">{domain.coverage}</p>
          {running && progress && <p className="mt-2 text-xs tabular-nums text-slate-600">{progress}</p>}
        </div>

        <div className="overflow-hidden rounded-2xl border border-dash-border bg-dash-surface/95 shadow-[var(--shadow-dash)]">
          <table className="w-full text-left text-sm text-slate-700">
            <thead className="bg-slate-50 text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500">
              <tr>
                <th className="px-4 py-3">ID</th>
                <th className="px-3 py-3">Requirement</th>
                <th className="px-3 py-3">Status</th>
                <th className="px-3 py-3">Evidence / problem</th>
                <th className="px-4 py-3 text-right">Action</th>
              </tr>
            </thead>
            <tbody>
              {domain.requirements.map((req) => {
                const stored = results.data?.[req.id];
                const liveResult = live[req.id];
                const status = (liveResult?.status as typeof req.status) ?? effectiveStatus(req, results.data ?? {});
                const reason = liveResult?.reason ?? stored?.reason ?? req.notes ?? null;
                const evidence = liveResult?.evidence ?? stored?.evidence ?? null;
                const open = openId === req.id;
                return (
                  <Fragment key={req.id}>
                    <tr className="border-t border-slate-200/80 align-top">
                      <td className="px-4 py-3 font-mono text-xs text-slate-500">{req.id}</td>
                      <td className="px-3 py-3">
                        <div className="font-medium text-slate-900">{req.name}</div>
                        <div className="text-xs text-slate-500">{req.requirement}</div>
                      </td>
                      <td className="px-3 py-3"><StatusPill status={status} /></td>
                      <td className="px-3 py-3 text-xs text-slate-600">
                        {status === "PASS" ? evidence ?? "Verified" : reason ?? STATUS_MEANING[status]}
                      </td>
                      <td className="px-4 py-3 text-right">
                        {status === "PASS" ? (
                          <span className="text-xs text-slate-400">—</span>
                        ) : (
                          <Button size="sm" variant="outline" onClick={() => setOpenId(open ? null : req.id)}>
                            {open ? "Close" : "Review / Fix"}
                          </Button>
                        )}
                      </td>
                    </tr>
                    {open && (
                      <tr className="border-t border-slate-200/60 bg-slate-50/70">
                        <td colSpan={5} className="px-4 py-4">
                          <dl className="grid gap-3 text-xs text-slate-700 md:grid-cols-2">
                            <div>
                              <dt className="font-semibold uppercase tracking-[0.12em] text-slate-500">Expected behaviour</dt>
                              <dd className="mt-1 space-y-1">
                                {req.behaviour.map((b) => (
                                  <div key={b}>• {b}</div>
                                ))}
                              </dd>
                            </div>
                            <div>
                              <dt className="font-semibold uppercase tracking-[0.12em] text-slate-500">Current observed behaviour</dt>
                              <dd className="mt-1">{evidence ?? "No audit run has inspected this requirement yet."}</dd>
                            </div>
                            <div>
                              <dt className="font-semibold uppercase tracking-[0.12em] text-slate-500">
                                Why it is {status}
                              </dt>
                              <dd className="mt-1">{reason ?? STATUS_MEANING[status]}</dd>
                            </div>
                            <div>
                              <dt className="font-semibold uppercase tracking-[0.12em] text-slate-500">Recommended correction</dt>
                              <dd className="mt-1">
                                {req.restorationSource
                                  ? `Restore to the approved standard using: ${req.restorationSource}`
                                  : "CORRECTION SOURCE UNAVAILABLE — the administrator must supply the approved behaviour."}
                              </dd>
                            </div>
                          </dl>
                          <div className="mt-4 flex flex-wrap gap-2">
                            <Button size="sm" variant="outline" onClick={() => void raiseRepairOrder(req)}>
                              <ClipboardCopy className="h-3.5 w-3.5" /> Record repair order
                            </Button>
                            <Button size="sm" onClick={() => void reauditOne(req)}>
                              <RefreshCw className="h-3.5 w-3.5" /> Re-audit
                            </Button>
                          </div>
                        </td>
                      </tr>
                    )}
                  </Fragment>
                );
              })}
            </tbody>
          </table>
        </div>

        <div className="rounded-2xl border border-dash-border bg-dash-surface/95 p-5 text-slate-700 shadow-[var(--shadow-dash)]">
          <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">
            <History className="h-3.5 w-3.5" /> Audit history — {domain.key}
          </div>
          {history.data?.length ? (
            <ul className="mt-3 space-y-1.5 text-sm">
              {history.data.map((run) => (
                <li key={run.id} className="flex flex-wrap items-baseline gap-2">
                  <span className="font-medium text-slate-900">Audit #{run.run_no}</span>
                  <span className="tabular-nums text-slate-600">
                    {run.pass_count} PASS / {run.partial_count} PARTIAL / {run.unknown_count} UNKNOWN /{" "}
                    {run.fail_count + run.missing_count} FAIL
                  </span>
                  <span className="text-xs text-slate-400">
                    {new Date(run.finished_at ?? run.started_at).toLocaleString()}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-2 text-xs text-slate-500">
              No audit has been run for this segment yet — the statuses shown come from the recorded Phase 1 inventory.
            </p>
          )}
        </div>
      </div>
    </DashboardShell>
  );
};

export default SegmentAudit;
