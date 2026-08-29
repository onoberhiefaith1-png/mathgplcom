import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "@/lib/router-compat";
import {
  ArrowLeft, Users, BookOpen, Presentation, ClipboardList, Compass, Gamepad2,
  Image as ImageIcon, BarChart3, Copy, Check, Radio, DoorOpen, Lock, Square, CalendarClock,
} from "lucide-react";

import { setAllowFreeEntry } from "@/lib/live/audience";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { ensureClassOwner } from "@/lib/classes/ensureClassOwner";
import JoinRequestsPanel from "@/components/class/JoinRequestsPanel";
import {
  LiveSession, formatNextLesson, formatRoomSchedule, hydrateSession, roomLabel,
  roomStateOf, roomTone, updateSessionBroadcasts, querySessions, fetchSessionCode,
  fetchAllowFreeEntry, setLiveState,
} from "@/lib/live/sessions";
import BroadcastEditor from "@/components/live/BroadcastEditor";
import { BroadcastEntry } from "@/lib/live/broadcast";
import { joinUrl } from "@/lib/links/publicUrl";
import { copyText, selectAllIn } from "@/lib/clipboard/copyText";




const SessionDashboardPage = () => {
  const { sessionId } = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [session, setSession] = useState<LiveSession | null>(null);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState<string | null>(null);
  const [broadcasts, setBroadcasts] = useState<BroadcastEntry[]>([]);
  const [savingBroadcasts, setSavingBroadcasts] = useState(false);
  const [togglingLive, setTogglingLive] = useState(false);

  /** The teacher's own switch — the clock never opens or closes a room. */
  const toggleLive = async () => {
    if (!session) return;
    const next = !session.is_live;
    setTogglingLive(true);
    const { error } = await setLiveState(session.id, next);
    setTogglingLive(false);
    if (error) {
      toast({ title: "Could not update the room", description: error.message, variant: "destructive" });
      return;
    }
    setSession({ ...session, is_live: next });
    toast({ title: next ? "You are live" : "Live teaching stopped" });
  };


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
      const data = await querySessions<Record<string, unknown>>((cols) =>
        supabase.from("sessions").select(cols).eq("id", sessionId!).maybeSingle() as never,
      );
      if (!data) {

        toast({ title: "Session not found", variant: "destructive" });
        navigate("/live/sessions");
        return;
      }
      const row = hydrateSession(data as unknown as Record<string, unknown>);
      if (row.owner_id !== userData.user.id) {
        navigate(`/live/s/${row.id}`, { replace: true });
        return;
      }
      const redirect = await ensureClassOwner(row.class_id, userData.user.id);
      if (redirect) {
        navigate(redirect, { replace: true });
        return;
      }
      setSession({
        ...row,
        allow_free_entry: await fetchAllowFreeEntry(row.id),
        session_code: await fetchSessionCode(row.id),
      });
      setBroadcasts(row.broadcasts);
      setLoading(false);

    })();
  }, [sessionId, navigate, toast]);

  const toggleFreeEntry = async () => {
    if (!session) return;
    const next = !session.allow_free_entry;
    setSession({ ...session, allow_free_entry: next });
    await setAllowFreeEntry(session.id, next);
    toast({ title: next ? "Free entry is on" : "Approval is now required" });
  };

  const copy = async (label: string, value: string) => {
    if (await copyText(value)) {
      setCopied(label);
      setTimeout(() => setCopied(null), 1500);
      return;
    }
    toast({
      title: "Copy blocked by your browser",
      description: "Select the link and copy it manually.",
      variant: "destructive",
    });
  };

  if (loading || !session) {
    return (
      <div className="flex min-h-screen items-center justify-center text-muted-foreground">Loading…</div>
    );
  }

  const classId = session.class_id;
  const state = roomStateOf(session);

  const joinLink = joinUrl(session.session_code);

  const tiles: { label: string; icon: typeof Users; to: string }[] = [
    { label: "Audience", icon: Users, to: `/live/sessions/${sessionId}/audience` },
    { label: "Schedule", icon: CalendarClock, to: `/live/sessions/${sessionId}/schedule` },

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
            <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide ${roomTone[state]}`}>
              {state === "live" ? <Radio className="h-3 w-3 animate-pulse" /> : <DoorOpen className="h-3 w-3" />}
              {roomLabel[state]}
            </span>
            <span className="rounded-full border border-border px-2.5 py-1 text-[11px] uppercase tracking-wide text-muted-foreground">
              {session.visibility === "public" ? "Public" : "Private"}
            </span>
          </div>

          <div className="mt-3 text-3xl font-semibold">{session.title}</div>
          {session.description && <p className="mt-2 text-sm text-muted-foreground">{session.description}</p>}

          <div className="mt-4 text-sm text-muted-foreground">
            {formatRoomSchedule(session)} · {session.duration_minutes} min ·{" "}
            {session.time_zone}
          </div>

          <div className="mt-4 flex flex-wrap items-center gap-3 rounded-xl border border-border bg-background/50 p-4">
            <button
              type="button"
              onClick={toggleLive}
              disabled={togglingLive}
              className={`inline-flex min-h-[44px] items-center gap-2 rounded-xl px-4 text-sm font-semibold transition disabled:opacity-60 ${
                session.is_live
                  ? "bg-destructive text-destructive-foreground hover:opacity-90"
                  : "bg-primary text-primary-foreground hover:opacity-90"
              }`}
            >
              {session.is_live ? <Square className="h-4 w-4" /> : <Radio className="h-4 w-4" />}
              {session.is_live ? "Stop teaching" : "Start teaching"}
            </button>
            <p className="text-xs text-muted-foreground">
              {session.is_live
                ? "Your audience sees this room as Live now."
                : formatNextLesson(session)
                  ? `The room stays open. Next lesson: ${formatNextLesson(session)}.`
                  : "The room stays open — start teaching whenever you are ready."}
            </p>
          </div>


          <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2">
            {([
              { label: "Session Code", value: session.session_code },
              { label: "Join Link", value: joinLink },
            ] as const).map((row) => (
              <div key={row.label} className="space-y-1">
                <div className="text-xs uppercase tracking-wider text-muted-foreground">{row.label}</div>
                <div className="flex items-center gap-2">
                  <code
                    onClick={(e) => selectAllIn(e.currentTarget)}
                    className="min-w-0 flex-1 cursor-text rounded-md border border-border bg-background px-2 py-1.5 text-xs break-all select-all"
                  >
                    {row.value}
                  </code>
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

          <button
            type="button"
            onClick={toggleFreeEntry}
            aria-pressed={session.allow_free_entry}
            className={`mt-4 inline-flex min-h-[44px] items-center gap-2 rounded-xl border px-3 py-2 text-sm font-medium transition ${
              session.allow_free_entry
                ? "border-emerald-400/50 bg-emerald-400/10 text-emerald-200"
                : "border-border text-muted-foreground hover:bg-accent"
            }`}
          >
            {session.allow_free_entry ? <DoorOpen className="h-4 w-4" /> : <Lock className="h-4 w-4" />}
            {session.allow_free_entry ? "Free entry on" : "Approval required"}
          </button>
          <p className="mt-2 text-xs text-muted-foreground">
            With free entry on, anyone with the link or code enters straight away — no approval needed.
          </p>
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

        <JoinRequestsPanel classId={classId} />
      </main>
    </div>
  );
};

export default SessionDashboardPage;
