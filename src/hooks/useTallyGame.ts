import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { BombKind, RewardKind } from "@/data/tallyAssets";

export const ROWS = 5;
export const COLS = 9;

export type TileContent =
  | { type: "reward"; reward: RewardKind }
  | { type: "bomb"; bomb: BombKind };

export interface MovingNumber {
  id: number;
  row: number;
  value: number;
  col: number; // current tile index
  lastStepAt: number; // ms timestamp of last step
}

export interface Settings {
  durationSec: number; // edge-to-edge total time
  spawnStaggerSec: number;
  maxRows: number;
  missLimit: number;
  bombFreq: number;
  coinWeight: number;
  heartWeight: number;
  diamondWeight: number;
  minVal: number;
  maxVal: number;
  paused: boolean;
}

export const DEFAULT_SETTINGS: Settings = {
  durationSec: 60,
  spawnStaggerSec: 2,
  maxRows: 5,
  missLimit: 5,
  bombFreq: 0.04,
  coinWeight: 0.8,
  heartWeight: 0.08,
  diamondWeight: 0.07,
  minVal: 1,
  maxVal: 40,
  paused: false,
};

export interface Objective {
  reward: RewardKind;
  target: number;
  collected: number;
}

export interface BlastEffect {
  id: number;
  cells: { row: number; col: number }[];
  startedAt: number;
}

export interface CollectEvent {
  id: number;
  reward: RewardKind;
  row: number;
  col: number;
}

const REWARD_POOL_BASE: RewardKind[] = ["star", "key", "energy", "crown", "potion", "scroll", "gem"];

// Strict distribution: 80% coin, 15% current-objective items, 5% bomb
function rollTile(s: Settings, objectiveRewards: RewardKind[]): TileContent {
  const r = Math.random();
  if (r < 0.05) {
    const bombs: BombKind[] = ["horizontal", "vertical", "diagonal", "area"];
    return { type: "bomb", bomb: bombs[Math.floor(Math.random() * bombs.length)] };
  }
  if (r < 0.20 && objectiveRewards.length > 0) {
    const pick = objectiveRewards[Math.floor(Math.random() * objectiveRewards.length)];
    return { type: "reward", reward: pick };
  }
  return { type: "reward", reward: "coin" };
}

function makeTiles(s: Settings, objectiveRewards: RewardKind[]): TileContent[][] {
  return Array.from({ length: ROWS }, () => Array.from({ length: COLS }, () => rollTile(s, objectiveRewards)));
}

function pickObjectives(level: number): Objective[] {
  // Always exclude coin from objectives — coin is the wallet currency
  const pool: RewardKind[] = ["heart", "diamond", "star", "key", "energy", "crown", "potion", "scroll", "gem"];
  const count = Math.min(3, 2 + Math.floor(level / 3));
  const shuffled = [...pool].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, count).map((r) => ({
    reward: r,
    target: 5 + level * 2,
    collected: 0,
  }));
}

export function useTallyGame() {
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);
  const settingsRef = useRef(settings);
  settingsRef.current = settings;

  const [level, setLevel] = useState(1);
  const [score, setScore] = useState(0);
  const [misses, setMisses] = useState(0);
  const [coinsEarned, setCoinsEarned] = useState(0);
  const [objectives, setObjectives] = useState<Objective[]>(() => pickObjectives(1));
  const objectivesRef = useRef(objectives);
  objectivesRef.current = objectives;
  const objectiveRewards = () =>
    objectivesRef.current.filter((o) => o.collected < o.target).map((o) => o.reward);

  const [tiles, setTiles] = useState<TileContent[][]>(() =>
    makeTiles(DEFAULT_SETTINGS, objectivesRef.current.map((o) => o.reward)),
  );
  const [active, setActive] = useState<MovingNumber[]>([]);
  const [blasts, setBlasts] = useState<BlastEffect[]>([]);
  const [tally, setTally] = useState(0);
  const [tallyHistory, setTallyHistory] = useState<number[]>([]);
  const [status, setStatus] = useState<"idle" | "playing" | "gameover" | "levelcomplete">("idle");

  const idRef = useRef(1);
  const nextSpawnAtRef = useRef<number[]>(Array(ROWS).fill(0));
  const activeRef = useRef<MovingNumber[]>([]);
  activeRef.current = active;

  const startLevel = useCallback((lvl: number) => {
    setLevel(lvl);
    setMisses(0);
    const objs = pickObjectives(lvl);
    setObjectives(objs);
    objectivesRef.current = objs;
    setTiles(makeTiles(settingsRef.current, objs.map((o) => o.reward)));
    setActive([]);
    setTally(0);
    setTallyHistory([]);
    setStatus("playing");
    const now = performance.now();
    const s = settingsRef.current;
    const stepMs = (s.durationSec * 1000) / COLS;
    // Staggered start: row 0 spawns immediately, row 1 after one step, etc.
    nextSpawnAtRef.current = Array.from({ length: ROWS }, (_, r) => now + r * stepMs);
  }, []);

  const restart = useCallback(() => {
    setScore(0);
    startLevel(1);
  }, [startLevel]);

  const spawnInRow = useCallback((row: number, now: number) => {
    const s = settingsRef.current;
    const value = Math.floor(Math.random() * (s.maxVal - s.minVal + 1)) + s.minVal;
    setActive((prev) => {
      if (prev.some((n) => n.row === row)) return prev;
      return [...prev, { id: idRef.current++, row, value, col: 0, lastStepAt: now }];
    });
  }, []);

  // Game loop: per-row staggered spawn, step, miss
  useEffect(() => {
    let raf = 0;
    const loop = () => {
      const s = settingsRef.current;
      if (!s.paused && status === "playing") {
        const now = performance.now();
        const stepMs = (s.durationSec * 1000) / COLS;

        // Spawn in any empty row whose timer has elapsed
        for (let r = 0; r < Math.min(s.maxRows, ROWS); r++) {
          const occupied = activeRef.current.some((n) => n.row === r);
          if (!occupied && now >= nextSpawnAtRef.current[r]) {
            spawnInRow(r, now);
          }
        }

        // Step movement — diff synchronously to count misses (StrictMode-safe)
        const prevActive = activeRef.current;
        const nextActive: MovingNumber[] = [];
        let missedThisFrame = 0;
        for (const n of prevActive) {
          if (now - n.lastStepAt >= stepMs) {
            const newCol = n.col + 1;
            if (newCol >= COLS) {
              missedThisFrame++;
              nextSpawnAtRef.current[n.row] = now + 400;
              continue;
            }
            nextActive.push({ ...n, col: newCol, lastStepAt: now });
          } else {
            nextActive.push(n);
          }
        }
        if (nextActive.length !== prevActive.length || missedThisFrame > 0 ||
            nextActive.some((n, i) => n !== prevActive[i])) {
          activeRef.current = nextActive;
          setActive(nextActive);
        }
        if (missedThisFrame > 0) {
          setMisses((m) => {
            const newM = m + missedThisFrame;
            if (newM >= s.missLimit) setStatus("gameover");
            return newM;
          });
        }
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [status, spawnInRow]);

  useEffect(() => {
    if (status !== "playing") return;
    if (objectives.length && objectives.every((o) => o.collected >= o.target)) {
      // Sweep all remaining coin tiles into the wallet with flying animations
      const grid = tiles;
      let swept = 0;
      const events: { id: number; reward: RewardKind; row: number; col: number }[] = [];
      for (let r = 0; r < grid.length; r++) {
        for (let c = 0; c < grid[r].length; c++) {
          const t = grid[r][c];
          if (t.type === "reward" && t.reward === "coin") {
            swept++;
            events.push({ id: idRef.current++, reward: "coin", row: r, col: c });
          }
        }
      }
      if (swept > 0) {
        setCoinsEarned((c) => c + swept);
        setSweptCoins(swept);
        setCollectEvents((prev) => [...prev, ...events]);
        const ids = new Set(events.map((e) => e.id));
        setTimeout(() => setCollectEvents((prev) => prev.filter((e) => !ids.has(e.id))), 1200);
      } else {
        setSweptCoins(0);
      }
      setStatus("levelcomplete");
      setScore((s) => s + 100 * level);
    }
  }, [objectives, status, level, tiles]);

  const [sweptCoins, setSweptCoins] = useState(0);

  const [collectEvents, setCollectEvents] = useState<
    { id: number; reward: RewardKind; row: number; col: number }[]
  >([]);

  const collectReward = useCallback((r: RewardKind, row: number, col: number) => {
    if (r === "coin") setCoinsEarned((c) => c + 1);
    setObjectives((prev) => prev.map((o) => (o.reward === r ? { ...o, collected: o.collected + 1 } : o)));
    setScore((s) => s + 10);
    const eid = idRef.current++;
    setCollectEvents((prev) => [...prev, { id: eid, reward: r, row, col }]);
    setTimeout(() => setCollectEvents((prev) => prev.filter((e) => e.id !== eid)), 900);
  }, []);


  const replaceTile = useCallback((row: number, col: number) => {
    setTiles((prev) => {
      const next = prev.map((r) => [...r]);
      next[row][col] = rollTile(settingsRef.current, objectiveRewards());
      return next;
    });
  }, []);

  const triggerBlast = useCallback(
    (kind: BombKind, row: number, col: number) => {
      const cells: { row: number; col: number }[] = [];
      if (kind === "horizontal") {
        for (let c = 0; c < COLS; c++) cells.push({ row, col: c });
      } else if (kind === "vertical") {
        for (let r = 0; r < ROWS; r++) cells.push({ row: r, col });
      } else if (kind === "diagonal") {
        for (let d = -Math.max(ROWS, COLS); d <= Math.max(ROWS, COLS); d++) {
          const r1 = row + d, c1 = col + d;
          const r2 = row + d, c2 = col - d;
          if (r1 >= 0 && r1 < ROWS && c1 >= 0 && c1 < COLS) cells.push({ row: r1, col: c1 });
          if (r2 >= 0 && r2 < ROWS && c2 >= 0 && c2 < COLS && d !== 0) cells.push({ row: r2, col: c2 });
        }
      } else if (kind === "area") {
        for (let dr = -2; dr <= 2; dr++)
          for (let dc = -2; dc <= 2; dc++) {
            const r = row + dr, c = col + dc;
            if (r >= 0 && r < ROWS && c >= 0 && c < COLS) cells.push({ row: r, col: c });
          }
      }
      const blastId = idRef.current++;
      setBlasts((b) => [...b, { id: blastId, cells, startedAt: performance.now() }]);
      setTimeout(() => setBlasts((b) => b.filter((x) => x.id !== blastId)), 700);

      // Collect items in cells and regenerate tiles
      setTiles((prev) => {
        const next = prev.map((r) => [...r]);
        cells.forEach(({ row: r, col: c }) => {
          const t = next[r][c];
          if (t.type === "reward") collectReward(t.reward, r, c);
          next[r][c] = rollTile(settingsRef.current, objectiveRewards());
        });
        return next;
      });
      // Remove numbers in affected rows
      const rowsHit = new Set(cells.map((c) => c.row));
      const now = performance.now();
      setActive((prev) => {
        const removed = prev.filter((n) => rowsHit.has(n.row));
        setScore((s) => s + 25 * removed.length);
        removed.forEach((n) => {
          nextSpawnAtRef.current[n.row] = now + 400;
        });
        return prev.filter((n) => !rowsHit.has(n.row));
      });
    },
    [collectReward],
  );

  const submitValue = useCallback(
    (value: number): boolean => {
      if (status !== "playing" || value <= 0) return false;
      const match = activeRef.current.find((n) => n.value === value);
      if (!match) return false;
      const col = match.col;
      const tile = tiles[match.row][col];
      const now = performance.now();
      setActive((prev) => prev.filter((n) => n.id !== match.id));
      nextSpawnAtRef.current[match.row] = now + 400;
      if (tile.type === "bomb") {
        triggerBlast(tile.bomb, match.row, col);
      } else {
        collectReward(tile.reward, match.row, col);
        replaceTile(match.row, col);
      }
      return true;
    },
    [status, tiles, triggerBlast, collectReward, replaceTile],
  );

  const submit = useCallback(() => {
    if (tally === 0) return false;
    const ok = submitValue(tally);
    setTally(0);
    setTallyHistory([]);
    return ok;
  }, [tally, submitValue]);

  const addOne = useCallback(() => {
    setTally((t) => t + 1);
    setTallyHistory((h) => [...h, 1]);
  }, []);
  const addFive = useCallback(() => {
    setTally((t) => t + 5);
    setTallyHistory((h) => [...h, 5]);
  }, []);
  const undo = useCallback(() => {
    setTallyHistory((h) => {
      if (!h.length) return h;
      const last = h[h.length - 1];
      setTally((t) => Math.max(0, t - last));
      return h.slice(0, -1);
    });
  }, []);
  const clear = useCallback(() => {
    setTally(0);
    setTallyHistory([]);
  }, []);

  const updateSettings = useCallback((patch: Partial<Settings>) => {
    setSettings((s) => ({ ...s, ...patch }));
  }, []);

  const setDifficulty = useCallback(
    (minVal: number, maxVal: number) => {
      // Synchronously mutate ref so the next loop frame sees new range
      settingsRef.current = { ...settingsRef.current, minVal, maxVal };
      setSettings((s) => ({ ...s, minVal, maxVal }));
      setScore(0);
      startLevel(1);
    },
    [startLevel],
  );

  const nextLevel = useCallback(() => {
    setSettings((s) => ({ ...s, durationSec: Math.max(20, s.durationSec - 5) }));
    startLevel(level + 1);
  }, [level, startLevel]);

  // Backwards-compat: revealed grid (computed) — tile hidden when a number occupies it
  const revealed = useMemo(() => {
    const grid = Array.from({ length: ROWS }, () => Array(COLS).fill(true));
    active.forEach((n) => {
      if (n.col >= 0 && n.col < COLS) grid[n.row][n.col] = false;
    });
    return grid;
  }, [active]);

  return {
    settings,
    updateSettings,
    level,
    score,
    misses,
    coinsEarned,
    sweptCoins,
    tiles,
    revealed,
    active,
    objectives,
    blasts,
    collectEvents,
    tally,
    status,
    addOne,
    addFive,
    undo,
    clear,
    submit,
    restart,
    nextLevel,
    setDifficulty,
    submitValue,
  };
}
