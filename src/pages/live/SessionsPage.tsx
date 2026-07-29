import { useCallback, useEffect, useState } from "react";
import { Link, useNavigate } from "@/lib/router-compat";
import { ArrowLeft, PlusCircle, Trash2, Radio } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import {
  LiveSession,
  deleteSession,
  formatCountdownLong,
  formatStartsAt,
  scheduleLabel,
  scheduleStateOf,
  scheduleTone,
  hydrateSession,
} from "@/lib/live/sessions";

import { useNowTick } from "@/lib/live/useCountdown";
import JoinSessionPanel from "@/components/live/JoinSessionPanel";

const SessionsPage = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [sessions, setSessions] = useState<LiveSession[]>([]);
  const [loading, setLoading] = useState(true);
  const now = useNowTick();

  const load = useCallback(async () => {
    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) {
      navigate("/auth?redirect=/live/sessions");
      return;
    }
    const { data } = await supabase
      .from("sessions")
      .select("*")
      .eq("owner_id", userData.user.id)
      .order("starts_at", { ascending: true, nullsFirst: false });
    setSessions(((data ?? []) as Record<string, unknown>[]).map(hydrateSession));
    setLoading(false);
  }, [navigate]);

  useEffect(() => { load(); }, [load]);

  const remove = async (s: LiveSession) => {
    if (!window.confirm(`Delete "${s.title}"? This removes the session and all of its work.`)) return;
    const { error } = await deleteSession(s);
    if (error) {
      toast({ title: "Delete failed", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: "Session deleted" });
    load();
  };

  const live = sessions.filter((s) => ["live", "starting-soon"].includes(scheduleStateOf(s, now)));
  const upcoming = sessions.filter((s) => ["scheduled", "unscheduled"].includes(scheduleStateOf(s, now)));
  const past = sessions.filter((s) => scheduleStateOf(s, now) === "ended");

  const Card = ({ s }: { s: LiveSession }) => {
    const state = scheduleStateOf(s, now);
    const startMs = s.starts_at ? new Date(s.starts_at).getTime() : NaN;
    return (
      <div className="group relative rounded-xl border border-border bg-card/40 p-4 backdrop-blur transition hover:border-primary/40">
        <Link to={`/live/sessions/${s.id}`} className="block pr-8">
          <div className="flex items-center gap-2">
            <span className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${scheduleTone[state]}`}>
              {scheduleLabel[state]}
            </span>
            {s.visibility === "public" && (
              <span className="rounded-full border border-border px-2 py-0.5 text-[10px] uppercase tracking-wide text-muted-foreground">
                Public
              </span>
            )}
          </div>
          <div className="mt-2 truncate text-base font-semibold">{s.title}</div>
          <div className="mt-1 text-xs text-muted-foreground">{formatStartsAt(s.starts_at, s.time_zone)}</div>
          {state === "scheduled" && !Number.isNaN(startMs) && (
            <div className="mt-2 text-xs text-cyan-200">Starts in {formatCountdownLong(startMs - now)}</div>
          )}
          <div className="mt-2 text-xs text-muted-foreground">
            Code: <code className="rounded bg-background px-1.5 py-0.5">{s.session_code}</code>
          </div>
        </Link>
        <button
          onClick={() => remove(s)}
          className="absolute right-2 top-2 rounded-md border border-border bg-background/60 p-1.5 text-muted-foreground opacity-0 transition group-hover:opacity-100 hover:text-destructive"
          aria-label="Delete session"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      </div>
    );
  };

  const Group = ({ title, items }: { title: string; items: LiveSession[] }) =>
    items.length === 0 ? null : (
      <section>
        <h2 className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">{title}</h2>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {items.map((s) => <Card key={s.id} s={s} />)}
        </div>
      </section>
    );

  return (
    <div className="min-h-screen w-full bg-gradient-to-b from-background via-background to-muted/20 text-foreground">
      <header className="flex items-center justify-between px-6 py-5">
        <Link to="/live" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-4 w-4" /> MathGPL Live
        </Link>
        <h1 className="text-lg font-semibold tracking-wide">Sessions</h1>
        <div className="w-32" />
      </header>

      <main className="mx-auto max-w-6xl space-y-10 px-6 py-8">
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <section className="space-y-3">
            <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Create Session</h2>
            <Link
              to="/live/sessions/create"
              className="group flex h-56 flex-col items-center justify-center gap-3 rounded-2xl border border-primary/40 bg-gradient-to-br from-primary/20 to-primary/5 p-8 text-center backdrop-blur transition hover:scale-[1.02] hover:shadow-2xl"
            >
              <PlusCircle className="h-10 w-10 text-primary" />
              <div className="text-xl font-semibold">Create Session</div>
              <p className="max-w-xs text-sm text-muted-foreground">
                Schedule an online lesson, attach a lesson note and share the session code.
              </p>
            </Link>
          </section>

          <section className="space-y-3">
            <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Join Session</h2>
            <JoinSessionPanel />
          </section>
        </div>

        {loading ? (
          <div className="text-center text-sm text-muted-foreground">Loading…</div>
        ) : sessions.length === 0 ? (
          <div className="flex flex-col items-center gap-2 rounded-2xl border border-dashed border-border p-10 text-center text-sm text-muted-foreground">
            <Radio className="h-6 w-6" />
            No sessions yet. Create your first online lesson.
          </div>
        ) : (
          <div className="space-y-8">
            <Group title="Live & Starting Soon" items={live} />
            <Group title="Upcoming" items={upcoming} />
            <Group title="Past Sessions" items={past} />
          </div>
        )}
      </main>
    </div>
  );
};

export default SessionsPage;
