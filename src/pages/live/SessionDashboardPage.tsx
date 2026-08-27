import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "@/lib/router-compat";
import {
  ArrowLeft, Users, BookOpen, Presentation, ClipboardList, Compass, Gamepad2,
  Image as ImageIcon, BarChart3, Copy, Check, Radio,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { ensureClassOwner } from "@/lib/classes/ensureClassOwner";
import JoinRequestsPanel from "@/components/class/JoinRequestsPanel";
import AudienceEntryPanel from "@/components/live/AudienceEntryPanel";
import { publicOrigin } from "@/lib/public/publicSite";
import {
  LiveSession, formatCountdownLong, formatStartsAt, hydrateSession, scheduleLabel,
  scheduleStateOf, scheduleTone, updateSessionBroadcasts, SESSION_COLUMNS, fetchSessionCode,
} from "@/lib/live/sessions";
import { useNowTick } from "@/lib/live/useCountdown";
import BroadcastEditor from "@/components/live/BroadcastEditor";
import { BroadcastEntry } from "@/lib/live/broadcast";


const SessionDashboardPage = () => {
  const { sessionId } = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [session, setSession] = useState<LiveSession | null>(null);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState<string | null>(null);
  const [broadcasts, setBroadcasts] = useState<BroadcastEntry[]>([]);
  const [savingBroadcasts, setSavingBroadcasts] = useState(false);
  const now = useNowTick();

  const saveBroadcasts = async () => {
    if (!sessionId) return;
    setSavingBroadcasts(true);
    const { error } = await updateSessionBroadcasts(sessionId, broadcasts);
    setSavingBroadcasts(false);
    toast(
      error
        ? { title: "Could not save broadcast details", description: error.message, variant: "destructive" }
        : { title: "Broadcast details saved" },
    );
  };


  useEffect(() => {
    (async () => {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) {
        navigate(`/auth?redirect=/live/sessions/${sessionId}`);
        return;
      }
      const { data, error } = await supabase
        .from("sessions")
        .select(SESSION_COLUMNS)
        .eq("id", sessionId!)
        .maybeSingle();
      if (error || !data) {
        toast({ title: "Session not found", variant: "destructive" });
        navigate("/live/sessions");
        return;
      }
      const row = hydrateSession(data as Record<string, unknown>);
      if (row.owner_id !== userData.user.id) {
        navigate(`/live/s/${row.id}`, { replace: true });
        return;
      }
      const redirect = await ensureClassOwner(row.class_id, userData.user.id);
      if (redirect) {
        navigate(redirect, { replace: true });
        return;
      }
      setSession({ ...row, session_code: await fetchSessionCode(row.id) });
      setBroadcasts(row.broadcasts);
      setLoading(false);

    })();
  }, [sessionId, navigate, toast]);

  const copy = async (label: string, value: string) => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(label);
      setTimeout(() => setCopied(null), 1500);
    } catch {
      toast({ title: "Copy failed", variant: "destructive" });
    }
  };

  if (loading || !session) {
    return (
      <div className="flex min-h-screen items-center justify-center text-muted-foreground">Loading…</div>
    );
  }

  const classId = session.class_id;
  const state = scheduleStateOf(session, now);
  const startMs = session.starts_at ? new Date(session.starts_at).getTime() : NaN;
  const joinLink = `${publicOrigin()}/live/join/${session.session_code}`;

  const tiles: { label: string; icon: typeof Users; to: string }[] = [
    { label: "Audience", icon: Users, to: `/live/workspace/${classId}/students` },
    { label: "Lesson Notes", icon: BookOpen, to: `/live/workspace/${classId}/lesson-notes` },
    { label: "SmartBoard", icon: Presentation, to: `/live/workspace/${classId}/smartboard` },
    { label: "Challenges", icon: ClipboardList, to: `/live/workspace/${classId}/assignments` },
    { label: "Game Challenges", icon: Compass, to: `/live/workspace/${classId}/adventures` },
    { label: "Assessment", icon: Gamepad2, to: `/live/workspace/${classId}/games` },
    { label: "Gallery", icon: ImageIcon, to: `/live/workspace/${classId}/gallery` },
    { label: "Reports", icon: BarChart3, to: `/live/workspace/${classId}/report` },
  ];

  return (
    <div className="min-h-screen w-full bg-gradient-to-b from-background via-background to-muted/20 text-foreground">
      <header className="flex items-center justify-between px-6 py-5">
        <Link to="/live/sessions" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-4 w-4" /> Sessions
        </Link>
        <h1 className="text-lg font-semibold tracking-wide">Session Dashboard</h1>
        <div className="w-32" />
      </header>

      <main className="mx-auto max-w-5xl space-y-8 px-6 py-8">
        <section className="rounded-2xl border border-border bg-card/40 p-6 backdrop-blur">
          <div className="flex flex-wrap items-center gap-2">
            <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide ${scheduleTone[state]}`}>
              {state === "live" && <Radio className="h-3 w-3 animate-pulse" />}
              {scheduleLabel[state]}
            </span>
            <span className="rounded-full border border-border px-2.5 py-1 text-[11px] uppercase tracking-wide text-muted-foreground">
              {session.visibility === "public" ? "Public" : "Private"}
            </span>
          </div>

          <div className="mt-3 text-3xl font-semibold">{session.title}</div>
          {session.description && <p className="mt-2 text-sm text-muted-foreground">{session.description}</p>}

          <div className="mt-4 text-sm text-muted-foreground">
            {formatStartsAt(session.starts_at, session.time_zone)} · {session.duration_minutes} min · {session.time_zone}
          </div>

          {(state === "scheduled" || state === "starting-soon") && !Number.isNaN(startMs) && (
            <div className="mt-4 rounded-xl border border-cyan-300/30 bg-cyan-400/10 p-4">
              <div className="text-xs uppercase tracking-wider text-cyan-200/80">Starts in</div>
              <div className="mt-1 text-2xl font-semibold text-cyan-100">{formatCountdownLong(startMs - now)}</div>
            </div>
          )}

          <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2">
            {([
              { label: "Session Code", value: session.session_code },
              { label: "Join Link", value: joinLink },
            ] as const).map((row) => (
              <div key={row.label} className="space-y-1">
                <div className="text-xs uppercase tracking-wider text-muted-foreground">{row.label}</div>
                <div className="flex items-center gap-2">
                  <code className="flex-1 truncate rounded-md border border-border bg-background px-2 py-1.5 text-xs">{row.value}</code>
                  <button
                    type="button"
                    onClick={() => copy(row.label, row.value)}
                    className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-border hover:bg-accent"
                    aria-label={`Copy ${row.label}`}
                  >
                    {copied === row.label ? <Check className="h-4 w-4 text-green-500" /> : <Copy className="h-4 w-4" />}
                  </button>
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className="space-y-4 rounded-2xl border border-border bg-card/40 p-6 backdrop-blur">
          <BroadcastEditor value={broadcasts} onChange={setBroadcasts} />
          <button
            type="button"
            onClick={saveBroadcasts}
            disabled={savingBroadcasts}
            className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition hover:opacity-90 disabled:opacity-50"
          >
            {savingBroadcasts ? "Saving…" : "Save broadcast details"}
          </button>
        </section>



        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
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

        <AudienceEntryPanel sessionId={session.id} />

        <JoinRequestsPanel classId={classId} />
      </main>
    </div>
  );
};

export default SessionDashboardPage;
