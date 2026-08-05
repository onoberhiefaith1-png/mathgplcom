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
  /** True when the duration is "None" — no countdown exists for this game. */
  noTime: boolean;
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

/** Shortest real countdown. 0 is also legal and means "No Time". */
export const MIN_DURATION_SECONDS = 60;

/** Clamp a requested duration: 0 (No Time) or at least one minute. */
export const clampDuration = (seconds: number): number => {
  const s = Math.round(Number(seconds) || 0);
  if (s <= 0) return 0;
  return Math.max(MIN_DURATION_SECONDS, s);
};

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

  // Live mirror of the teacher's (master) timer row. Self-healing: a failed or
  // dropped join would otherwise freeze the student on the row fetched at
  // load, so the subscription retries and a slow refetch acts as a fallback.
  useEffect(() => {
    if (!gameId) return;
    let cancelled = false;
    let ch: ReturnType<typeof supabase.channel> | null = null;
    let retries = 0;

    const connect = () => {
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
          .subscribe((status) => {
            if (cancelled) return;
            if (status === "SUBSCRIBED") {
              retries = 0;
              void refresh();
              return;
            }
            if ((status === "CHANNEL_ERROR" || status === "TIMED_OUT" || status === "CLOSED") && retries < 6) {
              retries += 1;
              const dead = ch;
              if (dead) supabase.removeChannel(dead);
              ch = null;
              window.setTimeout(() => { if (!cancelled) connect(); }, Math.min(3000, 400 * retries));
            }
          });
      });
    };
    connect();

    const revive = () => {
      if (cancelled || document.visibilityState === "hidden") return;
      void refresh();
      if (ch && ch.state === "joined") return;
      if (ch) supabase.removeChannel(ch);
      ch = null;
      retries = 0;
      connect();
    };
    window.addEventListener("online", revive);
    document.addEventListener("visibilitychange", revive);

    // Convergence fallback — cheap poll so the student's timer still matches
    // the teacher's even if realtime is unavailable.
    const poll = window.setInterval(() => { if (!cancelled) void refresh(); }, 4000);

    return () => {
      cancelled = true;
      window.clearInterval(poll);
      window.removeEventListener("online", revive);
      document.removeEventListener("visibilitychange", revive);
      if (ch) supabase.removeChannel(ch);
    };
  }, [gameId, refresh]);

  useEffect(() => {
    if (!row?.started_at || row.paused_at) return;
    const id = window.setInterval(() => setNow(Date.now()), 250);
    return () => window.clearInterval(id);
  }, [row?.started_at, row?.paused_at]);


  // Duration 0 = "No Time": the countdown is disabled, but every setting is
  // preserved so the teacher can switch a duration back on at any moment.
  const noTime = !!row && Number(row.duration_seconds) <= 0;
  const durationMs = Math.max(1, Number(row?.duration_seconds ?? 0)) * 1000;
  const elapsedMs = useMemo(() => {
    void now;
    return Math.min(durationMs, elapsedFrom(row));
  }, [row, durationMs, now]);
  const running = !noTime && !!row?.started_at && !row?.paused_at;
  const paused = !noTime && !!row?.paused_at;
  const expired = !noTime && !!row?.started_at && elapsedMs >= durationMs;

  const slotsLit = useCallback((segments: number) => {
    if (noTime || !row?.started_at) return 0;
    const segs = Math.max(1, segments);
    return Math.min(segs, Math.floor(elapsedMs / (durationMs / segs)));
  }, [noTime, row?.started_at, elapsedMs, durationMs]);

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
      // Selecting "None" also clears any run in progress so gameplay is free.
      const next = clampDuration(seconds);
      await apply(
        next === 0
          ? { duration_seconds: 0, started_at: null, paused_at: null, accumulated_paused_ms: 0 }
          : { duration_seconds: next },
      );
    },
    adjustDuration: async (deltaSeconds: number) => {
      const base = Number(row?.duration_seconds ?? 0);
      if (base <= 0) return; // No Time — ±1 minute does nothing until a duration is chosen.
      await apply({ duration_seconds: clampDuration(base + Math.round(deltaSeconds)) });
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
        duration_seconds: clampDuration(original),
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
    noTime,
    slotsLit,
    refresh,
    actions,
  };
}

/**
 * The first Progress Bar of every Adventure is reserved as the Time Bar, so its
 * live row is part of the engine rather than something a teacher links. This
 * creates the missing row on demand and is safe to call repeatedly.
 */
export async function ensureTimeBar(
  gameId: string,
  progressElementId: string,
  defaults?: { durationSeconds?: number },
): Promise<void> {
  const { data: existing } = await supabase
    .from("game_time_bars" as never)
    .select("game_id, progress_element_id")
    .eq("game_id", gameId)
    .maybeSingle();
  if (existing) {
    // The reserved bar may have been re-created in the editor; keep it pointed
    // at the current Time Bar element.
    if ((existing as any).progress_element_id !== progressElementId) {
      await supabase
        .from("game_time_bars" as never)
        .update({ progress_element_id: progressElementId } as never)
        .eq("game_id", gameId);
    }
    return;
  }
  const requested = Number(defaults?.durationSeconds);
  const seconds = Number.isFinite(requested) ? clampDuration(requested) : 600;
  await supabase.from("game_time_bars" as never).insert({
    game_id: gameId,
    progress_element_id: progressElementId,
    duration_seconds: seconds,
    default_duration_seconds: seconds > 0 ? seconds : 600,
  } as never);
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
