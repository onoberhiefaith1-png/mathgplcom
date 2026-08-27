import { Link, useParams } from "@/lib/router-compat";
import { BookOpen, ClipboardList, Gamepad2, Presentation, UserRound } from "lucide-react";

import AudienceShell from "./AudienceShell";
import { useAudienceAccess } from "@/lib/live/useAudienceAccess";
import { guestDisplayName } from "@/lib/live/guest";
import { formatNextLesson, formatRoomSchedule } from "@/lib/live/sessions";
import BroadcastPanel from "@/components/live/BroadcastPanel";

/** The four things an audience member can do in a MathGPL Live session. */
const AudienceSessionPage = () => {
  const { sessionId } = useParams();
  const access = useAudienceAccess(sessionId);
  const session = access.session;


  const tiles = [
    { label: "Notes", icon: BookOpen, to: `/live/s/${sessionId}/notes`, hint: "Read the lesson notes for this session." },
    { label: "SmartBoard", icon: Presentation, to: `/live/s/${sessionId}/board`, hint: "Follow the live mathematical board." },
    { label: "Challenge", icon: ClipboardList, to: `/live/s/${sessionId}/challenge`, hint: "Solve the questions set for this session." },
    { label: "Game Challenge", icon: Gamepad2, to: `/live/s/${sessionId}/game`, hint: "Play the game challenge and solve to progress." },
  ];

  return (
    <AudienceShell access={access}>
      <section className="rounded-2xl border border-border bg-card/40 p-5 backdrop-blur sm:p-6">
        <h1 className="text-2xl font-semibold sm:text-3xl">{session?.title}</h1>
        {session?.description && <p className="mt-2 text-sm text-muted-foreground">{session.description}</p>}
        {session && (
          <div className="mt-3 text-sm text-muted-foreground">
            {formatRoomSchedule(session)} · {session.duration_minutes} min
          </div>
        )}
        {session && !session.is_live && formatNextLesson(session) && (
          <div className="mt-1 text-sm text-cyan-200">Next lesson: {formatNextLesson(session)}</div>
        )}

        {!access.signedIn && (
          <div className="mt-4 inline-flex items-center gap-2 rounded-full border border-border bg-background/60 px-3 py-1.5 text-xs text-muted-foreground">
            <UserRound className="h-3.5 w-3.5 shrink-0" />
            <span className="truncate">Joined as {access.name ?? guestDisplayName()}</span>
          </div>
        )}
      </section>

      {session && <div className="mt-4"><BroadcastPanel entries={session.broadcasts} unlocked /></div>}

      <div className="mt-5 grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        {tiles.map(({ label, icon: Icon, to, hint }) => (
          <Link
            key={label}
            to={to}
            className="flex min-h-[7rem] min-w-0 flex-col justify-between rounded-2xl border border-border bg-card/40 p-4 backdrop-blur transition active:scale-[0.98] sm:hover:scale-[1.02] sm:hover:border-primary/40"
          >
            <Icon className="h-5 w-5 shrink-0 text-primary" />
            <div>
              <div className="truncate text-sm font-semibold">{label}</div>
              <div className="mt-0.5 hidden text-xs text-muted-foreground sm:block">{hint}</div>
            </div>
          </Link>
        ))}
      </div>
    </AudienceShell>
  );
};

export default AudienceSessionPage;
