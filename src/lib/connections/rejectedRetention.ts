import { supabase } from "@/integrations/supabase/client";

import { fetchConnections, type Connection } from "./connections";

/**
 * A rejected request is temporary history, not a permanent record.
 *
 * The account chooses how long it stays visible; the clock runs from the moment
 * of rejection, so shortening the setting immediately hides the older ones.
 */
export const DEFAULT_RETENTION_HOURS = 24;

export const RETENTION_CHOICES: { hours: number; label: string }[] = [
  { hours: 24, label: "24 hours" },
  { hours: 72, label: "3 days" },
  { hours: 120, label: "5 days" },
  { hours: 168, label: "7 days" },
];

export const retentionLabel = (hours: number) =>
  RETENTION_CHOICES.find((c) => c.hours === hours)?.label ?? `${hours} hours`;

export type RejectedRequest = Connection & { respondedAt: string };

/** True while a rejection is still inside the retention window. */
export const isRetained = (respondedAt: string, hours: number, now: number = Date.now()): boolean => {
  const at = new Date(respondedAt).getTime();
  if (!Number.isFinite(at)) return true;
  const window = (Number.isFinite(hours) && hours > 0 ? hours : DEFAULT_RETENTION_HOURS) * 3_600_000;
  return now - at < window;
};

export const retainedRejections = (
  rows: RejectedRequest[],
  hours: number,
  now: number = Date.now(),
): RejectedRequest[] => rows.filter((row) => isRetained(row.respondedAt, hours, now));

/** How long ago the rejection happened, in words. */
export const rejectedAgo = (respondedAt: string, now: number = Date.now()): string => {
  const at = new Date(respondedAt).getTime();
  if (!Number.isFinite(at)) return "recently";
  const minutes = Math.max(0, Math.round((now - at) / 60_000));
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} ${hours === 1 ? "hour" : "hours"} ago`;
  const days = Math.round(hours / 24);
  return `${days} ${days === 1 ? "day" : "days"} ago`;
};

// The rejection time lives on the connection row but is not returned by
// my_connections(); a dedicated reader exposes it. Until that reader exists the
// page still lists rejected requests, dated by when they were sent.
type RejectedRow = {
  id: string;
  relation: string;
  status: string;
  direction: string;
  counterpart_user_id: string;
  counterpart_name: string;
  counterpart_username: string | null;
  counterpart_role: string | null;
  org_id: string | null;
  org_name: string | null;
  message: string | null;
  created_at: string;
  responded_at: string | null;
  child_user_id?: string | null;
  child_name?: string | null;
};

const loose = supabase as unknown as {
  rpc: (name: string, args?: Record<string, unknown>) => Promise<{ data: unknown; error: unknown }>;
};

export async function fetchRejectedRequests(): Promise<RejectedRequest[]> {
  const { data, error } = await loose.rpc("my_rejected_requests");
  if (error) {
    const fallback = await fetchConnections("rejected");
    return fallback.map((row) => ({ ...row, respondedAt: row.createdAt }));
  }
  return ((data ?? []) as RejectedRow[]).map((row) => ({
    id: row.id,
    relation: row.relation as Connection["relation"],
    status: "rejected",
    direction: row.direction === "outgoing" ? "outgoing" : "incoming",
    counterpartUserId: row.counterpart_user_id,
    counterpartName: row.counterpart_name ?? "MathGPL account",
    counterpartUsername: row.counterpart_username,
    counterpartRole: (row.counterpart_role as Connection["counterpartRole"]) ?? null,
    orgId: row.org_id,
    orgName: row.org_name,
    message: row.message,
    createdAt: row.created_at,
    childUserId: row.child_user_id ?? null,
    childName: row.child_name ?? null,
    childConfirmedAt: null,
    counterpartAcceptedAt: null,
    respondedAt: row.responded_at ?? row.created_at,
  }));
}

export async function fetchRetentionHours(): Promise<number> {
  const { data: userData } = await supabase.auth.getUser();
  const userId = userData.user?.id;
  if (!userId) return DEFAULT_RETENTION_HOURS;
  const { data, error } = await (supabase.from("profiles") as unknown as {
    select: (columns: string) => {
      eq: (column: string, value: string) => {
        maybeSingle: () => Promise<{ data: { rejected_retention_hours?: number } | null; error: unknown }>;
      };
    };
  })
    .select("rejected_retention_hours")
    .eq("user_id", userId)
    .maybeSingle();
  if (error) return DEFAULT_RETENTION_HOURS;
  return data?.rejected_retention_hours ?? DEFAULT_RETENTION_HOURS;
}

export async function saveRetentionHours(hours: number): Promise<void> {
  const { data: userData } = await supabase.auth.getUser();
  const userId = userData.user?.id;
  if (!userId) return;
  const { error } = await (supabase.from("profiles") as unknown as {
    update: (values: Record<string, unknown>) => {
      eq: (column: string, value: string) => Promise<{ error: unknown }>;
    };
  })
    .update({ rejected_retention_hours: hours })
    .eq("user_id", userId);
  if (error) throw new Error("Retention setting could not be saved yet.");
}
