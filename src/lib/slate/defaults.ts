import type { Game, GameSettings, GameStatus, NumberSettings, Slot } from "./types";
import { defaultScene } from "./environments";
import { roomForSurface } from "./rooms";
import { defaultTextSettings } from "./text3d";

export const uid = () => Math.random().toString(36).slice(2, 10);

export const defaultNumberSettings = (): NumberSettings => ({
  visible: true,
  colour: null,
  opacity: 0.6,
  size: 1,
  depth: 1,
  bevel: 1,
  shadow: 1,
  contrast: 1,
  align: "left",
  vertical: "top",
  relief: "auto",
  swatches: [],
});

export const defaultSettings = (): GameSettings => ({
  slate: { scale: 1, width: 860, slotSpacing: 22, slotMinHeight: 96, slotPadding: 22 },
  text: defaultTextSettings(),
  numbers: defaultNumberSettings(),
  writing: {
    size: 30,
    depth: 1,
    bevel: 1,
    shadow: 1,
    highlight: 1,
    opacity: 1,
    style: "material",
  },
  rewards: { visible: true, opacity: 0.45, glow: 0.35, scale: 1 },
  effects: { speed: 1, glow: 1, particles: 1, duration: 3.5, testMode: true },
});

export const defaultGameStatus = (): GameStatus => ({
  coins: 0,
  lives: 3,
  timerEndsAt: null,
});

export const makeSlot = (index = 0): Slot => ({
  id: uid(),
  text: "",
  hiddenContent: "",
  contentState: "hidden",
  rewards: [],
  scene: defaultScene(index),
});

export const makeGame = (input: {
  name: string;
  topic: string;
  subtopic: string;
  surfaceId: string;
  lines: number;
  background: Game["background"];
  roomId?: string;
}): Game => ({
  id: typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID() : uid(),
  name: input.name.trim() || "Untitled Game",
  topic: input.topic.trim(),
  subtopic: input.subtopic.trim(),
  surfaceId: input.surfaceId,
  roomId: input.roomId ?? roomForSurface(input.surfaceId).id,
  background: input.background,
  slots: Array.from({ length: Math.max(1, input.lines) }, (_, index) => makeSlot(index)),
  patternLength: Math.max(1, input.lines),
  settings: defaultSettings(),
  status: defaultGameStatus(),
  updatedAt: Date.now(),
});
