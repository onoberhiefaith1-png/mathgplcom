// Games live on the teacher's account, not in one browser.
// The function names are unchanged from the browser-only version; they are
// simply asynchronous now.

import { supabase } from "@/integrations/supabase/client";
import { putAsset } from "./assets";
import type { Game } from "./types";
import { defaultScene } from "./environments";
import { roomForSurface } from "./rooms";
import { defaultTextSettings } from "./text3d";
import { normalizeLineConfig } from "./lineSurfaces";
import {
  defaultAssetSettings,
  defaultGameStatus,
  defaultNumberSettings,
  defaultSettings,
} from "./defaults";

const LOCAL_KEY = "game-slate:games";
const IMPORTED_KEY = "game-slate:imported";

/** Fill in anything an older draft is missing. Never drops teacher work. */
export const normalizeGame = (game: Game): Game => ({
  ...game,
  surfaceColour: game.surfaceColour ?? "#f4ead7",
  roomId: game.roomId ?? roomForSurface(game.surfaceId).id,
  background: {
    src: game.background?.src ?? null,
    assetId: game.background?.assetId ?? null,
    kind: game.background?.kind === "video" ? "video" : "image",
    scale: game.background?.scale ?? 1,
    x: game.background?.x ?? 0,
    y: game.background?.y ?? 0,
    opacity: game.background?.opacity ?? 1,
  },
  status: { ...defaultGameStatus(), ...(game.status ?? {}) },
  settings: {
    ...defaultSettings(),
    ...(game.settings ?? {}),
    text: { ...defaultTextSettings(), ...(game.settings?.text ?? {}) },
    numbers: { ...defaultNumberSettings(), ...(game.settings?.numbers ?? {}) },
    assets: { ...defaultAssetSettings(), ...(game.settings?.assets ?? {}) },
    effects: { ...defaultSettings().effects, ...(game.settings?.effects ?? {}) },
    // Per-Floating-Numbers-line configuration, keyed by line id.
    lines: Object.fromEntries(
      Object.entries(game.settings?.lines ?? {}).map(([lineId, config]) => [
        lineId,
        normalizeLineConfig(lineId, config),
      ]),
    ),
    life: {
      multiplier: Math.min(10, Math.max(0.1,
        Number(game.settings?.life?.multiplier)
        || ({ full: 1, half: 0.5, third: 1 / 3, quarter: 0.25 } as const)[game.settings?.life?.fraction ?? "full"]
        || 1,
      )),
    },
  },
  patternLength:
    Number(game.patternLength) > 0 ? Math.floor(Number(game.patternLength)) : game.slots.length,
  slots: (Array.isArray(game.slots) && game.slots.length > 0 ? game.slots : [
    {
      id: `recovery-${game.id}`,
      text: "",
      hiddenContent: "",
      contentState: "hidden" as const,
      rewards: [],
      scene: defaultScene(0),
    },
  ]).map((slot, index) => ({
    ...slot,
    scene: { ...defaultScene(index), ...(slot.scene ?? {}) },
    rewards: (slot.rewards ?? []).map((reward) => ({
      z: 0, scale: 1, rotation: 0, lighting: 1, animation: 1,
      effectIntensity: 1, material: "metal" as const, colour: "natural" as const,
      relief: "raised" as const, ...reward,
      // the Math Coin has been replaced by the Math Vault
      type: reward.type === "math-coin" ? "math-vault" : reward.type,
    })),
  })),
});

interface Row {
  id: string;
  name: string;
  topic: string;
  subtopic: string;
  surface_id: string;
  surface_colour: string | null;
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
    surfaceColour: row.surface_colour ?? "#f4ead7",
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
  surface_colour: game.surfaceColour ?? "#f4ead7",
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

/** Saves a game and explains, in plain words, why it could not be saved. */
export const saveGameResult = async (
  game: Game,
): Promise<{ ok: boolean; message?: string }> => {
  const { data } = await supabase.auth.getSession();
  if (!data.session) {
    return { ok: false, message: "You are signed out. Sign in again to create a game." };
  }
  if (!Array.isArray(game.slots) || game.slots.length === 0) {
    return {
      ok: false,
      message: "The writing surfaces are still loading. Your existing Game was not overwritten.",
    };
  }
  // A background still living in this browser (data/blob URL) is uploaded to
  // the account first, so the saved row only ever stores a small storage path.
  let toSave = game;
  const src = game.background?.src ?? "";
  if (!game.background?.assetId && /^(data|blob):/.test(src)) {
    try {
      const blob = await (await fetch(src)).blob();
      const file = new File([blob], "background", { type: blob.type || "image/png" });
      const assetId = await putAsset(file);
      toSave = {
        ...game,
        background: { ...game.background, src: null, assetId, kind: file.type.startsWith("video") ? "video" : "image" },
      };
    } catch (err) {
      return { ok: false, message: err instanceof Error ? err.message : "The background could not be uploaded." };
    }
  }
  const { error } = await supabase.from("slate_games").upsert(toRow(toSave) as never);
  if (!error) return { ok: true };
  console.error("[slate] save failed", error);
  const denied = error.code === "42501" || /row-level security|permission/i.test(error.message);
  return {
    ok: false,
    message: denied
      ? "This game could not be saved to your account. Sign out and sign in again, then try once more."
      : error.message,
  };
};

export const saveGame = async (game: Game): Promise<boolean> =>
  (await saveGameResult(game)).ok;

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
