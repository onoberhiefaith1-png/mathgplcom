// Time Bar foundation — read/subscribe/mutate helpers for `game_time_bars`.
// A time bar is scoped to a (game_id, progress_element_id) pair. It supports
// start modes ("manual" | "scheduled"), pause/resume, and reports a live
// `remainingMs` derived from wall-clock time. Ported additively for Phase 7.

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export type TimeBarStartMode = "manual" | "scheduled";

export interface TimeBarRow {
  game_id: string;
  progress_element_id: string;
  duration_seconds: number;
  start_mode: TimeBarStartMode;
  scheduled_start_at: string | null;
  started_at: string | null;
  paused_at: string | null;
  accumulated_paused_ms: number;
}

const zeroRow = (gameId: string, progressElementId: string): TimeBarRow => ({
  game_id: gameId,
  progress_element_id: progressElementId,
  duration_seconds: 600,
  start_mode: "manual",
  scheduled_start_at: null,
  started_at: null,
  paused_at: null,
  accumulated_paused_ms: 0,
});

/** Elapsed ms since the bar started, excluding paused windows. */
export function elapsedMs(row: TimeBarRow, now = Date.now()): number {
  if (!row.started_at) return 0;
  const startedMs = new Date(row.started_at).getTime();
  const raw = Math.max(0, now - startedMs);
  const pausedNow = row.paused_at ? Math.max(0, now - new Date(row.paused_at).getTime()) : 0;
  return Math.max(0, raw - row.accumulated_paused_ms - pausedNow);
}

export function remainingMs(row: TimeBarRow, now = Date.now()): number {
  return Math.max(0, row.duration_seconds * 1000 - elapsedMs(row, now));
}

/** Live time bar hook. Returns the row + tick-updated remainingMs, and a
 *  small mutation surface for teachers to control the timer. */
export function useTimeBar(gameId: string | null | undefined, progressElementId: string | null | undefined) {
  const [row, setRow] = useState<TimeBarRow | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    if (!gameId || !progressElementId) return;
    let cancelled = false;
    (async () => {
      const { data } = await supabase
        .from("game_time_bars")
        .select("*")
        .eq("game_id", gameId)
        .eq("progress_element_id", progressElementId)
        .maybeSingle();
      if (!cancelled) setRow((data as TimeBarRow | null) ?? zeroRow(gameId, progressElementId));
    })();
    return () => { cancelled = true; };
  }, [gameId, progressElementId]);

  useEffect(() => {
    if (!gameId || !progressElementId) return;
    const ch = supabase
      .channel(`time-bar-${gameId}-${progressElementId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "game_time_bars",
          filter: `game_id=eq.${gameId}`,
        },
        (payload) => {
          const next = (payload.new ?? payload.old) as TimeBarRow | null;
          if (next && next.progress_element_id === progressElementId) setRow(next);
        },
      )
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [gameId, progressElementId]);

  useEffect(() => {
    const tick = () => {
      setNow(Date.now());
      rafRef.current = window.setTimeout(tick, 250) as unknown as number;
    };
    tick();
    return () => { if (rafRef.current) window.clearTimeout(rafRef.current); };
  }, []);

  const upsert = useCallback(
    async (patch: Partial<TimeBarRow>) => {
      if (!gameId || !progressElementId) return;
      const next: TimeBarRow = { ...(row ?? zeroRow(gameId, progressElementId)), ...patch };
      setRow(next);
      await supabase
        .from("game_time_bars")
        .upsert(next as never, { onConflict: "game_id,progress_element_id" });
    },
    [gameId, progressElementId, row],
  );

  const start = useCallback(() => upsert({ started_at: new Date().toISOString(), paused_at: null }), [upsert]);
  const pause = useCallback(() => {
    if (!row || row.paused_at) return Promise.resolve();
    return upsert({ paused_at: new Date().toISOString() });
  }, [row, upsert]);
  const resume = useCallback(() => {
    if (!row?.paused_at) return Promise.resolve();
    const add = Date.now() - new Date(row.paused_at).getTime();
    return upsert({ paused_at: null, accumulated_paused_ms: row.accumulated_paused_ms + add });
  }, [row, upsert]);
  const reset = useCallback(
    () => upsert({ started_at: null, paused_at: null, accumulated_paused_ms: 0 }),
    [upsert],
  );
  const setDuration = useCallback((seconds: number) => upsert({ duration_seconds: Math.max(1, Math.round(seconds)) }), [upsert]);

  const remaining = useMemo(() => (row ? remainingMs(row, now) : 0), [row, now]);
  const running = Boolean(row?.started_at && !row?.paused_at && remaining > 0);

  return { row, remainingMs: remaining, running, start, pause, resume, reset, setDuration, upsert };
}
