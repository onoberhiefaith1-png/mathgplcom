/**
 * ENVIRONMENT NORMALISATION.
 *
 * A saved building environment is the source of truth for rendering. Older
 * records were written before newer surface fields existed, so instead of
 * replacing a partial record with the defaults (which silently turns a custom
 * corridor white), we merge it field-by-field over DEFAULT_ENVIRONMENT: every
 * saved value wins, only genuinely missing fields fall back.
 */
import {
  DEFAULT_ENVIRONMENT,
  type DoorDesign,
  type EffectsSettings,
  type EnvironmentSettings,
  type LightingSettings,
  type SurfaceDesign,
} from "./types";

type Loose = Record<string, unknown> | null | undefined;

const obj = (v: unknown): Record<string, unknown> =>
  v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : {};

const pick = <T,>(v: unknown, fallback: T, ok: (x: unknown) => boolean): T =>
  ok(v) ? (v as T) : fallback;

const num = (v: unknown, fallback: number) =>
  pick<number>(v, fallback, (x) => typeof x === "number" && Number.isFinite(x));
const str = (v: unknown, fallback: string) =>
  pick<string>(v, fallback, (x) => typeof x === "string" && x.length > 0);
const bool = (v: unknown, fallback: boolean) => pick<boolean>(v, fallback, (x) => typeof x === "boolean");

const mergeSurface = (raw: unknown, base: SurfaceDesign): SurfaceDesign => {
  const s = obj(raw);
  const tex = obj(s.texture);
  return {
    preset: str(s.preset, base.preset),
    color: str(s.color, base.color),
    texture:
      s.texture === null
        ? null
        : typeof tex.path === "string" && tex.path.length > 0
          ? { path: tex.path }
          : base.texture,
    scale: num(s.scale, base.scale),
    offsetX: num(s.offsetX, base.offsetX),
    offsetY: num(s.offsetY, base.offsetY),
    repeat: bool(s.repeat, base.repeat),
    fit: s.fit === "stretch" || s.fit === "cover" ? s.fit : base.fit,
  };
};

const mergeDoor = (raw: unknown, base: DoorDesign): DoorDesign => {
  const d = obj(raw);
  const tex = obj(d.texture);
  return {
    preset: str(d.preset, base.preset),
    color: str(d.color, base.color),
    texture:
      d.texture === null
        ? null
        : typeof tex.path === "string" && tex.path.length > 0
          ? { path: tex.path }
          : base.texture,
    brightness: num(d.brightness, base.brightness),
    style: str(d.style, base.style),
  };
};

const mergeLighting = (raw: unknown, base: LightingSettings): LightingSettings => {
  const l = obj(raw);
  return {
    brightness: num(l.brightness, base.brightness),
    ambient: num(l.ambient, base.ambient),
    intensity: num(l.intensity, base.intensity),
    atmosphere: bool(l.atmosphere, base.atmosphere),
  };
};

const mergeEffects = (raw: unknown, base: EffectsSettings): EffectsSettings => {
  const e = obj(raw);
  return {
    enabled: bool(e.enabled, base.enabled),
    effect: typeof e.effect === "string" && e.effect.length > 0 ? e.effect : e.effect === undefined ? base.effect : null,
  };
};

/** Merge a saved (possibly partial or legacy) environment over the defaults. */
export function mergeEnvironment(raw: Loose | EnvironmentSettings): EnvironmentSettings {
  const e = obj(raw);
  return {
    leftWall: mergeSurface(e.leftWall, DEFAULT_ENVIRONMENT.leftWall),
    rightWall: mergeSurface(e.rightWall, DEFAULT_ENVIRONMENT.rightWall),
    floor: mergeSurface(e.floor, DEFAULT_ENVIRONMENT.floor),
    roof: mergeSurface(e.roof, DEFAULT_ENVIRONMENT.roof),
    door: mergeDoor(e.door, DEFAULT_ENVIRONMENT.door),
    lighting: mergeLighting(e.lighting, DEFAULT_ENVIRONMENT.lighting),
    effects: mergeEffects(e.effects, DEFAULT_ENVIRONMENT.effects),
  };
}

/**
 * Light budget for a corridor. Administrators can brighten a hallway, but the
 * combined contribution is clamped so an extreme saved brightness can never
 * flatten every surface to white and hide the chosen materials.
 */
export interface LightBudget {
  ambient: number;
  hemisphere: number;
  directional: number;
  /** Per-hallway accent lights, so a long corridor is lit but not washed out. */
  point: number;
}

export function lightBudget(l: LightingSettings): LightBudget {
  const brightness = Math.min(2, Math.max(0.2, l.brightness));
  return {
    ambient: Math.min(0.18, Math.max(0, l.ambient) * 0.18 * brightness),
    hemisphere: Math.min(0.16, 0.12 * brightness),
    directional: Math.min(0.4, Math.max(0, l.intensity) * 0.22 * brightness),
    point: Math.min(0.45, 0.28 * brightness),
  };
}

/** Default name of a hallway endpoint when the administrator has not set one. */
export const DEFAULT_ENDPOINT_NAME = "Building Exit";
