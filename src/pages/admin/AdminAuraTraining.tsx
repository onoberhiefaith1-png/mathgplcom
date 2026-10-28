import { useEffect, useMemo, useState } from "react";
import {
  BadgeCheck,
  Ban,
  Compass,
  Loader2,
  Pause,
  Play,
  RefreshCw,
  Save,
  Send,
  Square,
} from "lucide-react";

import DashboardShell from "@/components/accounts/DashboardShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/lib/auth/AuthProvider";
import { useAura } from "@/lib/agent/AuraProvider";

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

const AREA_TONE: Record<string, string> = {
  confirmed: "bg-emerald-50 text-emerald-700 border-emerald-200",
  uncertain: "bg-amber-50 text-amber-700 border-amber-200",
  untouched: "bg-slate-50 text-slate-500 border-slate-200",
};

/**
 * Administrator page: give the assistant a mission, watch her explore the
 * platform on her own, answer her questions when you feel like it, and approve
 * or correct what she writes down. Nothing she records is trusted until you
 * approve it.
 */
const AdminAuraTraining = () => {
  const { ready } = useAuth();
  const { toast } = useToast();

  const [rows, setRows] = useState<Entry[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const { mission, messages, status } = useAura();
  const [goal, setGoal] = useState("");
  const [replies, setReplies] = useState<Record<string, string>>({});

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

  const activity = useMemo(
    () => messages.filter((m) => m.role === "assistant" && m.content.trim()).slice(-6),
    [messages],
  );
  const ledger = mission.ledger;
  const open = ledger.questions.filter((q) => q.status === "open");
  const areas = Object.entries(ledger.map);

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

  const bullets = (title: string, items: string[]) => (
    <div>
      <p className="text-sm font-medium text-slate-800">{title}</p>
      {items.length === 0 ? (
        <p className="text-sm text-slate-400">Nothing yet.</p>
      ) : (
        <ul className="mt-1 space-y-1 text-sm text-slate-600">
          {items.slice(-6).map((item) => (
            <li key={item}>· {item}</li>
          ))}
        </ul>
      )}
    </div>
  );

  return (
    <DashboardShell title="System exploration" subtitle="Give her a mission, watch her learn your platform">
      <div className="mx-auto w-full max-w-5xl space-y-6 p-4">
        {/* ── MISSION ─────────────────────────────────────────────────── */}
        <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <h2 className="text-lg font-semibold text-slate-900">Send her in with a mission</h2>
          <p className="mt-1 text-sm text-slate-600">
            Name a purpose, not a list of steps — for example “understand how lesson notes
            are created well enough to build good maths lessons across topics”. She decides
            what to look at next herself, works in her own practice notebooks, and reports
            as she goes. Your real lesson notes are only read, never changed, and nothing
            reaches a student.
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <Input
              value={mission.active ? (mission.mission ?? "") : goal}
              disabled={mission.active}
              onChange={(e) => setGoal(e.target.value)}
              placeholder="Understand how lesson notes are created and presented"
              className="min-w-[18rem] flex-1 bg-white text-slate-900"
              onKeyDown={(e) => {
                if (e.key === "Enter" && goal.trim()) mission.start(goal);
              }}
            />
            {mission.active ? (
              <>
                {mission.paused ? (
                  <Button size="sm" variant="outline" onClick={() => mission.resume()}>
                    <Play className="mr-2 h-4 w-4" />
                    Carry on
                  </Button>
                ) : (
                  <Button size="sm" variant="outline" onClick={() => mission.pause()}>
                    <Pause className="mr-2 h-4 w-4" />
                    Pause
                  </Button>
                )}
                <Button size="sm" variant="ghost" onClick={() => mission.end()}>
                  <Square className="mr-2 h-4 w-4" />
                  Stop
                </Button>
              </>
            ) : (
              <Button size="sm" onClick={() => mission.start(goal)} disabled={!goal.trim()}>
                <Compass className="mr-2 h-4 w-4" />
                Start exploring
              </Button>
            )}
          </div>
          {mission.active ? (
            <p className="mt-2 text-sm text-slate-500">
              {mission.paused ? "Paused — she is holding still." : "Exploring now"} — “{mission.mission}”.
              You can type to her in her panel at any time.
            </p>
          ) : null}
        </section>

        {mission.active || activity.length > 0 || areas.length > 0 ? (
          <div className="grid gap-4 lg:grid-cols-2">
            {/* ── LIVE ACTIVITY ─────────────────────────────────────── */}
            <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
              <h3 className="text-base font-semibold text-slate-900">Live activity</h3>
              {status === "submitted" ? (
                <p className="mt-1 flex items-center text-sm text-slate-500">
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Working…
                </p>
              ) : null}
              <div className="mt-2 space-y-2">
                {activity.length === 0 ? (
                  <p className="text-sm text-slate-400">Nothing yet.</p>
                ) : (
                  activity.map((m) => (
                    <div key={m.id} className="rounded-xl bg-slate-50 p-3 text-sm text-slate-700">
                      <p className="whitespace-pre-wrap">{m.content}</p>
                      {m.steps?.length ? (
                        <p className="mt-1 text-xs text-slate-500">
                          {m.steps.map((s) => s.summary).join(" · ")}
                        </p>
                      ) : null}
                    </div>
                  ))
                )}
              </div>
            </section>

            {/* ── EXPLORATION MAP AND RECORD ────────────────────────── */}
            <section className="space-y-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
              <div>
                <h3 className="text-base font-semibold text-slate-900">Exploration map</h3>
                {areas.length === 0 ? (
                  <p className="mt-1 text-sm text-slate-400">She has not marked an area yet.</p>
                ) : (
                  <div className="mt-2 flex flex-wrap gap-2">
                    {areas.map(([area, state]) => (
                      <span
                        key={area}
                        className={`rounded-full border px-3 py-1 text-xs font-medium ${
                          AREA_TONE[state] ?? AREA_TONE["untouched"]
                        }`}
                      >
                        {area} · {state}
                      </span>
                    ))}
                  </div>
                )}
              </div>
              {bullets("What she knows", ledger.known)}
              {bullets("What she still does not know", ledger.unknown)}
              {bullets("What did not work", ledger.failed)}
            </section>
          </div>
        ) : null}

        {/* ── HER QUESTIONS ───────────────────────────────────────────── */}
        {open.length > 0 ? (
          <section className="space-y-3 rounded-2xl border border-amber-200 bg-amber-50/60 p-4">
            <h3 className="text-base font-semibold text-slate-900">
              Her questions ({open.length})
            </h3>
            <p className="text-sm text-slate-600">
              She is not waiting on these — answer whenever you like and it goes into her
              next stretch of work.
            </p>
            {open.map((q) => (
              <div key={q.id} className="rounded-xl border border-amber-200 bg-white p-3">
                <p className="text-sm font-medium text-slate-800">{q.text}</p>
                <div className="mt-2 flex gap-2">
                  <Input
                    value={replies[q.id] ?? ""}
                    onChange={(e) => setReplies((r) => ({ ...r, [q.id]: e.target.value }))}
                    placeholder="Your answer"
                    className="bg-white text-slate-900"
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && (replies[q.id] ?? "").trim()) {
                        mission.answer(q.id, replies[q.id] ?? "");
                        setReplies((r) => ({ ...r, [q.id]: "" }));
                      }
                    }}
                  />
                  <Button
                    size="sm"
                    disabled={!(replies[q.id] ?? "").trim()}
                    onClick={() => {
                      mission.answer(q.id, replies[q.id] ?? "");
                      setReplies((r) => ({ ...r, [q.id]: "" }));
                    }}
                  >
                    <Send className="mr-2 h-4 w-4" />
                    Answer
                  </Button>
                </div>
              </div>
            ))}
          </section>
        ) : null}

        {/* ── FINDINGS ────────────────────────────────────────────────── */}
        <div className="flex items-center justify-between">
          <p className="text-sm text-slate-600">
            She follows a finding only after you approve it. Correct the steps first if she
            got something wrong.
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
              Nothing waiting. Send her in on a mission and her findings will appear here.
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
