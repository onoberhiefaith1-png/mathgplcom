// Live Time Bar state for a game.
import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { ensureRealtimeAuth } from "@/lib/realtime/auth";

export type GameTimeBarRow = {
  game_id: string;
  progress_element_id: string;
  duration_seconds: number;
  default_duration_seconds: number;
  start_mode: "manual" | "scheduled";
  scheduled_start_at: string | null;
  started_at: string | null;
  paused_at: string | null;
  accumulated_paused_ms: number;
};

export type UseGameTimeBar = {
  row: GameTimeBarRow | null;
  loading: boolean;
  elementId: string | null;
  durationMs: number;
  elapsedMs: number;
  running: boolean;
  paused: boolean;
  expired: boolean;
  slotsLit: (segments: number) => number;
  refresh: () => Promise<void>;
  /** Live-updating controls: they apply the returned row locally at once. */
  actions: {
    setDuration: (seconds: number) => Promise<void>;
    adjustDuration: (deltaSeconds: number) => Promise<void>;
    start: () => Promise<void>;
    pause: () => Promise<void>;
    resume: () => Promise<void>;
    reset: () => Promise<void>;
  };
};

export const MIN_DURATION_SECONDS = 60;

const elapsedFrom = (row: GameTimeBarRow | null): number => {
  if (!row || !row.started_at) return 0;
  const start = new Date(row.started_at).getTime();
  const end = row.paused_at ? new Date(row.paused_at).getTime() : Date.now();
  const raw = end - start - (Number(row.accumulated_paused_ms) || 0);
  return Math.max(0, raw);
};

export function useGameTimeBar(gameId: string | null | undefined): UseGameTimeBar {
  const [row, setRow] = useState<GameTimeBarRow | null>(null);
  const [loading, setLoading] = useState<boolean>(!!gameId);
  const [now, setNow] = useState<number>(() => Date.now());

  const refresh = useCallback(async () => {
    if (!gameId) { setRow(null); return; }
    const { data } = await supabase
      .from("game_time_bars" as never)
      .select("*")
      .eq("game_id", gameId)
      .maybeSingle();
    setRow((data as unknown as GameTimeBarRow | null) ?? null);
  }, [gameId]);

  useEffect(() => {
    let cancelled = false;
    if (!gameId) { setRow(null); setLoading(false); return; }
    setLoading(true);
    (async () => {
      await refresh();
      if (!cancelled) setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [gameId, refresh]);

  useEffect(() => {
    if (!gameId) return;
    let cancelled = false;
    let ch: ReturnType<typeof supabase.channel> | null = null;
    void ensureRealtimeAuth().then(() => {
      if (cancelled) return;
      ch = supabase
        .channel(`game-time-bar-${gameId}`)
        .on(
          "postgres_changes",
          { event: "*", schema: "public", table: "game_time_bars", filter: `game_id=eq.${gameId}` },
          (payload) => {
            if (payload.eventType === "DELETE") {
              setRow(null);
            } else {
              setRow((payload.new as unknown) as GameTimeBarRow);
            }
          },
        )
        .subscribe();
    });
    return () => { cancelled = true; if (ch) supabase.removeChannel(ch); };
  }, [gameId]);

  useEffect(() => {
    if (!row?.started_at || row.paused_at) return;
    const id = window.setInterval(() => setNow(Date.now()), 250);
    return () => window.clearInterval(id);
  }, [row?.started_at, row?.paused_at]);

  const durationMs = Math.max(1, Number(row?.duration_seconds ?? 0)) * 1000;
  const elapsedMs = useMemo(() => {
    void now;
    return Math.min(durationMs, elapsedFrom(row));
  }, [row, durationMs, now]);
  const running = !!row?.started_at && !row?.paused_at;
  const paused = !!row?.paused_at;
  const expired = !!row?.started_at && elapsedMs >= durationMs;

  const slotsLit = useCallback((segments: number) => {
    if (!row?.started_at) return 0;
    const segs = Math.max(1, segments);
    return Math.min(segs, Math.floor(elapsedMs / (durationMs / segs)));
  }, [row?.started_at, elapsedMs, durationMs]);

  // Every action applies the row returned by the write immediately, so the
  // panel updates without waiting on realtime (or a refresh).
  const apply = useCallback(async (patch: Record<string, unknown>) => {
    if (!gameId) return;
    const { data, error } = await supabase
      .from("game_time_bars" as never)
      .update(patch as never)
      .eq("game_id", gameId)
      .select()
      .maybeSingle();
    if (error) throw error;
    if (data) setRow((data as unknown) as GameTimeBarRow);
  }, [gameId]);

  const actions = useMemo(() => ({
    setDuration: async (seconds: number) => {
      await apply({ duration_seconds: Math.max(MIN_DURATION_SECONDS, Math.round(seconds)) });
    },
    adjustDuration: async (deltaSeconds: number) => {
      const base = Number(row?.duration_seconds ?? 0);
      await apply({ duration_seconds: Math.max(MIN_DURATION_SECONDS, base + Math.round(deltaSeconds)) });
    },
    start: async () => {
      await apply({ started_at: new Date().toISOString(), paused_at: null, accumulated_paused_ms: 0 });
    },
    pause: async () => {
      await apply({ paused_at: new Date().toISOString() });
    },
    resume: async () => {
      if (!row?.paused_at) return;
      const addedPaused = Date.now() - new Date(row.paused_at).getTime();
      await apply({
        paused_at: null,
        accumulated_paused_ms: (Number(row.accumulated_paused_ms) || 0) + Math.max(0, addedPaused),
      });
    },
    reset: async () => {
      const original = Number(row?.default_duration_seconds ?? row?.duration_seconds ?? 600);
      await apply({
        started_at: null,
        paused_at: null,
        accumulated_paused_ms: 0,
        duration_seconds: Math.max(MIN_DURATION_SECONDS, Math.round(original)),
      });
    },
  }), [apply, row]);

  return {
    row,
    loading,
    elementId: row?.progress_element_id ?? null,
    durationMs,
    elapsedMs,
    running,
    paused,
    expired,
    slotsLit,
    refresh,
    actions,
  };
}

export const timeBarActions = {
  async assign(gameId: string, progressElementId: string, defaults?: { durationSeconds?: number }) {
    const seconds = Math.max(MIN_DURATION_SECONDS, Math.round(defaults?.durationSeconds ?? 600));
    const { error } = await supabase
      .from("game_time_bars" as never)
      .insert({
        game_id: gameId,
        progress_element_id: progressElementId,
        duration_seconds: seconds,
        default_duration_seconds: seconds,
      } as never);
    if (error) throw error;
  },
  async remove(gameId: string) {
    const { error } = await supabase.from("game_time_bars" as never).delete().eq("game_id", gameId);
    if (error) throw error;
  },
  async setStartMode(gameId: string, mode: "manual" | "scheduled", scheduledAt: string | null) {
    const { error } = await supabase
      .from("game_time_bars" as never)
      .update({ start_mode: mode, scheduled_start_at: scheduledAt } as never)
      .eq("game_id", gameId);
    if (error) throw error;
  },
};
