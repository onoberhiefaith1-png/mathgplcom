/**
 * Audience access to one MathGPL Live session.
 *
 * Loads the session, registers this browser as audience, keeps a heartbeat, and
 * reports whether the visitor may enter, must wait for the teacher, or was
 * removed. Signed-in people are reported too, so a page can send a class member
 * to the full workspace instead of the audience shell.
 */
import { useCallback, useEffect, useState } from "react";

import { supabase } from "@/integrations/supabase/client";
import {
  AudienceMember,
  EntryDecision,
  entryDecision,
  fetchMyMembership,
  joinAudience,
  setAudienceName,
  touchAudience,
} from "@/lib/live/audience";
import { guestName, setGuestName } from "@/lib/live/guest";
import {
  LiveSession,
  querySessions,
  fetchAllowFreeEntry,
  hydrateSession,
} from "@/lib/live/sessions";
import {
  fetchAdmittedBroadcastCredentials,
  fetchPublicSession,
} from "@/lib/live/publicAudience";

const HEARTBEAT_MS = 45_000;

export type AudienceAccess = {
  loading: boolean;
  notFound: boolean;
  session: LiveSession | null;
  signedIn: boolean;
  isOwner: boolean;
  member: AudienceMember | null;
  decision: EntryDecision;
  name: string | null;
  saveName: (value: string) => Promise<void>;
};

export const useAudienceAccess = (sessionId: string | undefined): AudienceAccess => {
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [session, setSession] = useState<LiveSession | null>(null);
  const [signedIn, setSignedIn] = useState(false);
  const [isOwner, setIsOwner] = useState(false);
  const [member, setMember] = useState<AudienceMember | null>(null);
  const [name, setName] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!sessionId) return;
      const { data: userData } = await supabase.auth.getUser();
      const user = userData.user ?? null;

      const data = user
        ? await querySessions<Record<string, unknown>>((cols) =>
            supabase.from("sessions").select(cols).eq("id", sessionId).maybeSingle() as never,
          )
        : await fetchPublicSession(sessionId);

      if (cancelled) return;
      if (!data) {
        setNotFound(true);
        setLoading(false);
        return;
      }
      const row = user
        ? {
            ...hydrateSession(data as unknown as Record<string, unknown>),
            allow_free_entry: await fetchAllowFreeEntry(sessionId),
          }
        : hydrateSession({
            ...(data as unknown as Record<string, unknown>),
            owner_id: "",
            visibility: "public",
            session_code: "",
            created_at: "",
            updated_at: "",
          });
      if (cancelled) return;
      setSession(row);
      setSignedIn(Boolean(user));
      setIsOwner(Boolean(user && user.id === row.owner_id));

      if (!user) {
        const joined = await joinAudience(row.id, row.allow_free_entry);
        if (!cancelled) {
          setMember(joined);
          setName(guestName());
        }
      }
      if (!cancelled) setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [sessionId]);

  // Heartbeat + approval watch: a waiting visitor enters the moment the teacher
  // approves, without reloading.
  useEffect(() => {
    if (!member) return;
    const tick = async () => {
      await touchAudience(member.id);
      if (!sessionId) return;
      const fresh = await fetchMyMembership(sessionId);
      if (fresh) setMember(fresh);
    };
    const id = window.setInterval(tick, HEARTBEAT_MS);
    return () => window.clearInterval(id);
  }, [member, sessionId]);

  useEffect(() => {
    if (!member) return;
    const channel = supabase
      .channel(`audience-me-${member.id}`)
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "session_audience", filter: `id=eq.${member.id}` },
        (payload) => setMember(payload.new as AudienceMember),
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [member]);

  // Public links are always visible. Merge meeting IDs/passwords only after
  // this guest has passed the room's free-entry or approval gate.
  useEffect(() => {
    if (!sessionId || signedIn || !session || entryDecision({
      allowFreeEntry: session.allow_free_entry,
      status: member?.status ?? null,
    }) !== "enter") return;

    let cancelled = false;
    void fetchAdmittedBroadcastCredentials(sessionId).then((credentials) => {
      if (cancelled || credentials.length === 0) return;
      setSession((current) => current ? {
        ...current,
        broadcasts: current.broadcasts.map((entry) => ({
          ...entry,
          ...credentials.find((privateEntry) => privateEntry.id === entry.id),
        })),
      } : current);
    });
    return () => { cancelled = true; };
  }, [member?.status, session?.allow_free_entry, sessionId, signedIn]);

  const saveName = useCallback(
    async (value: string) => {
      const clean = value.trim().slice(0, 40);
      if (!clean) return;
      setGuestName(clean);
      setName(clean);
      if (member) await setAudienceName(member.id, clean);
    },
    [member],
  );

  const decision: EntryDecision = session
    ? signedIn
      ? "enter"
      : entryDecision({ allowFreeEntry: session.allow_free_entry, status: member?.status ?? null })
    : "waiting";

  return { loading, notFound, session, signedIn, isOwner, member, decision, name, saveName };
};
