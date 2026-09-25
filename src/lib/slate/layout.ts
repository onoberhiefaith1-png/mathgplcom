// Layout of the physical slate column.
//
// The slate is ONE long object. Its height comes from the number of writing
// regions and how much has been written in them. The camera and room never
// move; this object slides vertically through the fixed viewpoint.

import type { Slot } from "./types";
import type { TextVisualInsets } from "./textPresets";

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

/** Equal visible clearance above the first mark and below the last mark. */
export const gameVerticalContentMargin = (fontSize: number) =>
  gameSurfacePadding(fontSize).y;

/* ── Content Margin ──────────────────────────────────────────────────────
 * THE writing surface starts where it starts: its left edge never moves. The
 * Content Margin is an internal control that decides where the WRITING
 * begins inside that surface. Moving it moves the text, never the surface.
 * The right edge is content-driven: it provides exactly the room the margin
 * plus the actual rendered text plus padding need, and gives it back when
 * they need less.
 */

/** Largest share of the writing band the margin may take. */
export const CONTENT_MARGIN_MAX = 0.5;

/** Smallest writing width left after a margin, in world units. */
export const MIN_CONTENT_WIDTH = 0.4;

export const clampContentMargin = (fraction: number | undefined) =>
  Math.min(CONTENT_MARGIN_MAX, Math.max(0, Number.isFinite(fraction) ? (fraction as number) : 0));

/** The margin in world units for a given writing band. */
export const contentMarginWorld = (fraction: number | undefined, writingWidth: number) =>
  clampContentMargin(fraction) * Math.max(0, writingWidth);

/** One ordinary glyph of breathing room after the margin line. */
export const contentCharacterGap = (fontSize: number) =>
  Math.max(0.04, (Math.max(1, fontSize) / PX_PER_UNIT) * 0.58);


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
  visualInsets?: TextVisualInsets;
  /** Where the writing begins inside the surface, in world units. */
  contentMargin?: number;
  /** Decorative rolled/folded part of the surface: never a writing area. */
  foldInset?: number;
  /** Fixed strip at the surface's own start that carries the Line tag. */
  tagGutter?: number;
  /** Shared distance from the fixed surface start to the straight margin line. */
  contentStartInset?: number;
  /** Clear space between the margin line and the first visible glyph. */
  contentGap?: number;
}

export interface GameSurfaceBox {
  padX: number;
  padY: number;
  surfaceWidth: number;
  innerWritingWidth: number;
  surfaceHeight: number;
  /** The margin actually applied after clamping to the usable width. */
  contentMargin: number;
  /** The tag strip actually reserved at the surface's start. */
  tagGutter: number;
  /** Shared straight-line position measured from the fixed surface start. */
  contentStartInset: number;
  /** Clear space after the margin line. */
  contentGap: number;
  /**
   * Centre of the content box relative to the surface centre. Renderers place
   * their local writing box here, so the one margin decides the start of every
   * line and nothing has to re-derive it.
   */
  contentOffsetX: number;
}

export interface WritingSurfaceFrame extends GameSurfaceBox {
  slotId: string;
  x: number;
  outerLeft: number;
  outerRight: number;
  innerLeft: number;
  innerRight: number;
  innerTop: number;
  innerBottom: number;
}

/** One authoritative frame consumed by panel, text, pointer bed and diagnostics. */
export const writingSurfaceFrame = (
  slotId: string,
  box: GameSurfaceBox,
  band: GameWritingBand,
): WritingSurfaceFrame => {
  const x = band.left + box.surfaceWidth / 2;
  return {
    ...box,
    slotId,
    x,
    // RULE 1. The left edge is fixed: it is the band's left edge, whatever the
    // margin is. RULE 3. The right edge follows the content.
    outerLeft: band.left,
    outerRight: band.left + box.surfaceWidth,
    // RULE 2. The margin moves the writing, inside the same surface. The tag
    // strip sits before the margin and never moves with it.
    innerLeft: band.left + box.contentStartInset + box.contentMargin + box.contentGap,
    innerRight: band.left + box.surfaceWidth - box.padX,
    innerTop: box.surfaceHeight / 2 - box.padY,
    innerBottom: -box.surfaceHeight / 2 + box.padY,
  };
};



/* ── Text-In-Surface Layout ──────────────────────────────────────────────
 * THE one rule for where mathematical text is allowed to sit. The writing
 * surface is the authoritative boundary; a text body that reports itself
 * outside its surface is moved to the nearest valid place inside it. Edit,
 * Teacher Play, Student Play, reload and preview all run this same rule on
 * every measurement, so no stale or legacy placement can survive a frame.
 */
export interface TextBox {
  left: number;
  right: number;
  top: number;
  bottom: number;
}

export interface TextContainment {
  dx: number;
  dy: number;
  /** False when the body is genuinely wider/taller than the usable area. */
  fits: boolean;
}

/** Tolerance in world units: below this the body counts as already inside. */
export const TEXT_INSIDE_TOLERANCE = 0.006;

export const textInsideSurface = (body: TextBox, inner: TextBox) =>
  body.left >= inner.left - TEXT_INSIDE_TOLERANCE &&
  body.right <= inner.right + TEXT_INSIDE_TOLERANCE &&
  body.top <= inner.top + TEXT_INSIDE_TOLERANCE &&
  body.bottom >= inner.bottom - TEXT_INSIDE_TOLERANCE;

const containAxis = (low: number, high: number, limitLow: number, limitHigh: number) => {
  if (high - low > limitHigh - limitLow + 0.001) return { shift: limitLow - low, fits: false };
  let shift = 0;
  if (low < limitLow) shift = limitLow - low;
  if (high + shift > limitHigh) shift -= high + shift - limitHigh;
  return { shift, fits: true };
};

/** Nearest valid placement of a text body inside its surface's usable area. */
export const containTextInSurface = (body: TextBox, inner: TextBox): TextContainment => {
  const horizontal = containAxis(body.left, body.right, inner.left, inner.right);
  const vertical = containAxis(body.bottom, body.top, inner.bottom, inner.top);
  return {
    dx: horizontal.shift,
    dy: vertical.shift,
    fits: horizontal.fits && vertical.fits,
  };
};

/** Usable inner area of a surface, in that surface's own local coordinates. */
export const surfaceInnerBox = (
  innerWritingWidth: number,
  surfaceHeight: number,
  padY: number,
): TextBox => ({
  left: -innerWritingWidth / 2,
  right: innerWritingWidth / 2,
  top: surfaceHeight / 2 - padY,
  bottom: -surfaceHeight / 2 + padY,
});

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
  visualInsets = { left: 0, right: 0, top: 0, bottom: 0 },
  contentMargin = 0,
  foldInset = 0,
  tagGutter = 0,
  contentStartInset,
  contentGap = 0,
}: GameSurfaceBoxInput): GameSurfaceBox => {
  const { x: basePadX } = gameSurfacePadding(fontSize);
  const padY = gameVerticalContentMargin(fontSize);
  // THE FOLD IS NOT A WRITING AREA. The rolled part of the surface is physical
  // decoration, so it is removed from the content region before anything is
  // laid out inside it.
  const padX = basePadX + Math.max(0, foldInset);
  const requested = Math.max(0, contentMargin);
  const gutter = Math.max(0, tagGutter);
  const startInset = Math.max(
    padX + gutter,
    Number.isFinite(contentStartInset) ? (contentStartInset as number) : padX + gutter,
  );
  const gap = Math.max(0, contentGap);
  const content = text || hiddenContent || "";
  const emptyWidth = Math.max(0.9, fontSize / 145);
  const minimumWidth = Math.max(inset * 2 + 0.32, emptyWidth);
  const estimatedTextWidth = gameEstimatedTextWidth(
    content,
    fontSize,
    Math.max(MIN_CONTENT_WIDTH, writingWidth - startInset - requested - gap - padX),
  );
  // The right edge provides the room the tag strip plus the margin plus the
  // real content need — it is never widened by margin movement on its own.
  const contentSurfaceWidth = Math.max(
    minimumWidth,
    startInset + requested + gap + estimatedTextWidth + padX,
    startInset + requested + gap + Math.max(0, measuredWidth) + visualInsets.left + visualInsets.right + padX,
  );
  // Edit and Play are deliberately identical here. `readOnlyWriting` remains
  // in the input for saved-call compatibility, but can never open a second,
  // screen-wide text box that escapes the physical surface.
  void readOnlyWriting;
  const surfaceWidth = gameSurfaceWidth(writingWidth, contentSurfaceWidth);
  const appliedGutter = Math.min(gutter, Math.max(0, startInset - padX));
  const usableWidth = Math.max(MIN_CONTENT_WIDTH, surfaceWidth - startInset - gap - padX);
  const appliedMargin = Math.min(requested, Math.max(0, usableWidth - MIN_CONTENT_WIDTH));
  const innerWritingWidth = Math.max(MIN_CONTENT_WIDTH, usableWidth - appliedMargin);
  const estimatedTextHeight = gameEstimatedTextHeight(
    content,
    fontSize,
    innerWritingWidth,
    lineSpacing,
  );
  const surfaceHeight = Math.max(
    Math.max(0.42, fontSize / 175),
    estimatedTextHeight + padY * 2,
    Math.max(0, measuredHeight) + visualInsets.top + visualInsets.bottom + padY * 2,
  );

  return {
    padX,
    padY,
    surfaceWidth,
    innerWritingWidth,
    surfaceHeight,
    contentMargin: appliedMargin,
    tagGutter: appliedGutter,
    contentStartInset: startInset,
    contentGap: gap,
    // ONE start coordinate. Everything that draws text inside this surface uses
    // this centre, so no renderer can invent its own left edge.
    contentOffsetX:
      startInset + appliedMargin + gap + innerWritingWidth / 2 - surfaceWidth / 2,

  };
};



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

export interface ScrollRange {
  min: number;
  max: number;
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
    // Use the same equal top/bottom margin as the physical writing surface.
    // The former fixed REGION_PAD was a second height system and could make the
    // scroll layout disagree with the panel that was actually drawn.
    const verticalMargin = gameVerticalContentMargin(fontSize);
    const textHeight = verticalMargin * 2 + Math.max(rowH, real !== undefined && real > 0 ? real : estimate);
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

/** Lets the first physical surface travel down until its centre reaches the viewport centre. */
export const gameScrollRange = (layout: SlateLayout): ScrollRange => ({
  min: layout.regions[0] ? layout.regions[0].centre - VIEW_H / 2 : 0,
  max: layout.maxScroll,
});

export const clampScrollTarget = (value: number, range: ScrollRange) =>
  Math.min(range.max, Math.max(range.min, value));

/** Pure signed-range scrollbar mapping shared by the DOM navigator and its tests. */
export const scrollRatio = (value: number, minimum: number, maximum: number) => {
  const span = maximum - minimum;
  return span > 0 ? Math.min(1, Math.max(0, (value - minimum) / span)) : 0;
};

export const scrollTargetAtRatio = (ratio: number, minimum: number, maximum: number) =>
  clampScrollTarget(minimum + Math.min(1, Math.max(0, ratio)) * (maximum - minimum), {
    min: minimum,
    max: maximum,
  });
