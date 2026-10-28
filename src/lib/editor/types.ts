export interface Clip {
  id: string;
  /** in-point in the ORIGINAL source video, seconds */
  sourceStart: number;
  /** out-point in the ORIGINAL source video, seconds */
  sourceEnd: number;
}

export interface Segment {
  clip: Clip;
  index: number;
  tlStart: number;
  tlEnd: number;
}

export interface ProjectState {
  title: string;
  clips: Clip[];
}

export type StageStatus = "complete" | "editing" | "locked";

export interface StageInfo {
  id: number;
  name: string;
  summary: string;
  status: StageStatus;
}

export const MIN_CLIP_DURATION = 0.1;
export const FRAME = 1 / 30;

export function makeId(): string {
  return Math.random().toString(36).slice(2, 10);
}

export function createEmptyProject(): ProjectState {
  return { title: "Untitled lesson", clips: [] };
}

export function clipDuration(clip: Clip): number {
  return Math.max(0, clip.sourceEnd - clip.sourceStart);
}

export function buildSegments(clips: Clip[]): Segment[] {
  let cursor = 0;
  return clips.map((clip, index) => {
    const tlStart = cursor;
    cursor += clipDuration(clip);
    return { clip, index, tlStart, tlEnd: cursor };
  });
}

export function totalDuration(clips: Clip[]): number {
  return clips.reduce((sum, c) => sum + clipDuration(c), 0);
}

export function segmentAt(segments: Segment[], tlTime: number): Segment | undefined {
  if (segments.length === 0) return undefined;
  for (const seg of segments) {
    if (tlTime >= seg.tlStart && tlTime < seg.tlEnd) return seg;
  }
  return segments[segments.length - 1];
}

export function timelineToSource(segments: Segment[], tlTime: number): number | undefined {
  const seg = segmentAt(segments, tlTime);
  if (!seg) return undefined;
  const offset = Math.min(Math.max(tlTime - seg.tlStart, 0), clipDuration(seg.clip));
  return seg.clip.sourceStart + offset;
}

export function formatTimecode(seconds: number, withCentis = true): string {
  if (!Number.isFinite(seconds) || seconds < 0) seconds = 0;
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  const cs = Math.floor((seconds % 1) * 100);
  const pad = (n: number) => n.toString().padStart(2, "0");
  const base = h > 0 ? `${pad(h)}:${pad(m)}:${pad(s)}` : `${pad(m)}:${pad(s)}`;
  return withCentis ? `${base}.${pad(cs)}` : base;
}