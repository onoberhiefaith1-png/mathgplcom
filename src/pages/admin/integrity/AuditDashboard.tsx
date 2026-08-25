/**
 * Audit Dashboard — SYSTEM → SEGMENTS.
 *
 * Overall totals at the top, then every segment of the permanent standard as its
 * own row that can be opened or audited on its own. Totals are always folded from
 * individual requirement results, never stored as a number.
 */
import { useMemo, useState } from "react";
import { Link, useNavigate } from "@/lib/router-compat";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2, PlayCircle, ShieldCheck } from "lucide-react";

import DashboardShell from "@/components/accounts/DashboardShell";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { loadLatestResults, loadRunMeta, saveRun } from "@/lib/integrity/auditStore";
import { globalCounts, segmentRows, sortForDashboard } from "@/lib/integrity/segments";
import { runSegmentAudit } from "@/lib/integrity/runner";
import { useRoutePaths } from "@/lib/integrity/useRoutePaths";
import { StatusPill, TOTAL_LABELS } from "./statusUi";

const AuditDashboard = () => {
  const { toast } = useToast();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const routePaths = useRoutePaths();
  const [running, setRunning] = useState<string | null>(null);
  const [progress, setProgress] = useState<string>("");

  const results = useQuery({ queryKey: ["integrity", "results"], queryFn: loadLatestResults });
  const meta = useQuery({ queryKey: ["integrity", "runmeta"], queryFn: loadRunMeta });

  const rows = useMemo(
    () => sortForDashboard(segmentRows(results.data ?? {}, meta.data ?? {})),
    [results.data, meta.data],
  );
  const totals = useMemo(() => globalCounts(results.data ?? {}), [results.data]);

  const auditSegment = async (key: string) => {
    setRunning(key);
    setProgress("");
    try {
      const outcomes = await runSegmentAudit(key, routePaths, (p) =>
        setProgress(`${p.index} / ${p.total} — ${p.requirementId} ${p.status}`),
      );
      await saveRun(key, outcomes);
      await qc.invalidateQueries({ queryKey: ["integrity"] });
      toast({ title: `${key} audited`, description: `${outcomes.length} requirements checked.` });
    } catch (error) {
      toast({ title: "Audit failed", description: (error as Error).message, variant: "destructive" });
    } finally {
      setRunning(null);
      setProgress("");
    }
  };

  return (
    <DashboardShell
      title="System Audit"
      subtitle="Every page and feature of the permanent standard as its own audit segment. Audit one segment at a time — the totals update themselves."
    >
      <div className="space-y-6">
        <div className="rounded-2xl border border-dash-border bg-dash-surface/95 p-5 text-dash-navy shadow-[var(--shadow-dash)]">
          <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">
            <ShieldCheck className="h-3.5 w-3.5" /> Overall system status
          </div>
          <div className="mt-3 flex flex-wrap gap-3">
            {TOTAL_LABELS.map(({ key, label }) => (
              <div
                key={key}
                className="min-w-[104px] rounded-xl border border-slate-200 bg-white px-4 py-3"
              >
                <div className="text-2xl font-semibold tabular-nums text-slate-900">{totals[key]}</div>
                <div className="text-[11px] font-medium uppercase tracking-[0.14em] text-slate-500">{label}</div>
              </div>
            ))}
          </div>
          <p className="mt-3 text-xs text-slate-500">
            {totals.total} requirements across {rows.length} segments. Segments with problems are listed first.
          </p>
        </div>

        <div className="overflow-hidden rounded-2xl border border-dash-border bg-dash-surface/95 shadow-[var(--shadow-dash)]">
          <table className="w-full text-left text-sm text-slate-700">
            <thead className="bg-slate-50 text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500">
              <tr>
                <th className="px-4 py-3">Segment</th>
                <th className="px-3 py-3 text-right">Total</th>
                <th className="px-3 py-3 text-right">Pass</th>
                <th className="px-3 py-3 text-right">Partial</th>
                <th className="px-3 py-3 text-right">Unknown</th>
                <th className="px-3 py-3 text-right">Fail</th>
                <th className="px-3 py-3">Status</th>
                <th className="px-3 py-3">Last audited</th>
                <th className="px-4 py-3 text-right">Action</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.key} className="border-t border-slate-200/80 align-middle">
                  <td className="px-4 py-3">
                    <Link to={`/admin/integrity/${row.key}`} className="font-medium text-slate-900 hover:underline">
                      {row.title}
                    </Link>
                    <div className="text-[11px] uppercase tracking-[0.12em] text-slate-400">{row.key}</div>
                  </td>
                  <td className="px-3 py-3 text-right tabular-nums">{row.counts.total}</td>
                  <td className="px-3 py-3 text-right tabular-nums">{row.counts.PASS}</td>
                  <td className="px-3 py-3 text-right tabular-nums">{row.counts.PARTIAL}</td>
                  <td className="px-3 py-3 text-right tabular-nums">{row.counts.UNKNOWN}</td>
                  <td className="px-3 py-3 text-right tabular-nums">{row.counts.FAIL + row.counts.MISSING}</td>
                  <td className="px-3 py-3"><StatusPill status={row.status} /></td>
                  <td className="px-3 py-3 text-xs text-slate-500">
                    {row.lastAuditedAt
                      ? `${new Date(row.lastAuditedAt).toLocaleString()} (run ${row.runCount})`
                      : "Phase 1 record"}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex justify-end gap-2">
                      <Button size="sm" variant="outline" onClick={() => navigate(`/admin/integrity/${row.key}`)}>
                        Open
                      </Button>
                      <Button size="sm" disabled={running !== null} onClick={() => void auditSegment(row.key)}>
                        {running === row.key ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <PlayCircle className="h-3.5 w-3.5" />
                        )}
                        Audit this segment
                      </Button>
                    </div>
                    {running === row.key && progress && (
                      <div className="mt-1 text-right text-[11px] tabular-nums text-slate-500">{progress}</div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </DashboardShell>
  );
};

export default AuditDashboard;
