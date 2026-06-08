import { useCallback, useEffect, useRef, useState } from "react";
import { RewardKind } from "@/data/tallyAssets";

export const COLS = 9;

export interface LaneCapsule<P> {
  id: number;
  row: number;
  col: number;
  payload: P;
  reward: RewardKind; // visible inside the capsule's lane track
  lastStepAt: number;
}

export interface CollectFlight {
  id: number;
  reward: RewardKind;
  row: number;
  col: number;
}

export interface Objective {
  reward: RewardKind;
  target: number;
  collected: number;
}

export interface LaneRunnerOpts<P> {
  rows: number;
  initialActiveRows: number;
  rampSec: number;
  travelSec: number;
  missLimit: number;
  spawn: () => P;
  objectives: Objective[];
}

const REWARD_POOL: RewardKind[] = ["coin", "coin", "coin", "coin", "diamond", "crown", "gem", "key"];
const rollReward = (): RewardKind => REWARD_POOL[Math.floor(Math.random() * REWARD_POOL.length)];

export function useLaneRunner<P>(opts: LaneRunnerOpts<P>) {
  const optsRef = useRef(opts);
  optsRef.current = opts;

  const [active, setActive] = useState<LaneCapsule<P>[]>([]);
  const activeRef = useRef<LaneCapsule<P>[]>([]);
  activeRef.current = active;

  const [misses, setMisses] = useState(0);
  const [solved, setSolved] = useState(0);
  const [streak, setStreak] = useState(0);
  const [bestStreak, setBestStreak] = useState(0);
  const [coinsEarned, setCoinsEarned] = useState(0);
  const [objectives, setObjectives] = useState<Objective[]>(opts.objectives);
  const [flights, setFlights] = useState<CollectFlight[]>([]);
  const [activeRows, setActiveRows] = useState(opts.initialActiveRows);
  const [status, setStatus] = useState<"playing" | "gameover" | "won">("playing");
  const [lastMissAt, setLastMissAt] = useState<{ row: number; t: number } | null>(null);

  const idRef = useRef(1);
  const startedAtRef = useRef(performance.now());
  const nextSpawnAtRef = useRef<number[]>(Array(opts.rows).fill(0));

  const reset = useCallback(() => {
    idRef.current = 1;
    startedAtRef.current = performance.now();
    setActive([]);
    setMisses(0);
    setSolved(0);
    setStreak(0);
    setBestStreak(0);
    setCoinsEarned(0);
    setObjectives(optsRef.current.objectives);
    setFlights([]);
    setActiveRows(optsRef.current.initialActiveRows);
    setStatus("playing");
    const now = performance.now();
    const stepMs = (optsRef.current.travelSec * 1000) / COLS;
    nextSpawnAtRef.current = Array.from({ length: optsRef.current.rows }, (_, r) => now + r * stepMs * 0.7);
  }, []);

  // Initial spawn timing
  useEffect(() => {
    const now = performance.now();
    const stepMs = (opts.travelSec * 1000) / COLS;
    nextSpawnAtRef.current = Array.from({ length: opts.rows }, (_, r) => now + r * stepMs * 0.7);
    startedAtRef.current = now;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Lane ramping
  useEffect(() => {
    if (status !== "playing") return;
    if (activeRows >= opts.rows) return;
    const t = setInterval(() => {
      setActiveRows((r) => Math.min(opts.rows, r + 1));
    }, opts.rampSec * 1000);
    return () => clearInterval(t);
  }, [status, activeRows, opts.rows, opts.rampSec]);

  // Game loop
  useEffect(() => {
    if (status !== "playing") return;
    let raf = 0;
    const loop = () => {
      const o = optsRef.current;
      const now = performance.now();
      const stepMs = (o.travelSec * 1000) / COLS;

      // Spawn
      for (let r = 0; r < activeRows; r++) {
        const occupied = activeRef.current.some((n) => n.row === r);
        if (!occupied && now >= nextSpawnAtRef.current[r]) {
          const cap: LaneCapsule<P> = {
            id: idRef.current++,
            row: r,
            col: 0,
            payload: o.spawn(),
            reward: rollReward(),
            lastStepAt: now,
          };
          activeRef.current = [...activeRef.current, cap];
          setActive(activeRef.current);
        }
      }

      // Step
      const prev = activeRef.current;
      const next: LaneCapsule<P>[] = [];
      let missedThisFrame = 0;
      let missedRow = -1;
      for (const n of prev) {
        if (now - n.lastStepAt >= stepMs) {
          const newCol = n.col + 1;
          if (newCol >= COLS) {
            missedThisFrame++;
            missedRow = n.row;
            nextSpawnAtRef.current[n.row] = now + 600;
            continue;
          }
          next.push({ ...n, col: newCol, lastStepAt: now });
        } else {
          next.push(n);
        }
      }
      if (next.length !== prev.length || next.some((n, i) => n !== prev[i])) {
        activeRef.current = next;
        setActive(next);
      }
      if (missedThisFrame > 0) {
        setStreak(0);
        setLastMissAt({ row: missedRow, t: now });
        setMisses((m) => {
          const newM = m + missedThisFrame;
          if (newM >= o.missLimit) setStatus("gameover");
          return newM;
        });
      }

      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [status, activeRows]);

  /** Returns the current leading capsule in a row (lowest col), if any. */
  const peekRow = useCallback((row: number): LaneCapsule<P> | null => {
    const inRow = activeRef.current.filter((n) => n.row === row);
    if (!inRow.length) return null;
    inRow.sort((a, b) => b.col - a.col); // furthest right = leading
    return inRow[0];
  }, []);

  const solveCapsule = useCallback((id: number) => {
    const cap = activeRef.current.find((n) => n.id === id);
    if (!cap) return;
    // Award reward
    const eid = idRef.current++;
    setFlights((f) => [...f, { id: eid, reward: cap.reward, row: cap.row, col: cap.col }]);
    setTimeout(() => setFlights((f) => f.filter((x) => x.id !== eid)), 950);
    if (cap.reward === "coin") setCoinsEarned((c) => c + 1);
    setObjectives((prev) =>
      prev.map((o) => (o.reward === cap.reward ? { ...o, collected: Math.min(o.target, o.collected + 1) } : o)),
    );
    setSolved((s) => s + 1);
    setStreak((s) => {
      const ns = s + 1;
      setBestStreak((b) => Math.max(b, ns));
      return ns;
    });
    // Remove capsule
    activeRef.current = activeRef.current.filter((n) => n.id !== id);
    setActive(activeRef.current);
    nextSpawnAtRef.current[cap.row] = performance.now() + 500;
  }, []);

  const failCapsule = useCallback((id: number) => {
    const cap = activeRef.current.find((n) => n.id === id);
    if (!cap) return;
    setStreak(0);
    setLastMissAt({ row: cap.row, t: performance.now() });
    setMisses((m) => {
      const newM = m + 1;
      if (newM >= optsRef.current.missLimit) setStatus("gameover");
      return newM;
    });
  }, []);

  // Win check
  useEffect(() => {
    if (status !== "playing") return;
    if (objectives.length && objectives.every((o) => o.collected >= o.target)) {
      setStatus("won");
    }
  }, [objectives, status]);

  return {
    active,
    misses,
    solved,
    streak,
    bestStreak,
    coinsEarned,
    objectives,
    flights,
    activeRows,
    status,
    lastMissAt,
    peekRow,
    solveCapsule,
    failCapsule,
    reset,
  };
}
