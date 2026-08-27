import { useCallback, useEffect, useState } from "react";
import { Link, useNavigate } from "@/lib/router-compat";
import { ArrowLeft, PlusCircle, Radio, Settings, Square, Trash2, Users } from "lucide-react";
import ShareMenu from "@/components/community/ShareMenu";

import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import {
  LiveSession,
  deleteSession,
  formatNextLesson,
  formatRoomSchedule,
  roomLabel,
  roomStateOf,
  roomTone,
  hydrateSession,
  querySessions,
  fetchSessionCodes,
  setLiveState,
} from "@/lib/live/sessions";

import JoinSessionPanel from "@/components/live/JoinSessionPanel";

/**
 * A teacher's Live rooms.
 *
 * Every room is permanent: it is listed until the teacher deletes it. The
 * recurring schedule is shown as information, and only the teacher's own
 * Start teaching switch makes a room Live.
 */
const SessionsPage = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [sessions, setSessions] = useState<LiveSession[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) {
      navigate("/auth?redirect=/live/sessions");
      return;
    }
    const data = await querySessions<Record<string, unknown>[]>((cols) =>
      supabase
        .from("sessions")
        .select(cols)
        .eq("owner_id", userData.user!.id)
        .order("created_at", { ascending: false }) as never,
    );
    const rows = (data ?? []).map(hydrateSession);
    const codes = await fetchSessionCodes(rows.map((r) => r.id));
    setSessions(rows.map((r) => ({ ...r, session_code: codes[r.id] ?? "" })));
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

  const toggleLive = async (s: LiveSession) => {
    const { error } = await setLiveState(s.id, !s.is_live);
    if (error) {
      toast({ title: "Could not change teaching state", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: s.is_live ? "Teaching stopped" : "You are now teaching" });
    load();
  };

  const live = sessions.filter((s) => s.is_live);
  const rooms = sessions.filter((s) => !s.is_live);

  const Card = ({ s }: { s: LiveSession }) => {
    const state = roomStateOf(s);
    const next = formatNextLesson(s);
    return (
      <div className="group relative rounded-xl border border-border bg-card/40 p-4 backdrop-blur transition hover:border-primary/40">
        <Link to={`/live/sessions/${s.id}`} className="block pr-8">
          <div className="flex items-center gap-2">
            <span className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${roomTone[state]}`}>
              {roomLabel[state]}
            </span>
            {s.visibility === "public" && (
              <span className="rounded-full border border-border px-2 py-0.5 text-[10px] uppercase tracking-wide text-muted-foreground">
                Public
              </span>
            )}
          </div>
          <div className="mt-2 truncate text-base font-semibold">{s.title}</div>
          <div className="mt-1 text-xs text-muted-foreground">
            {formatRoomSchedule(s)}
          </div>
          {!s.is_live && next && (
            <div className="mt-2 text-xs text-cyan-200">Next lesson: {next}</div>
          )}
          <div className="mt-2 text-xs text-muted-foreground">
            Code: <code className="rounded bg-background px-1.5 py-0.5">{s.session_code}</code>
          </div>
        </Link>
        <div className="mt-3 grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => toggleLive(s)}
            className={`inline-flex min-h-[36px] items-center justify-center gap-1.5 rounded-lg border px-2 text-xs font-semibold transition ${
              s.is_live
                ? "border-destructive/50 bg-destructive/10 text-destructive hover:bg-destructive/20"
                : "border-emerald-300/50 bg-emerald-400/15 text-emerald-200 hover:bg-emerald-400/25"
            }`}
          >
            {s.is_live ? <><Square className="h-3.5 w-3.5" /> Stop teaching</> : <><Radio className="h-3.5 w-3.5" /> Start teaching</>}
          </button>
          <Link
            to={`/live/sessions/${s.id}/settings`}
            className="inline-flex min-h-[36px] items-center justify-center gap-1.5 rounded-lg border border-border px-2 text-xs font-medium hover:bg-accent"
          >
            <Settings className="h-3.5 w-3.5" /> Settings
          </Link>
          <Link
            to="/community/live"
            className="inline-flex min-h-[36px] items-center justify-center gap-1.5 rounded-lg border border-border px-2 text-xs font-medium hover:bg-accent"
          >
            <Users className="h-3.5 w-3.5" /> Show in Community
          </Link>
          <button
            type="button"
            onClick={() => remove(s)}
            className="inline-flex min-h-[36px] items-center justify-center gap-1.5 rounded-lg border border-border px-2 text-xs font-medium text-destructive hover:bg-destructive/10"
          >
            <Trash2 className="h-3.5 w-3.5" /> Delete
          </button>
        </div>

        <ShareMenu
          className="absolute right-2 top-2 opacity-0 transition group-hover:opacity-100"
          triggerClassName="h-7 w-7"
          kind="session"
          sourceId={s.id}
          title={s.title}
          hashtags="#LiveSession"
          payload={{ session_id: s.id, session_code: s.session_code }}
          onDelete={() => remove(s)}
          deleteLabel="Delete session"
        />

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
                Open a permanent teaching room, set the day and time you normally teach, and share the code.
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
            No teaching rooms yet. Open your first permanent room.
          </div>
        ) : (
          <div className="space-y-8">
            <Group title="Live Now" items={live} />
            <Group title="My Teaching Rooms" items={rooms} />
          </div>
        )}
      </main>
    </div>
  );
};

export default SessionsPage;
