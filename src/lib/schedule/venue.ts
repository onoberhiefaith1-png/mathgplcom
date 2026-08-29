/**
 * Where the teaching happens.
 *
 * Online teaching reuses the existing Live broadcast platforms untouched
 * (Zoom, Google Meet, WhatsApp, YouTube, TikTok, …). A Class can instead be
 * physical, which is what `classroom` adds: an address and room details.
 * A Live room simply never selects `classroom`.
 */

import { BroadcastEntry, displayName } from "@/lib/live/broadcast";

export type VenueKind = "online" | "classroom";

export const parseVenueKind = (value: unknown): VenueKind =>
  value === "classroom" ? "classroom" : "online";

export type Venue = {
  kind: VenueKind;
  broadcasts: BroadcastEntry[];
  address: string | null;
  details: string | null;
};

/** "Zoom · Google Meet", "Classroom — 24 Main Street, London", or "". */
export const formatVenue = (venue: Venue): string => {
  if (venue.kind === "classroom") {
    const where = (venue.address ?? "").trim();
    return where ? `Classroom — ${where}` : "Classroom";
  }
  const names = venue.broadcasts.map(displayName).filter(Boolean);
  return names.length ? names.join(" · ") : "";
};

/** Short form for a headline: "Classroom" / "Zoom". */
export const venueLabel = (venue: Venue): string => {
  if (venue.kind === "classroom") return "Classroom";
  const first = venue.broadcasts[0];
  return first ? displayName(first) : "Online";
};
