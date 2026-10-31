import type { FloatingLine } from "@/lib/lessonnotes/floatingCompile";

type HighlightIdentity = Pick<FloatingLine, "lineId" | "sourceUid" | "questionId" | "groupId" | "equation" | "noteObjects">;

/** Opening a highlighted line restores its saved chips, or an EMPTY workspace.
 * No payload parsing, chip generation or automatic migration belongs here. */
export function restoreFloatingHighlight(saved: FloatingLine | undefined, source: HighlightIdentity): FloatingLine {
  return {
    ...(saved ?? { fillers: [], containers: [], arrangement: [] }),
    ...source,
    lineId: saved?.lineId ?? source.lineId,
  };
}
