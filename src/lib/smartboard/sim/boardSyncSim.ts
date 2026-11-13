// Local multi-client simulation of the classroom board sync.
//
// A virtual clock, a broadcast network with latency, jitter, random loss and
// the Supabase Realtime message budget (a rolling one-minute average; going
// over closes every channel and clients rejoin), a saved-copy row with read and
// write latency, one teacher writing on the board, and any number of students.
//
// Two protocols run on it: "v2" (the real BoardSyncPeer engine) and "v1" (a
// faithful model of the previous useSmartboardSync logic) so before/after can
// be measured on identical traffic.

import {
  BoardSyncPeer,
  diffBoardState,
  hashBoard,
  type BoardDelta,
  type BoardState,
  type Clock,
  type RowSnapshot,
} from "../boardSyncEngine";

// ─────────────────────────── virtual time ───────────────────────────

type Task = { at: number; id: number; fn: () => void };
export class VirtualClock implements Clock {
  t = 0;
  private heap: Task[] = [];
  private seqId = 0;
  private cancelled = new Set<number>();
  now() { return this.t; }
  setTimeout(fn: () => void, ms: number) {
    const id = ++this.seqId;
    this.push({ at: this.t + Math.max(0, ms), id, fn });
    return id;
  }
  clearTimeout(id: unknown) { if (typeof id === "number") this.cancelled.add(id); }
  /** Set when a task resolved a promise, so awaiting code gets to run at this instant. */
  microtasksPending = false;
  async runUntil(end: number) {
    while (this.heap.length && this.heap[0]!.at <= end) {
      const task = this.pop()!;
      if (this.cancelled.has(task.id)) { this.cancelled.delete(task.id); continue; }
      this.t = task.at;
      task.fn();
      if (this.microtasksPending) {
        this.microtasksPending = false;
        for (let i = 0; i < 12; i++) await Promise.resolve();
      }
    }
    this.t = end;
  }
  private push(task: Task) {
    const h = this.heap; h.push(task);
    let i = h.length - 1;
    while (i > 0) { const p = (i - 1) >> 1; if (this.less(h[i]!, h[p]!)) { [h[i], h[p]] = [h[p]!, h[i]!]; i = p; } else break; }
  }
  private pop() {
    const h = this.heap; const top = h[0]; const last = h.pop()!;
    if (h.length) {
      h[0] = last; let i = 0;
      for (;;) {
        const l = 2 * i + 1, r = l + 1; let m = i;
        if (l < h.length && this.less(h[l]!, h[m]!)) m = l;
        if (r < h.length && this.less(h[r]!, h[m]!)) m = r;
        if (m === i) break; [h[i], h[m]] = [h[m]!, h[i]!]; i = m;
      }
    }
    return top;
  }
  private less(a: Task, b: Task) { return a.at < b.at || (a.at === b.at && a.id < b.id); }
}

export function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ─────────────────────────── network ───────────────────────────

export type NetConfig = {
  latencyMs: number;
  jitterMs: number;
  /** Probability a delivery is lost (server-side drops, half-open sockets). */
  dropRate: number;
  /** Probability a delivery is delayed past the next ones (out of order). */
  reorderRate: number;
  /** Realtime events per second allowed (rolling minute). 0 = unlimited. */
  budget: number;
  rowReadMs: number;
  rowWriteMs: number;
};

type Endpoint = {
  id: string;
  connected: boolean;
  lastDeliverAt: number;
  deliver: (event: string, payload: unknown) => void;
  onStatus: (joined: boolean) => void;
};

export class SimNet {
  endpoints = new Map<string, Endpoint>();
  events = 0;
  perSecond: number[] = [];
  closures = 0;
  byEvent: Record<string, number> = {};
  row: { value: RowSnapshot | null; writes: number; reads: number } = { value: null, writes: 0, reads: 0 };
  constructor(public clock: VirtualClock, public cfg: NetConfig, public rand: () => number) {
    const tick = () => { this.checkBudget(); this.clock.setTimeout(tick, 1000); };
    this.clock.setTimeout(tick, 1000);
  }
  private count(n: number) {
    this.events += n;
    const s = Math.floor(this.clock.now() / 1000);
    while (this.perSecond.length <= s) this.perSecond.push(0);
    this.perSecond[s]! += n;
  }
  private checkBudget() {
    if (!this.cfg.budget) return;
    const s = Math.floor(this.clock.now() / 1000);
    const window = this.perSecond.slice(Math.max(0, s - 60), s);
    const avg = window.reduce((a, b) => a + b, 0) / 60;
    if (avg <= this.cfg.budget) return;
    // "Too many messages per second": channels close; supabase-js rejoins.
    this.closures += 1;
    for (const ep of this.endpoints.values()) {
      if (!ep.connected) continue;
      ep.connected = false;
      ep.onStatus(false);
      this.clock.setTimeout(() => this.join(ep.id), 1000 + this.rand() * 3000);
    }
  }
  add(ep: Endpoint) { this.endpoints.set(ep.id, ep); }
  join(id: string) {
    const ep = this.endpoints.get(id);
    if (!ep || ep.connected) return;
    this.clock.setTimeout(() => { ep.connected = true; this.count(1); ep.onStatus(true); }, this.cfg.latencyMs * 2);
  }
  disconnect(id: string) {
    const ep = this.endpoints.get(id);
    if (ep?.connected) { ep.connected = false; ep.onStatus(false); }
  }
  broadcast(from: string, event: string, payload: unknown) {
    const wire = JSON.stringify(payload);
    let parsed: unknown = undefined;
    let receivers = 0;
    for (const ep of this.endpoints.values()) {
      if (ep.id === from || !ep.connected) continue;
      receivers += 1;
      if (this.rand() < this.cfg.dropRate) continue;
      let at = this.clock.now() + this.cfg.latencyMs + this.rand() * this.cfg.jitterMs;
      if (this.rand() < this.cfg.reorderRate) at += this.cfg.latencyMs * 3;
      else at = Math.max(at, ep.lastDeliverAt + 0.01), ep.lastDeliverAt = at;
      this.clock.setTimeout(() => {
        if (!ep.connected) return;
        parsed ??= JSON.parse(wire);
        ep.deliver(event, parsed);
      }, at - this.clock.now());
    }
    this.count(1 + receivers);
    const key = `${from === "teacher" ? "teacher" : "student"}:${event}${event === "state" && (payload as { full?: boolean }).full ? ":full" : ""}`;
    this.byEvent[key] = (this.byEvent[key] ?? 0) + 1 + receivers;
  }
  /** A request sent over REST to the board holder only (request channel): 2 events. */
  sendDirect(to: string, event: string, payload: unknown) {
    const ep = this.endpoints.get(to);
    this.count(ep?.connected ? 2 : 1);
    if (!ep?.connected || this.rand() < this.cfg.dropRate) return;
    const wire = JSON.stringify(payload);
    this.clock.setTimeout(() => { if (ep.connected) ep.deliver(event, JSON.parse(wire)); }, this.cfg.latencyMs + 100 + this.rand() * this.cfg.jitterMs);
  }
  readRow(): Promise<RowSnapshot | null> {
    this.row.reads += 1;
    const value = this.row.value ? (JSON.parse(JSON.stringify(this.row.value)) as RowSnapshot) : null;
    return new Promise((resolve) => this.clock.setTimeout(() => { this.clock.microtasksPending = true; resolve(value); }, this.cfg.rowReadMs));
  }
  writeRow(row: RowSnapshot) {
    const value = JSON.parse(JSON.stringify(row)) as RowSnapshot;
    this.clock.setTimeout(() => { this.row.value = value; this.row.writes += 1; }, this.cfg.rowWriteMs);
  }
}

// ─────────────────────────── clients ───────────────────────────

export type SimPeer = {
  update(state: BoardState): void;
  receive(event: string, payload: unknown): void;
  connected(joined: boolean): void;
  identityChanged(): void;
  poll(): void;
  pollEveryMs: number;
};

type ClientEnv = {
  id: string;
  clock: VirtualClock;
  send: (event: string, payload: unknown) => void;
  identity: () => { notebookId: string | null; fingerprint: string | null };
  onApply: (state: BoardState) => void;
  onPlan: (nb: string | null, skipped: string[]) => void;
  loadRow: () => Promise<RowSnapshot | null>;
  persist: (row: RowSnapshot) => void;
  rand: () => number;
  audience: number;
  budget: number;
};

const strip = (snap: Record<string, unknown>): BoardState => {
  const { v: _v, author: _a, ts: _t, syncEpoch: _e, syncEpochAt: _ea, syncSeq: _s, syncHash: _h, syncAudience: _au, ...rest } = snap;
  return rest as unknown as BoardState;
};

export function makeV2(env: ClientEnv): SimPeer {
  const peer = new BoardSyncPeer({
    clock: env.clock,
    random: env.rand,
    config: { eventsPerSecond: env.budget ? Math.floor(env.budget * 0.8) : 0, audience: env.id === "teacher" ? env.audience : 1 },
    selfId: () => env.id,
    identity: env.identity,
    send: (e, p) => env.send(e, p),
    requestsReady: () => env.id === "teacher",
    onApply: (snap) => env.onApply(strip(snap as unknown as Record<string, unknown>)),
    onPlan: (nb, skipped) => env.onPlan(nb, skipped ?? []),
    persist: (row) => env.persist(row),
    loadRow: env.loadRow,
  });
  return {
    update: (s) => peer.update(s),
    receive: (e, p) => peer.receive(e, p),
    connected: (j) => peer.connected(j),
    identityChanged: () => peer.identityChanged(),
    poll: () => peer.poll(),
    pollEveryMs: 5000,
  };
}

/** The previous protocol, line for line in behaviour (see git history of useSmartboardSync). */
export function makeV1(env: ClientEnv): SimPeer {
  const c = env.clock;
  const epoch = env.rand().toString(36).slice(2, 10);
  let seq = 0;
  const seen = new Map<string, { epoch: string; seq: number }>();
  let lastSent: BoardState | null = null;
  let lastLocal: BoardState | null = null;
  let remoteBase: BoardState | null = null;
  let sendTimer: unknown = null;
  let lastSendAt = 0;
  let persistTimer: unknown = null;
  let persistedOnce = false;
  let lastLiveAt = 0;
  let lastResyncAt = 0;
  const identityOk = (s: Partial<BoardState>) => {
    const { notebookId, fingerprint } = env.identity();
    return !!s.sourceNotebookId && s.sourceNotebookId === notebookId && !!s.sourceFingerprint && s.sourceFingerprint === fingerprint;
  };
  const persist = (state: BoardState, immediate = false) => {
    if (persistTimer !== null) c.clearTimeout(persistTimer);
    persistTimer = c.setTimeout(() => { env.persist({ v: 1, author: env.id, ts: c.now(), ...state }); }, immediate ? 0 : 1200);
  };
  const flush = () => {
    const state = lastLocal; if (!state) return;
    const patch = diffBoardStateV1(lastSent, state);
    if (Object.keys(patch).length === 0) return;
    const full = lastSent === null;
    lastSendAt = c.now();
    seq += 1;
    lastSent = state;
    env.send("state", { seq, epoch, author: env.id, ts: c.now(), full, patch } satisfies BoardDelta);
    persist(state);
  };
  const publishFull = () => {
    const state = lastLocal; if (!state) return;
    seq += 1; lastSent = state;
    env.send("state", { seq, epoch, author: env.id, ts: c.now(), full: true, patch: state } satisfies BoardDelta);
  };
  const load = async () => {
    const row = await env.loadRow();
    if (!row) return;
    if (!identityOk(row)) return;
    if (c.now() - lastLiveAt < 4000) return;
    remoteBase = strip(row as unknown as Record<string, unknown>);
    env.onApply(remoteBase);
  };
  const askForFull = () => {
    if (c.now() - lastResyncAt > 1500) { lastResyncAt = c.now(); env.send("hello", { from: env.id }); }
  };
  const applyDelta = (msg: BoardDelta) => {
    if (msg.author === env.id) return;
    const stamp = { author: msg.author, epoch: msg.epoch ?? "legacy", seq: msg.seq, full: msg.full };
    const prev = seen.get(stamp.author || "anon");
    const gap = !stamp.full && (!prev || prev.epoch !== stamp.epoch || stamp.seq > prev.seq + 1);
    if (prev && prev.epoch === stamp.epoch && stamp.seq <= prev.seq) return;
    seen.set(stamp.author || "anon", { epoch: stamp.epoch, seq: stamp.seq });
    if (gap) askForFull();
    lastLiveAt = c.now();
    const merged = { ...((msg.full ? null : remoteBase) ?? {}), ...msg.patch } as BoardState;
    if (!identityOk(merged)) { askForFull(); return; }
    remoteBase = merged;
    env.onApply(merged);
  };
  return {
    update: (state) => {
      lastLocal = state; lastLiveAt = c.now();
      if (!persistedOnce) { persistedOnce = true; persist(state, true); }
      const since = c.now() - lastSendAt;
      if (since >= 40) { flush(); return; }
      if (sendTimer !== null) return;
      sendTimer = c.setTimeout(() => { sendTimer = null; flush(); }, 40 - since);
    },
    receive: (event, payload) => {
      if (event === "state") applyDelta(payload as BoardDelta);
      else if (event === "reload") void load();
      else if (event === "hello") {
        const from = (payload as { from?: string }).from;
        if (from === env.id) return;
        lastSent = null; publishFull();
      }
    },
    connected: (joined) => {
      if (!joined) { lastSent = null; return; }
      void load(); env.send("hello", { from: env.id }); publishFull();
    },
    identityChanged: () => { void load(); },
    poll: () => { void load(); },
    pollEveryMs: 20_000,
  };
}

/** The previous diff: changed keys only (removed keys were never sent). */
function diffBoardStateV1(prev: BoardState | null, next: BoardState): Partial<BoardState> {
  if (!prev) return { ...next };
  const patch: Record<string, unknown> = {};
  for (const key of Object.keys(next) as (keyof BoardState)[]) {
    if (prev[key] === next[key]) continue;
    if (JSON.stringify(prev[key]) !== JSON.stringify(next[key])) patch[key] = next[key];
  }
  return patch as Partial<BoardState>;
}

// ─────────────────────────── scenario ───────────────────────────

export type Scenario = {
  protocol: "v1" | "v2";
  students: number;
  durationMs: number;
  seed?: number;
  net?: Partial<NetConfig>;
  /** When each student opens the class: all at the start (spread over 2s) unless given. */
  joinAt?: (i: number, rand: () => number) => number;
  /** Time from a student's channel join until its lesson has loaded here. */
  lessonLoadMs?: number;
  /** Beats the teacher skipped in Preview. */
  teacherSkipped?: string[];
  /** Teacher activity: "lesson" (bursts and pauses), "idle-after" (stops at t), or "constant". */
  activity?: { kind: "lesson" } | { kind: "idle-after"; at: number } | { kind: "constant" };
  /** Take these students offline for a while: [index, from, to]. */
  outages?: Array<[number, number, number]>;
  sampleMs?: number;
  /** A student's board counts as in sync if it equals the teacher's board as it was at most this long ago. */
  toleranceMs?: number;
};

export type ScenarioResult = {
  protocol: string;
  students: number;
  joinToSyncMs: { median: number; p95: number; max: number; neverSynced: number };
  /** Share of samples (after first sync) where a student was out of sync. */
  outOfSync: number;
  /** Longest stretch one student spent out of sync after first syncing. */
  longestDriftMs: number;
  eventsPerSecondAvg: number;
  eventsPerSecondPeak: number;
  channelClosures: number;
  rowReads: number;
  rowWrites: number;
  framesSentByTeacher: number;
  wantsSent: number;
  /** For each reconnect: time from the socket being back until the board matched. */
  resyncAfterReconnectMs: number[];
  eventsByKind: Record<string, number>;
};

const DEFAULT_NET: NetConfig = { latencyMs: 60, jitterMs: 40, dropRate: 0.002, reorderRate: 0, budget: 0, rowReadMs: 120, rowWriteMs: 150 };

const fp = (skipped: string[]) => `fp:${[...skipped].sort().join(",")}`;

function pct(values: number[], p: number) {
  if (!values.length) return NaN;
  const s = [...values].sort((a, b) => a - b);
  return s[Math.min(s.length - 1, Math.floor((p / 100) * s.length))]!;
}

export async function runScenario(sc: Scenario): Promise<ScenarioResult> {
  const rand = mulberry32(sc.seed ?? 7);
  const clock = new VirtualClock();
  const net = new SimNet(clock, { ...DEFAULT_NET, ...(sc.net ?? {}) }, rand);
  const make = sc.protocol === "v2" ? makeV2 : makeV1;
  const sampleMs = sc.sampleMs ?? 100;
  const tolerance = sc.toleranceMs ?? 400;
  const teacherSkipped = sc.teacherSkipped ?? [];

  // ── teacher ──
  let teacherState: BoardState = {
    beatCursor: 0, bandExtra: {}, freeLines: {}, lineOffsets: {}, smartLines: [], boxes: [],
    sensor: { line: 1, x: 0 }, zoom: 1, surface: "whiteboard", profileId: "default", inkColorId: "ink",
    sourceNotebookId: "nb", sourceFingerprint: fp(teacherSkipped), planSkipped: teacherSkipped,
    activeLineIdx: 0, lineEngaged: false, floating: null,
  };
  const history: Array<{ at: number; hash: string }> = [{ at: 0, hash: hashBoard(teacherState) }];
  let teacherFrames = 0;
  const outboxes = new Map<string, Array<[string, unknown]>>();
  const peers = new Map<string, SimPeer>();
  let wants = 0;
  const sendFrom = (id: string) => (event: string, payload: unknown) => {
    if (id === "teacher" && event === "state") teacherFrames += 1;
    if ((event === "hello" || event === "want") && id !== "teacher") wants += 1;
    if (event === "want") { net.sendDirect("teacher", event, payload); return; }
    const ep = net.endpoints.get(id);
    if (!ep?.connected) { const q = outboxes.get(id) ?? []; q.push([event, payload]); if (q.length > 60) q.shift(); outboxes.set(id, q); return; }
    net.broadcast(id, event, payload);
  };
  const addClient = (id: string, env: Partial<ClientEnv> & Pick<ClientEnv, "identity" | "onApply" | "onPlan">) => {
    const peer = make({
      id, clock, rand, send: sendFrom(id), loadRow: () => net.readRow(), persist: (row) => net.writeRow(row),
      audience: sc.students, budget: net.cfg.budget, ...env,
    });
    peers.set(id, peer);
    net.add({
      id, connected: false, lastDeliverAt: 0,
      deliver: (e, p) => peer.receive(e, p),
      onStatus: (joined) => {
        if (joined) {
          const q = outboxes.get(id) ?? []; outboxes.set(id, []);
          for (const [e, p] of q) net.broadcast(id, e, p);
        }
        peer.connected(joined);
      },
    });
    const poll = () => { peer.poll(); clock.setTimeout(poll, peer.pollEveryMs); };
    clock.setTimeout(poll, peer.pollEveryMs);
    return peer;
  };
  const teacher = addClient("teacher", {
    identity: () => ({ notebookId: "nb", fingerprint: fp(teacherSkipped) }),
    onApply: () => {}, onPlan: () => {},
  });
  net.join("teacher");
  const setTeacher = (next: BoardState) => {
    teacherState = next;
    history.push({ at: clock.now(), hash: hashBoard(next) });
    teacher.update(next);
  };
  clock.setTimeout(() => setTeacher({ ...teacherState }), 10);

  // Teacher activity: bursts of writing at ~16 actions/s, pauses, slide changes.
  const act = () => {
    const r = rand();
    const s = teacherState;
    if (r < 0.65) {
      const line = String(s.sensor.line);
      const ink = { ...(s.freeLines as Record<string, string>) };
      ink[line] = ((ink[line] ?? "") + "m12,4l3,1").slice(-400);
      setTeacher({ ...s, freeLines: ink, sensor: { ...s.sensor, x: s.sensor.x + 1 } });
    } else if (r < 0.85) {
      setTeacher({ ...s, sensor: { line: s.sensor.line, x: s.sensor.x + 7 } });
    } else if (r < 0.95) {
      setTeacher({ ...s, activeLineIdx: (s.activeLineIdx ?? 0) + 1, lineEngaged: true, sensor: { line: s.sensor.line + 1, x: 0 } });
    } else {
      setTeacher({ ...s, beatCursor: s.beatCursor + 1, freeLines: {}, sensor: { line: 1, x: 0 } });
    }
  };
  const activity = sc.activity ?? { kind: "lesson" };
  const schedule = (at: number) => {
    if (at >= sc.durationMs) return;
    clock.setTimeout(() => {
      if (activity.kind === "idle-after" && clock.now() >= activity.at) return;
      if (activity.kind === "constant") { act(); schedule(clock.now() + 60); return; }
      const burst = 1500 + rand() * 4500;
      const end = clock.now() + burst;
      const step = () => {
        if (clock.now() >= end || (activity.kind === "idle-after" && clock.now() >= activity.at)) {
          schedule(clock.now() + 1500 + rand() * 6000);
          return;
        }
        act();
        clock.setTimeout(step, 60);
      };
      step();
    }, at - clock.now());
  };
  schedule(300);

  // ── students ──
  type S = { reconnectAt: number | null; id: string; joinAt: number; display: BoardState | null; displayHash: string | null; syncedAt: number | null; out: number; total: number; driftStart: number | null; longest: number };
  const students: S[] = [];
  const lessonLoadMs = sc.lessonLoadMs ?? 1200;
  for (let i = 0; i < sc.students; i++) {
    const id = `s${i}`;
    const joinAt = sc.joinAt ? sc.joinAt(i, rand) : rand() * 2000;
    const st: S = { reconnectAt: null, id, joinAt, display: null, displayHash: null, syncedAt: null, out: 0, total: 0, driftStart: null, longest: 0 };
    students.push(st);
    let lessonReady = false;
    // Students read the plan from their own browser in v1 (none there); in v2 they adopt the teacher's.
    let plan: string[] = [];
    const peer = addClient(id, {
      identity: () => ({ notebookId: "nb", fingerprint: lessonReady ? fp(plan) : "loading" }),
      onApply: (state) => { st.display = state; st.displayHash = null; },
      onPlan: (nb, skipped) => {
        if (sc.protocol !== "v2" || nb !== "nb") return;
        if (skipped.join(",") === plan.join(",")) return;
        plan = skipped;
        clock.setTimeout(() => peer.identityChanged(), 0);
      },
    });
    clock.setTimeout(() => {
      net.join(id);
      clock.setTimeout(() => { lessonReady = true; peer.identityChanged(); }, lessonLoadMs);
    }, joinAt);
  }
  for (const [idx, from, to] of sc.outages ?? []) {
    clock.setTimeout(() => net.disconnect(`s${idx}`), from);
    clock.setTimeout(() => { net.join(`s${idx}`); students[idx]!.reconnectAt = clock.now(); }, to);
  }

  const resyncs: number[] = [];
  // ── sampling ──
  const sample = () => {
    const now = clock.now();
    // Teacher hashes within the tolerance window (plus the one current at its start).
    let k = history.length - 1;
    const ok = new Set<string>();
    while (k >= 0 && history[k]!.at > now - tolerance) { ok.add(history[k]!.hash); k--; }
    if (k >= 0) ok.add(history[k]!.hash);
    for (const st of students) {
      if (now < st.joinAt || !st.display) {
        if (now >= st.joinAt && st.syncedAt !== null) st.out += 1, st.total += 1;
        continue;
      }
      st.displayHash ??= hashBoard(st.display);
      const inSync = ok.has(st.displayHash);
      if (st.syncedAt === null) {
        if (inSync) st.syncedAt = now;
        continue;
      }
      st.total += 1;
      if (inSync && st.reconnectAt !== null && now >= st.reconnectAt) { resyncs.push(now - st.reconnectAt); st.reconnectAt = null; }
      if (!inSync) {
        st.out += 1;
        st.driftStart ??= now;
        st.longest = Math.max(st.longest, now - st.driftStart);
      } else st.driftStart = null;
    }
    if (now + sampleMs <= sc.durationMs) clock.setTimeout(sample, sampleMs);
  };
  clock.setTimeout(sample, sampleMs);

  await clock.runUntil(sc.durationMs);

  const join = students.filter((s) => s.syncedAt !== null).map((s) => s.syncedAt! - s.joinAt);
  const totals = students.reduce((a, s) => ({ out: a.out + s.out, total: a.total + s.total }), { out: 0, total: 0 });
  const secs = net.perSecond.slice(0, Math.floor(sc.durationMs / 1000));
  return {
    protocol: sc.protocol,
    students: sc.students,
    joinToSyncMs: {
      median: Math.round(pct(join, 50)), p95: Math.round(pct(join, 95)), max: Math.round(join.length ? Math.max(...join) : NaN),
      neverSynced: students.length - join.length,
    },
    outOfSync: totals.total ? totals.out / totals.total : 0,
    longestDriftMs: Math.max(0, ...students.map((s) => s.longest)),
    eventsPerSecondAvg: Math.round(secs.reduce((a, b) => a + b, 0) / Math.max(1, secs.length)),
    eventsPerSecondPeak: Math.max(0, ...secs),
    channelClosures: net.closures,
    rowReads: net.row.reads,
    rowWrites: net.row.writes,
    framesSentByTeacher: teacherFrames,
    wantsSent: wants,
    resyncAfterReconnectMs: resyncs,
    eventsByKind: net.byEvent,
  };
}

export { diffBoardState };
