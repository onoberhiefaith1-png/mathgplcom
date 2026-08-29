// Live SmartBoard mirroring. A teacher's board is the source of truth; it
// broadcasts its presentation state over the persistent realtime WebSocket
// channel and *also* persists it into class_smartboard_state for durability
// (reloads / late joiners). Students apply broadcasts read-only — unless the
// teacher has made them the single "active student", in which case their edits
// travel the same path (teacher always retains control).
//
// Why broadcast and not postgres_changes:
//   The previous pipeline was write-driven — debounce → DB upsert → WAL →
//   postgres_changes → student re-SELECT. Every hop added latency, and a full
//   board snapshot regularly exceeds the realtime postgres_changes payload
//   ceiling, so the change event was dropped and the 4s safety poll became the
//   real delivery mechanism. Broadcast is event-driven: a delta leaves down an
//   already-open socket, so delivery is tens of milliseconds and does not
//   depend on the database at all.

import { useCallback, useEffect, useRef, useState } from "react";
import type { RealtimeChannel } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { useLiveChannel } from "@/lib/stability/useLiveChannel";
import { usePolling } from "@/lib/stability/usePolling";


export type BoardSnapshot = {
  v: number;
  author: string;
  ts: number;
  beatCursor: number;
  bandExtra: Record<string, number>;
  freeLines: unknown;
  lineOffsets: Record<number, number>;
  smartLines: unknown[];
  boxes: unknown[];
  sensor: { line: number; x: number };
  zoom: number;
  surface: string;
  profileId: string;
  inkColorId: string;
  placeholderColorId?: string;
};

export type BoardState = Omit<BoardSnapshot, "v" | "author" | "ts">;

/** Fastest cadence at which local edits leave the browser (leading edge). */
export const BROADCAST_INTERVAL_MS = 40;
/** How often the durable copy is written; purely for reloads / late joiners. */
export const PERSIST_DEBOUNCE_MS = 1200;
/** Realtime refuses oversized frames — above this we persist + ping instead. */
export const MAX_BROADCAST_BYTES = 140_000;

export type BoardDelta = {
  seq: number;
  author: string;
  ts: number;
  full: boolean;
  patch: Partial<BoardState>;
};

/** Per-field diff so a keystroke sends a few hundred bytes, not the whole board. */
export function diffBoardState(prev: BoardState | null, next: BoardState): Partial<BoardState> {
  if (!prev) return { ...next };
  const patch: Record<string, unknown> = {};
  for (const key of Object.keys(next) as (keyof BoardState)[]) {
    if (JSON.stringify(prev[key]) !== JSON.stringify(next[key])) patch[key] = next[key];
  }
  return patch as Partial<BoardState>;
}

export function useSmartboardSync(opts: {
  classId?: string | null;
  role: "teacher" | "student";
}) {
  const { classId } = opts;
  const enabled = !!classId;

  const [selfId, setSelfId] = useState<string | null>(null);
  const [incoming, setIncoming] = useState<BoardSnapshot | null>(null);
  const [activeStudentId, setActiveStudentId] = useState<string | null>(null);

  const channelRef = useRef<RealtimeChannel | null>(null);
  const seqRef = useRef(0);
  // Per-sender sequence watermark. A sender's counter restarts at 1 whenever
  // its page remounts (teacher reload), so the guard must be scoped by author
  // AND must accept a restarted counter instead of treating it as stale.
  const lastSeenSeqRef = useRef<Map<string, number>>(new Map());
  const lastSentRef = useRef<BoardState | null>(null);
  const lastLocalRef = useRef<BoardState | null>(null);
  const remoteBaseRef = useRef<BoardState | null>(null);
  const sendTimer = useRef<number | null>(null);
  const lastSendAt = useRef(0);
  const persistTimer = useRef<number | null>(null);
  const selfIdRef = useRef<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    supabase.auth.getUser().then(({ data }) => {
      if (cancelled) return;
      selfIdRef.current = data.user?.id ?? null;
      setSelfId(data.user?.id ?? null);
    });
    return () => { cancelled = true; };
  }, []);

  const loadRef = useRef<() => Promise<void>>(async () => {});

  useEffect(() => {
    if (!classId) return;
    let cancelled = false;

    // Reset per-class transport state.
    seqRef.current = 0;
    lastSeenSeqRef.current = new Map();
    lastSentRef.current = null;
    remoteBaseRef.current = null;

    const load = async () => {
      const { data, error } = await supabase
        .from("class_smartboard_state")
        .select("state_json, active_student_id")
        .eq("class_id", classId)
        .maybeSingle();
      if (cancelled) return;
      if (error) { console.warn("[smartboard-sync] state reload failed", error.message); return; }
      const row = data as { state_json?: unknown; active_student_id?: string | null } | null;
      if (!row) return;
      setActiveStudentId(row.active_student_id ?? null);
      const sj = row.state_json;
      if (sj && typeof sj === "object" && "v" in sj) {
        const snap = sj as BoardSnapshot;
        const { v: _v, author: _author, ts: _ts, ...rest } = snap;
        remoteBaseRef.current = rest as BoardState;
        setIncoming(snap);
      }
    };

    loadRef.current = load;
    void load();

    return () => { cancelled = true; };
  }, [classId]);

  const applyDelta = useCallback((msg: BoardDelta | null) => {
    if (!msg || typeof msg.seq !== "number") return;
    if (msg.author && selfIdRef.current && msg.author === selfIdRef.current) return; // own echo
    const who = msg.author || "anon";
    const seen = lastSeenSeqRef.current.get(who) ?? 0;
    // Only drop true duplicates/out-of-order frames from the SAME sender. A
    // counter that jumped back to a low value means that sender remounted, so
    // adopt it rather than discarding every later frame forever.
    if (msg.seq === seen || (msg.seq < seen && msg.seq > 1)) return;
    lastSeenSeqRef.current.set(who, msg.seq);
    const base = msg.full ? null : remoteBaseRef.current;
    const merged = { ...(base ?? {}), ...msg.patch } as BoardState;
    remoteBaseRef.current = merged;
    setIncoming({ v: 1, author: msg.author, ts: msg.ts, ...merged });
  }, []);

  // One managed subscription per class — remounting replaces it instead of
  // adding a second listener, and rejoins back off instead of hammering.
  useLiveChannel({
    key: `sb-sync-${classId ?? "none"}`,
    enabled,
    build: (channel) => {
      channelRef.current = channel;
      channel
        .on("broadcast", { event: "state" }, ({ payload }) => {
          applyDelta(payload as BoardDelta);
        })
        // Oversized frames are persisted instead; this ping says "go read it".
        .on("broadcast", { event: "reload" }, () => { void loadRef.current(); })
        // A joiner asks whoever holds the board for one full snapshot.
        .on("broadcast", { event: "hello" }, ({ payload }) => {
          const from = (payload as { from?: string } | null)?.from;
          if (from && selfIdRef.current && from === selfIdRef.current) return;
          const state = lastLocalRef.current;
          if (!state) return;
          seqRef.current += 1;
          void channelRef.current?.send({
            type: "broadcast",
            event: "state",
            payload: {
              seq: seqRef.current,
              author: selfIdRef.current ?? "",
              ts: Date.now(),
              full: true,
              patch: state,
            } satisfies BoardDelta,
          });
        })
        // Control changes (active student) stay on the durable row; they're rare.
        .on(
          "postgres_changes",
          { event: "*", schema: "public", table: "class_smartboard_state", filter: `class_id=eq.${classId}` },
          () => { void loadRef.current(); },
        );
    },
    onJoined: () => {
      void loadRef.current();
      void channelRef.current?.send({
        type: "broadcast",
        event: "hello",
        payload: { from: selfIdRef.current ?? "" },
      });
    },
  });

  // Long-interval safety net only — realtime delivery is the primary path.
  // Pauses while the tab is hidden.
  usePolling("smartboard-sync", () => loadRef.current(), 20000, { enabled, immediate: false });

  const persist = useCallback((state: BoardState, immediate = false) => {
    if (!classId) return;
    if (persistTimer.current) window.clearTimeout(persistTimer.current);
    const write = async () => {
      const full: BoardSnapshot = { v: 1, author: selfIdRef.current ?? "", ts: Date.now(), ...state };
      const { error } = await supabase
        .from("class_smartboard_state")
        .upsert(
          { class_id: classId, state_json: full as never, updated_at: new Date().toISOString() },
          { onConflict: "class_id" },
        );
      if (error) console.warn("[smartboard-sync] snapshot persist failed", error.message);
      return !error;
    };
    persistTimer.current = window.setTimeout(() => { void write(); }, immediate ? 0 : PERSIST_DEBOUNCE_MS);
  }, [classId]);

  const flush = useCallback(() => {
    const state = lastLocalRef.current;
    const channel = channelRef.current;
    if (!state || !channel) return;
    const patch = diffBoardState(lastSentRef.current, state);
    if (Object.keys(patch).length === 0) return;
    const full = lastSentRef.current === null;
    lastSendAt.current = Date.now();
    seqRef.current += 1;
    const message: BoardDelta = {
      seq: seqRef.current,
      author: selfIdRef.current ?? "",
      ts: Date.now(),
      full,
      patch,
    };
    if (JSON.stringify(message).length > MAX_BROADCAST_BYTES) {
      // Too large for a socket frame: write it and tell peers to read the row.
      lastSentRef.current = null; // next delta must be a full resync
      persist(state, true);
      void channel.send({ type: "broadcast", event: "reload", payload: {} });
      return;
    }
    lastSentRef.current = state;
    void channel.send({ type: "broadcast", event: "state", payload: message });
    persist(state);
  }, [persist]);

  /**
   * Publish local board state. Leading-edge throttled at ~40ms so the first
   * change of a burst leaves immediately and the rest coalesce.
   */
  const pushSnapshot = useCallback((state: BoardState) => {
    if (!classId) return;
    lastLocalRef.current = state;
    const since = Date.now() - lastSendAt.current;
    if (since >= BROADCAST_INTERVAL_MS) { flush(); return; }
    if (sendTimer.current) return;
    sendTimer.current = window.setTimeout(() => {
      sendTimer.current = null;
      flush();
    }, BROADCAST_INTERVAL_MS - since);
  }, [classId, flush]);

  useEffect(() => () => {
    if (sendTimer.current) window.clearTimeout(sendTimer.current);
    if (persistTimer.current) window.clearTimeout(persistTimer.current);
  }, []);

  const setActiveStudent = useCallback(async (uid: string | null) => {
    if (!classId) return;
    const { error } = await supabase
      .from("class_smartboard_state")
      .upsert(
        { class_id: classId, active_student_id: uid, updated_at: new Date().toISOString() },
        { onConflict: "class_id" },
      );
    if (!error) setActiveStudentId(uid);
    else console.warn("[smartboard-sync] active student update failed", error.message);
  }, [classId]);

  return { enabled, selfId, incoming, activeStudentId, pushSnapshot, setActiveStudent };
}
