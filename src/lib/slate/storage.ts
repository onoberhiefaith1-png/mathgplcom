// Games live on the teacher's account, not in one browser.
// The function names are unchanged from the browser-only version; they are
// simply asynchronous now.

import { supabase } from "@/integrations/supabase/client";
import type { Game } from "./types";
import { defaultScene } from "./environments";
import { roomForSurface } from "./rooms";
import { defaultTextSettings } from "./text3d";
import { defaultGameStatus, defaultNumberSettings, defaultSettings } from "./defaults";

const LOCAL_KEY = "game-slate:games";
const IMPORTED_KEY = "game-slate:imported";

/** Fill in anything an older draft is missing. Never drops teacher work. */
export const normalizeGame = (game: Game): Game => ({
  ...game,
  roomId: game.roomId ?? roomForSurface(game.surfaceId).id,
  status: { ...defaultGameStatus(), ...(game.status ?? {}) },
  settings: {
    ...defaultSettings(),
    ...(game.settings ?? {}),
    text: { ...defaultTextSettings(), ...(game.settings?.text ?? {}) },
    numbers: { ...defaultNumberSettings(), ...(game.settings?.numbers ?? {}) },
  },
  patternLength:
    Number(game.patternLength) > 0 ? Math.floor(Number(game.patternLength)) : game.slots.length,
  slots: (game.slots ?? []).map((slot, index) => ({
    ...slot,
    scene: { ...defaultScene(index), ...(slot.scene ?? {}) },
    rewards: (slot.rewards ?? []).map((reward) => ({
      z: 0, scale: 1, rotation: 0, lighting: 1, animation: 1,
      effectIntensity: 1, material: "metal" as const, colour: "natural" as const,
      relief: "raised" as const, ...reward,
    })),
  })),
});

interface Row {
  id: string;
  name: string;
  topic: string;
  subtopic: string;
  surface_id: string;
  room_id: string;
  background: unknown;
  slots: unknown;
  settings: unknown;
  status: unknown;
  pattern_length: number;
  updated_at: string;
}

const toGame = (row: Row): Game =>
  normalizeGame({
    id: row.id,
    name: row.name,
    topic: row.topic ?? "",
    subtopic: row.subtopic ?? "",
    surfaceId: row.surface_id,
    roomId: row.room_id,
    background: row.background as Game["background"],
    slots: (row.slots ?? []) as Game["slots"],
    settings: (row.settings ?? {}) as Game["settings"],
    status: (row.status ?? {}) as Game["status"],
    patternLength: row.pattern_length,
    updatedAt: new Date(row.updated_at).getTime(),
  });

const toRow = (game: Game) => ({
  id: game.id,
  name: game.name,
  topic: game.topic,
  subtopic: game.subtopic,
  surface_id: game.surfaceId,
  room_id: game.roomId,
  background: game.background as unknown,
  slots: game.slots as unknown,
  settings: game.settings as unknown,
  status: game.status as unknown,
  pattern_length: Number(game.patternLength) > 0 ? Math.floor(Number(game.patternLength)) : game.slots.length,
});

export const listGames = async (): Promise<Game[]> => {
  const { data, error } = await supabase
    .from("slate_games")
    .select("*")
    .order("updated_at", { ascending: false });
  if (error || !data) return [];
  return (data as unknown as Row[]).map(toGame);
};

export const loadGame = async (id: string): Promise<Game | null> => {
  const { data, error } = await supabase.from("slate_games").select("*").eq("id", id).maybeSingle();
  if (error || !data) return null;
  return toGame(data as unknown as Row);
};

export const saveGame = async (game: Game): Promise<boolean> => {
  const { error } = await supabase.from("slate_games").upsert(toRow(game) as never);
  return !error;
};

export const deleteGame = async (id: string): Promise<boolean> => {
  const { error } = await supabase.from("slate_games").delete().eq("id", id);
  return !error;
};

/* ── One-time rescue of games saved in this browser ─────────────────────── */

export const listLocalGames = (): Game[] => {
  if (typeof window === "undefined") return [];
  if (window.localStorage.getItem(IMPORTED_KEY) === "done") return [];
  try {
    const raw = window.localStorage.getItem(LOCAL_KEY);
    const games = raw ? (JSON.parse(raw) as Game[]) : [];
    return games.map(normalizeGame);
  } catch {
    return [];
  }
};

/** Copies every browser-saved game into the account. Returns how many landed. */
export const importLocalGames = async (): Promise<number> => {
  const games = listLocalGames();
  let saved = 0;
  for (const game of games) {
    const fresh = { ...game, id: crypto.randomUUID() };
    if (await saveGame(fresh)) saved += 1;
  }
  if (typeof window !== "undefined") window.localStorage.setItem(IMPORTED_KEY, "done");
  return saved;
};

export const dismissLocalGames = () => {
  if (typeof window !== "undefined") window.localStorage.setItem(IMPORTED_KEY, "done");
};
