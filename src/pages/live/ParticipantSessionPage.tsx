import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "@/lib/router-compat";
import {
  ArrowLeft, BookOpen, Presentation, ClipboardList, Compass, Gamepad2,
  Image as ImageIcon, BarChart3, DoorOpen, Radio, UserRound,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import {
  LiveSession, formatNextLesson, formatRoomSchedule, hydrateSession,
  roomLabel, roomStateOf, roomTone, querySessions,
} from "@/lib/live/sessions";

import BroadcastPanel from "@/components/live/BroadcastPanel";
import { guestDisplayName, guestName, setGuestName } from "@/lib/live/guest";
import { useBreakpoint } from "@/hooks/useBreakpoint";
import AudienceSessionPage from "@/pages/live/audience/AudienceSessionPage";

/**
 * The session page serves two people from one link.
 *
 * A signed-in class member sees the full participant workspace. Someone who
 * simply received the link joins as audience: no registration, no redirect —
 * the session opens immediately, and a name is requested inline only when the
 * teacher switched that on.
 */
const ParticipantSessionPage = () => {
  const { sessionId } = useParams();
  const navigate = useNavigate();
  const bp = useBreakpoint();
  

  const [session, setSession] = useState<LiveSession | null>(null);
  const [loading, setLoading] = useState(true);
  const [signedIn, setSignedIn] = useState(false);
  const [notFound, setNotFound] = useState(false);
  const [nameDraft, setNameDraft] = useState("");
  const [name, setName] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const { data: userData } = await supabase.auth.getUser();
      const user = userData.user ?? null;
      setSignedIn(Boolean(user));

      // A guest never loads this page's data: the audience environment owns its
      // own session read and its own messaging.
      if (!user) {
        setLoading(false);
        return;
      }

      const data = await querySessions<Record<string, unknown>>((cols) =>
        supabase.from("sessions").select(cols).eq("id", sessionId!).maybeSingle() as never,
      );

      if (!data) {
        setNotFound(true);
        setLoading(false);
        return;
      }
      const row = hydrateSession(data as unknown as Record<string, unknown>);
      if (user && row.owner_id === user.id) {
        navigate(`/live/sessions/${row.id}`, { replace: true });
        return;
      }
      setSession(row);
      setName(user ? null : guestName());
      setLoading(false);
    })();
  }, [sessionId, navigate]);

  if (loading) {
    return <div className="flex min-h-screen items-center justify-center text-muted-foreground">Loading…</div>;
  }

  // Someone who simply received the link is audience, not a member: they get
  // the confined MathGPL Live environment (Notes, SmartBoard, Challenge, Game
  // Challenge) with no account and no platform navigation.
  if (!signedIn) return <AudienceSessionPage />;

  if (notFound || !session) {
    return (
      <div className="mx-auto flex min-h-screen max-w-md flex-col items-center justify-center gap-4 px-6 text-center">
        <h1 className="text-xl font-semibold">Session unavailable</h1>
        <p className="text-sm text-muted-foreground">
          This live session link is no longer active. Ask your teacher for a fresh link.
        </p>
        <Link to="/live/join" className="min-h-[44px] rounded-xl bg-primary px-5 py-3 text-sm font-medium text-primary-foreground">
          Enter a session code
        </Link>
      </div>
    );
  }

  const classId = session.class_id;
  const state = roomStateOf(session);
  const audience = !signedIn;

  const needsName = audience && session.ask_participant_name && !name;
  const phone = bp === "phone";

  const tiles: { label: string; icon: typeof BookOpen; to: string }[] = [
    { label: "Lesson Notes", icon: BookOpen, to: `/student/class/${classId}` },
    { label: "Assignments", icon: ClipboardList, to: `/student/class/${classId}` },
    { label: "Adventure", icon: Compass, to: `/student/class/${classId}/adventures` },
    { label: "Games", icon: Gamepad2, to: `/student/class/${classId}/games` },
    { label: "Gallery", icon: ImageIcon, to: `/student/class/${classId}/gallery` },
    { label: "Report", icon: BarChart3, to: `/student/class/${classId}/report` },
  ];

  return (
    <div className="min-h-screen w-full overflow-x-hidden bg-gradient-to-b from-background via-background to-muted/20 text-foreground">
      <header className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 px-4 py-4 sm:px-6 sm:py-5">
        <Link
          to="/live/join"
          className="inline-flex min-h-[44px] min-w-0 items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4 shrink-0" />
          <span className="truncate">{audience ? "Enter another code" : "My Sessions"}</span>
        </Link>
        <h1 className="shrink-0 text-base font-semibold tracking-wide sm:text-lg">MathGPL Live</h1>
      </header>

      <main className="mx-auto w-full max-w-4xl space-y-5 px-4 pb-10 sm:px-6 sm:py-8">
        <section className="rounded-2xl border border-border bg-card/40 p-5 backdrop-blur sm:p-6">
          <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide ${roomTone[state]}`}>
            {state === "live" ? <Radio className="h-3 w-3 animate-pulse" /> : <DoorOpen className="h-3 w-3" />}
            {roomLabel[state]}
          </span>
          <div className="mt-3 text-2xl font-semibold sm:text-3xl">{session.title}</div>
          {session.description && <p className="mt-2 text-sm text-muted-foreground">{session.description}</p>}
          <div className="mt-3 text-sm text-muted-foreground">
            {formatRoomSchedule(session)} · {session.duration_minutes} min
          </div>
          {!session.is_live && formatNextLesson(session) && (
            <div className="mt-1 text-sm text-cyan-200">Next lesson: {formatNextLesson(session)}</div>
          )}

          {audience && (
            <div className="mt-4 inline-flex items-center gap-2 rounded-full border border-border bg-background/60 px-3 py-1.5 text-xs text-muted-foreground">
              <UserRound className="h-3.5 w-3.5 shrink-0" />
              <span className="truncate">Joined as {name ?? guestDisplayName()}</span>
            </div>
          )}
        </section>

        {needsName && (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (!nameDraft.trim()) return;
              setGuestName(nameDraft);
              setName(nameDraft.trim());
            }}
            className="space-y-3 rounded-2xl border border-primary/40 bg-primary/5 p-5"
          >
            <label htmlFor="audience-name" className="text-sm font-medium">
              Your teacher would like to know who's here
            </label>
            <input
              id="audience-name"
              value={nameDraft}
              onChange={(e) => setNameDraft(e.target.value)}
              placeholder="Your name"
              autoComplete="name"
              className="w-full rounded-xl border border-border bg-background px-4 py-3 text-base outline-hidden focus:border-primary"
            />
            <button
              type="submit"
              className="min-h-[48px] w-full rounded-xl bg-primary px-4 text-base font-medium text-primary-foreground active:scale-[0.99]"
            >
              Continue
            </button>
          </form>
        )}

        {/* The room is permanent: broadcast links and the board are never clock-locked. */}
        <BroadcastPanel entries={session.broadcasts} unlocked />

        {audience ? (

          <section className="rounded-2xl border border-emerald-300/40 bg-emerald-400/10 p-5 sm:p-6">
            <div className="text-lg font-semibold text-emerald-100">You're in the session</div>
            <p className="mt-1 text-sm text-emerald-100/80">
              Use the broadcast link above to watch and take part. No account needed.
            </p>
          </section>
        ) : (
          <Link
            to={`/student/class/${classId}/smartboard`}
            className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 rounded-2xl border border-emerald-300/40 bg-emerald-400/10 p-5 transition active:scale-[0.99] sm:p-6 sm:hover:scale-[1.01]"
          >
            <div className="min-w-0">
              <div className="text-lg font-semibold text-emerald-100">Open SmartBoard</div>
              <div className="text-sm text-emerald-100/80">Follow the lesson live and solve along.</div>
            </div>
            <Presentation className="h-7 w-7 shrink-0 text-emerald-200" />
          </Link>
        )}

        {!audience && (
          <div className={`grid gap-3 sm:grid-cols-3 sm:gap-4 ${phone ? "grid-cols-2" : "grid-cols-2"}`}>
            {tiles.map(({ label, icon: Icon, to }) => (
              <Link
                key={label}
                to={to}
                className="flex h-24 min-w-0 flex-col justify-between rounded-2xl border border-border bg-card/40 p-4 backdrop-blur transition active:scale-[0.98] sm:h-28 sm:hover:scale-[1.02] sm:hover:border-primary/40"
              >
                <Icon className="h-5 w-5 shrink-0 text-primary" />
                <div className="truncate text-sm font-semibold">{label}</div>
              </Link>
            ))}
          </div>
        )}
      </main>
    </div>
  );
};

export default ParticipantSessionPage;
