import { useEffect } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import {
  fetchNotificationThread,
  listNotifications,
  markNotificationsRead,
  respondToNotification,
  unreadNotificationCount,
} from "./notifications.functions";

export type NotificationTab = "all" | "unread" | "questions" | "announcements";

/** Live unread badge: one query plus one realtime subscription on my rows. */
export function useUnreadNotifications(userId: string | null | undefined) {
  const queryClient = useQueryClient();
  const fetchCount = useServerFn(unreadNotificationCount);

  const query = useQuery({
    queryKey: ["notifications", "unread"],
    queryFn: () => fetchCount(),
    enabled: !!userId,
    staleTime: 30_000,
  });

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

  return { unread: query.data?.unread ?? 0, isLoading: query.isLoading };
}

export function useNotificationList(tab: NotificationTab) {
  const load = useServerFn(listNotifications);
  return useQuery({
    queryKey: ["notifications", "list", tab],
    queryFn: () => load({ data: { tab } }),
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
