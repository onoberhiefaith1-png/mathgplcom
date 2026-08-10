import { useQuery } from "@tanstack/react-query";

import { supabase } from "@/integrations/supabase/client";

export type UpcomingSession = {
  id: string;
  title: string;
  startsAt: string;
  durationMinutes: number | null;
};

/**
 * The teacher's real schedule: sessions they own that have not started yet.
 * Nothing is invented — when there is nothing scheduled the dashboard says so.
 */
export const useUpcomingSessions = () =>
  useQuery({
    queryKey: ["teacher-upcoming-sessions"],
    staleTime: 60_000,
    queryFn: async (): Promise<UpcomingSession[]> => {
      const { data: userData } = await supabase.auth.getUser();
      const user = userData.user;
      if (!user) return [];
      const { data } = await supabase
        .from("sessions")
        .select("id, title, starts_at, duration_minutes")
        .eq("owner_id", user.id)
        .gte("starts_at", new Date().toISOString())
        .order("starts_at", { ascending: true })
        .limit(5);
      return ((data ?? []) as { id: string; title: string | null; starts_at: string; duration_minutes: number | null }[]).map(
        (row) => ({
          id: row.id,
          title: row.title || "Live session",
          startsAt: row.starts_at,
          durationMinutes: row.duration_minutes,
        }),
      );
    },
  });
