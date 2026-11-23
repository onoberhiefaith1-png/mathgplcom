import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { SupportAccessLogEntry } from "./supportAccess";
import { formatSupportAccessLogTime } from "./supportAccess";

type Db = { from: (table: string) => any; channel: (name: string) => any; removeChannel: (ch: any) => void };

const db = () => supabase as unknown as Db;

export type PendingSupportRequest = {
  id: string;
  adminUserId: string;
  createdAt: string;
};

export function useSupportAccess(userId: string | undefined) {
  const [allowed, setAllowed] = useState(false);
  const [pending, setPending] = useState<PendingSupportRequest[]>([]);
  const [log, setLog] = useState<SupportAccessLogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    if (!userId) {
      setAllowed(false);
      setPending([]);
      setLog([]);
      setLoading(false);
      return;
    }
    setError(null);
    const client = db();
    const [{ data: grant, error: grantError }, { data: requests, error: reqError }, { data: rows, error: logError }] =
      await Promise.all([
        client.from("support_access_grants").select("allowed").eq("user_id", userId).maybeSingle(),
        client
          .from("support_access_requests")
          .select("id, admin_user_id, created_at")
          .eq("target_user_id", userId)
          .eq("status", "pending")
          .order("created_at", { ascending: false }),
        client
          .from("support_access_log")
          .select("id, admin_user_id, entered_at")
          .eq("target_user_id", userId)
          .order("entered_at", { ascending: false })
          .limit(20),
      ]);
    if (grantError || reqError || logError) {
      setError((grantError ?? reqError ?? logError)?.message ?? "Could not load support access.");
      setLoading(false);
      return;
    }
    setAllowed((grant as { allowed?: boolean } | null)?.allowed === true);
    setPending(
      ((requests ?? []) as { id: string; admin_user_id: string; created_at: string }[]).map((row) => ({
        id: row.id,
        adminUserId: row.admin_user_id,
        createdAt: row.created_at,
      })),
    );
    setLog(
      ((rows ?? []) as { id: string; entered_at: string }[]).map((row) => ({
        id: row.id,
        enteredAt: row.entered_at,
        adminLabel: "Platform administrator",
      })),
    );
    setLoading(false);
  }, [userId]);

  useEffect(() => {
    void reload();
  }, [reload]);

  useEffect(() => {
    if (!userId) return;
    const client = db();
    const channel = client
      .channel(`support-access-${userId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "support_access_grants", filter: `user_id=eq.${userId}` },
        () => void reload(),
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "support_access_requests", filter: `target_user_id=eq.${userId}` },
        () => void reload(),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [userId, reload]);

  const setGrant = async (next: boolean) => {
    if (!userId) return;
    setSaving(true);
    setError(null);
    const previous = allowed;
    setAllowed(next);
    const { error: writeError } = await db()
      .from("support_access_grants")
      .upsert({ user_id: userId, allowed: next, updated_at: new Date().toISOString() }, { onConflict: "user_id" });
    setSaving(false);
    if (writeError) {
      setAllowed(previous);
      setError(writeError.message);
      throw new Error(writeError.message);
    }
    await reload();
  };

  const respond = async (requestId: string, status: "allowed" | "denied") => {
    setSaving(true);
    setError(null);
    const { error: writeError } = await db()
      .from("support_access_requests")
      .update({ status, responded_at: new Date().toISOString() })
      .eq("id", requestId)
      .eq("status", "pending");
    setSaving(false);
    if (writeError) {
      setError(writeError.message);
      throw new Error(writeError.message);
    }
    await reload();
  };

  return {
    allowed,
    pending,
    log,
    loading,
    saving,
    error,
    reload,
    setGrant,
    respond,
    formatTime: formatSupportAccessLogTime,
  };
}
