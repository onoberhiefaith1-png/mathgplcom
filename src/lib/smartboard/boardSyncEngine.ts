// Classroom board sync engine: one authoritative stream per author, versioned,
// self-correcting. Transport- and clock-agnostic so it can be tested and
// simulated with many students; useSmartboardSync is the thin React adapter
// over the Supabase Realtime channel.
//
// Guarantees it is built for:
//   * A student who joins at ANY point gets the latest board straight away: the
//     saved copy (written at most 1s behind the live board) shows at once, and a
//     full live snapshot follows when the saved copy is not current.
//   * Every frame carries (epoch, seq) and a delta names the seq it builds on
//     (`base`). A delta is only applied on top of exactly that seq; anything
//     else is held back and a full snapshot is requested. Nothing is applied out
//     of order and nothing is silently skipped.
//   * The board's owner sends a tiny heartbeat (seq + content hash) every
//     second. A student who is behind or whose board differs in any way notices
//     within one heartbeat and is corrected with a full snapshot.
//   * Requests for a snapshot are spread out and suppressed (one snapshot
//     answers everyone who was waiting), and the owner sends at most one
//     snapshot per 250ms however many students ask, so a class of 1,000 does
//     not turn one missed frame into 1,000 snapshots.
//   * Send rate adapts to class size so the realtime message budget is never
//     exceeded (exceeding it makes Supabase close the channel: that was lag).
//
// Wire format is backward compatible with the previous protocol: the same
// "state" (seq/epoch/full/patch) and "hello" events, plus a new "beat" event
// older clients simply ignore.

import { mergeBoardFrame, type ClassroomAcademiaState, type ClassroomBoardSurface } from "@/lib/smartboard/classroomAcademia";

/** One floating chip as the teacher arranged it. */
export type FloatingChipShared = { chipId: string; token: string; absIdx: number };
export type FloatingLineShared = { lineId: string; lineIdx: number; chips: FloatingChipShared[] };

/** The floating-number workspace as SHARED state, addressed by ids. */
export type FloatingShared = {
  resId: string;
  viewIdx: number;
  activeIdx: number;
  lineIdx: number;
  lines: FloatingLineShared[];
  usedOrder: string[];
  reveal: number;
  offset: number;
  reentryOffset: number;
};

export type BoardSnapshot = {
  v: number;
  author: string;
  ts: number;
  sourceNotebookId?: string | null;
  sourceFingerprint?: string | null;
  /** Beats the teacher chose to skip in Preview. Students present the
   *  teacher's plan, not whatever happens to be in their own browser. */
  planSkipped?: string[] | null;
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
  activeLineIdx?: number;
  lineEngaged?: boolean;
  floating?: FloatingShared | null;
  /** Classroom surface. Lesson Notes stays the teacher's working copy.
   *  Academia is the workspace Academia, mirrored to the class. Only the
   *  teacher sends these; a full board without them keeps the last ones. */
  boardSurface?: ClassroomBoardSurface;
  academia?: ClassroomAcademiaState | null;
};

export type BoardState = Omit<BoardSnapshot, "v" | "author" | "ts">;

export type BoardDelta = {
  seq: number;
  epoch: string;
  author: string;
  ts: number;
  full: boolean;
  patch: Partial<BoardState>;
  /** The seq this delta builds on (always seq - 1 for one sender run). */
  base?: number;
  /** When this sender run started; a later run of the same author wins. */
  epochAt?: number;
  /** Content hash of the complete board after this frame (full frames). */
  hash?: string;
};

export type BeatFrame = { author: string; epoch: string; epochAt: number; seq: number; hash: string; ts: number; /** class size, so followers can spread their requests */ aud?: number; /** the sender listens on the private request channel */ rq?: boolean };
export type WantFrame = { from: string; to?: string | null; have?: { epoch: string; seq: number } | null };
/** The saved copy, as stored in class_smartboard_state.state_json. */
export type RowSnapshot = BoardSnapshot & { syncEpoch?: string; syncEpochAt?: number; syncSeq?: number; syncHash?: string; syncAudience?: number };

export type Clock = { now(): number; setTimeout(fn: () => void, ms: number): unknown; clearTimeout(id: unknown): void };
export const realClock: Clock = {
  now: () => Date.now(),
  setTimeout: (fn, ms) => setTimeout(fn, ms),
  clearTimeout: (id) => clearTimeout(id as ReturnType<typeof setTimeout>),
};

export type SyncConfig = {
  /** Fastest cadence local edits leave the browser. */
  minIntervalMs: number;
  /** Heartbeat cadence (before the class-size budget stretches it). */
  beatMs: number;
  /** At most one full snapshot per this many ms, however many ask. */
  fullGapMs: number;
  /** Wait this long after a request so requests arriving together share one snapshot. */
  fullCoalesceMs: number;
  /** Random spread before a student asks (scales with class size). */
  wantJitterMs: number;
  /** Give in-flight frames this long to arrive before asking for a snapshot. */
  settleMs: number;
  /** Ask again if no snapshot came within this long (doubles, max 8s). */
  wantRetryMs: number;
  /** The saved copy is written at most this far behind the live board. */
  persistMs: number;
  /** Frames above this are saved and announced instead of sent. */
  maxBytes: number;
  /** Realtime events per second this class may use (sent + delivered). 0 = unlimited. */
  eventsPerSecond: number;
  /** Expected number of listeners (students); drives the budget. */
  audience: number;
  /** A saved copy younger than this counts as current on join. */
  rowFreshMs: number;
  /** Up to this class size a joiner asks for the live board at once; above it,
   *  it shows the saved copy and lets the next heartbeat decide (saves a storm). */
  eagerJoinUpTo: number;
  /** No frame or heartbeat for this long ⇒ read the saved copy. */
  silentMs: number;
};

export const DEFAULT_SYNC_CONFIG: SyncConfig = {
  minIntervalMs: 40,
  beatMs: 1000,
  fullGapMs: 250,
  fullCoalesceMs: 25,
  wantJitterMs: 80,
  settleMs: 60,
  wantRetryMs: 600,
  persistMs: 1000,
  maxBytes: 140_000,
  eventsPerSecond: 0,
  audience: 1,
  rowFreshMs: 2500,
  eagerJoinUpTo: 50,
  silentMs: 4000,
};

/** Delta cadence and heartbeat cadence that keep a class inside its message budget. */
export function cadenceFor(cfg: Pick<SyncConfig, "minIntervalMs" | "beatMs" | "eventsPerSecond" | "audience">): { intervalMs: number; beatMs: number } {
  const fanout = Math.max(1, cfg.audience) + 1; // one send + one delivery per listener
  if (!cfg.eventsPerSecond) return { intervalMs: cfg.minIntervalMs, beatMs: cfg.beatMs };
  return {
    intervalMs: Math.max(cfg.minIntervalMs, Math.ceil((1000 * fanout) / (0.8 * cfg.eventsPerSecond))),
    beatMs: Math.max(cfg.beatMs, Math.ceil((1000 * fanout) / (0.15 * cfg.eventsPerSecond))),
  };
}

/** Stable JSON: sorted keys; null and undefined fields are the same (absent). */
export function stableStringify(value: unknown): string {
  if (value === null || value === undefined) return "null";
  if (typeof value !== "object") return JSON.stringify(value) ?? "null";
  if (Array.isArray(value)) return `[${Array.from(value, (v) => stableStringify(v)).join(",")}]`;
  const obj = value as Record<string, unknown>;
  const keys = Object.keys(obj).filter((k) => obj[k] !== undefined && obj[k] !== null).sort();
  return `{${keys.map((k) => `${JSON.stringify(k)}:${stableStringify(obj[k])}`).join(",")}}`;
}

/** 64-bit content hash (two FNV-1a variants) of a board. */
/** The board without the fields only the teacher publishes. */
function withoutTeacherOnly(state: BoardState): BoardState {
  const { boardSurface: _s, academia: _a, ...rest } = state;
  return rest as BoardState;
}

export function hashBoard(state: Partial<BoardState> | null | undefined): string {
  const text = stableStringify(state ?? null);
  let a = 0x811c9dc5;
  let b = 0x01000193 ^ text.length;
  for (let i = 0; i < text.length; i++) {
    const c = text.charCodeAt(i);
    a = Math.imul(a ^ c, 16777619);
    b = Math.imul(b ^ c, 2246822519) ^ (b >>> 13);
  }
  return (a >>> 0).toString(16).padStart(8, "0") + (b >>> 0).toString(16).padStart(8, "0");
}

/** Per-field diff. A field that disappeared is sent as null so it is cleared, not kept. */
export function diffBoardState(prev: BoardState | null, next: BoardState): Partial<BoardState> {
  if (!prev) return { ...next };
  const patch: Record<string, unknown> = {};
  const keys = new Set([...Object.keys(prev), ...Object.keys(next)]) as Set<keyof BoardState>;
  for (const key of keys) {
    const a = prev[key];
    const b = next[key];
    if (a === b) continue;
    if ((a === undefined || a === null) && (b === undefined || b === null)) continue;
    if (b === undefined) { patch[key] = null; continue; }
    if (JSON.stringify(a) !== JSON.stringify(b)) patch[key] = b;
  }
  return patch as Partial<BoardState>;
}

type Stamp = { epoch: string; epochAt: number; seq: number };
/** >0 when a is newer than b. A later sender run always wins over an earlier one. */
export function compareStamp(a: Stamp, b: Stamp): number {
  if (a.epoch !== b.epoch) {
    if (a.epochAt && b.epochAt && a.epochAt !== b.epochAt) return a.epochAt - b.epochAt;
    return 1; // unknown order: the new run wins (it is the one talking now)
  }
  return a.seq - b.seq;
}

const newEpoch = () => Math.random().toString(36).slice(2, 10);

export type SyncMetrics = {
  deltasSent: number;
  fullsSent: number;
  beatsSent: number;
  wantsSent: number;
  persists: number;
  fullsApplied: number;
  deltasApplied: number;
  rowsApplied: number;
  gaps: number;
  driftDetected: number;
  heldForLesson: number;
  lastAppliedAt: number | null;
  lastBeatAt: number | null;
};

export type BoardSyncPeerOptions = {
  clock?: Clock;
  config?: Partial<SyncConfig>;
  selfId: () => string | null;
  /** The lesson this board shows; frames for any other lesson are held back. */
  identity: () => { notebookId: string | null; fingerprint: string | null };
  /** Broadcast one event to the class channel (the adapter queues while offline).
   *  "want" goes only to whoever holds the board (a separate request channel),
   *  so a request does not reach — and is not paid for by — every student. */
  send: (event: "state" | "hello" | "beat" | "reload" | "want", payload: unknown) => void;
  /** This device is listening on the request channel (it may answer "want"). */
  requestsReady?: () => boolean;
  /** A new remote board to show. */
  onApply: (snap: BoardSnapshot, source: "peer" | "row") => void;
  /** The teacher's Preview plan for this lesson, seen before the lesson matches. */
  onPlan?: (notebookId: string | null, skipped: string[] | null) => void;
  /** Write the saved copy. */
  persist?: (row: RowSnapshot) => Promise<boolean> | void;
  /** Read the saved copy. */
  loadRow?: () => Promise<RowSnapshot | null>;
  random?: () => number;
};

/**
 * One board on one device. It publishes when this device edits (teacher, or the
 * student the teacher handed the board to) and follows everyone else.
 */
export class BoardSyncPeer {
  private clock: Clock;
  cfg: SyncConfig;
  private o: BoardSyncPeerOptions;
  private rand: () => number;

  // ── publishing ──
  readonly epoch = newEpoch();
  readonly epochAt: number;
  private seq = 0;
  private lastLocal: BoardState | null = null;
  private lastSent: BoardState | null = null;
  private lastSentHash: string | null = null;
  private lastSendAt = -Infinity;
  private sendTimer: unknown = null;
  private lastFullAt = -Infinity;
  private fullTimer: unknown = null;
  private beatTimer: unknown = null;
  private persistTimer: unknown = null;
  private lastPersistAt = -Infinity;
  private persistedOnce = false;
  /** Realtime budget: tokens are events; one broadcast costs one per listener plus one. */
  private tokens = 0;
  private tokensAt = -Infinity;

  // ── following ──
  private streams = new Map<string, Stamp>();
  private merged: BoardState | null = null;
  private lastWriter: string | null = null;
  private beats = new Map<string, BeatFrame>();
  /** Senders whose frames we applied across a gap: shown, but not yet proven exact. */
  private dirty = new Set<string>();
  private held: { author: string; frame: BoardDelta } | null = null;
  private needs = new Map<string, string>();
  private wantTimer: unknown = null;
  private wantAttempt = 0;
  private joinTimer: unknown = null;
  private lastLiveAt = -Infinity;
  /** A live full board (or an exact chain of frames) has been applied. */
  private liveSynced = false;
  private joined = false;
  private stopped = false;

  metrics: SyncMetrics = {
    deltasSent: 0, fullsSent: 0, beatsSent: 0, wantsSent: 0, persists: 0,
    fullsApplied: 0, deltasApplied: 0, rowsApplied: 0, gaps: 0, driftDetected: 0, heldForLesson: 0,
    lastAppliedAt: null, lastBeatAt: null,
  };

  constructor(o: BoardSyncPeerOptions) {
    this.o = o;
    this.clock = o.clock ?? realClock;
    this.cfg = { ...DEFAULT_SYNC_CONFIG, ...(o.config ?? {}) };
    this.rand = o.random ?? Math.random;
    this.epochAt = this.clock.now();
  }

  get cadence() { return cadenceFor(this.cfg); }

  /** Events one broadcast on the class channel costs. */
  private get broadcastCost() { return Math.max(1, this.cfg.audience) + 1; }

  /** Spend budget for one broadcast; false (nothing spent) when it would go over. */
  private spend(): boolean {
    const rate = this.cfg.eventsPerSecond;
    if (!rate) return true;
    const cap = rate * 10; // Supabase averages over a minute; allow 10s of burst
    const now = this.clock.now();
    this.tokens = this.tokensAt === -Infinity ? cap : Math.min(cap, this.tokens + ((now - this.tokensAt) / 1000) * rate);
    this.tokensAt = now;
    if (this.tokens < this.broadcastCost) return false;
    this.tokens -= this.broadcastCost;
    return true;
  }

  /** Milliseconds until one broadcast fits the budget again. */
  private budgetWait(): number {
    const rate = this.cfg.eventsPerSecond;
    if (!rate) return 0;
    return Math.max(this.cfg.minIntervalMs, Math.ceil(((this.broadcastCost - this.tokens) / rate) * 1000));
  }
  get publishing() { return this.lastLocal !== null; }
  get sentSeq() { return this.seq; }
  get board() { return this.merged; }
  get pendingNeeds() { return [...this.needs.entries()]; }
  /** Followed sender runs (for diagnostics). */
  get followed() { return [...this.streams.entries()]; }

  setAudience(audience: number) {
    this.cfg.audience = Math.max(1, Math.floor(audience));
  }

  stop() {
    this.stopped = true;
    for (const t of [this.sendTimer, this.fullTimer, this.beatTimer, this.persistTimer, this.wantTimer, this.joinTimer]) {
      if (t !== null) this.clock.clearTimeout(t);
    }
    this.sendTimer = this.fullTimer = this.beatTimer = this.persistTimer = this.wantTimer = this.joinTimer = null;
  }

  // ───────────────────────── connection ─────────────────────────

  connected(joined: boolean) {
    this.joined = joined;
    if (!joined) {
      // Whatever is sent next must be complete: frames may have been lost.
      this.lastSent = null;
      return;
    }
    if (this.lastLocal) {
      this.publishFull();
      this.scheduleBeat();
    }
    void this.join();
  }

  /** Coming back to the screen, or the network returning. */
  resume(reason = "resume") {
    if (this.stopped) return;
    void this.syncFromRow(reason);
    const beat = this.metrics.lastBeatAt;
    if (!this.publishing && (beat === null || this.clock.now() - beat > this.cadence.beatMs * 2)) this.need("*", "silent");
  }

  /** Called on a slow timer: if nothing at all has been heard, read the saved copy. */
  poll() {
    if (this.stopped || this.publishing) return;
    if (this.clock.now() - this.lastLiveAt > this.cfg.silentMs) void this.syncFromRow("poll");
  }

  private async join() {
    const fresh = await this.syncFromRow("join");
    if (this.stopped) return;
    if (!this.publishing && !fresh && (!this.merged || this.cfg.audience <= this.cfg.eagerJoinUpTo)) this.need("*", "join");
    // Nobody heard by two heartbeats after joining ⇒ ask anyone holding the board.
    if (this.joinTimer !== null) this.clock.clearTimeout(this.joinTimer);
    this.joinTimer = this.clock.setTimeout(() => {
      this.joinTimer = null;
      if (!this.publishing && this.metrics.lastBeatAt === null) this.need("*", "silent");
    }, this.cadence.beatMs * 2 + 200);
  }

  // ───────────────────────── publishing ─────────────────────────

  /** This device changed the board. Rendering already happened locally. */
  update(state: BoardState) {
    if (this.stopped) return;
    const first = this.lastLocal === null;
    this.lastLocal = state;
    if (first) this.scheduleBeat();
    if (!this.persistedOnce) {
      // The saved copy exists from the moment the board opens.
      this.persistedOnce = true;
      this.flush();
      return;
    }
    const since = this.clock.now() - this.lastSendAt;
    const { intervalMs } = this.cadence;
    if (since >= intervalMs) { this.flush(); return; }
    if (this.sendTimer !== null) return;
    this.sendTimer = this.clock.setTimeout(() => { this.sendTimer = null; this.flush(); }, intervalMs - since);
  }

  private stampFrame(full: boolean, patch: Partial<BoardState>, hash?: string): BoardDelta {
    return {
      seq: this.seq, base: this.seq - 1, epoch: this.epoch, epochAt: this.epochAt,
      author: this.o.selfId() ?? "", ts: this.clock.now(), full, patch, ...(hash ? { hash } : {}),
    };
  }

  private flush() {
    const state = this.lastLocal;
    if (!state) return;
    const full = this.lastSent === null;
    const patch = full ? { ...state } : diffBoardState(this.lastSent, state);
    if (!full && Object.keys(patch).length === 0) return;
    if (!this.spend()) {
      // Over the class budget: wait; whatever changes meanwhile leaves together.
      if (this.sendTimer === null) this.sendTimer = this.clock.setTimeout(() => { this.sendTimer = null; this.flush(); }, this.budgetWait());
      return;
    }
    this.seq += 1;
    // Hashing the whole board is only needed for full frames and heartbeats.
    this.lastSentHash = full ? hashBoard(state) : null;
    const frame = this.stampFrame(full, patch, this.lastSentHash ?? undefined);
    this.lastSendAt = this.clock.now();
    this.lastSent = state;
    if (JSON.stringify(frame).length > this.cfg.maxBytes) {
      // Too big for one realtime frame: save it and tell everyone to read it.
      this.lastSent = null;
      this.writeRow(true);
      this.o.send("reload", { seq: this.seq });
    } else {
      this.o.send("state", frame);
      if (full) { this.metrics.fullsSent += 1; this.lastFullAt = this.clock.now(); } else this.metrics.deltasSent += 1;
    }
    this.markPersist();
  }

  /** Send the complete board now (on join, on request). */
  publishFull() {
    if (!this.lastLocal) return;
    if (this.sendTimer !== null) { this.clock.clearTimeout(this.sendTimer); this.sendTimer = null; }
    this.lastSent = null;
    this.flush();
  }

  private scheduleFull() {
    if (this.fullTimer !== null || !this.lastLocal) return;
    const now = this.clock.now();
    const at = Math.max(now + this.cfg.fullCoalesceMs, this.lastFullAt + this.cfg.fullGapMs);
    this.fullTimer = this.clock.setTimeout(() => { this.fullTimer = null; this.publishFull(); }, at - now);
  }

  private scheduleBeat() {
    if (this.beatTimer !== null || this.stopped) return;
    this.beatTimer = this.clock.setTimeout(() => {
      this.beatTimer = null;
      if (this.lastLocal && this.lastSent && this.joined && this.spend()) {
        this.lastSentHash ??= hashBoard(this.lastSent);
        const beat: BeatFrame = { author: this.o.selfId() ?? "", epoch: this.epoch, epochAt: this.epochAt, seq: this.seq, hash: this.lastSentHash, ts: this.clock.now(), aud: this.cfg.audience, ...(this.o.requestsReady?.() ? { rq: true } : {}) };
        this.o.send("beat", beat);
        this.metrics.beatsSent += 1;
      }
      if (this.lastLocal) this.scheduleBeat();
    }, this.cadence.beatMs);
  }

  private markPersist() {
    const wait = this.lastPersistAt + this.cfg.persistMs - this.clock.now();
    if (wait <= 0) { this.writeRow(); return; }
    if (this.persistTimer !== null) return;
    this.persistTimer = this.clock.setTimeout(() => { this.persistTimer = null; this.writeRow(); }, wait);
  }

  private writeRow(immediate = false) {
    if (!this.o.persist) return;
    const state = this.lastSent ?? this.lastLocal;
    if (!state) return;
    if (immediate && this.persistTimer !== null) { this.clock.clearTimeout(this.persistTimer); this.persistTimer = null; }
    this.lastPersistAt = this.clock.now();
    this.metrics.persists += 1;
    const row: RowSnapshot = {
      v: 1, author: this.o.selfId() ?? "", ts: this.clock.now(), ...state,
      syncEpoch: this.epoch, syncEpochAt: this.epochAt, syncSeq: this.seq, syncHash: (this.lastSentHash ??= hashBoard(state)), syncAudience: this.cfg.audience,
    };
    void this.o.persist(row);
  }

  // ───────────────────────── following ─────────────────────────

  private isSelf(author: string | undefined | null) {
    const me = this.o.selfId();
    return !!author && !!me && author === me;
  }

  private identityOk(state: Partial<BoardState> | null | undefined): boolean {
    if (!state) return false;
    const { notebookId, fingerprint } = this.o.identity();
    return !!state.sourceNotebookId && state.sourceNotebookId === notebookId
      && !!state.sourceFingerprint && state.sourceFingerprint === fingerprint;
  }

  receive(event: string, payload: unknown) {
    if (this.stopped || !payload || typeof payload !== "object") return;
    if (event === "state") this.onFrame(payload as BoardDelta);
    else if (event === "beat") this.onBeat(payload as BeatFrame);
    else if (event === "hello" || event === "want") this.onWant(payload as WantFrame);
    else if (event === "reload") void this.syncFromRow("reload");
  }

  private onWant(w: WantFrame) {
    if (this.isSelf(w.from)) return;
    if (w.to && !this.isSelf(w.to)) return;
    if (!this.lastLocal) return;
    this.scheduleFull();
  }

  private onFrame(f: BoardDelta) {
    if (typeof f.seq !== "number" || this.isSelf(f.author)) return;
    const author = f.author || "anon";
    this.lastLiveAt = this.clock.now();
    const stamp: Stamp = { epoch: f.epoch ?? "legacy", epochAt: f.epochAt ?? 0, seq: f.seq };
    const cur = this.streams.get(author);
    if (cur && cur.epoch !== stamp.epoch && compareStamp(stamp, cur) < 0) return; // an older run of this sender
    if (f.full) {
      if (cur && cur.epoch === stamp.epoch && stamp.seq <= cur.seq) return; // duplicate or older
      this.adoptFull(author, stamp, f.patch as BoardState, "peer", f);
      return;
    }
    if (cur && cur.epoch === stamp.epoch && stamp.seq <= cur.seq) return; // duplicate / already covered
    const base = typeof f.base === "number" ? f.base : f.seq - 1;
    if (cur && cur.epoch === stamp.epoch && base === cur.seq && this.merged) {
      this.applyDelta(author, stamp, f);
      return;
    }
    // Not the next frame on top of what we hold (a frame went missing, or this
    // sender restarted). Show it anyway — every field it carries is the
    // sender's current value, so the board keeps moving — but this copy is no
    // longer guaranteed exact, so ask for the full board to make it exact.
    this.metrics.gaps += 1;
    if (this.merged && (!cur || cur.epoch === stamp.epoch)) {
      const next = { ...this.merged, ...(f.patch as BoardState) };
      if (this.identityOk(next)) {
        this.merged = next;
        this.streams.set(author, stamp);
        this.lastWriter = author;
        this.dirty.add(author);
        this.emit(author, f.ts, "peer");
      }
    }
    this.need(author, "gap");
  }

  private applyDelta(author: string, stamp: Stamp, f: BoardDelta) {
    const next = { ...(this.merged as BoardState), ...(f.patch as BoardState) };
    if (!this.identityOk(next)) { this.need(author, "lesson"); return; }
    this.merged = next;
    this.streams.set(author, stamp);
    this.lastWriter = author;
    this.metrics.deltasApplied += 1;
    this.emit(author, f.ts, "peer");
    this.settle(author);
  }

  private adoptFull(author: string, stamp: Stamp, state: BoardState, source: "peer" | "row", frame?: BoardDelta) {
    if (!this.identityOk(state)) {
      // Not this lesson (yet): the lesson may still be loading here, or the
      // teacher's Preview plan has not been applied. Keep it and re-check when
      // the lesson changes, instead of dropping it and waiting for the next edit.
      this.held = { author, frame: frame ?? { ...stamp, author, ts: this.clock.now(), full: true, patch: state } };
      this.metrics.heldForLesson += 1;
      this.o.onPlan?.(state.sourceNotebookId ?? null, state.planSkipped ?? null);
      return;
    }
    if (this.held && this.held.author === author && compareStamp(stamp, { epoch: this.held.frame.epoch, epochAt: this.held.frame.epochAt ?? 0, seq: this.held.frame.seq }) >= 0) this.held = null;
    // A full board from a student holder does not carry Academia: keep the
    // teacher's Academia snapshot unless this board sets it.
    this.merged = mergeBoardFrame(this.merged as Record<string, unknown> | null, state as Record<string, unknown>, true) as BoardState;
    this.dirty.delete(author);
    this.streams.set(author, stamp);
    this.lastWriter = author;
    if (source === "row") this.metrics.rowsApplied += 1; else { this.metrics.fullsApplied += 1; this.liveSynced = true; }
    this.o.onPlan?.(state.sourceNotebookId ?? null, state.planSkipped ?? null);
    this.emit(author, frame?.ts ?? this.clock.now(), source);
    this.settle(author);
  }

  private onBeat(b: BeatFrame) {
    if (typeof b.seq !== "number" || this.isSelf(b.author)) return;
    const author = b.author || "anon";
    this.lastLiveAt = this.clock.now();
    this.metrics.lastBeatAt = this.clock.now();
    this.beats.set(author, b);
    if (this.lastLocal) return;
    if (typeof b.aud === "number" && b.aud > 0) this.setAudience(b.aud); // this device is editing; it does not follow
    const verdict = this.checkAgainstBeat(author);
    if (verdict === "behind") this.need(author, "behind");
    else if (verdict === "drift") { this.metrics.driftDetected += 1; this.need(author, "drift"); }
    else this.settle(author);
  }

  /** How this device's copy compares with the sender's last heartbeat. */
  private checkAgainstBeat(author: string): "ok" | "behind" | "drift" | "unknown" {
    const b = this.beats.get(author);
    if (!b) return "unknown";
    const cur = this.streams.get(author);
    const stamp: Stamp = { epoch: b.epoch, epochAt: b.epochAt, seq: b.seq };
    if (!cur || compareStamp(stamp, cur) > 0) return "behind";
    if (compareStamp(stamp, cur) < 0) return "ok"; // we already have newer frames
    // Same version: the content must match exactly. Only meaningful when that
    // sender made the latest change (another editor may have changed it since).
    if (this.lastWriter === author && this.merged) {
      // A holder that never sends Academia hashes its board without it.
      if (hashBoard(this.merged) !== b.hash && hashBoard(withoutTeacherOnly(this.merged)) !== b.hash) return "drift";
      this.dirty.delete(author); // proven identical after all
    }
    return "ok";
  }

  private stillNeeded(author: string, reason: string): boolean {
    if (reason === "join" || reason === "silent") {
      if (!this.merged || this.held !== null) return true;
      // A heartbeat, when there is one, says exactly whether this copy is current.
      if (this.beats.size > 0) return [...this.beats.keys()].some((a) => { const v = this.checkAgainstBeat(a); return v === "behind" || v === "drift"; });
      // No heartbeat yet: a live snapshot settles it; a saved copy alone does not.
      return !this.liveSynced;
    }
    if (reason === "gap") return this.dirty.has(author) || !this.streams.has(author) || !this.merged;
    if (reason === "lesson") return !this.identityOk(this.merged);
    const v = this.checkAgainstBeat(author);
    return v === "behind" || v === "drift";
  }

  private settle(author: string) {
    const reason = this.needs.get(author);
    if (reason && !this.stillNeeded(author, reason)) this.needs.delete(author);
    const any = this.needs.get("*");
    if (any && !this.stillNeeded("*", any)) this.needs.delete("*");
    if (this.needs.size === 0) {
      this.wantAttempt = 0;
      if (this.wantTimer !== null) { this.clock.clearTimeout(this.wantTimer); this.wantTimer = null; }
    }
  }

  /** Ask for a full board — after a short random wait, and only if still needed then. */
  private need(author: string, reason: string) {
    if (this.stopped) return;
    if (!this.needs.has(author)) this.needs.set(author, reason);
    if (this.wantTimer !== null) return;
    // Bigger classes spread their requests wider so one snapshot answers them all.
    // Small classes ask almost at once (requests go only to the board holder);
    // big classes spread wide so one snapshot, sent to everyone, answers most.
    const aud = this.cfg.audience;
    const spread = aud <= 100 ? Math.max(this.cfg.wantJitterMs / 2, 2 * aud) : Math.min(2000, this.cfg.wantJitterMs * (aud / 10));
    const settle = reason === "gap" || reason === "behind" ? this.cfg.settleMs : 0;
    const backoff = this.wantAttempt === 0 ? 0 : Math.min(8000, this.cfg.wantRetryMs * 2 ** (this.wantAttempt - 1));
    const delay = settle + backoff + this.rand() * spread;
    this.wantTimer = this.clock.setTimeout(() => this.fireWant(), delay);
  }

  private fireWant() {
    this.wantTimer = null;
    if (this.stopped) return;
    for (const [author, reason] of [...this.needs.entries()]) {
      if (!this.stillNeeded(author, reason)) this.needs.delete(author);
    }
    // A device that is editing holds the board itself; it never needs to ask.
    if (this.needs.size === 0 || this.publishing) { this.needs.clear(); this.wantAttempt = 0; return; }
    const targets = [...this.needs.keys()].filter((a) => a !== "*");
    const to = targets.length === 1 && !this.needs.has("*") ? targets[0]! : null;
    const have = to ? this.streams.get(to) ?? null : null;
    const want: WantFrame = { from: this.o.selfId() ?? "", to, have: have ? { epoch: have.epoch, seq: have.seq } : null };
    // Ask only the board holder (request channel). Fall back to asking the
    // whole class channel only when the holder is clearly an older version:
    // it sends no heartbeats at all, and a direct request went unanswered.
    const beats = [...this.beats.values()];
    const direct = beats.some((x) => x.rq) || (beats.length === 0 && this.wantAttempt < 2);
    this.o.send(direct ? "want" : "hello", want);
    this.metrics.wantsSent += 1;
    this.wantAttempt += 1;
    // If no snapshot settles it, ask again (backing off).
    const [first] = this.needs.entries();
    if (first) this.need(first[0], "retry");
  }

  /** Read the saved copy; returns true when it is current enough to show without asking. */
  async syncFromRow(_reason: string): Promise<boolean> {
    if (!this.o.loadRow) return false;
    let row: RowSnapshot | null = null;
    try { row = await this.o.loadRow(); } catch { return false; }
    if (this.stopped || !row || typeof row !== "object" || !("v" in row)) return false;
    if (this.isSelf(row.author) && this.publishing) return false;
    const { v: _v, author, ts, syncEpoch, syncEpochAt, syncSeq, syncHash: _h, syncAudience, ...state } = row;
    if (typeof syncAudience === "number" && syncAudience > 0 && !this.publishing) this.setAudience(syncAudience);
    const who = author || "anon";
    if (typeof syncSeq === "number" && syncEpoch) {
      const stamp: Stamp = { epoch: syncEpoch, epochAt: syncEpochAt ?? 0, seq: syncSeq };
      const cur = this.streams.get(who);
      if (!cur || compareStamp(stamp, cur) > 0) this.adoptFull(who, stamp, state as BoardState, "row");
    } else if (!this.merged) {
      // Saved by an older version: no stamp. Better than an empty board.
      this.adoptFull(who, { epoch: "row", epochAt: 0, seq: 0 }, state as BoardState, "row");
    }
    return !!this.merged && this.held === null && this.clock.now() - (ts ?? 0) < this.cfg.rowFreshMs;
  }

  /** The lesson identity on this device changed (lesson loaded, plan applied). */
  identityChanged() {
    if (this.stopped) return;
    const held = this.held;
    if (held && this.identityOk(held.frame.patch)) {
      this.held = null;
      const f = held.frame;
      this.adoptFull(held.author, { epoch: f.epoch, epochAt: f.epochAt ?? 0, seq: f.seq }, f.patch as BoardState, "peer", f);
    }
    if (this.merged && !this.identityOk(this.merged) && !this.publishing) this.need("*", "join");
  }

  private emit(author: string, ts: number, source: "peer" | "row") {
    if (!this.merged) return;
    this.metrics.lastAppliedAt = this.clock.now();
    this.o.onApply({ v: 1, author, ts, ...this.merged }, source);
  }
}
