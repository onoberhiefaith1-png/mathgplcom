import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { ensureRealtimeAuth } from "@/lib/realtime/auth";
import { useToast } from "@/hooks/use-toast";
import { Check, X, Loader2 } from "lucide-react";

type PendingRequest = {
  id: string;
  requester_id: string;
  created_at: string;
  display_name: string | null;
  mathgpl_student_id: string | null;
};

/**
 * Owner-only panel. Lists pending join requests for one class and lets
 * the owner approve (→ class_members) or reject them. Subscribes to
 * realtime on class_join_requests so new requests appear live.
 */
const JoinRequestsPanel = ({ classId, light }: { classId: string; light?: boolean }) => {
  // `light` = white elevated surface (class dashboard); default = dark card (Live).
  const shell = light
    ? "rounded-2xl border border-dash-border bg-dash-surface p-5 shadow-[var(--shadow-dash)] text-dash-surface-foreground"
    : "rounded-2xl border border-border bg-card/40 p-5 backdrop-blur";
  const head = light
    ? "text-[11px] font-semibold uppercase tracking-[0.14em] text-dash-surface-muted"
    : "text-sm font-semibold uppercase tracking-wider text-muted-foreground";
  const muted = light ? "text-dash-surface-muted" : "text-muted-foreground";
  const rowCls = light
    ? "flex items-center justify-between gap-3 rounded-xl border border-dash-border bg-dash-navy/[0.03] p-3"
    : "flex items-center justify-between gap-3 rounded-xl border border-border bg-background/40 p-3";
  const { toast } = useToast();
  const [rows, setRows] = useState<PendingRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(async () => {
    const { data: reqs } = await supabase
      .from("class_join_requests")
      .select("id, requester_id, created_at")
      .eq("class_id", classId)
      .eq("status", "pending")
      .order("created_at", { ascending: true });
    const { data: profs } = await supabase.rpc("get_class_join_request_profiles", { _class_id: classId });
    const profiles: Record<string, { display_name: string | null; mathgpl_student_id: string | null }> =
      Object.fromEntries(
        (profs ?? []).map((p) => [p.user_id, { display_name: p.display_name, mathgpl_student_id: p.mathgpl_student_id }]),
      );
    setRows(
      (reqs ?? []).map((r) => ({
        id: r.id,
        requester_id: r.requester_id,
        created_at: r.created_at,
        display_name: profiles[r.requester_id]?.display_name ?? null,
        mathgpl_student_id: profiles[r.requester_id]?.mathgpl_student_id ?? null,
      })),
    );
    setLoading(false);
  }, [classId]);

  useEffect(() => {
    load();
    let cancelled = false;
    let ch: ReturnType<typeof supabase.channel> | null = null;
    void ensureRealtimeAuth().then(() => {
      if (cancelled) return;
      ch = supabase
        .channel(`join-requests-${classId}`, { config: { private: true } })
        .on(
          "postgres_changes",
          { event: "*", schema: "public", table: "class_join_requests", filter: `class_id=eq.${classId}` },
          () => { load(); },
        )
        .subscribe();
    });
    return () => { cancelled = true; if (ch) supabase.removeChannel(ch); };
  }, [classId, load]);

  const approve = async (req: PendingRequest) => {
    setBusy(req.id);
    try {
      const { error: insErr } = await supabase
        .from("class_members")
        .insert({ class_id: classId, user_id: req.requester_id });
      if (insErr && !/duplicate key/i.test(insErr.message)) {
        toast({ title: "Could not approve", description: insErr.message, variant: "destructive" });
        return;
      }
      const { error: updErr } = await supabase
        .from("class_join_requests")
        .update({ status: "approved" })
        .eq("id", req.id);
      if (updErr) {
        toast({ title: "Approved, but status update failed", description: updErr.message, variant: "destructive" });
      } else {
        toast({ title: "Approved", description: req.display_name ?? req.mathgpl_student_id ?? "Student added" });
      }
      load();
    } finally {
      setBusy(null);
    }
  };

  const reject = async (req: PendingRequest) => {
    setBusy(req.id);
    try {
      const { error } = await supabase
        .from("class_join_requests")
        .update({ status: "rejected" })
        .eq("id", req.id);
      if (error) {
        toast({ title: "Could not reject", description: error.message, variant: "destructive" });
        return;
      }
      load();
    } finally {
      setBusy(null);
    }
  };

  return (
    <section className={shell}>
      <div className="mb-3 flex items-center justify-between">
        <h2 className={head}>
          Pending Join Requests
        </h2>
        {rows.length > 0 && (
          <span className={`rounded-full px-2 py-0.5 text-xs ${light ? "bg-amber-100 text-amber-700" : "bg-amber-400/20 text-amber-200"}`}>
            {rows.length}
          </span>
        )}
      </div>
      {loading ? (
        <div className={`flex items-center gap-2 text-sm ${muted}`}>
          <Loader2 className="h-4 w-4 animate-spin" /> Loading…
        </div>
      ) : rows.length === 0 ? (
        <div className={`rounded-xl border border-dashed p-4 text-center text-sm ${light ? "border-dash-border text-dash-surface-muted" : "border-border text-muted-foreground"}`}>
          No pending requests.
        </div>
      ) : (
        <ul className="space-y-2">
          {rows.map((r) => (
            <li
              key={r.id}
              className={rowCls}
            >
              <div className="min-w-0">
                <div className="truncate text-sm font-semibold">{r.display_name ?? "Unnamed student"}</div>
                <div className={`truncate font-mono text-xs ${muted}`}>
                  {r.mathgpl_student_id ?? "—"}
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  disabled={busy === r.id}
                  onClick={() => approve(r)}
                  className={`inline-flex items-center gap-1 rounded-md px-3 py-1.5 text-xs font-semibold disabled:opacity-50 ${light ? "bg-emerald-600 text-white hover:bg-emerald-700" : "bg-emerald-500/20 text-emerald-200 hover:bg-emerald-500/30"}`}
                >
                  <Check className="h-3.5 w-3.5" /> Approve
                </button>
                <button
                  type="button"
                  disabled={busy === r.id}
                  onClick={() => reject(r)}
                  className={`inline-flex items-center gap-1 rounded-md px-3 py-1.5 text-xs font-semibold disabled:opacity-50 ${light ? "bg-rose-600 text-white hover:bg-rose-700" : "bg-rose-500/20 text-rose-200 hover:bg-rose-500/30"}`}
                >
                  <X className="h-3.5 w-3.5" /> Reject
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
};

export default JoinRequestsPanel;
