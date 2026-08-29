import { useEffect, useRef } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import type { NotificationCategory } from "./audience";
import {
  fetchNotificationThread,
  listNotifications,
  listSentNotifications,
  markNotificationsRead,
  notificationStats,
  respondToNotification,
  unreadNotificationCount,
} from "./notifications.functions";

export type NotificationTab = "all" | "unread" | "questions" | "announcements";

const SOUND_KEY = "mathgpl.notifications.sound";

export const notificationSoundEnabled = (): boolean => {
  if (typeof window === "undefined") return true;
  return window.localStorage.getItem(SOUND_KEY) !== "off";
};

export const setNotificationSoundEnabled = (enabled: boolean): void => {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(SOUND_KEY, enabled ? "on" : "off");
};

/** One short tone — a notification chime, not a ringtone. */
export const playNotificationSound = (): void => {
  if (typeof window === "undefined" || !notificationSoundEnabled()) return;
  try {
    const Ctor =
      window.AudioContext ??
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctor) return;
    const ctx = new Ctor();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "sine";
    osc.frequency.setValueAtTime(880, ctx.currentTime);
    osc.frequency.setValueAtTime(1170, ctx.currentTime + 0.09);
    gain.gain.setValueAtTime(0.0001, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.09, ctx.currentTime + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.28);
    osc.connect(gain).connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.3);
    osc.onended = () => void ctx.close();
  } catch {
    /* sound is a courtesy, never a requirement */
  }
};

/** Live unread badge: one query plus one realtime subscription on my rows. */
export function useUnreadNotifications(userId: string | null | undefined) {
  const queryClient = useQueryClient();
  const fetchCount = useServerFn(unreadNotificationCount);
  const previous = useRef<number | null>(null);

  const query = useQuery({
    queryKey: ["notifications", "unread"],
    queryFn: () => fetchCount(),
    enabled: !!userId,
    staleTime: 30_000,
  });

  const unread = query.data?.unread ?? 0;

  // A rising unread count means something new arrived while the tab was open.
  useEffect(() => {
    if (query.isLoading) return;
    const before = previous.current;
    previous.current = unread;
    if (before !== null && unread > before) playNotificationSound();
  }, [unread, query.isLoading]);

  useEffect(() => {
    if (!userId) return;
    const channel = supabase
      .channel(`notifications-${userId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "notification_recipients", filter: `recipient_user_id=eq.${userId}` },
        () => {
          void queryClient.invalidateQueries({ queryKey: ["notifications"] });
        },
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [userId, queryClient]);

  return { unread, isLoading: query.isLoading };
}

export function useNotificationList(tab: NotificationTab, category?: NotificationCategory | null) {
  const load = useServerFn(listNotifications);
  return useQuery({
    queryKey: ["notifications", "list", tab, category ?? "any"],
    queryFn: () => load({ data: { tab, category: category ?? null } }),
    staleTime: 15_000,
  });
}

export function useNotificationThread(id: string) {
  const load = useServerFn(fetchNotificationThread);
  return useQuery({
    queryKey: ["notifications", "thread", id],
    queryFn: () => load({ data: { id } }),
    enabled: !!id,
  });
}

export function useSentNotifications(enabled = true) {
  const load = useServerFn(listSentNotifications);
  return useQuery({
    queryKey: ["notifications", "sent"],
    queryFn: () => load(),
    enabled,
    staleTime: 30_000,
  });
}

export function useNotificationStats(enabled = true) {
  const load = useServerFn(notificationStats);
  return useQuery({
    queryKey: ["notifications", "stats"],
    queryFn: () => load(),
    enabled,
    staleTime: 30_000,
  });
}

export function useMarkRead() {
  const queryClient = useQueryClient();
  const mark = useServerFn(markNotificationsRead);
  return useMutation({
    mutationFn: (input: { ids?: string[]; all?: boolean }) => mark({ data: { ...input, all: input.all ?? false } }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["notifications"] }),
  });
}

export function useRespond(threadId?: string) {
  const queryClient = useQueryClient();
  const respond = useServerFn(respondToNotification);
  return useMutation({
    mutationFn: (input: { messageId: string; body: string }) => respond({ data: input }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["notifications"] });
      if (threadId) void queryClient.invalidateQueries({ queryKey: ["notifications", "thread", threadId] });
    },
  });
}
