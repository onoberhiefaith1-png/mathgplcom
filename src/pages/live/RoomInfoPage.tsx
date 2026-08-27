import { Link } from "@/lib/router-compat";
import { CalendarDays, DoorOpen, Radio, Users } from "lucide-react";

import BroadcastPanel from "@/components/live/BroadcastPanel";
import { copyText } from "@/lib/clipboard/copyText";
import { joinUrl } from "@/lib/links/publicUrl";
import {
  LiveSession,
  formatClockTime,
  formatNextLesson,
  roomScheduleEntries,
} from "@/lib/live/sessions";
import { dayName } from "@/lib/live/schedule";

/**
 * Live Broadcast Information.
 *
 * A Live room is a permanent public teaching room. When the teacher is not
 * currently teaching, anyone opening the room's link lands here: who teaches,
 * what they teach, on which days and at what time, and where the broadcast
 * happens. Nothing on this page ever says the room ended or expired.
 */
const RoomInfoPage = ({ session }: { session: LiveSession }) => {
  const entries = roomScheduleEntries(session);
  const next = formatNextLesson(session);
  const teacher = session.teacher_name?.trim() || "Teacher";
  const subject = [session.subject, session.subtopic].filter(Boolean).join(" — ");

  return (
    <div className="min-h-screen w-full bg-gradient-to-b from-background via-background to-muted/20 text-foreground">
      <main className="mx-auto w-full max-w-3xl space-y-5 px-4 py-8 sm:px-6">
        <section className="rounded-2xl border border-border bg-card/40 p-6 backdrop-blur">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-muted/40 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
            <DoorOpen className="h-3 w-3" /> Teaching room
          </span>
          <h1 className="mt-3 text-2xl font-semibold sm:text-3xl">{session.title}</h1>
          {session.description && (
            <p className="mt-2 text-sm text-muted-foreground">{session.description}</p>
          )}
          <dl className="mt-4 grid gap-3 sm:grid-cols-2">
            <div>
              <dt className="text-xs uppercase tracking-wider text-muted-foreground">Teacher</dt>
              <dd className="mt-0.5 text-sm font-medium">{teacher}</dd>
            </div>
            <div>
              <dt className="text-xs uppercase tracking-wider text-muted-foreground">Subject</dt>
              <dd className="mt-0.5 text-sm font-medium">{subject || "Mathematics"}</dd>
            </div>
          </dl>

          <div className="mt-5 rounded-xl border border-amber-300/40 bg-amber-400/10 p-4 text-sm text-amber-100">
            The teacher is not currently teaching. This room stays open — come back at a teaching time
            below, and this page opens the live class by itself the moment teaching starts.
          </div>
        </section>

        <section className="rounded-2xl border border-border bg-card/40 p-6 backdrop-blur">
          <div className="flex items-center gap-2 text-sm font-semibold">
            <CalendarDays className="h-4 w-4 text-primary" /> Teaching schedule
          </div>
          {entries.length === 0 ? (
            <p className="mt-3 text-sm text-muted-foreground">
              The teacher has not published a regular schedule for this room yet.
            </p>
          ) : (
            <ul className="mt-3 space-y-1.5 text-sm">
              {entries.map(({ day, time }) => (
                <li key={day} className="flex items-center justify-between gap-3 border-b border-border/50 pb-1.5 last:border-0">
                  <span className="font-medium">{dayName(day)}</span>
                  <span className="text-muted-foreground">{time ? formatClockTime(time) : "Time not set"}</span>
                </li>
              ))}
            </ul>
          )}
          {next && <p className="mt-3 text-sm text-cyan-200">Next teaching time: {next}</p>}
          {session.time_zone && (
            <p className="mt-1 text-xs text-muted-foreground">Times shown for {session.time_zone}</p>
          )}
        </section>

        <BroadcastPanel entries={session.broadcasts} unlocked />

        <section className="rounded-2xl border border-border bg-card/40 p-6 backdrop-blur">
          <div className="flex items-center gap-2 text-sm font-semibold">
            <Users className="h-4 w-4 text-primary" /> Entry
          </div>
          <p className="mt-2 text-sm text-muted-foreground">
            {session.allow_free_entry
              ? "Free entry — anyone with this room's link or code can come in."
              : "The teacher admits visitors one by one when teaching starts."}
          </p>
          {session.session_code && (
            <div className="mt-3 space-y-2 text-sm">
              <div>
                Room code:{" "}
                <code className="rounded bg-background px-1.5 py-0.5">{session.session_code}</code>
              </div>
              <button
                type="button"
                onClick={() => copyText(joinUrl(session.session_code))}
                className="min-h-[40px] rounded-xl border border-border px-4 text-sm font-medium hover:bg-accent"
              >
                Copy permanent join link
              </button>
            </div>
          )}
        </section>

        <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
          <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
            <Radio className="h-3.5 w-3.5" /> MathGPL Live — permanent teaching room
          </span>
          <Link
            to="/live/join"
            className="min-h-[40px] rounded-xl border border-border px-4 py-2 text-sm font-medium hover:bg-accent"
          >
            Enter another room code
          </Link>
        </div>
      </main>
    </div>
  );
};

export default RoomInfoPage;
