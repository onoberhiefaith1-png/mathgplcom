// Live Time Bar state for a game.
import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { ensureRealtimeAuth } from "@/lib/realtime/auth";

export type GameTimeBarRow = {
  game_id: string;
  progress_element_id: string;
  duration_seconds: number;
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
  };
}

export const timeBarActions = {
  async assign(gameId: string, progressElementId: string, defaults?: { durationSeconds?: number }) {
    const { error } = await supabase
      .from("game_time_bars" as never)
      .insert({
        game_id: gameId,
        progress_element_id: progressElementId,
        duration_seconds: Math.max(30, Math.round(defaults?.durationSeconds ?? 600)),
      } as never);
    if (error) throw error;
  },
  async remove(gameId: string) {
    const { error } = await supabase.from("game_time_bars" as never).delete().eq("game_id", gameId);
    if (error) throw error;
  },
  async setDuration(gameId: string, durationSeconds: number) {
    await supabase
      .from("game_time_bars" as never)
      .update({ duration_seconds: Math.max(10, Math.round(durationSeconds)) } as never)
      .eq("game_id", gameId);
  },
  async setStartMode(gameId: string, mode: "manual" | "scheduled", scheduledAt: string | null) {
    await supabase
      .from("game_time_bars" as never)
      .update({ start_mode: mode, scheduled_start_at: scheduledAt } as never)
      .eq("game_id", gameId);
  },
  async start(gameId: string) {
    await supabase
      .from("game_time_bars" as never)
      .update({
        started_at: new Date().toISOString(),
        paused_at: null,
        accumulated_paused_ms: 0,
      } as never)
      .eq("game_id", gameId);
  },
  async pause(gameId: string) {
    await supabase
      .from("game_time_bars" as never)
      .update({ paused_at: new Date().toISOString() } as never)
      .eq("game_id", gameId);
  },
  async resume(gameId: string, row: GameTimeBarRow) {
    if (!row.paused_at) return;
    const addedPaused = Date.now() - new Date(row.paused_at).getTime();
    await supabase
      .from("game_time_bars" as never)
      .update({
        paused_at: null,
        accumulated_paused_ms: (Number(row.accumulated_paused_ms) || 0) + Math.max(0, addedPaused),
      } as never)
      .eq("game_id", gameId);
  },
  async adjustDuration(gameId: string, row: GameTimeBarRow, deltaSeconds: number) {
    const next = Math.max(10, Number(row.duration_seconds) + Math.round(deltaSeconds));
    await supabase
      .from("game_time_bars" as never)
      .update({ duration_seconds: next } as never)
      .eq("game_id", gameId);
  },
  async reset(gameId: string) {
    await supabase
      .from("game_time_bars" as never)
      .update({ started_at: null, paused_at: null, accumulated_paused_ms: 0 } as never)
      .eq("game_id", gameId);
  },
};
