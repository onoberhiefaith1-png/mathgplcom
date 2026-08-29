import { CalendarClock, MapPin } from "lucide-react";
import {
  dayName,
  formatClockTime,
  formatTimeWindow,
  nextOccurrence,
} from "@/lib/live/schedule";
import type { ClassMeeting } from "@/lib/classes/classMeeting";
import { formatVenue } from "@/lib/schedule/venue";
import {
  formatPlanDate,
  formatPlanDayDate,
  nextPlanEntry,
  upcomingPlanEntries,
  type SchedulePlanEntry,
} from "@/lib/schedule/plan";
import { toHref } from "@/lib/live/broadcast";

/**
 * "What are we doing now, when is the next class, what comes next" — shown to
 * anyone in the space without the teacher having to start anything.
 */
const ComingSoonPanel = ({
  meeting,
  entries,
  className,
}: {
  meeting: ClassMeeting;
  entries: SchedulePlanEntry[];
  className?: string;
}) => {
  const next = nextPlanEntry(entries);
  const upcoming = upcomingPlanEntries(entries).slice(0, 5);
  const occurrence = nextOccurrence(meeting.scheduleDays, meeting.scheduleTimes);
  const venueText = formatVenue(meeting.venue);

  const when = next?.entryDate
    ? formatPlanDayDate(next.entryDate)
    : occurrence
      ? `Every ${dayName(occurrence.day)}`
      : "";

  const timeWindow = occurrence
    ? formatTimeWindow(occurrence.time, meeting.scheduleEndTimes[String(occurrence.day)] ?? null)
    : "";

  const nothingSet = !when && !timeWindow && !venueText && upcoming.length === 0;
  if (nothingSet) return null;

  const link = meeting.venue.kind === "online" ? toHref(meeting.venue.broadcasts[0]?.link) : null;

  return (
    <section
      className={`rounded-2xl border border-border bg-card/50 p-5 backdrop-blur ${className ?? ""}`}
    >
      <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
        Coming Soon
      </div>

      <div className="mt-2 space-y-1">
        <div className="flex items-center gap-2 text-base font-semibold">
          <CalendarClock className="h-4 w-4 shrink-0 text-primary" />
          <span className="truncate">
            {when ? `Next class — ${when}` : "Next class"}
          </span>
        </div>
        {next?.topic && <div className="text-sm font-medium">{next.topic}</div>}
        {next?.description && (
          <p className="text-xs text-muted-foreground">{next.description}</p>
        )}
        {timeWindow && <div className="text-sm tabular-nums text-muted-foreground">{timeWindow}</div>}
        {venueText && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <MapPin className="h-3.5 w-3.5 shrink-0" />
            <span className="truncate">{venueText}</span>
          </div>
        )}
        {meeting.venue.kind === "classroom" && meeting.venue.details && (
          <p className="text-xs text-muted-foreground">{meeting.venue.details}</p>
        )}
        {link && (
          <a
            href={link}
            target="_blank"
            rel="noreferrer"
            className="inline-flex text-xs font-medium text-primary underline-offset-2 hover:underline"
          >
            Open joining link
          </a>
        )}
        {meeting.venue.kind === "online" &&
          meeting.venue.broadcasts.map((b) => (
            <div key={b.id} className="text-xs text-muted-foreground">
              {b.code && <span className="mr-3">Meeting ID: {b.code}</span>}
              {b.password && <span className="mr-3">Password: {b.password}</span>}
              {b.note && <span>{b.note}</span>}
            </div>
          ))}
        {meeting.timeZone && (
          <div className="text-[11px] text-muted-foreground">Times shown for {meeting.timeZone}</div>
        )}
      </div>

      {upcoming.length > 0 && (
        <div className="mt-4 border-t border-border pt-3">
          <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
            Upcoming Topics
          </div>
          <ul className="mt-2 space-y-1.5">
            {upcoming.map((e) => (
              <li key={e.id} className="flex flex-wrap items-baseline gap-x-2 text-sm">
                <span className="tabular-nums text-muted-foreground">
                  {e.entryDate ? formatPlanDate(e.entryDate) : e.weekLabel || "Later"}
                </span>
                <span className="text-muted-foreground">—</span>
                <span className="font-medium">{e.topic}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {!next && occurrence && (
        <p className="mt-3 text-xs text-muted-foreground">
          Next meeting {dayName(occurrence.day)} at {formatClockTime(occurrence.time)}.
        </p>
      )}
    </section>
  );
};

export default ComingSoonPanel;
