// The staged timeline every effect is built on.
//
// PRE-CHARGE -> ANTICIPATION -> ACTIVATION -> PRIMARY IMPACT ->
// SECONDARY -> TRAIL/DEBRIS -> RESOLUTION
//
// Each stage owns its own duration, easing and optional sound trigger, so an
// effect describes *when* things happen once and then reads normalised
// progress out of the timeline every frame.

import type { SfxName } from "@/lib/slate/audio";

export type StageName =
  | "pre-charge"
  | "anticipation"
  | "activation"
  | "impact"
  | "secondary"
  | "trail"
  | "resolution";

export type Easing = (t: number) => number;

export const clamp01 = (v: number) => Math.min(1, Math.max(0, v));
export const easeOut = (t: number) => 1 - Math.pow(1 - clamp01(t), 3);
export const easeIn = (t: number) => Math.pow(clamp01(t), 2.4);
export const easeInOut = (t: number) =>
  clamp01(t) < 0.5 ? 2 * clamp01(t) * clamp01(t) : 1 - Math.pow(-2 * clamp01(t) + 2, 2) / 2;
export const linear = (t: number) => clamp01(t);

export interface StageSpec {
  name: StageName;
  duration: number;
  ease?: Easing;
  /** Fired once, the first frame the timeline enters this stage. */
  sound?: SfxName;
}

export interface StageWindow {
  name: StageName;
  start: number;
  end: number;
  ease: Easing;
  sound?: SfxName | undefined;
}

export class StageTimeline {
  readonly windows: StageWindow[] = [];
  readonly total: number;
  private entered = new Set<StageName>();

  constructor(stages: StageSpec[]) {
    let cursor = 0;
    for (const stage of stages) {
      this.windows.push({
        name: stage.name,
        start: cursor,
        end: cursor + stage.duration,
        ease: stage.ease ?? linear,
        sound: stage.sound,
      });
      cursor += stage.duration;
    }
    this.total = cursor;
  }

  window(name: StageName) {
    return this.windows.find((w) => w.name === name) ?? null;
  }

  /** Absolute start time of a stage, for positioning things between stages. */
  at(name: StageName) {
    return this.window(name)?.start ?? 0;
  }

  /** 0 before the stage, eased 0..1 inside it, 1 after it. */
  progress(name: StageName, t: number) {
    const w = this.window(name);
    if (!w) return 0;
    if (t <= w.start) return 0;
    if (t >= w.end) return 1;
    return w.ease((t - w.start) / Math.max(0.0001, w.end - w.start));
  }

  /** True only while the playhead sits inside the stage. */
  inside(name: StageName, t: number) {
    const w = this.window(name);
    return !!w && t >= w.start && t < w.end;
  }

  /** Returns the stage entered on this frame, once per stage. */
  entering(t: number): StageWindow | null {
    for (const w of this.windows) {
      if (t >= w.start && !this.entered.has(w.name)) {
        this.entered.add(w.name);
        return w;
      }
    }
    return null;
  }

  reset() {
    this.entered.clear();
  }
}
