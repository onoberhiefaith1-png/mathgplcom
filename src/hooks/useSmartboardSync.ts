// Live CLASSROOM SmartBoard transport — one shared workspace, many clients.
//
// The classroom board is not "the teacher's board copied to students". There is
// one logical workspace per class; every client holds a local representation of
// it, renders its own actions instantly, and publishes each change as a small
// delta down an already-open realtime socket. The durable row
// (class_smartboard_state) is a recovery copy for reloads and late joiners only.
//
// Hard-won rules encoded here:
//   * NEVER send before the channel reports SUBSCRIBED. A send down a
//     half-open socket is silently downgraded to a REST call and the frame is
//     lost — this was the "PC stays blank until I refresh" symptom. Outgoing
//     frames queue and drain on join.
//   * Every sender carries an `epoch` (random per mount) alongside its `seq`.
//     A reopened board gets a new epoch, so a restarted counter can never be
//     mistaken for stale traffic and silently discarded forever.
//   * A joiner hydrates from the durable row AND asks peers for a live full
//     snapshot at the same time; live frames always win over the row.
//   * No polling. The socket is the delivery mechanism.

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { RealtimeChannel } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { useLiveChannel } from "@/lib/stability/useLiveChannel";

/** One floating chip as the teacher arranged it. `chipId` is content-anchored,
 *  so it can never be confused with a different chip that happens to share a
 *  value or an array position. */
export type FloatingChipShared = { chipId: string; token: string; absIdx: number };
export type FloatingLineShared = { lineId: string; lineIdx: number; chips: FloatingChipShared[] };

/**
 * The floating-number workspace as SHARED state. Identity is explicit: every
 * line has a lineId, every chip a chipId, and consumed/used/reveal state is
 * expressed in those ids. Nothing is addressed by array position, so an
 * operation on one line can never land on another.
 */
export type FloatingShared = {
  /** Reservoir (question) the arrangement belongs to. */
  resId: string;
  /** Which reservoir is being viewed / is active, and the active line. */
  viewIdx: number;
  activeIdx: number;
  lineIdx: number;
  /** The arrangement itself — published, never re-derived by receivers. */
  lines: FloatingLineShared[];
  /** Chips already used, by chipId, in the order they were used. */
  usedOrder: string[];
  /** Strip view state so every client shows the same window of chips. */
  reveal: number;
  offset: number;
  reentryOffset: number;
};

export type BoardSnapshot = {
  v: number;
  author: string;
  ts: number;
  /** Notebook whose canonical lesson structure this state belongs to. */
  sourceNotebookId?: string | null;
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
  /** Floating-number workspace: which lesson line is active on the shared
   *  board, and whether it has been engaged. The student's floating number is
   *  the SAME object as the teacher's — it must activate at the same instant,
   *  even while its panel is hidden on the student side. */
  activeLineIdx?: number;
  lineEngaged?: boolean;
  /** Identified floating-number workspace (arrangement + per-chip state). */
  floating?: FloatingShared | null;
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
  /** Random per page-mount. Identifies one continuous sender run. */
  epoch: string;
  author: string;
  ts: number;
  full: boolean;
  patch: Partial<BoardState>;
};

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

const newEpoch = () => Math.random().toString(36).slice(2, 10);

export function useSmartboardSync(opts: {
  classId?: string | null;
  notebookId?: string | null;
  role: "teacher" | "student";
}) {
  const { classId, notebookId = null } = opts;
  const enabled = !!classId;

  const [selfId, setSelfId] = useState<string | null>(null);
  const [incoming, setIncoming] = useState<BoardSnapshot | null>(null);
  const [activeStudentId, setActiveStudentId] = useState<string | null>(null);
  const [connected, setConnected] = useState(false);
  const [diagTick, setDiagTick] = useState(0);

  const epochRef = useRef(newEpoch());
  const channelRef = useRef<RealtimeChannel | null>(null);
  const joinedRef = useRef(false);
  /** Frames that could not leave yet because the socket was not live. */
  const outboxRef = useRef<Array<{ event: string; payload: unknown }>>([]);
  const seqRef = useRef(0);
  const lastSeenRef = useRef<Map<string, { epoch: string; seq: number }>>(new Map());
  const lastSentRef = useRef<BoardState | null>(null);
  const lastLocalRef = useRef<BoardState | null>(null);
  const remoteBaseRef = useRef<BoardState | null>(null);
  const sendTimer = useRef<number | null>(null);
  const lastSendAt = useRef(0);
  const persistTimer = useRef<number | null>(null);
  const persistedOnceRef = useRef(false);
  const selfIdRef = useRef<string | null>(null);
  const peersRef = useRef<Set<string>>(new Set());
  /** When the last live frame (or local edit) touched the shared board. The
   *  durable row is a recovery copy only — it must never overwrite state that
   *  is fresher than the row it was written from. */
  const lastLiveAt = useRef(0);
  const diagRef = useRef<SyncDiagnostics>({
    connected: false,
    classId: classId ?? null,
    selfId: null,
    epoch: epochRef.current,
    seqSent: 0,
    queued: 0,
    lastSentAt: null,
    lastReceivedAt: null,
    lastReceivedFrom: null,
    lastReceivedSeq: null,
    lastReceivedKeys: [],
    peers: 0,
    hydratedFrom: null,
    errors: [],
  });

  const bumpDiag = useCallback((patch: Partial<SyncDiagnostics>) => {
    diagRef.current = { ...diagRef.current, ...patch };
    setDiagTick((n) => (n + 1) % 1_000_000);
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
      // Keep the queue bounded; the newest board state supersedes older frames.
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
    for (const frame of queued) {
      void channel.send({ type: "broadcast", event: frame.event, payload: frame.payload });
    }
    bumpDiag({ queued: 0, lastSentAt: queued.length ? Date.now() : diagRef.current.lastSentAt });
  }, [bumpDiag]);

  const loadRef = useRef<() => Promise<void>>(async () => {});

  useEffect(() => {
    if (!classId) return;
    let cancelled = false;

    // Reset per-class transport state.
    seqRef.current = 0;
    epochRef.current = newEpoch();
    lastSeenRef.current = new Map();
    lastSentRef.current = null;
    remoteBaseRef.current = null;
    persistedOnceRef.current = false;
    outboxRef.current = [];
    peersRef.current = new Set();
    bumpDiag({ classId, epoch: epochRef.current, hydratedFrom: null, errors: [] });

    const load = async () => {
      const { data, error } = await supabase
        .from("class_smartboard_state")
        .select("state_json, active_student_id")
        .eq("class_id", classId)
        .maybeSingle();
      if (cancelled) return;
      if (error) {
        console.warn("[smartboard-sync] state reload failed", error.message);
        bumpDiag({ errors: [...diagRef.current.errors.slice(-4), `row: ${error.message}`] });
        return;
      }
      const row = data as { state_json?: unknown; active_student_id?: string | null } | null;
      if (!row) return;
      setActiveStudentId(row.active_student_id ?? null);
      const sj = row.state_json;
      if (sj && typeof sj === "object" && "v" in sj) {
        const snap = sj as BoardSnapshot;
        // A class row survives notebook switches. Never hydrate one lesson with
        // another lesson's ink or Floating Number sequence. Legacy snapshots
        // without an identity are deliberately ignored and replaced by the
        // canonical notebook source on the next local publish.
        if (!snap.sourceNotebookId || snap.sourceNotebookId !== notebookId) return;
        // Live frames are the truth. Only adopt the durable copy when nothing
        // live has arrived recently (first load, reconnect after a drop).
        if (Date.now() - lastLiveAt.current < 4000) return;
        const { v: _v, author: _author, ts: _ts, ...rest } = snap;
        remoteBaseRef.current = rest as BoardState;
        setIncoming(snap);
        bumpDiag({ hydratedFrom: diagRef.current.hydratedFrom ?? "row" });
      }
    };

    loadRef.current = load;
    void load();

    return () => { cancelled = true; };
  }, [classId, notebookId, bumpDiag]);

  const applyDelta = useCallback((msg: BoardDelta | null) => {
    if (!msg || typeof msg.seq !== "number") return;
    if (msg.author && selfIdRef.current && msg.author === selfIdRef.current) return; // own echo
    if (!shouldApplyDelta(lastSeenRef.current, { author: msg.author, epoch: msg.epoch ?? "legacy", seq: msg.seq })) return;
    lastLiveAt.current = Date.now();
    const base = msg.full ? null : remoteBaseRef.current;
    const merged = { ...(base ?? {}), ...msg.patch } as BoardState;
    if (!merged.sourceNotebookId || merged.sourceNotebookId !== notebookId) return;
    remoteBaseRef.current = merged;
    setIncoming({ v: 1, author: msg.author, ts: msg.ts, ...merged });
    if (msg.author) peersRef.current.add(msg.author);
    bumpDiag({
      lastReceivedAt: Date.now(),
      lastReceivedFrom: msg.author || null,
      lastReceivedSeq: msg.seq,
      lastReceivedKeys: Object.keys(msg.patch ?? {}),
      peers: peersRef.current.size,
      hydratedFrom: "peer",
    });
  }, [bumpDiag, notebookId]);

  /** Publish a full snapshot of whatever this client currently holds. */
  const publishFull = useCallback(() => {
    const state = lastLocalRef.current;
    if (!state) return;
    seqRef.current += 1;
    lastSentRef.current = state;
    emit("state", {
      seq: seqRef.current,
      epoch: epochRef.current,
      author: selfIdRef.current ?? "",
      ts: Date.now(),
      full: true,
      patch: state,
    } satisfies BoardDelta);
    bumpDiag({ seqSent: seqRef.current });
  }, [emit, bumpDiag]);

  // One managed subscription per class — remounting replaces it instead of
  // adding a second listener, and rejoins back off instead of hammering.
  useLiveChannel({
    key: `sb-sync-${classId ?? "none"}`,
    enabled,
    build: (channel) => {
      channelRef.current = channel;
      joinedRef.current = false;
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
          if (from) {
            peersRef.current.add(from);
            bumpDiag({ peers: peersRef.current.size });
          }
          // Whoever holds board state answers with the complete workspace, even
          // if nothing has been edited since the board opened.
          lastSentRef.current = null;
          publishFull();
        })
        // Control changes (active student) stay on the durable row; they're rare.
        .on(
          "postgres_changes",
          { event: "*", schema: "public", table: "class_smartboard_state", filter: `class_id=eq.${classId}` },
          () => { void loadRef.current(); },
        );
    },
    onStatus: (joined) => {
      joinedRef.current = joined;
      setConnected(joined);
      bumpDiag({ connected: joined });
      if (!joined) {
        // The next frame after a reconnect must be a full resync.
        lastSentRef.current = null;
      }
    },
    onJoined: () => {
      joinedRef.current = true;
      // Hydrate from the durable row and ask peers for the live workspace at
      // the same time; live frames always win, so there is no missed-update gap.
      void loadRef.current();
      emit("hello", { from: selfIdRef.current ?? "" });
      // Anything queued while the socket was still opening leaves now.
      drainOutbox();
      // Announce our own workspace so a peer that joined first catches up.
      publishFull();
    },
  });

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
      if (error) {
        console.warn("[smartboard-sync] snapshot persist failed", error.message);
        bumpDiag({ errors: [...diagRef.current.errors.slice(-4), `persist: ${error.message}`] });
      }
      return !error;
    };
    persistTimer.current = window.setTimeout(() => { void write(); }, immediate ? 0 : PERSIST_DEBOUNCE_MS);
  }, [classId, bumpDiag]);

  const flush = useCallback(() => {
    const state = lastLocalRef.current;
    if (!state) return;
    const patch = diffBoardState(lastSentRef.current, state);
    if (Object.keys(patch).length === 0) return;
    const full = lastSentRef.current === null;
    lastSendAt.current = Date.now();
    seqRef.current += 1;
    const message: BoardDelta = {
      seq: seqRef.current,
      epoch: epochRef.current,
      author: selfIdRef.current ?? "",
      ts: Date.now(),
      full,
      patch,
    };
    if (JSON.stringify(message).length > MAX_BROADCAST_BYTES) {
      // Too large for a socket frame: write it and tell peers to read the row.
      lastSentRef.current = null; // next delta must be a full resync
      persist(state, true);
      emit("reload", {});
      return;
    }
    lastSentRef.current = state;
    emit("state", message);
    bumpDiag({ seqSent: seqRef.current });
    persist(state);
  }, [persist, emit, bumpDiag]);

  /**
   * Publish local board state. Leading-edge throttled at ~40ms so the first
   * change of a burst leaves immediately and the rest coalesce. Local rendering
   * has already happened — this never gates the author's own view.
   */
  const pushSnapshot = useCallback((state: BoardState) => {
    if (!classId) return;
    lastLocalRef.current = state;
    lastLiveAt.current = Date.now();
    // The durable copy exists from the moment the board opens, so a late joiner
    // always has something to read even before the first edit.
    if (!persistedOnceRef.current) {
      persistedOnceRef.current = true;
      persist(state, true);
    }
    const since = Date.now() - lastSendAt.current;

    if (since >= BROADCAST_INTERVAL_MS) { flush(); return; }
    if (sendTimer.current) return;
    sendTimer.current = window.setTimeout(() => {
      sendTimer.current = null;
      flush();
    }, BROADCAST_INTERVAL_MS - since);
  }, [classId, flush, persist]);

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

  const diagnostics = useMemo(() => {
    void diagTick;
    return diagRef.current;
  }, [diagTick]);

  return {
    enabled,
    selfId,
    incoming,
    activeStudentId,
    pushSnapshot,
    setActiveStudent,
    connected,
    diagnostics,
  };
}
