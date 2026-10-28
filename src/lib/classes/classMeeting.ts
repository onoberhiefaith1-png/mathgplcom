/**
 * A Class's "when and where" — the same information a Live room carries, so a
 * student always knows the day, the time window and the place before anything
 * starts. Read and written on the `classes` row itself.
 */

import { supabase } from "@/integrations/supabase/client";
import { normalizeBroadcasts, parseBroadcasts, type BroadcastEntry } from "@/lib/live/broadcast";
import { hydrateScheduleTimes, parseScheduleTimes, type ScheduleTimes } from "@/lib/live/schedule";
import { parseVenueKind, type Venue, type VenueKind } from "@/lib/schedule/venue";

export type ClassMeeting = {
  scheduleDays: number[];
  scheduleTimes: ScheduleTimes;
  scheduleEndTimes: ScheduleTimes;
  timeZone: string | null;
  venue: Venue;
};

export const EMPTY_CLASS_MEETING: ClassMeeting = {
  scheduleDays: [],
  scheduleTimes: {},
  scheduleEndTimes: {},
  timeZone: null,
  venue: { kind: "online", broadcasts: [], address: null, details: null },
};

export const MEETING_COLUMNS =
  "schedule_days, schedule_times, schedule_end_times, time_zone, broadcasts, venue_kind, venue_address, venue_details";

const toDays = (value: unknown): number[] =>
  Array.isArray(value)
    ? value.map((n) => Number(n)).filter((n) => Number.isInteger(n) && n >= 0 && n <= 6)
    : [];

const text = (value: unknown): string | null =>
  typeof value === "string" && value.trim() ? value.trim() : null;

export const hydrateClassMeeting = (row: Record<string, unknown> | null): ClassMeeting => {
  if (!row) return EMPTY_CLASS_MEETING;
  const days = toDays(row.schedule_days);
  return {
    scheduleDays: days,
    scheduleTimes: hydrateScheduleTimes(row.schedule_times, days, null),
    scheduleEndTimes: parseScheduleTimes(row.schedule_end_times),
    timeZone: text(row.time_zone),
    venue: {
      kind: parseVenueKind(row.venue_kind),
      broadcasts: parseBroadcasts(row.broadcasts),
      address: text(row.venue_address),
      details: text(row.venue_details),
    },
  };
};

export const loadClassMeeting = async (classId: string): Promise<ClassMeeting> => {
  const { data } = await supabase
    .from("classes")
    .select(MEETING_COLUMNS as never)
    .eq("id", classId)
    .maybeSingle();
  return hydrateClassMeeting((data ?? null) as Record<string, unknown> | null);
};

export const meetingPayload = (meeting: ClassMeeting): Record<string, unknown> => ({
  schedule_days: meeting.scheduleDays,
  schedule_times: meeting.scheduleTimes,
  schedule_end_times: meeting.scheduleEndTimes,
  time_zone: meeting.timeZone,
  broadcasts: normalizeBroadcasts(meeting.venue.broadcasts),
  venue_kind: meeting.venue.kind satisfies VenueKind,
  venue_address: meeting.venue.kind === "classroom" ? meeting.venue.address : null,
  venue_details: meeting.venue.kind === "classroom" ? meeting.venue.details : null,
});

export const saveClassMeeting = async (classId: string, meeting: ClassMeeting) =>
  supabase
    .from("classes")
    .update(meetingPayload(meeting) as never)
    .eq("id", classId);

export const broadcastsOf = (entries: BroadcastEntry[]): BroadcastEntry[] =>
  normalizeBroadcasts(entries);
