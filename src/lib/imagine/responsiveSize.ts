import type { ImagineSettings } from "@/lib/slate/types";

export type ImagineViewport = "desktop" | "tablet" | "phone";

export const IMAGINE_TEXT_MIN = 1;

export const IMAGINE_TEXT_RANGE = {
  desktop: { midpoint: 16, maximum: 96 },
  tablet: { midpoint: 16, maximum: 84 },
  phone: { midpoint: 14, maximum: 64 },
} as const;

const finite = (value: unknown): value is number =>
  typeof value === "number" && Number.isFinite(value);

/** Slider 0–50 reaches today's old minimum; 50–100 keeps the old useful range. */
export function imagineSliderToSize(position: number, viewport: ImagineViewport): number {
  const safe = Math.min(100, Math.max(0, Number(position) || 0));
  const range = IMAGINE_TEXT_RANGE[viewport];
  const value = safe <= 50
    ? IMAGINE_TEXT_MIN + (range.midpoint - IMAGINE_TEXT_MIN) * (safe / 50)
    : range.midpoint + (range.maximum - range.midpoint) * ((safe - 50) / 50);
  return Math.round(value * 10) / 10;
}

export function imagineSizeToSlider(size: number, viewport: ImagineViewport): number {
  const range = IMAGINE_TEXT_RANGE[viewport];
  const safe = Math.min(range.maximum, Math.max(IMAGINE_TEXT_MIN, Number(size) || range.midpoint));
  if (safe <= range.midpoint) {
    return ((safe - IMAGINE_TEXT_MIN) / (range.midpoint - IMAGINE_TEXT_MIN)) * 50;
  }
  return 50 + ((safe - range.midpoint) / (range.maximum - range.midpoint)) * 50;
}

export function imagineSavedSize(
  settings: ImagineSettings | undefined,
  viewport: ImagineViewport,
  fallback: number | undefined,
): number {
  const saved = viewport === "desktop"
    ? settings?.desktopTextSize
    : viewport === "tablet"
      ? settings?.tabletTextSize
      : settings?.mobileTextSize;
  return finite(saved) ? saved : (finite(fallback) ? fallback : IMAGINE_TEXT_RANGE[viewport].midpoint);
}

/** At the old minimum the surface is unchanged; below it, surface and text contract together. */
export function imagineSurfaceScale(size: number, viewport: ImagineViewport): number {
  const midpoint = IMAGINE_TEXT_RANGE[viewport].midpoint;
  return Math.min(1, Math.max(IMAGINE_TEXT_MIN / midpoint, size / midpoint));
}

export function scaleImagineSizes(settings: ImagineSettings | undefined, factor: number): ImagineSettings | undefined {
  if (!settings || factor === 1) return settings;
  const safe = Number.isFinite(factor) ? Math.min(3, Math.max(0.4, factor)) : 1;
  return {
    ...settings,
    ...(finite(settings.desktopTextSize) ? { desktopTextSize: settings.desktopTextSize * safe } : {}),
    ...(finite(settings.tabletTextSize) ? { tabletTextSize: settings.tabletTextSize * safe } : {}),
    ...(finite(settings.mobileTextSize) ? { mobileTextSize: settings.mobileTextSize * safe } : {}),
  };
}