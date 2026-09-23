import { useEffect, useMemo, useState } from "react";
import { BadgeCheck, Ban, Loader2, RefreshCw, Save } from "lucide-react";

import DashboardShell from "@/components/accounts/DashboardShell";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/lib/auth/AuthProvider";

type Entry = {
  id: string;
  feature: string;
  scope: string | null;
  roles: string[] | null;
  preconditions: string[] | null;
  steps: string[] | null;
  expected_result: string | null;
  verification: string | null;
  failures: string[] | null;
  evidence: string | null;
  status: string;
  version: number;
  updated_at: string;
};

const STATUS_LABEL: Record<string, string> = {
  proposed: "Waiting for you",
  observed: "Seen in the app",
  approved: "Approved",
  retired: "Retired",
};

/**
 * Administrator training review.
 *
 * Everything the assistant writes down while you teach her lands here as a
 * proposal. Nothing she records is trusted until you approve it, and you can
 * correct the steps in place before you do.
 */
const AdminAuraTraining = () => {
  const { ready } = useAuth();
  const { toast } = useToast();

  const [rows, setRows] = useState<Entry[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [drafts, setDrafts] = useState<Record<string, string>>({});

  const load = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("aura_knowledge" as never)
      .select("*")
      .order("updated_at", { ascending: false })
      .limit(200);
    setLoading(false);
    if (error) {
      toast({ title: "Could not load the training notes", description: error.message, variant: "destructive" });
      return;
    }
    setRows((data ?? []) as unknown as Entry[]);
  };

  useEffect(() => {
    if (ready) void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready]);

  const pending = useMemo(() => rows.filter((r) => r.status === "proposed" || r.status === "observed"), [rows]);
  const settled = useMemo(() => rows.filter((r) => r.status === "approved" || r.status === "retired"), [rows]);

  const stepsText = (row: Entry) => drafts[row.id] ?? (row.steps ?? []).join("\n");

  const save = async (row: Entry, patch: Record<string, unknown>) => {
    setBusy(row.id);
    const { error } = await supabase
      .from("aura_knowledge" as never)
      .update(patch as never)
      .eq("id", row.id);
    setBusy(null);
    if (error) {
      toast({ title: "That did not save", description: error.message, variant: "destructive" });
      return;
    }
    await load();
  };

  const approve = (row: Entry) => {
    const steps = stepsText(row)
      .split(/\r?\n/)
      .map((s) => s.trim())
      .filter(Boolean);
    if (steps.length === 0) {
      toast({ title: "Write at least one step before approving", variant: "destructive" });
      return;
    }
    void save(row, {
      steps,
      status: "approved",
      version: row.version + 1,
      approved_at: new Date().toISOString(),
    }).then(() => toast({ title: `Approved — she will follow this for ${row.feature}` }));
  };

  const card = (row: Entry) => (
    <div key={row.id} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="text-base font-semibold text-slate-900">{row.feature}</p>
          {row.scope ? <p className="text-sm text-slate-500">{row.scope}</p> : null}
        </div>
        <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-600">
          {STATUS_LABEL[row.status] ?? row.status} · v{row.version}
        </span>
      </div>

      {row.preconditions?.length ? (
        <p className="mt-3 text-sm text-slate-600">
          <span className="font-medium text-slate-800">Needs first: </span>
          {row.preconditions.join(" · ")}
        </p>
      ) : null}

      <div className="mt-3">
        <p className="mb-1 text-sm font-medium text-slate-800">Steps</p>
        <Textarea
          value={stepsText(row)}
          onChange={(e) => setDrafts((d) => ({ ...d, [row.id]: e.target.value }))}
          rows={Math.max(3, (row.steps ?? []).length + 1)}
          className="bg-white text-slate-900"
        />
      </div>

      {row.expected_result ? (
        <p className="mt-3 text-sm text-slate-600">
          <span className="font-medium text-slate-800">Expect: </span>
          {row.expected_result}
        </p>
      ) : null}
      {row.evidence ? (
        <p className="mt-1 text-sm text-slate-500">
          <span className="font-medium text-slate-700">Observed: </span>
          {row.evidence}
        </p>
      ) : null}

      <div className="mt-4 flex flex-wrap gap-2">
        <Button size="sm" onClick={() => approve(row)} disabled={busy === row.id}>
          {busy === row.id ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <BadgeCheck className="mr-2 h-4 w-4" />}
          Approve
        </Button>
        <Button
          size="sm"
          variant="outline"
          disabled={busy === row.id}
          onClick={() =>
            void save(row, {
              steps: stepsText(row)
                .split(/\r?\n/)
                .map((s) => s.trim())
                .filter(Boolean),
              version: row.version + 1,
            })
          }
        >
          <Save className="mr-2 h-4 w-4" />
          Save correction
        </Button>
        <Button
          size="sm"
          variant="ghost"
          disabled={busy === row.id}
          onClick={() => void save(row, { status: "retired", version: row.version + 1 })}
        >
          <Ban className="mr-2 h-4 w-4" />
          Retire
        </Button>
      </div>
    </div>
  );

  return (
    <DashboardShell title="Training review" subtitle="What your assistant has learned, waiting for your word">
      <div className="mx-auto w-full max-w-4xl space-y-6 p-4">
        <div className="flex items-center justify-between">
          <p className="text-sm text-slate-600">
            She follows an entry only after you approve it. Correct the steps first if she got something wrong.
          </p>
          <Button size="sm" variant="outline" onClick={() => void load()} disabled={loading}>
            {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}
            Refresh
          </Button>
        </div>

        <section className="space-y-3">
          <h2 className="text-lg font-semibold text-slate-900">Waiting for you ({pending.length})</h2>
          {pending.length === 0 && !loading ? (
            <p className="rounded-2xl border border-dashed border-slate-300 p-6 text-sm text-slate-500">
              Nothing waiting. Teach her something and it will appear here.
            </p>
          ) : (
            pending.map(card)
          )}
        </section>

        {settled.length ? (
          <section className="space-y-3">
            <h2 className="text-lg font-semibold text-slate-900">Settled ({settled.length})</h2>
            {settled.map(card)}
          </section>
        ) : null}
      </div>
    </DashboardShell>
  );
};

export default AdminAuraTraining;
