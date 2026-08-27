import { useQuery } from "@tanstack/react-query";

import { supabase } from "@/integrations/supabase/client";
import { nextOccurrence, querySessions, hydrateSession } from "@/lib/live/sessions";

export type UpcomingSession = {
  id: string;
  title: string;
  startsAt: string;
  durationMinutes: number | null;
};

/**
 * The teacher's real schedule.
 *
 * Teaching rooms are permanent, so "upcoming" means the next occurrence of each
 * room's recurring day and time. Rooms without a schedule are omitted — nothing
 * is invented, and when there is nothing scheduled the dashboard says so.
 */
export const useUpcomingSessions = () =>
  useQuery({
    queryKey: ["teacher-upcoming-sessions"],
    staleTime: 60_000,
    queryFn: async (): Promise<UpcomingSession[]> => {
      const { data: userData } = await supabase.auth.getUser();
      const user = userData.user;
      if (!user) return [];
      const rows = await querySessions<Record<string, unknown>[]>((cols) =>
        supabase.from("sessions").select(cols).eq("owner_id", user.id) as never,
      );
      return (rows ?? [])
        .map(hydrateSession)
        .map((s) => ({ session: s, next: nextOccurrence(s.schedule_days, s.schedule_time) }))
        .filter((entry): entry is { session: ReturnType<typeof hydrateSession>; next: Date } => Boolean(entry.next))
        .sort((a, b) => a.next.getTime() - b.next.getTime())
        .slice(0, 5)
        .map(({ session, next }) => ({
          id: session.id,
          title: session.title || "Live session",
          startsAt: next.toISOString(),
          durationMinutes: session.duration_minutes,
        }));
    },
  });
