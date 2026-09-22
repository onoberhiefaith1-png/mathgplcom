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

/** Legacy editor-width reference; Game Play uses the live viewport instead. */
export const GAME_WRITING_WIDTH = SLATE_W * 0.9;

/** Keeps a Game Play surface inside 5% margins of the live viewport. */
export const gameWritingWidth = (visibleWorldWidth: number) =>
  Math.max(0.8, visibleWorldWidth * 0.9);

/** Shared Edit/Play writing span after room architecture restricts the viewport band. */
export const gameSafeWritingWidth = (
  visibleWorldWidth: number,
  roomSafeWidth = Infinity,
) => Math.min(gameWritingWidth(visibleWorldWidth), roomSafeWidth);

/**
 * The one horizontal coordinate system used by Game surfaces, text, hit areas,
 * rewards and their travel. It is centred on the fixed camera axis; room
 * projection may narrow it, but no child is allowed to invent another span.
 */
export interface GameWritingBand {
  width: number;
  left: number;
  right: number;
  centre: number;
}

export const gameWritingBand = (
  visibleWorldWidth: number,
  roomSafeWidth = Infinity,
): GameWritingBand => {
  const width = gameSafeWritingWidth(visibleWorldWidth, roomSafeWidth);
  return { width, left: -width / 2, right: width / 2, centre: 0 };
};

/** Places a percentage-positioned object's complete visible body in the band. */
export const gameBandPosition = (
  percent: number,
  band: GameWritingBand,
  visualWidth = 0,
) => {
  const half = Math.min(band.width / 2, Math.max(0, visualWidth) / 2);
  const requested = band.left + (Math.min(100, Math.max(0, percent)) / 100) * band.width;
  return Math.min(band.right - half, Math.max(band.left + half, requested));
};

/** Maximum travel before a moving object's visible edge reaches the band. */
export const gameBandTravel = (
  origin: number,
  direction: number,
  band: GameWritingBand,
  visualWidth = 0,
) => {
  const half = Math.min(band.width / 2, Math.max(0, visualWidth) / 2);
  return direction >= 0
    ? Math.max(0, band.right - half - origin)
    : Math.max(0, origin - (band.left + half));
};

/** Inner text width after reserving the physical surface's left/right padding. */
export const gameInnerWritingWidth = (
  surfaceMaxWidth: number,
  horizontalPadding: number,
) => Math.max(0.2, surfaceMaxWidth - Math.max(0, horizontalPadding) * 2);

export const gameSurfacePadding = (fontSize: number) => ({
  x: Math.max(0.18, Math.min(0.34, fontSize / 520)),
  y: Math.max(0.13, Math.min(0.26, fontSize / 650)),
});

/** Each Play surface follows its own content, capped by the 5%–95% writing band. */
export const gameSurfaceWidth = (
  writingWidth: number,
  contentWidth: number,
) => Math.min(writingWidth, contentWidth);

/**
 * Stable first-pass width for live Game text. This breaks the measurement
 * cycle where a compact panel forced the renderer to wrap before it could
 * report that the panel needed to grow.
 */
export const gameEstimatedTextWidth = (
  text: string,
  fontSize: number,
  maximumWidth: number,
) => {
  const longestLine = text
    .split("\n")
    .reduce((longest, line) => Math.max(longest, Array.from(line).length), 0);
  const estimatedGlyphWidth = (Math.max(1, fontSize) / PX_PER_UNIT) * 0.58;
  return Math.min(Math.max(0, maximumWidth), longestLine * estimatedGlyphWidth);
};

export const gameEstimatedTextLineCount = (
  text: string,
  fontSize: number,
  width: number,
): number => countLines(text, fontSize, width);

export const gameEstimatedTextHeight = (
  text: string,
  fontSize: number,
  width: number,
  lineSpacing = 1.25,
): number => {
  const rowH = Math.max(0.16, (fontSize * Math.max(1, lineSpacing)) / PX_PER_UNIT);
  return Math.max(rowH, gameEstimatedTextLineCount(text, fontSize, width) * rowH);
};

export interface GameSurfaceBoxInput {
  text: string;
  hiddenContent?: string;
  fontSize: number;
  lineSpacing?: number;
  writingWidth: number;
  readOnlyWriting: boolean;
  inset: number;
  measuredWidth?: number;
  measuredHeight?: number;
}

export interface GameSurfaceBox {
  padX: number;
  padY: number;
  surfaceWidth: number;
  innerWritingWidth: number;
  surfaceHeight: number;
}

/**
 * One calculation for the physical panel and its local writing box. The same
 * result is used for rendering and layout, so a growing panel cannot visually
 * collide with the next line while the layout still thinks the old height fits.
 */
export const gameSurfaceBox = ({
  text,
  hiddenContent = "",
  fontSize,
  lineSpacing = 1.25,
  writingWidth,
  readOnlyWriting,
  inset,
  measuredWidth = 0,
  measuredHeight = 0,
}: GameSurfaceBoxInput): GameSurfaceBox => {
  const { x: padX, y: padY } = gameSurfacePadding(fontSize);
  const content = text || hiddenContent || "";
  const emptyWidth = Math.max(0.9, fontSize / 145);
  const minimumWidth = Math.max(inset * 2 + 0.32, emptyWidth);
  const estimatedTextWidth = gameEstimatedTextWidth(
    content,
    fontSize,
    gameInnerWritingWidth(writingWidth, padX),
  );
  const contentSurfaceWidth = Math.max(
    minimumWidth,
    estimatedTextWidth + padX * 2,
    Math.max(0, measuredWidth) + padX * 2,
  );
  // Edit and Play are deliberately identical here. `readOnlyWriting` remains
  // in the input for saved-call compatibility, but can never open a second,
  // screen-wide text box that escapes the physical surface.
  void readOnlyWriting;
  const surfaceWidth = gameSurfaceWidth(writingWidth, contentSurfaceWidth);
  const innerWritingWidth = gameInnerWritingWidth(surfaceWidth, padX);
  const estimatedTextHeight = gameEstimatedTextHeight(
    content,
    fontSize,
    innerWritingWidth,
    lineSpacing,
  );
  const surfaceHeight = Math.max(
    Math.max(0.42, fontSize / 175),
    estimatedTextHeight + padY * 2,
    Math.max(0, measuredHeight) + padY * 2,
  );

  return { padX, padY, surfaceWidth, innerWritingWidth, surfaceHeight };
};


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

const countLines = (text: string, fontSize: number, width: number) => {
  const perLine = Math.max(12, Math.floor((width * PX_PER_UNIT) / (fontSize * 0.58)));
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
  /** Exact renderer width, so estimated and measured wrapping share edges. */
  writingWidth = INNER_W,
  /** Play starts at minimum size and waits for exact renderer bounds. */
  estimateUnmeasured = true,
  lineSpacing = 1.25,
  /** Minimum actual rendered surface heights, keyed by slot id. */
  renderedSurfaceHeights: Record<string, number> = {},
): SlateLayout => {
  let cursor = 0.5;
  // one line of text, in world units — scales with the chosen size so a very
  // large equation reserves the right space before it has been measured
  const rowH = Math.max(0.16, (fontSize * Math.max(1, lineSpacing)) / PX_PER_UNIT);
  const regions = slots.map((slot, index) => {
    const estimate = estimateUnmeasured
      ? gameEstimatedTextHeight(slot.text || slot.hiddenContent || "", fontSize, writingWidth, lineSpacing)
      : rowH;
    const real = measured[slot.id];
    const textHeight = REGION_PAD * 2 + Math.max(rowH, real !== undefined && real > 0 ? real : estimate);
    const height = Math.max(textHeight, renderedSurfaceHeights[slot.id] ?? 0);
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
