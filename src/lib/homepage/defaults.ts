// Shipped homepage defaults. These are the artwork and scene the platform falls
// back to whenever an account has not chosen its own — and what the revert
// button restores.
import defaultSky from "@/assets/adventure/default-sky-background.mp4.asset.json";

/** The default layer behind the rotating building: a looping sky video. */
export const DEFAULT_BACKGROUND = {
  url: defaultSky.url,
  mediaType: "video" as const,
};
