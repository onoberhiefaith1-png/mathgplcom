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

/** An explicit playback marker pair inside the ONE uploaded video. */
export interface VideoSegmentMarker {
  key: string;
  start: number;
  end: number;
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
}

export interface VideoSection {
  key: string;
  label: string;
  start: number;
  end: number;
  /** Mathematical lines are mandatory; intro/conclusion are optional. */
  required: boolean;
  lineId: string | null;
}

export const emptyVideoConfig = (): QuestionVideoConfig => ({
  videoPath: null,
  duration: 0,
  checkpoints: {},
  segments: [],
  introEnabled: false,
  conclusionEnabled: false,
});

const num = (v: unknown): number | null => (Number.isFinite(Number(v)) ? Number(v) : null);
const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

/**
 * The ordered sections of the video: optional Introduction, every mathematical
 * line in order, then the optional Conclusion.
 *
 * Markers, never files. An explicit `segments` entry wins; otherwise the older
 * end-only `checkpoints` chain is used; otherwise the video is split evenly.
 * Every value is clamped inside the file and `end` never precedes `start`.
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

  const slice = duration / entries.length;
  const out: VideoSection[] = [];
  let prev = 0;
  entries.forEach((entry, i) => {
    const isLast = i === entries.length - 1;
    const marker = markers.get(entry.key);
    const mStart = num(marker?.start);
    const mEnd = num(marker?.end);

    if (mStart !== null || mEnd !== null) {
      // A boundary the teacher wrote is kept as written, with one repair: a
      // start that is not BEFORE its own end would make a section of no
      // duration, so it falls back to the boundary above it. The running
      // cursor always advances, so the next section chains from this end.
      const writtenStart = mStart ?? prev;
      const writtenEnd = mEnd ?? duration;
      const collapsed = !(writtenStart < writtenEnd);
      const start = clamp(collapsed ? prev : writtenStart, 0, duration || Infinity);
      // A section with no usable end runs to the next written boundary, or to
      // the end of the file for the last one.
      const nextWritten = entries
        .slice(i + 1)
        .map((e) => num(markers.get(e.key)?.start) ?? num(markers.get(e.key)?.end))
        .find((v): v is number => v !== null && v > start);
      const fallbackEnd = nextWritten ?? duration;
      const end = clamp(
        writtenEnd > start ? writtenEnd : fallbackEnd,
        start,
        duration || Infinity,
      );
      out.push({ ...entry, start, end });
      prev = end;
      return;
    }

    const raw = num(cfg?.checkpoints?.[entry.key]);
    let end = raw === null ? (isLast ? duration : slice * (i + 1)) : raw;
    end = clamp(end, prev, duration);
    if (isLast && raw === null) end = duration;
    out.push({ ...entry, start: prev, end });
    prev = end;
  });
  return out;
};

/** Sections that carry no playable duration — nothing to teach with. */
export const emptySectionsFor = (sections: VideoSection[]): string[] =>
  sections.filter((s) => !(s.end - s.start > 0.05)).map((s) => s.key);

/** The explicit marker list for the sections currently shown to the teacher. */
export const markersFor = (sections: VideoSection[]): VideoSegmentMarker[] =>
  sections.map((s) => ({ key: s.key, start: s.start, end: s.end }));

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
 * Keys whose ranges overlap the previous section or run backwards. Shown as a
 * quiet warning to the teacher — never silently corrected.
 */
export const overlapsFor = (sections: VideoSection[]): string[] => {
  const bad = new Set<string>();
  sections.forEach((s, i) => {
    if (s.end < s.start) bad.add(s.key);
    const prev = sections[i - 1];
    if (prev && s.start < prev.end) { bad.add(s.key); bad.add(prev.key); }
  });
  return [...bad];
};
