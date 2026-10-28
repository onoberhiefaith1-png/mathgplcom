import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { FileSearch, Loader2, Printer, Sparkles } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { staffAiReviewTask, staffAiTeacherReport, type AiReport } from "@/lib/staffHub/ai.functions";
import { fmt } from "@/lib/staffHub/api";
import { btn, btnGhost } from "./ui";

const db = supabase as unknown as { from: (t: string) => any; rpc: (f: string, a: object) => any };

export function AiReportView({ report, at, title }: { report: AiReport; at?: string; title?: string }) {
  const List = ({ label, items, tone }: { label: string; items: string[]; tone?: string }) =>
    items.length ? (
      <div>
        <p className={`mb-1 text-xs font-semibold uppercase tracking-wider ${tone ?? "text-muted-foreground"}`}>{label}</p>
        <ul className="list-disc space-y-1 pl-5 text-sm">{items.map((x, i) => <li key={i}>{x}</li>)}</ul>
      </div>
    ) : null;
  return (
    <div className="space-y-3 rounded-2xl border border-primary/30 bg-primary/5 p-4" data-ai-report>
      <div className="flex items-center justify-between gap-2">
        <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-primary">
          <Sparkles className="h-3.5 w-3.5" /> {title ?? "AI-assisted review"}
        </p>
        {at && <span className="text-[11px] text-muted-foreground">{fmt(at)}</span>}
      </div>
      <p className="text-sm font-semibold">{report.verdict}</p>
      <div className="grid gap-2 text-sm sm:grid-cols-3">
        {([["Delivery", report.delivery], ["Timeliness", report.timeliness], ["Quality", report.quality]] as const).map(([k, v]) => (
          <div key={k} className="rounded-xl border border-border bg-card p-3">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{k}</p>
            <p className="mt-1">{v || "Not recorded"}</p>
          </div>
        ))}
      </div>
      <List label="Strengths" items={report.strengths} tone="text-primary" />
      <List label="Concerns" items={report.concerns} tone="text-destructive" />
      <List label="Suggested next steps" items={report.next_steps} />
      <List label="Not recorded" items={report.not_recorded} />
      <p className="text-[11px] text-muted-foreground">Built only from Staff Hub records. The decision stays with the manager.</p>
    </div>
  );
}

const printReport = (html: string) => {
  const w = window.open("", "_blank", "noopener,width=800,height=900");
  if (!w) return;
  w.document.write(`<html><head><title>Staff Hub AI report</title><style>body{font-family:system-ui;padding:32px;line-height:1.5}</style></head><body>${html}</body></html>`);
  w.document.close();
  w.print();
};

/** Real facts from the MathGPL item a task links to. */
export function TaskEvidence({ taskId }: { taskId: string }) {
  const q = useQuery({
    queryKey: ["staff-evidence", taskId],
    queryFn: async () => ((await db.rpc("staff_task_evidence", { _task: taskId })).data ?? []) as { label: string; value?: number; at?: string }[],
  });
  if (!q.data?.length) return null;
  return (
    <section className="space-y-2">
      <h3 className="flex items-center gap-1.5 text-sm font-semibold"><FileSearch className="h-4 w-4" /> Evidence from MathGPL</h3>
      <div className="grid gap-2 sm:grid-cols-3">
        {q.data.map((e, i) => (
          <div key={i} className="rounded-xl border border-border bg-muted/40 p-3">
            <p className="text-[11px] text-muted-foreground">{e.label}</p>
            <p className="text-base font-semibold">{e.value != null ? e.value : e.at ? fmt(e.at) : "—"}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

export function TaskAiReview({ taskId, userId }: { taskId: string; userId: string | null }) {
  const qc = useQueryClient();
  const review = useServerFn(staffAiReviewTask);
  const [busy, setBusy] = useState(false);
  const latest = useQuery({
    queryKey: ["staff-ai", taskId, userId],
    queryFn: async () => {
      let q = db.from("staff_ai_reports").select("*").eq("task_id", taskId).order("created_at", { ascending: false }).limit(1);
      q = userId ? q.eq("subject_user_id", userId) : q;
      return ((await q).data?.[0] ?? null) as { content: AiReport; created_at: string } | null;
    },
  });
  const go = async () => {
    setBusy(true);
    try {
      await review({ data: { taskId, userId } });
      await qc.invalidateQueries({ queryKey: ["staff-ai", taskId, userId] });
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="space-y-2">
      <button type="button" className={btnGhost} onClick={() => void go()} disabled={busy}>
        {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />} {latest.data ? "Run AI review again" : "AI review"}
      </button>
      {latest.data && <AiReportView report={latest.data.content} at={latest.data.created_at} />}
    </div>
  );
}

export function TeacherAiReport({ orgId, userId, days, label }: { orgId: string; userId: string | null; days: number; label: string }) {
  const qc = useQueryClient();
  const run = useServerFn(staffAiTeacherReport);
  const [busy, setBusy] = useState(false);
  const key = ["staff-ai-teacher", orgId, userId, days];
  const latest = useQuery({
    queryKey: key,
    queryFn: async () => {
      let q = db.from("staff_ai_reports").select("*").eq("org_id", orgId).eq("period_days", days).is("task_id", null)
        .order("created_at", { ascending: false }).limit(1);
      q = userId ? q.eq("subject_user_id", userId) : q.is("subject_user_id", null);
      return ((await q).data?.[0] ?? null) as { content: AiReport; created_at: string } | null;
    },
  });
  const go = async () => {
    setBusy(true);
    try {
      await run({ data: { orgId, userId, days } });
      await qc.invalidateQueries({ queryKey: key });
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        <button type="button" className={btn} onClick={() => void go()} disabled={busy}>
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />} {label}
        </button>
        {latest.data && (
          <button type="button" className={btnGhost} onClick={() => {
            const el = document.querySelector(`[data-ai-host="${userId ?? "team"}"] [data-ai-report]`);
            if (el) printReport(el.outerHTML);
          }}>
            <Printer className="h-4 w-4" /> Print
          </button>
        )}
      </div>
      <div data-ai-host={userId ?? "team"}>
        {latest.data && <AiReportView report={latest.data.content} at={latest.data.created_at} title={userId ? "AI performance report" : "AI weekly team summary"} />}
      </div>
    </div>
  );
}
