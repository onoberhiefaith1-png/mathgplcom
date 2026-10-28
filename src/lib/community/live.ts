/**
 * Live Now — public teaching rooms that are actually on air right now.
 *
 * A session is only listed while its owner has it live and shared publicly:
 * Community never advertises a room that cannot be entered.
 */
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type LiveNowRoom = {
  sessionId: string;
  shareCode: string | null;
  title: string;
  subject: string | null;
  startedAt: string | null;
  ownerUsername: string | null;
  ownerName: string;
  ownerAvatarUrl: string | null;
  audienceCount: number;
};

type LiveRow = {
  session_id: string;
  share_code: string | null;
  title: string | null;
  subject: string | null;
  live_started_at: string | null;
  owner_username: string | null;
  owner_name: string | null;
  owner_avatar_url: string | null;
  audience_count: number | null;
};

export const listLiveNow = async (): Promise<LiveNowRoom[]> => {
  const { data, error } = await (
    supabase.rpc as unknown as (n: string, a?: Record<string, unknown>) => Promise<{ data: unknown; error: unknown }>
  )("community_live_now", {});
  if (error) throw error as Error;
  return ((data ?? []) as LiveRow[]).map((row) => ({
    sessionId: row.session_id,
    shareCode: row.share_code,
    title: row.title || "Live teaching room",
    subject: row.subject,
    startedAt: row.live_started_at,
    ownerUsername: row.owner_username,
    ownerName: row.owner_name || row.owner_username || "MathGPL teacher",
    ownerAvatarUrl: row.owner_avatar_url,
    audienceCount: Number(row.audience_count ?? 0),
  }));
};

/** Live is time-critical: it refreshes on its own while the page is open. */
export const useLiveNow = () => {
  const query = useQuery({
    queryKey: ["community", "live-now"],
    queryFn: listLiveNow,
    refetchInterval: 20_000,
  });
  return { rooms: query.data ?? [], isLoading: query.isLoading, refetch: query.refetch };
};
