import type { Game } from "./types";
import { defaultScene } from "./environments";
import { roomForSurface } from "./rooms";
import { defaultTextSettings } from "./text3d";
import { defaultGameStatus, defaultNumberSettings } from "./defaults";

const KEY = "game-slate:games";

const read = (): Game[] => {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(KEY);
    const games = raw ? (JSON.parse(raw) as Game[]) : [];
    return games.map((game) => ({
      ...game,
      roomId: game.roomId ?? roomForSurface(game.surfaceId).id,
      status: { ...defaultGameStatus(), ...(game.status ?? {}) },
      settings: {
        ...game.settings,
        text: { ...defaultTextSettings(), ...(game.settings?.text ?? {}) },
        numbers: { ...defaultNumberSettings(), ...(game.settings?.numbers ?? {}) },
      },
      slots: game.slots.map((slot, index) => ({
        ...slot,
        scene: { ...defaultScene(index), ...(slot.scene ?? {}) },
        rewards: slot.rewards.map((reward) => ({
          z: 0, scale: 1, rotation: 0, lighting: 1, animation: 1,
          effectIntensity: 1, material: "metal" as const, colour: "natural" as const,
          relief: "raised" as const, ...reward,
        })),
      })),
    }));
  } catch {
    return [];
  }
};

const write = (games: Game[]) => {
  try {
    window.localStorage.setItem(KEY, JSON.stringify(games));
    return true;
  } catch {
    return false;
  }
};

export const listGames = (): Game[] =>
  read().sort((a, b) => b.updatedAt - a.updatedAt);

export const loadGame = (id: string): Game | null =>
  read().find((g) => g.id === id) ?? null;

export const saveGame = (game: Game): boolean => {
  const games = read();
  const next = { ...game, updatedAt: Date.now() };
  const i = games.findIndex((g) => g.id === game.id);
  if (i >= 0) games[i] = next;
  else games.push(next);
  return write(games);
};

export const deleteGame = (id: string) => write(read().filter((g) => g.id !== id));
