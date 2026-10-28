import type { SubtitleSettings } from "./workflow";

export interface Cue {
  start: number;
  end: number;
  lines: string[];
}

function wrap(text: string, maxChars: number, maxLines: number): string[] {
  const words = text.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let current = "";
  for (const word of words) {
    if (current && current.length + word.length + 1 > maxChars) {
      lines.push(current);
      current = word;
    } else {
      current = current ? `${current} ${word}` : word;
    }
  }
  if (current) lines.push(current);
  if (lines.length <= maxLines) return lines;
  const kept = lines.slice(0, maxLines - 1);
  kept.push(lines.slice(maxLines - 1).join(" "));
  return kept;
}

export function buildCues(
  segments: { start: number; end: number; text: string }[],
  settings: SubtitleSettings,
): Cue[] {
  return segments
    .filter((s) => s.text.trim())
    .map((s) => ({
      start: s.start,
      end: Math.max(s.end, s.start + 0.4),
      lines: wrap(s.text.trim(), settings.maxCharsPerLine, settings.maxLines),
    }));
}

function stamp(seconds: number, comma: boolean): string {
  const total = Math.max(0, seconds);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = Math.floor(total % 60);
  const ms = Math.floor((total % 1) * 1000);
  const pad = (n: number, size = 2) => n.toString().padStart(size, "0");
  return `${pad(h)}:${pad(m)}:${pad(s)}${comma ? "," : "."}${pad(ms, 3)}`;
}

export function toSrt(cues: Cue[]): string {
  return cues
    .map((cue, i) =>
      [`${i + 1}`, `${stamp(cue.start, true)} --> ${stamp(cue.end, true)}`, ...cue.lines, ""].join("\n"),
    )
    .join("\n");
}

export function toVtt(cues: Cue[]): string {
  return [
    "WEBVTT",
    "",
    ...cues.map((cue) =>
      [`${stamp(cue.start, false)} --> ${stamp(cue.end, false)}`, ...cue.lines, ""].join("\n"),
    ),
  ].join("\n");
}

export function cueAt(cues: Cue[], time: number): Cue | undefined {
  return cues.find((cue) => time >= cue.start && time < cue.end);
}

export function download(name: string, content: Blob | string, type = "text/plain") {
  const blob = typeof content === "string" ? new Blob([content], { type }) : content;
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = name;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}
