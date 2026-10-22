import type { McqPaper } from "@/lib/academia/mcq/api";
import type { AdventureQuestion } from "@/lib/academia/adventureSlots";
import { normalizeAudio, type AdventureAudio } from "@/lib/academia/adventureMix";
import { checkpointsOf, narrationsOf, normalizeCanvas, type GameCanvas } from "@/lib/games/types";
import type { Game } from "@/lib/slate/types";

export type OfflineAdventure = {
  id: string;
  canvas: GameCanvas;
  questions: AdventureQuestion[];
  pass: Record<string, number>;
  game: Game | null;
  audio: AdventureAudio;
  assetUrls: Record<string, string>;
};
export type OfflinePaper = Pick<McqPaper, "id" | "subject_id" | "title" | "questions">;
type Row = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any

/** Session copies supply the question and answer; a linked paper supplies practice. */
export function sessionPaper(activity: Row, items: Row[], papers: OfflinePaper[]): OfflinePaper {
  const source = papers.find((p) => p.id === activity.ref_id);
  return { id: activity.id, subject_id: source?.subject_id ?? "", title: activity.title,
    questions: items.filter((r) => r.activity_id === activity.id).map((r) => ({
      n: r.n, text: r.text, options: r.options, answer: r.answer,
      solution: source?.questions.find((q) => q.n === r.n)?.solution ?? null,
    })) };
}

export const adventureAssetUrl = (activity: string, path: string) =>
  `/api/public/academia-media?activity=${encodeURIComponent(activity)}&adventureAsset=${encodeURIComponent(path)}`;

/** Only media actually rendered by the linked Adventure can be served publicly. */
export function adventureMediaPaths(raw: unknown, audio: unknown): string[] {
  const canvas = normalizeCanvas(raw as GameCanvas);
  const paths = new Set<string>();
  if (canvas.video?.source !== "url" && canvas.video?.path) paths.add(canvas.video.path);
  for (const n of narrationsOf(canvas)) if (n.source !== "url") paths.add(n.path);
  const music = normalizeAudio(audio).music?.path;
  if (music) paths.add(music);
  const visit = (value: unknown) => {
    if (!value || typeof value !== "object") return;
    const r = value as Row;
    if (r.source !== "url" && typeof r.storagePath === "string") paths.add(r.storagePath);
    if (r.effectSource !== "url" && typeof r.effectStoragePath === "string") paths.add(r.effectStoragePath);
    for (const child of Object.values(r)) if (child && typeof child === "object") visit(child);
  };
  checkpointsOf(canvas).forEach(visit);
  return [...paths].filter((p) => p && !p.includes("..") && p.length <= 400);
}

/** Stable public addresses replace expiring storage links before caching. */
export function offlineAdventureCanvas(activityId: string, raw: unknown): GameCanvas {
  const canvas = normalizeCanvas(raw as GameCanvas);
  const convert = (value: unknown): unknown => {
    if (Array.isArray(value)) return value.map(convert);
    if (!value || typeof value !== "object") return value;
    const r = Object.fromEntries(Object.entries(value).map(([k, v]) => [k, convert(v)])) as Row;
    if (r.storagePath && r.source !== "url") { r.storagePath = adventureAssetUrl(activityId, r.storagePath); r.source = "url"; }
    if (r.effectStoragePath && r.effectSource !== "url") { r.effectStoragePath = adventureAssetUrl(activityId, r.effectStoragePath); r.effectSource = "url"; }
    return r;
  };
  const converted = convert(canvas) as GameCanvas;
  if (canvas.video) converted.video = { ...canvas.video, source: "url", path: canvas.video.source === "url" ? canvas.video.path : adventureAssetUrl(activityId, canvas.video.path) };
  converted.narrations = narrationsOf(canvas).map((n) => ({ ...n, source: "url", path: n.source === "url" ? n.path : adventureAssetUrl(activityId, n.path) }));
  return converted;
}

export function copiedAdventureQuestion(r: Row): AdventureQuestion {
  return { id: r.id, activityId: r.activity_id, sceneId: r.scene_id, barId: r.bar_id,
    position: r.position ?? 0, title: r.title ?? "", questionText: r.question_text ?? null,
    lines: r.lines ?? [], objects: r.objects ?? null, totalMarks: Number(r.total_marks) || 0,
    subsectionId: r.subsection_id ?? null, notebookId: r.notebook_id ?? null };
}
