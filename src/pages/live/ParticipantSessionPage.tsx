import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, BookOpen, Presentation, ClipboardList, Compass, Gamepad2, Image as ImageIcon, BarChart3, Lock, Radio } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import {
  LiveSession, formatCountdownClock, formatCountdownLong, formatStartsAt, hydrateSession,
  scheduleLabel, scheduleStateOf, scheduleTone,
} from "@/lib/live/sessions";
import { useNowTick } from "@/lib/live/useCountdown";
import BroadcastPanel from "@/components/live/BroadcastPanel";


/**
 * Participant view of a Session. Everything the classroom student sees, gated
 * by the schedule: the Smartboard stays locked until the session start time.
 */
const ParticipantSessionPage = () => {
  const { sessionId } = useParams();
  const navigate = useNavigate();
  const [session, setSession] = useState<LiveSession | null>(null);
  const [loading, setLoading] = useState(true);
  const now = useNowTick();

  useEffect(() => {
    (async () => {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) {
        navigate(`/auth?redirect=/live/s/${sessionId}`);
        return;
      }
      const { data } = await supabase.from("sessions").select("*").eq("id", sessionId!).maybeSingle();
      if (!data) {
        navigate("/live/join", { replace: true });
        return;
      }
      const row = hydrateSession(data as Record<string, unknown>);
      if (row.owner_id === userData.user.id) {
        navigate(`/live/sessions/${row.id}`, { replace: true });
        return;
      }
      setSession(row);
      setLoading(false);
    })();
  }, [sessionId, navigate]);

  if (loading || !session) {
    return <div className="flex min-h-screen items-center justify-center text-muted-foreground">Loading…</div>;
  }

  const classId = session.class_id;
  const state = scheduleStateOf(session, now);
  const startMs = session.starts_at ? new Date(session.starts_at).getTime() : NaN;
  const boardLocked = state === "scheduled" || state === "starting-soon";

  const tiles: { label: string; icon: typeof BookOpen; to: string }[] = [
    { label: "Lesson Notes", icon: BookOpen, to: `/student/class/${classId}` },
    { label: "Assignments", icon: ClipboardList, to: `/student/class/${classId}` },
    { label: "Adventure", icon: Compass, to: `/student/class/${classId}/adventures` },
    { label: "Games", icon: Gamepad2, to: `/student/class/${classId}/games` },
    { label: "Gallery", icon: ImageIcon, to: `/student/class/${classId}/gallery` },
    { label: "Report", icon: BarChart3, to: `/student/class/${classId}/report` },
  ];

  return (
    <div className="min-h-screen w-full bg-gradient-to-b from-background via-background to-muted/20 text-foreground">
      <header className="flex items-center justify-between px-6 py-5">
        <Link to="/live/join" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-4 w-4" /> My Sessions
        </Link>
        <h1 className="text-lg font-semibold tracking-wide">MathGPL Live</h1>
        <div className="w-24" />
      </header>

      <main className="mx-auto max-w-4xl space-y-6 px-6 py-8">
        <section className="rounded-2xl border border-border bg-card/40 p-6 backdrop-blur">
          <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide ${scheduleTone[state]}`}>
            {state === "live" && <Radio className="h-3 w-3 animate-pulse" />}
            {scheduleLabel[state]}
          </span>
          <div className="mt-3 text-3xl font-semibold">{session.title}</div>
          {session.description && <p className="mt-2 text-sm text-muted-foreground">{session.description}</p>}
          <div className="mt-3 text-sm text-muted-foreground">
            {formatStartsAt(session.starts_at, session.time_zone)} · {session.duration_minutes} min
          </div>
        </section>

        <BroadcastPanel entries={session.broadcasts} unlocked={!boardLocked} />



        {boardLocked ? (
          <section className="rounded-2xl border border-amber-300/40 bg-amber-400/10 p-8 text-center">
            <Lock className="mx-auto h-7 w-7 text-amber-200" />
            <div className="mt-3 text-lg font-semibold text-amber-100">Waiting for teacher</div>
            <div className="mt-1 text-sm text-amber-100/80">Class starts in</div>
            <div className="mt-2 font-mono text-4xl font-semibold tabular-nums text-amber-100">
              {formatCountdownClock(Number.isNaN(startMs) ? 0 : startMs - now)}
            </div>
            <div className="mt-2 text-xs text-amber-100/70">
              {Number.isNaN(startMs) ? "" : formatCountdownLong(startMs - now)}
            </div>
          </section>
        ) : (
          <Link
            to={`/student/class/${classId}/smartboard`}
            className="flex items-center justify-between rounded-2xl border border-emerald-300/40 bg-emerald-400/10 p-6 transition hover:scale-[1.01]"
          >
            <div>
              <div className="text-lg font-semibold text-emerald-100">Open SmartBoard</div>
              <div className="text-sm text-emerald-100/80">Follow the lesson live and solve along.</div>
            </div>
            <Presentation className="h-7 w-7 text-emerald-200" />
          </Link>
        )}

        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
          {tiles.map(({ label, icon: Icon, to }) => (
            <Link
              key={label}
              to={to}
              className="flex h-28 flex-col justify-between rounded-2xl border border-border bg-card/40 p-4 backdrop-blur transition hover:scale-[1.02] hover:border-primary/40"
            >
              <Icon className="h-5 w-5 text-primary" />
              <div className="text-sm font-semibold">{label}</div>
            </Link>
          ))}
        </div>
      </main>
    </div>
  );
};

export default ParticipantSessionPage;
