// Lightweight realtime presence for a class.

import { supabase } from "@/integrations/supabase/client";
import { ensureRealtimeAuth } from "./auth";

export type ClassPresenceHandle = {
  channel: ReturnType<typeof supabase.channel>;
  unsubscribe: () => void;
};

export async function joinClassPresence(
  classId: string,
  userId: string,
): Promise<ClassPresenceHandle> {
  await ensureRealtimeAuth();
  const channel = supabase.channel(`class-presence-${classId}`, {
    config: { presence: { key: userId } },
  });
  channel.subscribe(async (status) => {
    if (status === "SUBSCRIBED") {
      await channel.track({ user_id: userId, at: Date.now() });
    }
  });
  return { channel, unsubscribe: () => { supabase.removeChannel(channel); } };
}

export async function observeClassPresence(
  classId: string,
  onChange: (online: Set<string>) => void,
): Promise<ClassPresenceHandle> {
  await ensureRealtimeAuth();
  const channel = supabase.channel(`class-presence-${classId}`, {
    config: { presence: { key: "observer" } },
  });
  const emit = () => {
    const state = channel.presenceState() as Record<string, Array<{ user_id?: string }>>;
    const online = new Set<string>();
    for (const key of Object.keys(state)) {
      if (key === "observer") continue;
      online.add(key);
      for (const meta of state[key]) if (meta.user_id) online.add(meta.user_id);
    }
    onChange(online);
  };
  channel
    .on("presence", { event: "sync" }, emit)
    .on("presence", { event: "join" }, emit)
    .on("presence", { event: "leave" }, emit)
    .subscribe(async (status) => {
      if (status === "SUBSCRIBED") {
        await channel.track({ role: "observer" });
        emit();
      }
    });
  return { channel, unsubscribe: () => { supabase.removeChannel(channel); } };
}
