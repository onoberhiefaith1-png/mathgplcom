/**
 * What the Game surface needs on a device so it still paints fully with no
 * network: the bundled castle (shown under the Adventure video whenever it has
 * no frame), the writing-surface frames, the Game fonts, and a pure rule for
 * when the fallback backdrop and a notice are shown. No browser needed.
 */
import { DEFAULT_GAME_BACKGROUND_URL } from "@/components/imagine/defaultBackground";
import { surfacePicture } from "@/lib/imagine/surfaceSkins";

/** Bundled castle picture: ships with the app, never needs the network. */
export const CASTLE_URL = DEFAULT_GAME_BACKGROUND_URL;

/** The Game's writing fonts (public/fonts). Tiny; saved once with the app. */
export const GAME_FONT_URLS: readonly string[] = [
  "inscription", "hero", "crystal", "handwritten", "runic", "technical", "chalk", "royal", "mechanical", "glow",
].map((name) => `/fonts/${name}.ttf`);

type GameLike = { surfaceId?: unknown; slots?: unknown } | null | undefined;

/** Plain (unmarked) addresses of the look files one Game paints with. */
export function gameLookUrls(game: GameLike): string[] {
  const out = new Set<string>([CASTLE_URL, ...GAME_FONT_URLS]);
  const ids = new Set<string>(["scroll"]);
  if (game && typeof game.surfaceId === "string") ids.add(game.surfaceId);
  if (game && Array.isArray(game.slots)) {
    for (const slot of game.slots) {
      const id = (slot as { surfaceId?: unknown } | null)?.surfaceId;
      if (typeof id === "string") ids.add(id);
    }
  }
  for (const id of ids) {
    const picture = surfacePicture(id);
    if (picture) out.add(picture);
  }
  return [...out];
}

/** Items of `wanted` that are not in `saved`, in order, without repeats. */
export function missingFrom(wanted: readonly string[], saved: ReadonlySet<string>): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const url of wanted) {
    if (saved.has(url) || seen.has(url)) continue;
    seen.add(url);
    out.push(url);
  }
  return out;
}

export type Backdrop = {
  /** The video is painted only once it has a frame and has not failed. */
  showVideo: boolean;
  /** A short line for the student, or null when nothing is wrong. */
  notice: string | null;
};

/**
 * The castle is always painted beneath the video, so a missing video never
 * leaves a black screen. The notice appears only after play began and the
 * video still has no frame (or failed).
 */
export function backdropFor(input: { frame: boolean; failed: boolean; started: boolean; online: boolean }): Backdrop {
  const showVideo = input.frame && !input.failed;
  return { showVideo, notice: !showVideo && input.started ? failedNotice(input.online) : null };
}

function failedNotice(online: boolean): string {
  return online
    ? "The video is still loading. You can keep working."
    : "This video is not saved on this device yet. Connect once and press Update to save it. You can keep working.";
}
