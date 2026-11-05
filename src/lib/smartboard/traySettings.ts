// The writing tray used to be the Flow "trail", edited on each lesson-note flow.
// It now belongs to the Smartboard. One setting follows the pointer on the board.

import { DEFAULT_TRAIL, type TrailSettings } from "@/lib/flow/types";

export const TRAY_STORAGE_KEY = "smartboard:tray";

export type TrayMode = "solution" | "always";

export interface TraySettings {
  /** Off until the teacher wants the tray, or on from a saved choice. */
  enabled: boolean;
  /** Only while the board is in a solution, or on the whole lesson. */
  mode: TrayMode;
  color: string;
  /** 0..1 how long the ribbon behind the pointer is. */
  length: number;
  /** 0..1 stroke width. */
  width: number;
  /** 0..1 how quickly the ribbon grows toward the pointer. */
  speed: number;
  /** 0..1 side-to-side wobble. */
  vibration: number;
  /** 0..1 soft halo. */
  glow: number;
  /** Seconds the ribbon takes to shrink after the pointer rests. */
  fadeSec: number;
}

export const DEFAULT_TRAY: TraySettings = {
  enabled: false,
  mode: "solution",
  color: DEFAULT_TRAIL.color,
  length: DEFAULT_TRAIL.length,
  width: DEFAULT_TRAIL.thickness,
  speed: 0.55,
  vibration: DEFAULT_TRAIL.vibration,
  glow: DEFAULT_TRAIL.glow,
  fadeSec: DEFAULT_TRAIL.fadeSec,
};

const unit = (value: unknown, fallback: number): number => {
  const n = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(1, Math.max(0, n));
};

const hex = (value: unknown, fallback: string): string =>
  typeof value === "string" && /^#[0-9a-fA-F]{6}$/.test(value) ? value : fallback;

export const normalizeTraySettings = (raw: unknown): TraySettings => {
  const row = raw && typeof raw === "object" ? (raw as Partial<TraySettings>) : {};
  const fade = typeof row.fadeSec === "number" ? row.fadeSec : Number(row.fadeSec);
  return {
    enabled: row.enabled === true,
    mode: row.mode === "always" ? "always" : "solution",
    color: hex(row.color, DEFAULT_TRAY.color),
    length: unit(row.length, DEFAULT_TRAY.length),
    width: unit(row.width, DEFAULT_TRAY.width),
    speed: unit(row.speed, DEFAULT_TRAY.speed),
    vibration: unit(row.vibration, DEFAULT_TRAY.vibration),
    glow: unit(row.glow, DEFAULT_TRAY.glow),
    fadeSec: Number.isFinite(fade) ? Math.min(5, Math.max(0.3, fade)) : DEFAULT_TRAY.fadeSec,
  };
};

export const loadTraySettings = (storage: Pick<Storage, "getItem">): TraySettings => {
  try {
    const raw = storage.getItem(TRAY_STORAGE_KEY);
    if (!raw) return { ...DEFAULT_TRAY };
    return normalizeTraySettings(JSON.parse(raw));
  } catch {
    return { ...DEFAULT_TRAY };
  }
};

export const saveTraySettings = (storage: Pick<Storage, "setItem">, settings: TraySettings): void => {
  storage.setItem(TRAY_STORAGE_KEY, JSON.stringify(normalizeTraySettings(settings)));
};

/** The tray draws only when it is switched on, and only in the chosen moments. */
export const trayIsActive = (settings: TraySettings, inSolution: boolean): boolean => {
  if (!settings.enabled) return false;
  if (settings.mode === "always") return true;
  return inSolution;
};

/**
 * Solution session on the Smartboard: a solution step, the example-solution
 * phase, or Floating Numbers (#), which is the solution-writing tool.
 */
export const boardInSolution = (input: {
  phase?: string | null;
  beatKind?: string | null;
  numbersOn?: boolean;
}): boolean =>
  input.phase === "example-step" || input.beatKind === "solution-step" || input.numbersOn === true;

/** Shape the existing ribbon renderer already understands. */
export const trayToTrail = (settings: TraySettings): TrailSettings => ({
  color: settings.color,
  length: settings.length,
  thickness: settings.width,
  glow: settings.glow,
  vibration: settings.vibration,
  fadeSec: settings.fadeSec,
  speed: settings.speed,
});
