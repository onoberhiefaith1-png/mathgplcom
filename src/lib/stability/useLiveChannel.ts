/**
 * Managed live (realtime) subscription.
 *
 * A page can only ever hold ONE channel per key: mounting again replaces the
 * previous one instead of stacking a second listener on top of it. Rejoins use
 * exponential backoff with jitter so a broken socket never hammers the server.
 */
import { useEffect, useRef } from "react";
import type { RealtimeChannel } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { ensureRealtimeAuth } from "@/lib/realtime/auth";
import { releaseResource, trackResource } from "./registry";

const openChannels = new Map<string, RealtimeChannel>();

function dropChannel(key: string) {
  const existing = openChannels.get(key);
  if (existing) {
    openChannels.delete(key);
    void supabase.removeChannel(existing);
  }
}

export type LiveChannelOptions = {
  /** Unique per logical subscription (e.g. `sb-sync-${classId}`). */
  key: string;
  enabled?: boolean;
  private?: boolean;
  /** Attach handlers; return nothing. Called on every (re)join. */
  build: (channel: RealtimeChannel) => void;
  /** Called after a successful join — resync server state here. */
  onJoined?: () => void;
};

export function useLiveChannel({ key, enabled = true, private: isPrivate = true, build, onJoined }: LiveChannelOptions): void {
  const buildRef = useRef(build);
  buildRef.current = build;
  const joinedRef = useRef(onJoined);
  joinedRef.current = onJoined;

  useEffect(() => {
    if (!enabled || !key) return;
    let cancelled = false;
    let attempt = 0;
    let retryTimer: number | undefined;
    const resourceId = trackResource("channel", key);

    const subscribe = async () => {
      if (cancelled) return;
      await ensureRealtimeAuth();
      if (cancelled) return;
      dropChannel(key);

      const channel = supabase.channel(key, { config: { private: isPrivate } });
      openChannels.set(key, channel);
      buildRef.current(channel);

      channel.subscribe((status) => {
        if (cancelled) return;
        if (status === "SUBSCRIBED") {
          attempt = 0;
          joinedRef.current?.();
          return;
        }
        if (status === "CHANNEL_ERROR" || status === "TIMED_OUT" || status === "CLOSED") {
          if (attempt >= 8) return;
          attempt += 1;
          const wait = Math.min(15_000, 500 * 2 ** (attempt - 1)) * (0.7 + Math.random() * 0.6);
          window.clearTimeout(retryTimer);
          retryTimer = window.setTimeout(() => void subscribe(), wait);
        }
      });
    };

    void subscribe();

    return () => {
      cancelled = true;
      window.clearTimeout(retryTimer);
      dropChannel(key);
      releaseResource(resourceId);
    };
  }, [key, enabled, isPrivate]);
}

/** How many live subscriptions are currently open (leak auditing). */
export function openChannelCount(): number {
  return openChannels.size;
}
