// Live CLASSROOM SmartBoard transport — the React adapter over the board sync
// engine (src/lib/smartboard/boardSyncEngine.ts) and one Supabase Realtime
// channel per class.
//
// Hard-won rules encoded here:
//   * NEVER send before the channel reports SUBSCRIBED. A send down a
//     half-open socket is silently downgraded to a REST call and the frame is
//     lost. Outgoing frames queue and drain on join.
//   * Every sender run has an epoch and a seq; a delta only applies on top of
//     the exact seq it was made from, otherwise a full board is requested.
//   * The editor sends a heartbeat (seq + content hash) every second, so a
//     student who is behind or different is corrected within about a second.
//   * A joiner shows the saved copy at once and asks for the live board only
//     when the saved copy is not current; one snapshot answers everyone.
//   * The send rate stays inside the realtime message budget for the class
//     size. Going over it makes Supabase close the channel (that was lag).

import { useCallback, useEffect, useRef, useState } from "react";
import type { RealtimeChannel } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { useLiveChannel } from "@/lib/stability/useLiveChannel";
import { usePolling } from "@/lib/stability/usePolling";
import {
  BoardSyncPeer,
  cadenceFor,
  DEFAULT_SYNC_CONFIG,
  type BoardSnapshot,
  type BoardState,
  type RowSnapshot,
  type SyncMetrics,
} from "@/lib/smartboard/boardSyncEngine";

export {
  diffBoardState,
  hashBoard,
  type BoardDelta,
  type BoardSnapshot,
  type BoardState,
  type FloatingChipShared,
  type FloatingLineShared,
  type FloatingShared,
} from "@/lib/smartboard/boardSyncEngine";
import type { BoardDelta } from "@/lib/smartboard/boardSyncEngine";

/** Fastest cadence at which local edits leave the browser (leading edge). */
export const BROADCAST_INTERVAL_MS = 40;
/** How often the durable copy is written; purely for reloads / late joiners. */
export const PERSIST_DEBOUNCE_MS = 1200;
/** Realtime refuses oversized frames — above this we persist + ping instead. */
export const MAX_BROADCAST_BYTES = 140_000;
/** A burst of frames after a gap asks for one resync, not one per frame. */
export const RESYNC_MIN_INTERVAL_MS = 1500;

export type SyncDiagnostics = {
  connected: boolean;
  classId: string | null;
  selfId: string | null;
  epoch: string;
  seqSent: number;
  queued: number;
  lastSentAt: number | null;
  lastReceivedAt: number | null;
  lastReceivedFrom: string | null;
  lastReceivedSeq: number | null;
  lastReceivedKeys: string[];
  peers: number;
  hydratedFrom: "row" | "peer" | null;
  errors: string[];
  /** Delta cadence / heartbeat cadence in use for this class size. */
  intervalMs?: number;
  beatMs?: number;
  audience?: number;
  metrics?: SyncMetrics;
  waitingFor?: string[];
};

/**
 * Realtime events per second one class may use (one send plus one delivery per
 * listener). Supabase Pro allows 500/s for the whole project, measured over a
 * minute; going over closes channels. 0 means no limit (a self-hosted SFU).
 */
export const BOARD_SYNC_EVENTS_PER_SECOND = Number(import.meta.env?.VITE_BOARD_SYNC_EVENTS_PER_SECOND ?? 400) || 0;

/**
 * Ordering guard. Frames from the same sender run (`epoch`) must arrive in
 * increasing `seq`; a NEW epoch always wins, because the sender remounted.
 * Returns true when the frame should be applied.
 */
export function shouldApplyDelta(
  seen: Map<string, { epoch: string; seq: number }>,
  msg: Pick<BoardDelta, "author" | "epoch" | "seq">,
): boolean {
  const who = msg.author || "anon";
  const prev = seen.get(who);
  if (prev && prev.epoch === msg.epoch && msg.seq <= prev.seq) return false;
  seen.set(who, { epoch: msg.epoch, seq: msg.seq });
  return true;
}

/**
 * Broadcast has no acknowledgement, so a lost frame is silent. An incremental
 * patch is only safe on top of the frame right before it: if this one is not
 * the next in its sender's run, fields changed in the missing frame(s) never
 * reach us until they change again. Must be called BEFORE shouldApplyDelta
 * records the frame. A full frame carries everything, so it never has a gap.
 */
export function hasSeqGap(
  seen: Map<string, { epoch: string; seq: number }>,
  msg: Pick<BoardDelta, "author" | "epoch" | "seq" | "full">,
): boolean {
  if (msg.full) return false;
  const prev = seen.get(msg.author || "anon");
  if (!prev || prev.epoch !== msg.epoch) return true;
  return msg.seq > prev.seq + 1;
}


/** The class's private request topic (already authorised for class members). */
export const requestChannelKey = (classId: string) => `smartboard-state-${classId}`;

export function useSmartboardSync(opts: {
  classId?: string | null;
  notebookId?: string | null;
  sourceFingerprint?: string | null;
  role: "teacher" | "student";
  /** The teacher's Preview plan arrived with the board (students present it). */
  onRemotePlan?: (notebookId: string | null, skipped: string[]) => void;
}) {
  const { classId, notebookId = null, sourceFingerprint = null, role } = opts;
  const onRemotePlanRef = useRef(opts.onRemotePlan);
  onRemotePlanRef.current = opts.onRemotePlan;
  const enabled = !!classId;

  const [selfId, setSelfId] = useState<string | null>(null);
  const [incoming, setIncoming] = useState<BoardSnapshot | null>(null);
  const [activeStudentId, setActiveStudentId] = useState<string | null>(null);
  const [connected, setConnected] = useState(false);

  const channelRef = useRef<RealtimeChannel | null>(null);
  const joinedRef = useRef(false);
  /** Frames that could not leave yet because the socket was not live. */
  const outboxRef = useRef<Array<{ event: string; payload: unknown }>>([]);
  const selfIdRef = useRef<string | null>(null);
  const identityRef = useRef({ notebookId, sourceFingerprint });
  identityRef.current = { notebookId, sourceFingerprint };
  const diagRef = useRef<SyncDiagnostics>({
    connected: false, classId: classId ?? null, selfId: null, epoch: "", seqSent: 0, queued: 0,
    lastSentAt: null, lastReceivedAt: null, lastReceivedFrom: null, lastReceivedSeq: null, lastReceivedKeys: [],
    peers: 0, hydratedFrom: null, errors: [],
  });
  const bumpDiag = useCallback((patch: Partial<SyncDiagnostics>) => {
    // Diagnostics live in a ref, read on demand by the hidden panel. Bumping
    // React state here would re-render the whole classroom board per frame.
    diagRef.current = { ...diagRef.current, ...patch };
  }, []);

  useEffect(() => {
    let cancelled = false;
    supabase.auth.getUser().then(({ data }) => {
      if (cancelled) return;
      selfIdRef.current = data.user?.id ?? null;
      setSelfId(data.user?.id ?? null);
      bumpDiag({ selfId: data.user?.id ?? null });
    });
    return () => { cancelled = true; };
  }, [bumpDiag]);

  /** Send now if the socket is live, otherwise queue in order. */
  const emit = useCallback((event: string, payload: unknown) => {
    const channel = channelRef.current;
    if (!channel || !joinedRef.current) {
      outboxRef.current.push({ event, payload });
      // Bounded; on rejoin the engine sends a complete board anyway.
      if (outboxRef.current.length > 60) outboxRef.current.splice(0, outboxRef.current.length - 60);
      bumpDiag({ queued: outboxRef.current.length });
      return;
    }
    void channel.send({ type: "broadcast", event, payload });
    bumpDiag({ lastSentAt: Date.now(), queued: outboxRef.current.length });
  }, [bumpDiag]);

  const drainOutbox = useCallback(() => {
    const channel = channelRef.current;
    if (!channel || !joinedRef.current) return;
    const queued = outboxRef.current;
    outboxRef.current = [];
    for (const frame of queued) void channel.send({ type: "broadcast", event: frame.event, payload: frame.payload });
    bumpDiag({ queued: 0, lastSentAt: queued.length ? Date.now() : diagRef.current.lastSentAt });
  }, [bumpDiag]);

  const engineRef = useRef<BoardSyncPeer | null>(null);
  /** This device listens for snapshot requests (it holds the board). */
  const requestsJoinedRef = useRef(false);
  const [holdsBoard, setHoldsBoard] = useState(false);
  const holdsBoardRef = useRef(false);

  useEffect(() => {
    if (!classId) return;
    let cancelled = false;
    outboxRef.current = [];
    const loadRow = async (): Promise<RowSnapshot | null> => {
      const { data, error } = await supabase
        .from("class_smartboard_state")
        .select("state_json, active_student_id")
        .eq("class_id", classId)
        .maybeSingle();
      if (cancelled) return null;
      if (error) {
        console.warn("[smartboard-sync] state reload failed", error.message);
        bumpDiag({ errors: [...diagRef.current.errors.slice(-4), `row: ${error.message}`] });
        return null;
      }
      const row = data as { state_json?: unknown; active_student_id?: string | null } | null;
      if (!row) return null;
      setActiveStudentId(row.active_student_id ?? null);
      const sj = row.state_json;
      return sj && typeof sj === "object" && "v" in sj ? (sj as RowSnapshot) : null;
    };
    const persist = async (snapshot: RowSnapshot) => {
      const { error } = await supabase
        .from("class_smartboard_state")
        .upsert({ class_id: classId, state_json: snapshot as never, updated_at: new Date().toISOString() }, { onConflict: "class_id" });
      if (error) {
        console.warn("[smartboard-sync] snapshot persist failed", error.message);
        bumpDiag({ errors: [...diagRef.current.errors.slice(-4), `persist: ${error.message}`] });
      }
      return !error;
    };
    // Requests for a full board go to the board holder only, over REST on the
    // class's request topic, so they are not delivered to (and paid for by)
    // every student. Falls back to the class channel if that fails.
    const requestTopic = requestChannelKey(classId);
    let requestSender: RealtimeChannel | null = null;
    const sendRequest = (payload: unknown) => {
      try {
        requestSender ??= supabase.channel(requestTopic, { config: { private: true } });
        void requestSender.httpSend("want", payload as Record<string, unknown>).catch(() => emit("hello", payload));
      } catch {
        emit("hello", payload);
      }
    };
    const engine = new BoardSyncPeer({
      config: { eventsPerSecond: BOARD_SYNC_EVENTS_PER_SECOND },
      selfId: () => selfIdRef.current,
      identity: () => ({ notebookId: identityRef.current.notebookId, fingerprint: identityRef.current.sourceFingerprint }),
      send: (event, payload) => (event === "want" ? sendRequest(payload) : emit(event, payload)),
      requestsReady: () => requestsJoinedRef.current,
      onApply: (snap, source) => {
        if (cancelled) return;
        setIncoming(snap);
        bumpDiag({
          lastReceivedAt: Date.now(), lastReceivedFrom: snap.author || null, hydratedFrom: diagRef.current.hydratedFrom === "peer" ? "peer" : source,
        });
      },
      onPlan: (nb, skipped) => {
        if (!cancelled) onRemotePlanRef.current?.(nb, skipped ?? []);
      },
      persist,
      loadRow,
    });
    engineRef.current = engine;
    bumpDiag({ classId, epoch: engine.epoch, hydratedFrom: null, errors: [] });

    // The teacher sizes the send rate to the class so the realtime budget holds.
    if (role === "teacher") {
      void (async () => {
        try {
          const res = await supabase.from("class_members").select("user_id", { count: "exact", head: true }).eq("class_id", classId);
          const count = (res as { count?: number | null } | null)?.count;
          if (!cancelled && typeof count === "number") engine.setAudience(count);
        } catch { /* keep the default */ }
      })();
    }
    // Back on screen / network back: catch up at once instead of waiting.
    const onVisible = () => { if (document.visibilityState === "visible") engine.resume("visible"); };
    const onOnline = () => engine.resume("online");
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("online", onOnline);
    if (joinedRef.current) engine.connected(true);
    return () => {
      cancelled = true;
      engine.stop();
      if (engineRef.current === engine) engineRef.current = null;
      if (requestSender) void supabase.removeChannel(requestSender);
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("online", onOnline);
    };
  }, [classId, role, emit, bumpDiag]);

  // The lesson here changed (loaded, or the teacher's plan applied): a board
  // that arrived before it matched is applied now, not on the teacher's next edit.
  useEffect(() => { engineRef.current?.identityChanged(); }, [notebookId, sourceFingerprint]);

  // Safety net only: when nothing at all has been heard for a while, read the saved board.
  usePolling("smartboard-sync", () => { engineRef.current?.poll(); }, 5_000, { enabled: !!classId, immediate: false });

  // One managed subscription per class — remounting replaces it instead of
  // adding a second listener, and rejoins back off instead of hammering.
  useLiveChannel({
    key: `sb-sync-${classId ?? "none"}`,
    enabled,
    build: (channel) => {
      channelRef.current = channel;
      joinedRef.current = false;
      const on = (event: "state" | "hello" | "beat" | "reload") =>
        channel.on("broadcast", { event }, ({ payload }) => {
          const engine = engineRef.current;
          if (!engine) return;
          if (event === "state") {
            const f = payload as BoardDelta | null;
            if (f && typeof f.seq === "number") bumpDiag({ lastReceivedSeq: f.seq, lastReceivedKeys: Object.keys(f.patch ?? {}) });
          }
          engine.receive(event, payload);
        });
      on("state"); on("hello"); on("beat"); on("reload");
      // Who holds the pen is a rare control change: announced on the channel,
      // and read from the saved row on join. (Listening to every row write via
      // postgres_changes made every student re-read the row about once a second.)
      channel.on("broadcast", { event: "control" }, ({ payload }) => {
        const p = payload as { activeStudentId?: string | null } | null;
        if (p && "activeStudentId" in p) setActiveStudentId(p.activeStudentId ?? null);
      });
    },
    onStatus: (joined) => {
      joinedRef.current = joined;
      setConnected(joined);
      bumpDiag({ connected: joined });
      if (!joined) engineRef.current?.connected(false);
    },
    onJoined: () => {
      joinedRef.current = true;
      // Anything queued while the socket was still opening leaves now, then the
      // engine sends/asks for the complete board.
      drainOutbox();
      engineRef.current?.connected(true);
    },
  });

  // Whoever holds the board (the teacher, or the student given the pen) listens
  // for snapshot requests on the class's request topic.
  useLiveChannel({
    key: requestChannelKey(classId ?? "none"),
    enabled: enabled && (role === "teacher" || holdsBoard),
    build: (channel) => {
      channel.on("broadcast", { event: "want" }, ({ payload }) => { engineRef.current?.receive("want", payload); });
    },
    onStatus: (joined) => { requestsJoinedRef.current = joined; },
  });

  /** Publish local board state. Local rendering has already happened. */
  const pushSnapshot = useCallback((state: BoardState) => {
    if (!classId) return;
    if (!holdsBoardRef.current) { holdsBoardRef.current = true; if (role !== "teacher") setHoldsBoard(true); }
    engineRef.current?.update(state);
    const e = engineRef.current;
    if (e) bumpDiag({ seqSent: e.sentSeq });
  }, [classId, role, bumpDiag]);

  const setActiveStudent = useCallback(async (uid: string | null) => {
    if (!classId) return;
    const { error } = await supabase
      .from("class_smartboard_state")
      .upsert({ class_id: classId, active_student_id: uid, updated_at: new Date().toISOString() }, { onConflict: "class_id" });
    if (!error) {
      setActiveStudentId(uid);
      emit("control", { activeStudentId: uid });
    } else console.warn("[smartboard-sync] active student update failed", error.message);
  }, [classId, emit]);

  const getDiagnostics = useCallback((): SyncDiagnostics => {
    const e = engineRef.current;
    if (!e) return diagRef.current;
    const { intervalMs, beatMs } = e.cadence;
    return {
      ...diagRef.current, seqSent: e.sentSeq, intervalMs, beatMs, audience: e.cfg.audience, metrics: { ...e.metrics },
      peers: e.followed.length, waitingFor: e.pendingNeeds.map(([a, r]) => `${a}:${r}`),
    };
  }, []);

  return {
    enabled,
    selfId,
    incoming,
    activeStudentId,
    pushSnapshot,
    setActiveStudent,
    connected,
    getDiagnostics,
  };
}

export { cadenceFor, DEFAULT_SYNC_CONFIG };
