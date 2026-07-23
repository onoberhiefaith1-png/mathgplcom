import { supabase } from "@/integrations/supabase/client";
import { ensureRealtimeAuth } from "./auth";

export type PresenceHandle = {
  channel: ReturnType<typeof supabase.channel>;
  unsubscribe: () => void;
};

export function lessonPresenceTopic(classId: string, notebookId: string): string {
  return `lesson-presence-${classId}-${notebookId}`;
}

export function adventurePresenceTopic(classId: string, gameId: string): string {
  return `adventure-presence-${classId}-${gameId}`;
}

export function assessmentPresenceTopic(classId: string, assessmentId: string): string {
  return `assessment-presence-${classId}-${assessmentId}`;
}

export async function joinPresence(topic: string, userId: string): Promise<PresenceHandle> {
  await ensureRealtimeAuth();
  const channel = supabase.channel(topic, { config: { presence: { key: userId } } });
  channel.subscribe(async (status) => {
    if (status === "SUBSCRIBED") {
      await channel.track({ user_id: userId, at: Date.now() });
    }
  });
  return { channel, unsubscribe: () => { supabase.removeChannel(channel); } };
}

export async function observePresence(
  topic: string,
  onChange: (active: Set<string>) => void,
): Promise<PresenceHandle> {
  await ensureRealtimeAuth();
  const channel = supabase.channel(topic, { config: { presence: { key: "observer" } } });
  const emit = () => {
    const state = channel.presenceState() as Record<string, Array<{ user_id?: string }>>;
    const active = new Set<string>();
    for (const key of Object.keys(state)) {
      if (key === "observer") continue;
      active.add(key);
      for (const meta of state[key]) if (meta.user_id) active.add(meta.user_id);
    }
    onChange(active);
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
