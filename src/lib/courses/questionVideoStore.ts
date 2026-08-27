// Reading / writing the teaching-video record for one Exercise Card question.
//
// The record is tiny: the storage path of the ONE uploaded video plus the
// segments that slice it into sections. No marks, no answers, no state.
//
// It is stored inside the Exercise Card's own settings
// (`course_blocks.config.questionVideos[questionId]`) — the card already exists,
// its owner may write it and learners may read it, so no separate store is
// needed and nothing here depends on a new table.
import { supabase } from "@/integrations/supabase/client";
import { emptyVideoConfig, type QuestionVideoConfig } from "./questionVideo";

type Db = { from: (t: string) => any };
const db = supabase as unknown as Db;

const TABLE = "course_blocks";
/** The key inside the Exercise Card config that holds every question's video. */
export const VIDEO_CONFIG_KEY = "questionVideos";

type StoredVideo = {
  videoPath?: string | null;
  duration?: number | null;
  checkpoints?: Record<string, number> | null;
  segments?: { key: string; start: number; end: number }[] | null;
  introEnabled?: boolean | null;
  conclusionEnabled?: boolean | null;
};

type BlockConfig = Record<string, unknown> & {
  [VIDEO_CONFIG_KEY]?: Record<string, StoredVideo> | null;
};

const toConfig = (row: StoredVideo | null | undefined): QuestionVideoConfig | null => {
  if (!row) return null;
  return {
    videoPath: row.videoPath ?? null,
    duration: Number(row.duration) || 0,
    checkpoints: (row.checkpoints ?? {}) as Record<string, number>,
    segments: Array.isArray(row.segments) ? row.segments : [],
    introEnabled: !!row.introEnabled,
    conclusionEnabled: !!row.conclusionEnabled,
  };
};

/** The whole Exercise Card config plus its video map. */
const readConfig = async (blockId: string): Promise<BlockConfig> => {
  const { data, error } = await db.from(TABLE).select("config").eq("id", blockId).maybeSingle();
  if (error) throw new Error(error.message ?? "Could not read this exercise card.");
  const config = (data as { config?: BlockConfig } | null)?.config;
  return (config && typeof config === "object" ? config : {}) as BlockConfig;
};

const videoMap = (config: BlockConfig): Record<string, StoredVideo> => {
  const map = config[VIDEO_CONFIG_KEY];
  return map && typeof map === "object" ? { ...(map as Record<string, StoredVideo>) } : {};
};

/** The video config for one question of an Exercise Card, or null. */
export const loadQuestionVideo = async (
  blockId: string,
  questionId: string,
): Promise<QuestionVideoConfig | null> => {
  try {
    const config = await readConfig(blockId);
    return toConfig(videoMap(config)[questionId]);
  } catch {
    return null;
  }
};

/** Which questions of one Exercise Card have a teaching video. */
export const loadCardVideoFlags = async (blockId: string): Promise<Set<string>> => {
  const out = new Set<string>();
  try {
    const map = videoMap(await readConfig(blockId));
    for (const [questionId, row] of Object.entries(map)) {
      if (row?.videoPath) out.add(questionId);
    }
  } catch {
    /* no videos readable — the card simply shows none */
  }
  return out;
};

const writeMap = async (blockId: string, map: Record<string, StoredVideo>): Promise<void> => {
  const config = await readConfig(blockId);
  const next: BlockConfig = { ...config, [VIDEO_CONFIG_KEY]: map };
  const { error } = await db.from(TABLE).update({ config: next }).eq("id", blockId);
  if (error) throw new Error(error.message ?? "Could not save the video.");
};

/** Teacher-side save (owner only, enforced by the exercise card's own policy). */
export const saveQuestionVideo = async (
  blockId: string,
  questionId: string,
  cfg: QuestionVideoConfig,
): Promise<void> => {
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user?.id) throw new Error("not_signed_in");

  const config = await readConfig(blockId);
  const map = videoMap(config);
  map[questionId] = {
    videoPath: cfg.videoPath,
    duration: cfg.duration,
    checkpoints: cfg.checkpoints,
    segments: cfg.segments,
    introEnabled: cfg.introEnabled,
    conclusionEnabled: cfg.conclusionEnabled,
  };
  const next: BlockConfig = { ...config, [VIDEO_CONFIG_KEY]: map };
  const { error } = await db.from(TABLE).update({ config: next }).eq("id", blockId);
  if (error) throw new Error(error.message ?? "Could not save the video.");
};

export const removeQuestionVideo = async (blockId: string, questionId: string): Promise<void> => {
  const map = videoMap(await readConfig(blockId));
  if (!(questionId in map)) return;
  delete map[questionId];
  await writeMap(blockId, map);
};

export { emptyVideoConfig };
