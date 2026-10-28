import type { GameCompletionFlow } from "@/lib/slate/types";

/** Exact references on the attached public Game only; never a whole Flow. */
export function isCompletionClipPath(flow: Pick<GameCompletionFlow, "clips"> | null | undefined, path: string): boolean {
  return !!path && !path.includes("..") && !!flow?.clips?.some(clip => clip.path === path || clip.processedPath === path);
}