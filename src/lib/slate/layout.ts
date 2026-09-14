// Layout of the physical slate column.
//
// The slate is ONE long object. Its height comes from the number of writing
// regions and how much has been written in them. The camera and room never
// move; this object slides vertically through the fixed viewpoint.

import type { Slot } from "./types";

/** Slate body width in world units. */
export const SLATE_W = 6.6;
/** Slate depth (real thickness). */
export const SLATE_D = 0.34;
/** Distance of the slate from the camera plane. */
export const SLATE_Z = -5.55;
/** Front face of the slate body, relative to the slate group. */
export const SLATE_FRONT = SLATE_D / 2;

/** Vertical window the fixed camera can actually see. */
export const VIEW_TOP = 2.75;
export const VIEW_BOTTOM = -2.75;
export const VIEW_H = VIEW_TOP - VIEW_BOTTOM;

/** CSS pixels per world unit for surface-attached DOM (text). */
export const PX_PER_UNIT = 220;

/** Writable width inside the slate frame. */
export const INNER_W = SLATE_W - 0.9;
export const TEXT_W_PX = Math.round(INNER_W * PX_PER_UNIT);

const ROW_H = 0.3;
const REGION_PAD = 0.36;

export interface RegionLayout {
  slot: Slot;
  index: number;
  /** Distance from the top of the slate to the top of this region. */
  top: number;
  /** Region height in world units. */
  height: number;
  /** Centre of the region, measured down from the top of the slate. */
  centre: number;
}

export interface SlateLayout {
  regions: RegionLayout[];
  /** Full physical length of the slate. */
  total: number;
  /** How far the slate can travel before its end reaches the viewport. */
  maxScroll: number;
}

const countLines = (text: string, fontSize: number) => {
  const perLine = Math.max(12, Math.floor(TEXT_W_PX / (fontSize * 0.58)));
  return text
    .split("\n")
    .reduce((sum, line) => sum + Math.max(1, Math.ceil(line.length / perLine)), 0);
};

/** Builds the physical layout of the whole slate from the slot list. */
export const buildLayout = (
  slots: Slot[],
  fontSize: number,
  spacing = 0.12,
  /** Measured height of the rendered 3D text, per slot id, in world units. */
  measured: Record<string, number> = {},
): SlateLayout => {
  let cursor = 0.5;
  const regions = slots.map((slot, index) => {
    const lines = Math.max(1, countLines(slot.text || slot.hiddenContent || "", fontSize));
    const estimate = lines * ROW_H;
    const real = measured[slot.id];
    const height = REGION_PAD * 2 + Math.max(ROW_H, real !== undefined && real > 0 ? real : estimate);
    const region: RegionLayout = {
      slot,
      index,
      top: cursor,
      height,
      centre: cursor + height / 2,
    };
    cursor += height + spacing;
    return region;
  });
  const total = cursor + 0.5;
  return { regions, total, maxScroll: Math.max(0, total - VIEW_H) };
};

/** World Y of a point measured down from the top of the slate. */
export const worldY = (down: number, scroll: number) => VIEW_TOP + scroll - down;
