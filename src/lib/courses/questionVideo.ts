// Interactive teaching video — pure section model.
//
// ONE uploaded video per question. The teacher marks where each section ENDS;
// the previous checkpoint is automatically the next section's start. The
// sections mirror the question's own mathematical lines, so the existing line
// state (Floating Numbers / Present) is the only thing that drives playback.
//
// Nothing here touches the mathematics, marking or evaluation engines: this
// module only answers "which slice of the video belongs to this line?".

export const INTRO_KEY = "intro";
export const CONCLUSION_KEY = "conclusion";

export const lineKey = (lineId: string): string => `line:${lineId}`;

/**
 * An explicit playback marker pair inside the ONE uploaded video.
 *
 * `null` means the teacher has NOT chosen that boundary yet — it is never the
 * same thing as second 0. `startSource` records whether the start was prepared
 * automatically from the section above (end + 1s) or typed by the teacher; a
 * manual start is never overwritten.
 */
export interface VideoSegmentMarker {
  key: string;
  start: number | null;
  end: number | null;
  startSource?: "auto" | "manual";
}

export interface QuestionVideoConfig {
  videoPath: string | null;
  duration: number;
  /** Legacy shape: section key → the second the section ENDS at. */
  checkpoints: Record<string, number>;
  /** Explicit start/end markers per section — the file is never split. */
  segments: VideoSegmentMarker[];
  introEnabled: boolean;
  conclusionEnabled: boolean;
}

export interface VideoLine {
  lineId: string;
  label: string;
  /**
   * Display-only echo of this line's OWN floating-number content (chips, else
   * the equation text). `null` means the line has no floating-number content —
   * shown as NULL. It never affects numbering, ordering or video mapping:
   * `lineId` remains the single source of truth.
   */
  preview?: string | null;
}

export interface VideoSection {
  key: string;
  label: string;
  /** Playable start — the stored start, or 0 when nothing is stored. */
  start: number;
  /** Playable end — the stored end, or the end of the file when unstored. */
  end: number;
  /** Exactly what the teacher chose; null means "Not set". */
  startAt: number | null;
  endAt: number | null;
  startSource: "auto" | "manual";
  /** True only when BOTH boundaries were chosen. */
  configured: boolean;
  /** Mathematical lines are mandatory; intro/conclusion are optional. */
  required: boolean;
  lineId: string | null;
  /** Display-only floating-number echo; null = NULL (no floating content). */
  preview: string | null;
}

export const emptyVideoConfig = (): QuestionVideoConfig => ({
  videoPath: null,
  duration: 0,
  checkpoints: {},
  segments: [],
  introEnabled: false,
  conclusionEnabled: false,
});

/** The gap the next section's prepared start leaves after an end point. */
export const NEXT_START_GAP = 1;


const num = (v: unknown): number | null =>
  v === null || v === undefined || v === "" || !Number.isFinite(Number(v)) ? null : Number(v);

/**
 * The ordered sections of the video: optional Introduction, every mathematical
 * line in order, then the optional Conclusion.
 *
 * Markers, never files, and NEVER chained: each section reports exactly the
 * boundaries the teacher chose for its own key (`line:<lineId>`), so a gap or
 * an overlap with its neighbour is preserved as written and editing one section
 * can never move another. A missing boundary stays missing (`null`).
 *
 * Legacy end-only `checkpoints` records are adopted once, chained as they were
 * originally written, so an already-saved video keeps playing.
 */
export const sectionsFor = (
  lines: VideoLine[],
  cfg: QuestionVideoConfig | null | undefined,
): VideoSection[] => {
  const duration = Math.max(0, num(cfg?.duration) ?? 0);
  const entries: { key: string; label: string; required: boolean; lineId: string | null }[] = [];
  if (cfg?.introEnabled) entries.push({ key: INTRO_KEY, label: "Introduction", required: false, lineId: null });
  lines.forEach((l, i) => {
    entries.push({
      key: lineKey(l.lineId),
      label: l.label || `Line ${i + 1}`,
      required: true,
      lineId: l.lineId,
    });
  });
  if (cfg?.conclusionEnabled) {
    entries.push({ key: CONCLUSION_KEY, label: "Conclusion", required: false, lineId: null });
  }
  if (entries.length === 0) return [];

  const markers = new Map<string, VideoSegmentMarker>();
  for (const m of cfg?.segments ?? []) {
    if (m && typeof m.key === "string") markers.set(m.key, m);
  }
  const hasMarkers = markers.size > 0;

  // Legacy adoption: the old records only stored each section's END, with the
  // start implied by the section above. Rebuild that chain once so nothing that
  // was already authored loses its ranges.
  const legacy = new Map<string, { start: number; end: number }>();
  if (!hasMarkers && cfg?.checkpoints && Object.keys(cfg.checkpoints).length > 0) {
    let prev = 0;
    entries.forEach((entry) => {
      const end = num(cfg.checkpoints?.[entry.key]);
      if (end === null) return;
      legacy.set(entry.key, { start: prev, end: Math.max(prev, end) });
      prev = Math.max(prev, end);
    });
  }

  return entries.map((entry) => {
    const marker = markers.get(entry.key);
    const fallback = legacy.get(entry.key);
    const startAt = marker ? num(marker.start) : (fallback?.start ?? null);
    const endAt = marker ? num(marker.end) : (fallback?.end ?? null);
    const start = startAt ?? 0;
    const end = endAt ?? (duration > 0 ? duration : 0);
    return {
      ...entry,
      startAt,
      endAt,
      startSource: marker?.startSource === "auto" ? "auto" : "manual",
      configured: startAt !== null && endAt !== null,
      start,
      end: Math.max(start, end),
    } satisfies VideoSection;
  });
};

/**
 * Sections whose OWN boundaries run backwards — the only genuinely invalid
 * state. Gaps and overlaps between neighbours are the teacher's choice.
 */
export const emptySectionsFor = (sections: VideoSection[]): string[] =>
  sections
    .filter((s) => s.startAt !== null && s.endAt !== null && !(s.endAt - s.startAt > 0.05))
    .map((s) => s.key);

/** The explicit marker list for the sections currently shown to the teacher. */
export const markersFor = (sections: VideoSection[]): VideoSegmentMarker[] =>
  sections.map((s) => ({ key: s.key, start: s.startAt, end: s.endAt, startSource: s.startSource }));

/**
 * Write one boundary of one section, by key, and prepare the NEXT section's
 * start (end + 1s) when an end is confirmed and that next start is either unset
 * or itself auto-prepared. Nothing else is ever touched: the previous section's
 * end stays exactly where the teacher put it.
 */
export const writeBoundary = (
  sections: VideoSection[],
  key: string,
  field: "start" | "end",
  seconds: number | null,
): VideoSegmentMarker[] => {
  const markers = markersFor(sections);
  const i = markers.findIndex((m) => m.key === key);
  if (i < 0) return markers;
  const value = seconds === null ? null : Math.max(0, seconds);
  const target = markers[i]!;
  markers[i] =
    field === "start"
      ? { ...target, start: value, startSource: "manual" }
      : { ...target, end: value };

  if (field === "end" && value !== null) {
    const next = markers[i + 1];
    if (next && (next.start === null || next.startSource === "auto")) {
      markers[i + 1] = { ...next, start: value + NEXT_START_GAP, startSource: "auto" };
    }
  }
  return markers;
};


/** The teaching section for one mathematical line, or null. */
export const sectionForLine = (sections: VideoSection[], lineId: string | null): VideoSection | null => {
  if (!lineId) return null;
  return sections.find((s) => s.lineId === lineId) ?? null;
};

export const sectionIndex = (sections: VideoSection[], key: string | null): number =>
  key ? sections.findIndex((s) => s.key === key) : -1;

/** Video-only navigation — never touches the mathematical state. */
export const nextSection = (sections: VideoSection[], key: string | null): VideoSection | null => {
  const i = sectionIndex(sections, key);
  if (i < 0) return sections[0] ?? null;
  return sections[i + 1] ?? null;
};

export const prevSection = (sections: VideoSection[], key: string | null): VideoSection | null => {
  const i = sectionIndex(sections, key);
  if (i <= 0) return null;
  return sections[i - 1] ?? null;
};

/**
 * Returning to a line that is already correct must NOT replay its explanation;
 * a line that is not yet correct plays again.
 */
export const shouldAutoPlay = (input: { lineCompleted: boolean }): boolean => !input.lineCompleted;

/** True when this question has a usable teaching video. */
export const videoReady = (cfg: QuestionVideoConfig | null | undefined): boolean =>
  !!cfg?.videoPath && Math.max(0, num(cfg?.duration) ?? 0) > 0;

export { fmtClock, parseClock } from "@/lib/games/timerVideo";

/**
 * The mathematical lines of one compiled question, in board order, as video
 * sections. Standalone notes carry no line of their own, so they are skipped.
 */
export const videoLinesFromQuestion = (
  lines: { lineId?: string | null; noteOnly?: boolean }[] | null | undefined,
): VideoLine[] => {
  const out: VideoLine[] = [];
  for (const l of lines ?? []) {
    if (!l?.lineId || l.noteOnly) continue;
    out.push({ lineId: l.lineId, label: `Line ${out.length + 1}` });
  }
  return out;
};

/**
 * Keys whose CONFIGURED ranges overlap the previous configured section. Purely
 * informational: overlapping ranges are legal, because a range only says where
 * playback starts and stops. Nothing is ever corrected from this.
 */
export const overlapsFor = (sections: VideoSection[]): string[] => {
  const bad = new Set<string>();
  const done = sections.filter((s) => s.configured);
  done.forEach((s, i) => {
    const prev = done[i - 1];
    if (prev && s.start < prev.end) { bad.add(s.key); bad.add(prev.key); }
  });
  return [...bad];
};
